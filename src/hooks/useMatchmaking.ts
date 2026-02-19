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
 */
async function createGame(
    player1Id: string,
    player2Id: string,
    createdBy: string
): Promise<string> {
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

async function getOpponentName(opponentId: string): Promise<string> {
    const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", opponentId)
        .maybeSingle();
    return data?.display_name ?? "Unknown Captain";
}

export function useMatchmaking(onlineUserIds?: Set<string>): UseMatchmakingReturn {
    const { user } = useAuth();
    const [status, setStatus] = useState<MatchmakingStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [matchedGameId, setMatchedGameId] = useState<string | null>(null);
    const [matchedOpponent, setMatchedOpponent] = useState<string | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const statusRef = useRef<MatchmakingStatus>("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Store game IDs that existed BEFORE we started searching
    const existingGameIdsRef = useRef<Set<string>>(new Set());

    const SEARCH_TIMEOUT_MS = 30000;
    const POLL_INTERVAL_MS = 2000; // poll every 2 seconds (faster)

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Auto-reset timeout back to idle after 15 seconds
    useEffect(() => {
        if (status !== "timeout") return;
        const resetTimer = setTimeout(() => {
            setStatus("idle");
            statusRef.current = "idle";
        }, 15000);
        return () => clearTimeout(resetTimer);
    }, [status]);

    /** Clean up all timers and subscriptions */
    const cleanup = useCallback(() => {
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
    }, []);

    /** Handle a successful match */
    const handleMatchFound = useCallback(
        async (gameId: string, opponentId: string) => {
            cleanup();
            const opponentName = await getOpponentName(opponentId);
            setMatchedGameId(gameId);
            setMatchedOpponent(opponentName);
            setStatus("matched");
            statusRef.current = "matched";
        },
        [cleanup]
    );

    /**
     * Subscribe to `games_players` inserts for the current user via realtime.
     */
    const subscribeToMatch = useCallback(() => {
        if (!user) return;

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
                    if (statusRef.current === "searching") {
                        const gameId = (payload.new as { game_id: string }).game_id;

                        // Skip if this game existed before our search
                        if (existingGameIdsRef.current.has(gameId)) return;

                        const { data: opponent } = await supabase
                            .from("games_players")
                            .select("player_id")
                            .eq("game_id", gameId)
                            .neq("player_id", user.id)
                            .maybeSingle();

                        // Clean up queue
                        supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id)
                            .then(() => { });

                        await handleMatchFound(gameId, opponent?.player_id ?? "");
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;
    }, [user, handleMatchFound]);

    // Keep a ref of online users to avoid closure staleness in setInterval
    const onlineUserIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (onlineUserIds) {
            onlineUserIdsRef.current = onlineUserIds;
        }
    }, [onlineUserIds]);

    /**
     * Poll to detect matches.
     */
    const startPolling = useCallback(() => {
        if (!user) return;

        pollingRef.current = setInterval(async () => {
            if (statusRef.current !== "searching") {
                if (pollingRef.current) clearInterval(pollingRef.current);
                return;
            }

            try {
                // Strategy 1: Check if we have a NEW game assignment
                const { data: myGames } = await supabase
                    .from("games_players")
                    .select("game_id")
                    .eq("player_id", user.id);

                if (myGames) {
                    const newGame = myGames.find(
                        (g) => !existingGameIdsRef.current.has(g.game_id)
                    );

                    if (newGame && statusRef.current === "searching") {
                        const { data: opponent } = await supabase
                            .from("games_players")
                            .select("player_id")
                            .eq("game_id", newGame.game_id)
                            .neq("player_id", user.id)
                            .maybeSingle();

                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id);

                        await handleMatchFound(
                            newGame.game_id,
                            opponent?.player_id ?? ""
                        );
                        return;
                    }
                }

                // Strategy 2: Try to actively match with someone in the queue
                const { data: waitingPlayer } = await supabase
                    .from("matchmaking_queue")
                    .select("*")
                    .neq("player_id", user.id)
                    .order("joined_at", { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (waitingPlayer && statusRef.current === "searching") {
                    // Check if opponent is actually online using the REF
                    const currentOnlineIds = onlineUserIdsRef.current;
                    if (currentOnlineIds.size > 0 && !currentOnlineIds.has(waitingPlayer.player_id)) {
                        // Opponent is offline -> remove stale entry
                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("id", waitingPlayer.id);
                        return;
                    }

                    // Remove opponent from queue
                    await supabase
                        .from("matchmaking_queue")
                        .delete()
                        .eq("id", waitingPlayer.id);

                    // Remove ourselves from queue
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
            } catch {
                // Silently ignore
            }
        }, POLL_INTERVAL_MS);
    }, [user, handleMatchFound]);

    /**
     * Join the matchmaking queue.
     */
    const joinQueue = useCallback(async () => {
        if (!user) return;

        cleanup();

        setError(null);
        setStatus("searching");
        statusRef.current = "searching";
        setMatchedGameId(null);
        setMatchedOpponent(null);

        try {
            // Snapshot existing game IDs BEFORE we start searching
            const { data: existingGames } = await supabase
                .from("games_players")
                .select("game_id")
                .eq("player_id", user.id);

            existingGameIdsRef.current = new Set(
                (existingGames ?? []).map((g) => g.game_id)
            );

            // Remove any stale queue entry
            await supabase
                .from("matchmaking_queue")
                .delete()
                .eq("player_id", user.id);

            // Check for a waiting opponent (FIFO)
            const { data: waitingPlayer, error: queryError } = await supabase
                .from("matchmaking_queue")
                .select("*")
                .neq("player_id", user.id)
                .order("joined_at", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (queryError) throw new Error(queryError.message);

            if (waitingPlayer) {
                // Check if opponent is actually online
                if (onlineUserIds && !onlineUserIds.has(waitingPlayer.player_id)) {
                    // Opponent is offline -> remove stale entry
                    await supabase
                        .from("matchmaking_queue")
                        .delete()
                        .eq("id", waitingPlayer.id);

                    // Proceed to join queue as if no one was waiting
                    const { error: insertError } = await supabase
                        .from("matchmaking_queue")
                        .insert({ player_id: user.id });

                    if (insertError && !insertError.message.includes("duplicate")) {
                        throw new Error(insertError.message);
                    }

                    subscribeToMatch();
                    startPolling();

                    timeoutRef.current = setTimeout(async () => {
                        if (statusRef.current === "searching") {
                            cleanup();
                            try {
                                await supabase
                                    .from("matchmaking_queue")
                                    .delete()
                                    .eq("player_id", user.id);
                            } catch { /* ignore */ }
                            setStatus("timeout");
                        }
                    }, SEARCH_TIMEOUT_MS);
                } else {
                    // Match found immediately
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
                }
            } else {
                // Join queue and wait
                const { error: insertError } = await supabase
                    .from("matchmaking_queue")
                    .insert({ player_id: user.id });

                if (insertError && !insertError.message.includes("duplicate")) {
                    throw new Error(insertError.message);
                }

                // Subscribe to realtime + start polling
                subscribeToMatch();
                startPolling();

                // Timeout
                timeoutRef.current = setTimeout(async () => {
                    if (statusRef.current === "searching") {
                        cleanup();
                        try {
                            await supabase
                                .from("matchmaking_queue")
                                .delete()
                                .eq("player_id", user.id);
                        } catch { /* ignore */ }
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
    }, [user, subscribeToMatch, startPolling, handleMatchFound, cleanup]);

    /**
     * Leave the queue / cancel search.
     */
    const leaveQueue = useCallback(async () => {
        if (!user) return;

        try {
            await supabase
                .from("matchmaking_queue")
                .delete()
                .eq("player_id", user.id);
        } catch { /* ignore */ }

        cleanup();
        setStatus("idle");
        setError(null);
        setMatchedGameId(null);
        setMatchedOpponent(null);
    }, [user, cleanup]);

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
            cleanup();
        };
    }, [user, cleanup]);

    return { status, error, matchedGameId, matchedOpponent, joinQueue, leaveQueue };
}
