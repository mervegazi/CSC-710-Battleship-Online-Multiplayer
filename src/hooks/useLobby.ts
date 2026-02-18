import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { PresenceState, LobbyStatus } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface LobbyStats {
  online: number;
  playing: number;
  waiting: number;
}

interface UseLobbyReturn {
  onlineUsers: PresenceState[];
  stats: LobbyStats;
  updateStatus: (status: LobbyStatus) => Promise<void>;
}

function flattenPresenceState(
  state: Record<string, { user_id: string; display_name: string; status: LobbyStatus; joined_at: string }[]>
): PresenceState[] {
  const users: PresenceState[] = [];
  for (const key of Object.keys(state)) {
    const presences = state[key];
    if (presences.length > 0) {
      users.push(presences[0]);
    }
  }
  return users;
}

export function useLobby(): UseLobbyReturn {
  const { user, profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const displayName =
    profile?.display_name ??
    (user?.user_metadata as { display_name?: string } | undefined)
      ?.display_name ??
    "Player";

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("lobby", {
      config: { presence: { key: user.id } },
    });

    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceState>();
      setOnlineUsers(flattenPresenceState(state));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          display_name: displayName,
          status: "idle" as LobbyStatus,
          joined_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, displayName]);

  const updateStatus = useCallback(
    async (status: LobbyStatus) => {
      if (!channelRef.current || !user) return;
      await channelRef.current.track({
        user_id: user.id,
        display_name: displayName,
        status,
        joined_at: new Date().toISOString(),
      });
    },
    [user, displayName]
  );

  const stats: LobbyStats = {
    online: onlineUsers.length,
    playing: onlineUsers.filter((u) => u.status === "in_game").length,
    waiting: onlineUsers.filter((u) => u.status === "in_queue").length,
  };

  return { onlineUsers, stats, updateStatus };
}
