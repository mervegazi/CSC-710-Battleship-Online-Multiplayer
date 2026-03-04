import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/** Heartbeat interval: update DB every 10 seconds */
const HEARTBEAT_INTERVAL = 10_000;
/** If opponent's last_heartbeat is older than 30 seconds, consider them disconnected */
const STALE_THRESHOLD = 30_000;
/** How often we poll the opponent's heartbeat from DB */
const POLL_INTERVAL = 5_000;

export interface UseHeartbeatReturn {
    /** Whether the opponent is currently connected (heartbeat is fresh) */
    opponentConnected: boolean;
    /** Timestamp of the opponent's last heartbeat, or null if unknown */
    opponentLastSeen: number | null;
}

/**
 * Database-based heartbeat for disconnect detection.
 *
 * Each player writes their `last_heartbeat` column in games_players every 10s.
 * We poll the opponent's `last_heartbeat` every 5s.
 * If it's older than 30s, we mark them as disconnected.
 */
export function useHeartbeat(
    gameId: string | undefined,
    userId: string | undefined,
    active: boolean = true
): UseHeartbeatReturn {
    const [opponentConnected, setOpponentConnected] = useState(true);
    const [opponentLastSeen, setOpponentLastSeen] = useState<number | null>(null);

    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    const clearTimers = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // ── Send our heartbeat to DB ──────────────────────────────────────
    const sendHeartbeat = useCallback(async () => {
        if (!gameId || !userId) return;

        const now = new Date().toISOString();
        const { error } = await supabase
            .from("games_players")
            .update({ last_heartbeat: now })
            .eq("game_id", gameId)
            .eq("player_id", userId);

        if (error) {
            console.warn("[Heartbeat] failed to send:", error.message);
        }
    }, [gameId, userId]);

    // ── Poll opponent's heartbeat from DB ─────────────────────────────
    const pollOpponent = useCallback(async () => {
        if (!gameId || !userId || !mountedRef.current) return;

        const { data, error } = await supabase
            .from("games_players")
            .select("last_heartbeat")
            .eq("game_id", gameId)
            .neq("player_id", userId)
            .single();

        if (error || !data) {
            console.warn("[Heartbeat] failed to poll opponent:", error?.message);
            return;
        }

        const lastHeartbeat = data.last_heartbeat;
        if (!lastHeartbeat) {
            // Opponent hasn't sent any heartbeat yet — give them grace period
            return;
        }

        const lastSeenMs = new Date(lastHeartbeat).getTime();
        const elapsed = Date.now() - lastSeenMs;

        setOpponentLastSeen(lastSeenMs);

        if (elapsed > STALE_THRESHOLD) {
            console.log("[Heartbeat] opponent stale — elapsed:", Math.round(elapsed / 1000), "s");
            setOpponentConnected(false);
        } else {
            setOpponentConnected(true);
        }
    }, [gameId, userId]);

    useEffect(() => {
        mountedRef.current = true;

        if (!gameId || !userId || !active) {
            clearTimers();
            setOpponentConnected(true);
            return;
        }

        // Send initial heartbeat immediately
        sendHeartbeat();
        // Poll opponent immediately
        pollOpponent();

        // Set up recurring heartbeat (every 10s)
        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

        // Set up recurring poll (every 5s)
        pollRef.current = setInterval(pollOpponent, POLL_INTERVAL);

        return () => {
            mountedRef.current = false;
            clearTimers();
        };
    }, [gameId, userId, active, sendHeartbeat, pollOpponent, clearTimers]);

    return { opponentConnected, opponentLastSeen };
}
