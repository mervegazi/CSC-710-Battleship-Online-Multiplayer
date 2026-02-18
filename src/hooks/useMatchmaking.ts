import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

type MatchmakingStatus = "idle" | "searching" | "matched" | "error" | "timeout";

interface UseMatchmakingReturn {
    status: MatchmakingStatus;
    error: string | null;
    matchedGameId: string | null;
    matchedOpponent: string | null;
    joinQueue: () => Promise<void>;
    leaveQueue: () => Promise<void>;
}

/**
 * Creates a new game record and two games_players rows for the matched pair.
 * Returns the new game ID.
 */
async function createGame(
    player1Id: string,
    player2Id: string,
    createdBy: string
): Promise<string> {
    // Randomly decide who goes first
    const firstPlayer = Math.random() < 0.5 ? player1Id : player2Id;

    const { data: game, error: gameError } = await supabase
        .from("games")
        .insert({
            status: "setup",
            current_turn: firstPlayer,
            created_by: createdBy,
        })
        .select("id")
        .single();

    if (gameError || !game) {
        throw new Error(gameError?.message ?? "Failed to create game");
    }

    // Insert both players into games_players
    const { error: playersError } = await supabase
        .from("games_players")
        .insert([
            {
                game_id: game.id,
                player_id: player1Id,
                player_number: 1,
                board: { ships: [] },
                ready: false,
            },
            {
                game_id: game.id,
                player_id: player2Id,
                player_number: 2,
                board: { ships: [] },
                ready: false,
            },
        ]);

    if (playersError) {
        throw new Error(playersError.message);
    }

    return game.id;
}

/**
 * Fetch opponent display name from profiles table.
 */
async function getOpponentName(opponentId: string): Promise<string> {
    const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", opponentId)
        .maybeSingle();
    return data?.display_name ?? "Unknown Captain";
}

