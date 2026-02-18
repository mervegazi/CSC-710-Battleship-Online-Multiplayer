import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

type MatchmakingStatus = "idle" | "searching" | "matched" | "error" | "timeout";

interface UseMatchmakingReturn {
    status: MatchmakingStatus;
    error: string | null;
    matchedGameId: string | null;
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

export function useMatchmaking(): UseMatchmakingReturn {
    const { user } = useAuth();
    const [status, setStatus] = useState<MatchmakingStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [matchedGameId, setMatchedGameId] = useState<string | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const statusRef = useRef<MatchmakingStatus>("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const SEARCH_TIMEOUT_MS = 30000; // 30 seconds

    // Keep a ref in sync so the realtime callback sees the latest status
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
                (payload) => {
                    // Only react if we are still searching
                    if (statusRef.current === "searching") {
                        const gameId = (payload.new as { game_id: string }).game_id;
                        setMatchedGameId(gameId);
                        setStatus("matched");
                        // Clean up queue entry (if it still exists)
                        supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id)
                            .then(() => { });
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;
    }, [user]);

    /**
     * Join the matchmaking queue.
     *
     * Flow:
     * 1. Check if there is a waiting player in the queue (FIFO).
     * 2a. If found → remove them, create a game, navigate both players.
     * 2b. If not found → insert self into queue and wait for realtime notification.
     */
    const joinQueue = useCallback(async () => {
        if (!user) return;

        // Clear any previous timeout and channel from a prior search
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        setError(null);
        setStatus("searching");
        statusRef.current = "searching"; // update ref immediately
        setMatchedGameId(null);

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

                setMatchedGameId(gameId);
                setStatus("matched");
            } else {
                // No one waiting — join queue and subscribe for match notification
                const { error: insertError } = await supabase
                    .from("matchmaking_queue")
                    .insert({ player_id: user.id });

                if (insertError) {
                    // If duplicate key, we're already in queue — that's fine
                    if (!insertError.message.includes("duplicate")) {
                        throw new Error(insertError.message);
                    }
                }

                // Listen for a game being created that includes us
                subscribeToMatch();

                // Start timeout timer
                timeoutRef.current = setTimeout(async () => {
                    if (statusRef.current === "searching") {
                        // Remove from queue
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
    }, [user, subscribeToMatch]);

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

        setStatus("idle");
        setError(null);
        setMatchedGameId(null);
    }, [user]);

    // Cleanup on unmount — remove from queue and unsubscribe
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
        };
    }, [user]);

    return { status, error, matchedGameId, joinQueue, leaveQueue };
}
