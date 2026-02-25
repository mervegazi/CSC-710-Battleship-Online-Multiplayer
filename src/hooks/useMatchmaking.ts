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
    // Store game IDs that existed BEFORE we started searching
    const existingGameIdsRef = useRef<Set<string>>(new Set());

    const SEARCH_TIMEOUT_MS = 30000;

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
     * Subscribe to realtime events for matchmaking:
     * 1. games_players INSERT — detect when another player creates a game for us
     * 2. matchmaking_queue INSERT — detect when a new opponent joins the queue
     */
    const subscribeToMatch = useCallback(() => {
        if (!user) return;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel("matchmaking-" + user.id)
            // When another player creates a game that includes us
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "games_players",
                    filter: `player_id=eq.${user.id}`,
                },
                async (payload) => {
                    if (statusRef.current !== "searching") return;

                    const gameId = (payload.new as { game_id: string }).game_id;
                    if (existingGameIdsRef.current.has(gameId)) return;

                    const { data: opponent } = await supabase
                        .from("games_players")
                        .select("player_id")
                        .eq("game_id", gameId)
                        .neq("player_id", user.id)
                        .maybeSingle();

                    supabase
                        .from("matchmaking_queue")
                        .delete()
                        .eq("player_id", user.id)
                        .then(() => { });

                    await handleMatchFound(gameId, opponent?.player_id ?? "");
                }
            )
            // When a new player joins the queue, try to match with them
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "matchmaking_queue",
                },
                async (payload) => {
                    if (statusRef.current !== "searching") return;

                    const entry = payload.new as { player_id: string; id: string };
                    if (entry.player_id === user.id) return;

                    const currentOnlineIds = onlineUserIdsRef.current;
                    if (!currentOnlineIds.has(entry.player_id)) return;

                    try {
                        // Remove opponent from queue
                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("id", entry.id);

                        // Remove ourselves from queue
                        await supabase
                            .from("matchmaking_queue")
                            .delete()
                            .eq("player_id", user.id);

                        const gameId = await createGame(
                            entry.player_id,
                            user.id,
                            user.id
                        );

                        await handleMatchFound(gameId, entry.player_id);
                    } catch {
                        // Another player may have matched with them first
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;
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
                // No immediate match — join queue and listen for opponents via realtime
                const { error: insertError } = await supabase
                    .from("matchmaking_queue")
                    .insert({ player_id: user.id });

                if (insertError && !insertError.message.includes("duplicate")) {
                    throw new Error(insertError.message);
                }

                subscribeToMatch();

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
    }, [user, onlineUserIds, subscribeToMatch, handleMatchFound, cleanup]);

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
