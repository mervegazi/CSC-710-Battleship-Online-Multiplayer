import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
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

export interface UseGameReturn {
  gameStatus: GameStatus;
  isMyTurn: boolean;
  myBoard: CellState[][];
  opponentBoard: CellState[][];
  myInfo: PlayerInfo | null;
  opponentInfo: PlayerInfo | null;
  myPlayer: GamePlayer | null;
  winnerId: string | null;
  loading: boolean;
  error: string | null;
  submitReady: (fleet: MatchShip[]) => Promise<void>;
  attack: (row: number, col: number) => Promise<void>;
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
  // Prevent duplicate attack processing
  const attackingRef = useRef(false);

  const gameStatus: GameStatus = game?.status ?? "setup";
  const isMyTurn = game?.current_turn === user?.id && gameStatus === "in_progress";
  const winnerId = game?.winner_id ?? null;

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
      .subscribe();

    channelRef.current = channel;

    return () => {
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

      const moveNumber = moves.length + 1;

      try {
        // INSERT move
        const { error: moveError } = await supabase.from("moves").insert({
          game_id: gameId,
          player_id: user.id,
          x: col,
          y: row,
          result,
          sunk_ship: sunkShip?.type ?? null,
          move_number: moveNumber,
        });

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
    isMyTurn,
    myBoard,
    opponentBoard,
    myInfo,
    opponentInfo,
    myPlayer,
    winnerId,
    loading,
    error,
    submitReady,
    attack,
  };
}
