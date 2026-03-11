import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { soundService } from "../lib/soundService";
import { useAuth } from "./useAuth";
import { useHeartbeat } from "./useHeartbeat";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  Game,
  GamePlayer,
  GameStatus,
  Move,
  CellState,
  BoardState,
} from "../types";
import type { MatchShip } from "../game/shipRules";
import {
  convertFleetToBoard,
  resolveAttack,
  checkWinByMoves,
  buildOpponentDisplay,
  buildMyDisplay,
  emptyBoard,
} from "../lib/gameLogic";

interface PlayerInfo {
  id: string;
  displayName: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseGameReturn {
  gameStatus: GameStatus;
  currentTurnPlayerId: string | null;
  isMyTurn: boolean;
  myBoard: CellState[][];
  opponentBoard: CellState[][];
  myInfo: PlayerInfo | null;
  opponentInfo: PlayerInfo | null;
  myPlayer: GamePlayer | null;
  opponentPlayer: GamePlayer | null;
  moves: Move[];
  winnerId: string | null;
  opponentConnected: boolean;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  gameShipCount: number;
  submitReady: (fleet: MatchShip[]) => Promise<void>;
  endPlacementTurn: (fleet: MatchShip[], shipSize: number, shipCount: number) => Promise<void>;
  abandonGame: () => Promise<void>;
  attack: (row: number, col: number) => Promise<void>;
}

async function updateProfileStats(winnerId: string, loserId: string) {
  // Atomic increment via Postgres RPC to avoid lost-update race conditions
  await Promise.all([
    supabase.rpc("increment_wins", { player_id: winnerId }),
    supabase.rpc("increment_losses", { player_id: loserId }),
  ]);
}

export function useGame(gameId: string | undefined): UseGameReturn {
  const { user } = useAuth();

  const [game, setGame] = useState<Game | null>(null);
  const [myPlayer, setMyPlayer] = useState<GamePlayer | null>(null);
  const [opponentPlayer, setOpponentPlayer] = useState<GamePlayer | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [myInfo, setMyInfo] = useState<PlayerInfo | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  // Prevent duplicate attack processing
  const attackingRef = useRef(false);

  const gameStatus: GameStatus = game?.status ?? "setup";
  const currentTurnPlayerId = game?.current_turn ?? null;
  const isMyTurn = game?.current_turn === user?.id && gameStatus === "in_progress";
  const winnerId = game?.winner_id ?? null;
  const gameShipCount = game?.ship_count ?? 5;

  // Heartbeat / disconnect detection (must come after gameStatus)
  const heartbeatActive = gameStatus === "setup" || gameStatus === "in_progress";
  const { opponentConnected } = useHeartbeat(gameId, user?.id, heartbeatActive);

  // Derive board displays from state
  const myMoves = moves.filter((m) => m.player_id === user?.id);
  const opponentMoves = moves.filter((m) => m.player_id !== user?.id);

  const myBoard: CellState[][] =
    myPlayer?.board && myPlayer.board.ships.length > 0
      ? buildMyDisplay(myPlayer.board, opponentMoves)
      : emptyBoard();

  const opponentBoard: CellState[][] =
    gameStatus === "in_progress" || gameStatus === "finished"
      ? buildOpponentDisplay(myMoves, opponentPlayer?.board ?? undefined)
      : emptyBoard();

  // ── Initial data fetch ──────────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !user) return;
    const userId = user.id;
    let cancelled = false;

    async function fetchGameData() {
      try {
        // Fetch game, players, and moves in parallel
        const [gameRes, playersRes, movesRes] = await Promise.all([
          supabase.from("games").select("*").eq("id", gameId).single(),
          supabase.from("games_players").select("*").eq("game_id", gameId),
          supabase.from("moves").select("*").eq("game_id", gameId).order("move_number", { ascending: true }),
        ]);

        if (cancelled) return;

        if (gameRes.error) throw new Error(gameRes.error.message);
        if (playersRes.error) throw new Error(playersRes.error.message);

        const gameData = gameRes.data as Game;
        const playersData = (playersRes.data ?? []) as GamePlayer[];
        const movesData = (movesRes.data ?? []) as Move[];

        setGame(gameData);
        setMoves(movesData);

        const me = playersData.find((p) => p.player_id === userId) ?? null;
        const opp = playersData.find((p) => p.player_id !== userId) ?? null;
        setMyPlayer(me);
        setOpponentPlayer(opp);

        // Fetch profiles for display names
        const playerIds = playersData.map((p) => p.player_id);
        if (playerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", playerIds);

          if (!cancelled && profiles) {
            for (const profile of profiles) {
              const info: PlayerInfo = {
                id: profile.id,
                displayName: profile.display_name ?? "Unknown",
              };
              if (profile.id === userId) {
                setMyInfo(info);
              } else {
                setOpponentInfo(info);
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load game");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGameData();
    return () => { cancelled = true; };
  }, [gameId, user]);

  // ── Realtime subscription ───────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !user) return;
    const currentUserId = user.id;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`game:${gameId}`)
      // New moves
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moves",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMove = payload.new as Move;
          setMoves((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === newMove.id)) return prev;
            return [...prev, newMove];
          });
          // Play incoming sound for opponent's move only
          if (newMove.player_id !== currentUserId) {
            if (newMove.result === "miss") {
              soundService.play("splash_incoming");
            } else {
              soundService.play("hit_incoming");
            }
          }
        }
      )
      // Game state changes (current_turn, status, winner_id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as Game;
          setGame(updated);
        }
      )
      // Player state changes (ready, board)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games_players",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as GamePlayer;
          if (updated.player_id === currentUserId) {
            setMyPlayer(updated);
          } else {
            setOpponentPlayer(updated);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnectionStatus("disconnected");
        } else if (status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
          setTimeout(() => {
            channel.subscribe();
          }, 3000);
        }
      });

    setConnectionStatus("connecting");
    channelRef.current = channel;

    // Browser online/offline detection for immediate UI feedback
    const handleOffline = () => setConnectionStatus("disconnected");
    const handleOnline = () => {
      setConnectionStatus("connecting");
      // Re-subscribe to pick up any missed events
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      const newChannel = supabase
        .channel(`game:${gameId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "moves", filter: `game_id=eq.${gameId}` },
          (payload) => {
            const newMove = payload.new as Move;
            setMoves((prev) => {
              if (prev.some((m) => m.id === newMove.id)) return prev;
              return [...prev, newMove];
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
          (payload) => setGame(payload.new as Game)
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "games_players", filter: `game_id=eq.${gameId}` },
          (payload) => {
            const updated = payload.new as GamePlayer;
            if (updated.player_id === currentUserId) {
              setMyPlayer(updated);
            } else {
              setOpponentPlayer(updated);
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnectionStatus("connected");
          else if (status === "CLOSED" || status === "CHANNEL_ERROR") setConnectionStatus("disconnected");
        });
      channelRef.current = newChannel;

      // Re-fetch latest state to catch anything missed while offline
      Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("games_players").select("*").eq("game_id", gameId),
        supabase.from("moves").select("*").eq("game_id", gameId).order("move_number", { ascending: true }),
      ]).then(([gameRes, playersRes, movesRes]) => {
        if (gameRes.data) setGame(gameRes.data as Game);
        if (playersRes.data) {
          const players = playersRes.data as GamePlayer[];
          setMyPlayer(players.find((p) => p.player_id === currentUserId) ?? null);
          setOpponentPlayer(players.find((p) => p.player_id !== currentUserId) ?? null);
        }
        if (movesRes.data) setMoves(movesRes.data as Move[]);
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, user]);

  // ── Submit ready (board placement) ──────────────────────────────────
  const submitReady = useCallback(
    async (fleet: MatchShip[]) => {
      if (!gameId || !user || !myPlayer) return;

      const boardState = convertFleetToBoard(fleet);

      // Update our games_players row with board and ready flag
      const { error: updateError } = await supabase
        .from("games_players")
        .update({ board: boardState, ready: true })
        .eq("game_id", gameId)
        .eq("player_id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Check if opponent is also ready
      const { data: players } = await supabase
        .from("games_players")
        .select("ready")
        .eq("game_id", gameId);

      const allReady = players && players.length === 2 && players.every((p) => p.ready);

      if (allReady) {
        // Transition game to in_progress
        await supabase
          .from("games")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .eq("id", gameId);
      }
    },
    [gameId, user, myPlayer]
  );

  const endPlacementTurn = useCallback(
    async (fleet: MatchShip[], shipSize: number, shipCount: number) => {
      if (!gameId || !user || !myPlayer || !opponentPlayer || !game) return;
      if (game.status !== "setup") return;
      if (game.current_turn !== user.id) {
        setError("It is not your placement turn.");
        return;
      }

      const ship = fleet.find((s) => s.size === shipSize);
      if (!ship || ship.cells.length !== shipSize) {
        setError(`Place your 1x${shipSize} ship before ending turn.`);
        return;
      }

      const boardState = convertFleetToBoard(fleet);
      const placedCount = boardState.ships.length;
      const isNowReady = placedCount === fleet.length;

      // Lock ship_count in DB on first placement so both players use the same count
      if (placedCount === 1 && game.ship_count !== shipCount) {
        await supabase
          .from("games")
          .update({ ship_count: shipCount })
          .eq("id", gameId);
      }

      const { error: updateError } = await supabase
        .from("games_players")
        .update({ board: boardState, ready: isNowReady })
        .eq("game_id", gameId)
        .eq("player_id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMyPlayer((prev) =>
        prev
          ? {
            ...prev,
            board: boardState,
            ready: isNowReady,
          }
          : prev
      );

      const { data: players, error: playersError } = await supabase
        .from("games_players")
        .select("ready")
        .eq("game_id", gameId);

      if (playersError) {
        setError(playersError.message);
        return;
      }

      const allReady =
        players && players.length === 2 && players.every((p) => p.ready);

      if (allReady) {
        await supabase
          .from("games")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .eq("id", gameId);
      } else {
        await supabase
          .from("games")
          .update({ current_turn: opponentPlayer.player_id })
          .eq("id", gameId);
      }
    },
    [gameId, user, myPlayer, opponentPlayer, game]
  );

  const abandonGame = useCallback(async () => {
    if (!gameId || !user || !game) return;
    if (game.status === "finished" || game.status === "abandoned") return;

    const { error: abandonError } = await supabase
      .from("games")
      .update({
        status: "abandoned",
        winner_id: opponentPlayer?.player_id ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq("id", gameId);

    if (abandonError) {
      setError(abandonError.message);
      return;
    }

    // Update profile stats: abandoner loses, opponent wins
    if (opponentPlayer?.player_id) {
      await updateProfileStats(opponentPlayer.player_id, user.id);
    }

    setGame((prev) =>
      prev
        ? {
          ...prev,
          status: "abandoned",
          winner_id: opponentPlayer?.player_id ?? null,
          ended_at: new Date().toISOString(),
        }
        : prev
    );
  }, [gameId, user, game, opponentPlayer]);

  // ── Attack ──────────────────────────────────────────────────────────
  const attack = useCallback(
    async (row: number, col: number) => {
      if (!gameId || !user || !game || !opponentPlayer) return;
      if (attackingRef.current) return;
      if (game.current_turn !== user.id) return;
      if (game.status !== "in_progress") return;

      // Check if cell already attacked
      const alreadyAttacked = moves.some(
        (m) => m.player_id === user.id && m.x === col && m.y === row
      );
      if (alreadyAttacked) return;

      attackingRef.current = true;

      // Resolve the attack against opponent's board
      const opponentBoard = opponentPlayer.board;
      const myPreviousMoves = moves
        .filter((m) => m.player_id === user.id)
        .map((m) => ({ x: m.x, y: m.y }));

      const { result, sunkShip } = resolveAttack(
        opponentBoard,
        col,  // x = col
        row,  // y = row
        myPreviousMoves
      );

      // Immediate audio feedback (before async DB calls)
      if (sunkShip) {
        soundService.play("sunk");
      } else if (result === "hit") {
        soundService.play("explosion");
      } else {
        soundService.play("splash");
      }

      try {
        // Fetch current max move_number from DB to avoid race conditions
        const { data: maxRow } = await supabase
          .from("moves")
          .select("move_number")
          .eq("game_id", gameId)
          .order("move_number", { ascending: false })
          .limit(1)
          .single();

        const moveNumber = (maxRow?.move_number ?? 0) + 1;

        // INSERT move (upsert to ignore race-condition duplicates)
        const { error: moveError } = await supabase.from("moves").upsert({
          game_id: gameId,
          player_id: user.id,
          x: col,
          y: row,
          result,
          sunk_ship: sunkShip?.type ?? null,
          move_number: moveNumber,
        }, { onConflict: "game_id,player_id,x,y", ignoreDuplicates: true });

        if (moveError) throw new Error(moveError.message);

        // If a ship was sunk, update the opponent's board JSONB
        if (sunkShip) {
          const updatedShips = opponentBoard.ships.map((s) =>
            s.type === sunkShip.type ? { ...s, sunk: true } : s
          );
          const updatedBoard: BoardState = { ships: updatedShips };

          await supabase
            .from("games_players")
            .update({ board: updatedBoard })
            .eq("game_id", gameId)
            .eq("player_id", opponentPlayer.player_id);

          // Check win: all ships sunk?
          const allMoves = [
            ...myPreviousMoves,
            { x: col, y: row },
          ];

          if (checkWinByMoves(opponentBoard, allMoves)) {
            await supabase
              .from("games")
              .update({
                status: "finished",
                winner_id: user.id,
                ended_at: new Date().toISOString(),
              })
              .eq("id", gameId);

            // Update profile stats for both players
            await updateProfileStats(user.id, opponentPlayer.player_id);
          } else {
            // Switch turn
            await supabase
              .from("games")
              .update({ current_turn: opponentPlayer.player_id })
              .eq("id", gameId);
          }
        } else {
          // No sunk ship — switch turn
          await supabase
            .from("games")
            .update({ current_turn: opponentPlayer.player_id })
            .eq("id", gameId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Attack failed");
      } finally {
        attackingRef.current = false;
      }
    },
    [gameId, user, game, opponentPlayer, moves]
  );

  return {
    gameStatus,
    currentTurnPlayerId,
    isMyTurn,
    myBoard,
    opponentBoard,
    myInfo,
    opponentInfo,
    myPlayer,
    opponentPlayer,
    moves,
    winnerId,
    opponentConnected,
    loading,
    error,
    connectionStatus,
    gameShipCount,
    submitReady,
    endPlacementTurn,
    abandonGame,
    attack,
  };
}
