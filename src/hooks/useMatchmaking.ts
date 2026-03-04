import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

type MatchmakingStatus =
  | "idle"
  | "searching"
  | "pending_accept"
  | "matched"
  | "error"
  | "timeout";

interface UseMatchmakingReturn {
  status: MatchmakingStatus;
  error: string | null;
  matchedGameId: string | null;
  matchedOpponent: string | null;
  acceptedByMe: boolean;
  opponentAccepted: boolean;
  joinQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  acceptMatch: () => Promise<void>;
  declineMatch: () => Promise<void>;
  expirePendingMatch: () => Promise<void>;
  finalizeMatch: () => Promise<void>;
}

interface MatchFoundPayload {
  pairId: string;
  playerA: string;
  playerB: string;
  initiator: string;
}

interface MatchAcceptPayload {
  pairId: string;
  userId: string;
}

interface MatchDeclinePayload {
  pairId: string;
  declinedBy: string;
}

interface MatchReadyPayload {
  pairId: string;
  gameId: string;
  opponentId: string;
}

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

  const { error: playersError } = await supabase.from("games_players").insert([
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

function makePairId(userA: string, userB: string): string {
  const [first, second] = [userA, userB].sort();
  return `${first}:${second}`;
}

export function useMatchmaking(onlineUserIds?: Set<string>): UseMatchmakingReturn {
  const { user } = useAuth();
  const [status, setStatus] = useState<MatchmakingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [matchedGameId, setMatchedGameId] = useState<string | null>(null);
  const [matchedOpponent, setMatchedOpponent] = useState<string | null>(null);
  const [acceptedByMe, setAcceptedByMe] = useState(false);
  const [opponentAccepted, setOpponentAccepted] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<MatchmakingStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingGameRef = useRef(false);

  const pairIdRef = useRef<string | null>(null);
  const opponentIdRef = useRef<string | null>(null);
  const initiatorIdRef = useRef<string | null>(null);

  const SEARCH_TIMEOUT_MS = 30000;
  const ACCEPT_TIMEOUT_MS = 25000;

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const onlineUserIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (onlineUserIds) {
      onlineUserIdsRef.current = onlineUserIds;
    }
  }, [onlineUserIds]);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (acceptTimeoutRef.current) {
      clearTimeout(acceptTimeoutRef.current);
      acceptTimeoutRef.current = null;
    }
  }, []);

  const resetMatchState = useCallback(() => {
    setMatchedGameId(null);
    setMatchedOpponent(null);
    setAcceptedByMe(false);
    setOpponentAccepted(false);
    pairIdRef.current = null;
    opponentIdRef.current = null;
    initiatorIdRef.current = null;
    creatingGameRef.current = false;
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [clearTimers]);

  const finalizeMatch = useCallback(async () => {
    if (!user) return;
    if (!pairIdRef.current || !opponentIdRef.current || !initiatorIdRef.current) return;
    if (!acceptedByMe || !opponentAccepted) return;
    if (initiatorIdRef.current !== user.id) return;
    if (creatingGameRef.current) return;

    creatingGameRef.current = true;

    try {
      const opponentId = opponentIdRef.current;
      const gameId = await createGame(user.id, opponentId, user.id);

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "match-ready",
          payload: {
            pairId: pairIdRef.current,
            gameId,
            opponentId,
          } satisfies MatchReadyPayload,
        });
      }

      const opponentName = await getOpponentName(opponentId);
      setMatchedGameId(gameId);
      setMatchedOpponent(opponentName);
      setStatus("matched");
      clearTimers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create match");
      setStatus("error");
      resetMatchState();
    }
  }, [acceptedByMe, opponentAccepted, user, clearTimers, resetMatchState]);

  const setPendingMatch = useCallback(
    async (payload: MatchFoundPayload) => {
      if (!user) return;
      if (statusRef.current !== "searching" && statusRef.current !== "pending_accept") return;

      const opponentId = payload.playerA === user.id ? payload.playerB : payload.playerA;
      if (!opponentId || opponentId === user.id) return;

      const opponentName = await getOpponentName(opponentId);

      clearTimers();
      await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);

      pairIdRef.current = payload.pairId;
      opponentIdRef.current = opponentId;
      initiatorIdRef.current = payload.initiator;
      setMatchedOpponent(opponentName);
      setMatchedGameId(null);
      setAcceptedByMe(false);
      setOpponentAccepted(false);
      setStatus("pending_accept");
      setError(null);

      acceptTimeoutRef.current = setTimeout(async () => {
        if (statusRef.current === "pending_accept") {
          await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);
          resetMatchState();
          setStatus("idle");
          setError("Match request timed out because both players did not accept.");
        }
      }, ACCEPT_TIMEOUT_MS);
    },
    [clearTimers, resetMatchState, user]
  );

  const ensureRealtimeChannel = useCallback(() => {
    if (!user) return;
    if (channelRef.current) return;

    const channel = supabase
      .channel("matchmaking-global")
      .on("broadcast", { event: "match-found" }, async ({ payload }) => {
        const data = payload as MatchFoundPayload;
        if (!user) return;
        if (data.playerA !== user.id && data.playerB !== user.id) return;
        await setPendingMatch(data);
      })
      .on("broadcast", { event: "match-accept" }, ({ payload }) => {
        const data = payload as MatchAcceptPayload;
        if (!pairIdRef.current || data.pairId !== pairIdRef.current) return;
        if (data.userId === user?.id) return;
        setOpponentAccepted(true);
      })
      .on("broadcast", { event: "match-decline" }, ({ payload }) => {
        const data = payload as MatchDeclinePayload;
        if (!pairIdRef.current || data.pairId !== pairIdRef.current) return;
        clearTimers();
        resetMatchState();
        setStatus("idle");
        setError("The other player did not accept the match.");
      })
      .on("broadcast", { event: "match-ready" }, async ({ payload }) => {
        const data = payload as MatchReadyPayload;
        if (!pairIdRef.current || data.pairId !== pairIdRef.current) return;

        const opponentName = await getOpponentName(data.opponentId === user?.id ? (opponentIdRef.current ?? "") : data.opponentId);
        clearTimers();
        setMatchedGameId(data.gameId);
        setMatchedOpponent(opponentName || matchedOpponent);
        setStatus("matched");
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matchmaking_queue",
        },
        async (payload) => {
          if (!user) return;
          if (statusRef.current !== "searching") return;

          const entry = payload.new as { player_id: string; id: string };
          if (entry.player_id === user.id) return;

          const currentOnlineIds = onlineUserIdsRef.current;
          if (!currentOnlineIds.has(entry.player_id)) return;

          try {
            await supabase.from("matchmaking_queue").delete().eq("id", entry.id);
            await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);

            const pairId = makePairId(user.id, entry.player_id);
            const matchPayload: MatchFoundPayload = {
              pairId,
              playerA: user.id,
              playerB: entry.player_id,
              initiator: user.id,
            };

            await setPendingMatch(matchPayload);
            await channel.send({
              type: "broadcast",
              event: "match-found",
              payload: matchPayload,
            });
          } catch {
            // Queue race condition; ignore.
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [clearTimers, matchedOpponent, resetMatchState, setPendingMatch, user]);

  const joinQueue = useCallback(async () => {
    if (!user) return;

    cleanup();
    resetMatchState();
    setError(null);
    setStatus("searching");

    ensureRealtimeChannel();

    try {
      await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);

      const { data: waitingPlayers, error: queryError } = await supabase
        .from("matchmaking_queue")
        .select("id, player_id")
        .neq("player_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(10);

      if (queryError) throw new Error(queryError.message);

      const opponent = waitingPlayers?.find((p: { id: string; player_id: string }) =>
        onlineUserIdsRef.current.has(p.player_id)
      );

      if (opponent) {
        await supabase.from("matchmaking_queue").delete().eq("id", opponent.id);

        const pairId = makePairId(user.id, opponent.player_id);
        const payload: MatchFoundPayload = {
          pairId,
          playerA: user.id,
          playerB: opponent.player_id,
          initiator: user.id,
        };

        await setPendingMatch(payload);
        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "match-found",
            payload,
          });
        }
      } else {
        const { error: insertError } = await supabase
          .from("matchmaking_queue")
          .insert({ player_id: user.id });

        if (insertError && !insertError.message.includes("duplicate")) {
          throw new Error(insertError.message);
        }

        timeoutRef.current = setTimeout(async () => {
          if (statusRef.current === "searching") {
            await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);
            cleanup();
            setStatus("timeout");
            setError(null);
          }
        }, SEARCH_TIMEOUT_MS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Matchmaking failed");
      setStatus("error");
    }
  }, [cleanup, ensureRealtimeChannel, resetMatchState, setPendingMatch, user]);

  const declineMatch = useCallback(async () => {
    if (!user) return;

    if (pairIdRef.current && channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "match-decline",
        payload: {
          pairId: pairIdRef.current,
          declinedBy: user.id,
        } satisfies MatchDeclinePayload,
      });
    }

    clearTimers();
    await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);
    resetMatchState();
    setStatus("idle");
    setError("You declined the match.");
  }, [clearTimers, resetMatchState, user]);

  const expirePendingMatch = useCallback(async () => {
    if (!user) return;
    if (!pairIdRef.current) return;
    if (statusRef.current !== "pending_accept") return;

    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "match-decline",
        payload: {
          pairId: pairIdRef.current,
          declinedBy: user.id,
        } satisfies MatchDeclinePayload,
      });
    }

    clearTimers();
    await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);
    resetMatchState();
    setStatus("idle");
    setError("Match expired before both players accepted.");
  }, [clearTimers, resetMatchState, user]);

  const acceptMatch = useCallback(async () => {
    if (!user || !pairIdRef.current) return;
    if (statusRef.current !== "pending_accept") return;

    setAcceptedByMe(true);

    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "match-accept",
        payload: {
          pairId: pairIdRef.current,
          userId: user.id,
        } satisfies MatchAcceptPayload,
      });
    }
  }, [user]);

  const leaveQueue = useCallback(async () => {
    if (!user) return;

    if (statusRef.current === "pending_accept") {
      await declineMatch();
      return;
    }

    await supabase.from("matchmaking_queue").delete().eq("player_id", user.id);
    cleanup();
    resetMatchState();
    setStatus("idle");
    setError(null);
  }, [cleanup, declineMatch, resetMatchState, user]);

  useEffect(() => {
    return () => {
      if (user && (statusRef.current === "searching" || statusRef.current === "pending_accept")) {
        supabase.from("matchmaking_queue").delete().eq("player_id", user.id).then(() => {
          // no-op
        });
      }
      cleanup();
    };
  }, [cleanup, user]);

  return {
    status,
    error,
    matchedGameId,
    matchedOpponent,
    acceptedByMe,
    opponentAccepted,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    expirePendingMatch,
    finalizeMatch,
  };
}