export function useMatchmaking(): UseMatchmakingReturn {
    const { user } = useAuth();
    const [status, setStatus] = useState<MatchmakingStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [matchedGameId, setMatchedGameId] = useState<string | null>(null);
    const [matchedOpponent, setMatchedOpponent] = useState<string | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const statusRef = useRef<MatchmakingStatus>("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const SEARCH_TIMEOUT_MS = 30000; // 30 seconds
    const POLL_INTERVAL_MS = 3000; // poll every 3 seconds

    // Keep a ref in sync so callbacks see the latest status
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Auto-reset timeout state back to idle after 15 seconds
    useEffect(() => {
        if (status !== "timeout") return;
        const resetTimer = setTimeout(() => {
            setStatus("idle");
            statusRef.current = "idle";
        }, 15000);
        return () => clearTimeout(resetTimer);
    }, [status]);

    /**
     * Handle a successful match — set state and fetch opponent name.
     */
    const handleMatchFound = useCallback(
        async (gameId: string, opponentId: string) => {
            // Clean up polling and timeout
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }

            const opponentName = await getOpponentName(opponentId);
            setMatchedGameId(gameId);
            setMatchedOpponent(opponentName);
            setStatus("matched");
            statusRef.current = "matched";
        },
        []
    );

    /**
     * Subscribe to `games_players` inserts for the current user.
     * When another player creates a game that includes us, we get notified.
     */
    const subscribeToMatch = useCallback(() => {
        if (!user) return;

        // Clean up any previous subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel("matchmaking-" + user.id)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "games_players",
                    filter: `player_id=eq.${user.id}`,
                },
                async (payload) => {
                    // Only react if we are still searching
                    if (statusRef.current === "searching") {
                        const gameId = (payload.new as { game_id: string }).game_id;

                        // Find opponent from games_players
                        const { data: players } = await supabase
                            .from("games_players")
                            .select("player_id")
                            .eq("game_id", gameId)
                            .neq("player_id", user.id)
                            .maybeSingle();

                        const opponentId = players?.player_id ?? "";

                        // Clean up queue entry (if it still exists)
                        supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id)
                            .then(() => { });

                        await handleMatchFound(gameId, opponentId);
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;
    }, [user, handleMatchFound]);

    /**
     * Poll the queue for opponents. This is a fallback for cases where:
     * - Both players join at the same time and miss each other
     * - Realtime subscription isn't delivering events
     */
    const startPolling = useCallback(() => {
        if (!user) return;

        pollingRef.current = setInterval(async () => {
            if (statusRef.current !== "searching") {
                if (pollingRef.current) clearInterval(pollingRef.current);
                return;
            }

            try {
                // 1. Check if WE are still in the queue
                const { data: myEntry } = await supabase
                    .from("matchmaking_queue")
                    .select("id")
                    .eq("player_id", user.id)
                    .maybeSingle();

                if (!myEntry && statusRef.current === "searching") {
                    // We were removed from the queue — someone matched us!
                    // Find our most recent game assignment
                    const { data: gameEntry } = await supabase
                        .from("games_players")
                        .select("game_id")
                        .eq("player_id", user.id)
                        .order("id", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (gameEntry) {
                        // Find opponent in the same game
                        const { data: opponent } = await supabase
                            .from("games_players")
                            .select("player_id")
                            .eq("game_id", gameEntry.game_id)
                            .neq("player_id", user.id)
                            .maybeSingle();

                        await handleMatchFound(
                            gameEntry.game_id,
                            opponent?.player_id ?? ""
                        );
                        return;
                    }
                }

                // 2. Also try to actively match with someone in the queue
                if (myEntry) {
                    const { data: waitingPlayer } = await supabase
                        .from("matchmaking_queue")
                        .select("*")
                        .neq("player_id", user.id)
                        .order("joined_at", { ascending: true })
                        .limit(1)
                        .maybeSingle();

                    if (waitingPlayer && statusRef.current === "searching") {
                        // Match found! Remove both from queue
                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("id", waitingPlayer.id);

                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id);

                        const gameId = await createGame(
                            waitingPlayer.player_id as string,
                            user.id,
                            user.id
                        );

                        await handleMatchFound(
                            gameId,
                            waitingPlayer.player_id as string
                        );
                    }
                }
            } catch {
                // Silently ignore polling errors — will retry on next interval
            }
        }, POLL_INTERVAL_MS);
    }, [user, handleMatchFound]);

    /**
     * Join the matchmaking queue.
     */
    const joinQueue = useCallback(async () => {
        if (!user) return;

        // Clear any previous timeout, polling, and channel
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        setError(null);
        setStatus("searching");
        statusRef.current = "searching";
        setMatchedGameId(null);
        setMatchedOpponent(null);

        try {
            // First, make sure we're not already in the queue
            await supabase
                .from("matchmaking_queue")
                .delete()
                .eq("player_id", user.id);

            // Check for a waiting opponent (FIFO — oldest first, not ourselves)
            const { data: waitingPlayer, error: queryError } = await supabase
                .from("matchmaking_queue")
                .select("*")
                .neq("player_id", user.id)
                .order("joined_at", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (queryError) {
                throw new Error(queryError.message);
            }

            if (waitingPlayer) {
                // Match found! Remove them from queue and create game
                await supabase
                    .from("matchmaking_queue")
                    .delete()
                    .eq("id", waitingPlayer.id);

                const gameId = await createGame(
                    waitingPlayer.player_id as string,
                    user.id,
                    user.id
                );

                await handleMatchFound(gameId, waitingPlayer.player_id as string);
            } else {
                // No one waiting — join queue
                const { error: insertError } = await supabase
                    .from("matchmaking_queue")
                    .insert({ player_id: user.id });

                if (insertError) {
                    if (!insertError.message.includes("duplicate")) {
                        throw new Error(insertError.message);
                    }
                }

                // Listen for a game being created that includes us (realtime)
                subscribeToMatch();

                // Also poll the queue as a fallback (race condition safety net)
                startPolling();

                // Start timeout timer
                timeoutRef.current = setTimeout(async () => {
                    if (statusRef.current === "searching") {
                        if (pollingRef.current) {
                            clearInterval(pollingRef.current);
                            pollingRef.current = null;
                        }
                        try {
                            await supabase
                                .from("matchmaking_queue")
                                .delete()
                                .eq("player_id", user.id);
                        } catch {
                            // ignore cleanup errors
                        }
                        if (channelRef.current) {
                            supabase.removeChannel(channelRef.current);
                            channelRef.current = null;
                        }
                        setStatus("timeout");
                    }
                }, SEARCH_TIMEOUT_MS);
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Matchmaking failed";
            setError(message);
            setStatus("error");
        }
    }, [user, subscribeToMatch, startPolling, handleMatchFound]);

    /**
     * Leave the matchmaking queue / cancel search.
     */
    const leaveQueue = useCallback(async () => {
        if (!user) return;

        try {
            await supabase
                .from("matchmaking_queue")
                .delete()
                .eq("player_id", user.id);
        } catch {
            // Silently ignore cleanup errors
        }

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        setStatus("idle");
        setError(null);
        setMatchedGameId(null);
        setMatchedOpponent(null);
    }, [user]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (user && statusRef.current === "searching") {
                supabase
                    .from("matchmaking_queue")
                    .delete()
                    .eq("player_id", user.id)
                    .then(() => { });
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [user]);

    return { status, error, matchedGameId, matchedOpponent, joinQueue, leaveQueue };
}
