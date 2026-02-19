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
    const POLL_INTERVAL_MS = 2000; // poll every 2 seconds

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Keep a ref of online users to avoid closure staleness in setInterval
    const onlineUserIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (onlineUserIds) {
            onlineUserIdsRef.current = onlineUserIds;
        }
    }, [onlineUserIds]);

    // Auto-reset timeout status back to idle after 15 seconds
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
                    const now = new Date();
                    const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();

                    // Find a game ID that didn't exist before we started searching
                    const newGame = myGames.find(
                        (g: { game_id: string }) => !existingGameIdsRef.current.has(g.game_id)
                    );

                    if (newGame && statusRef.current === "searching") {
                        // Verify the game is actually recent (prevent matching into stale games)
                        const { data: gameDetails } = await supabase
                            .from("games")
                            .select("created_at")
                            .eq("id", newGame.game_id)
                            .maybeSingle();

                        if (gameDetails && gameDetails.created_at > oneMinuteAgo) {
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
                        } else {
                            // It's an old game we just discovered? Ignore it.
                            existingGameIdsRef.current.add(newGame.game_id);
                        }
                    }
                }

                // Strategy 2: Actively match with someone in the queue
                // Fetch up to 10 oldest players to find one that is online
                // (We cannot delete offline players due to RLS, so we must skip them in memory)
                const { data: waitingPlayers } = await supabase
                    .from("matchmaking_queue")
                    .select("*")
                    .neq("player_id", user.id)
                    .order("joined_at", { ascending: true })
                    .limit(10);

                if (waitingPlayers && waitingPlayers.length > 0 && statusRef.current === "searching") {
                    const currentOnlineIds = onlineUserIdsRef.current;
                    const isPresenceActive = currentOnlineIds.size > 0 && currentOnlineIds.has(user.id);

                    if (!isPresenceActive) {
                        // Presence not ready yet -> DO NOT MATCH. Wait for next poll.
                        return;
                    }

                    // Find first online opponent
                    const opponent = waitingPlayers.find((p: any) => currentOnlineIds.has(p.player_id));

                    if (opponent) {
                        // Found an online opponent! Match!
                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("id", opponent.id)
                            .then(({ error }: { error: any }) => {
                                // Note: This delete might fail if RLS restriction exists,
                                // but we proceed to create game anyway.
                                // Ideally RLS should allow matching trigger deletion or we rely on them deleting themselves.
                                if (error) console.log("Could not delete opponent from queue logic (expected if strict RLS)", error);
                            });

                        // Remove ourselves from queue
                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id);

                        const gameId = await createGame(
                            opponent.player_id as string,
                            user.id,
                            user.id
                        );

                        await handleMatchFound(
                            gameId,
                            opponent.player_id as string
                        );
                    }
                    // If no one in top 10 is online, we do nothing and retry next poll
                }
            } catch {
                // Ignore errors
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
            // Snapshot existing games
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

            // Check for waiting opponent - fetch batch to skip offline users
            const { data: waitingPlayers, error: queryError } = await supabase
                .from("matchmaking_queue")
                .select("*")
                .neq("player_id", user.id)
                .order("joined_at", { ascending: true })
                .limit(10);

            if (queryError) throw new Error(queryError.message);

            // Check presence strictly before immediate match
            const isPresenceActive = onlineUserIds && onlineUserIds.has(user.id);

            // Find first online opponent
            const opponent = isPresenceActive
                ? waitingPlayers?.find((p: any) => onlineUserIds.has(p.player_id))
                : null;

            // If we found a player AND presence system is ready -> MATCH IMMEDIATELY
            if (opponent) {
                await supabase
                    .from("matchmaking_queue")
                    .delete()
                    .eq("id", opponent.id);

                const gameId = await createGame(
                    opponent.player_id as string,
                    user.id,
                    user.id
                );

                await handleMatchFound(gameId, opponent.player_id as string);
            } else {
                // Otherwise (no player OR presence not ready OR player offline) -> Join queue & let polling handle it

                // Note: If player was offline, polling will delete them later when presence is confirmed ready.

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
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Matchmaking failed";
            setError(message);
            setStatus("error");
        }
    }, [user, onlineUserIds, subscribeToMatch, startPolling, handleMatchFound, cleanup]);

    /**
     * Leave queue.
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
