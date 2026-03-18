import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  total_points: number;
  wins: number;
  losses: number;
}

export interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  myPoints: number;
  loading: boolean;
  refresh: () => void;
}

export function useLeaderboard(): UseLeaderboardReturn {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch top players by total_points, then sort by win/loss ratio for ties
      const { data: top, error: topError } = await supabase
        .from("profiles")
        .select("id, display_name, total_points, wins, losses")
        .order("total_points", { ascending: false })
        .order("wins", { ascending: false })
        .limit(20);

      if (topError) {
        console.error("Leaderboard fetch error:", topError);
        return;
      }

      // Secondary sort: when points are tied, higher win/loss ratio ranks first
      const winRatio = (e: LeaderboardEntry) => {
        const total = e.wins + e.losses;
        return total > 0 ? e.wins / total : 0;
      };
      const sorted = ((top ?? []) as LeaderboardEntry[]).sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        return winRatio(b) - winRatio(a);
      });

      const entries = sorted.slice(0, 10);
      setLeaderboard(entries);

      // Determine current user's rank and points
      if (user) {
        // Check if user is in top 10
        const inTop10 = entries.findIndex((e) => e.id === user.id);
        if (inTop10 !== -1) {
          setMyRank(inTop10 + 1);
          setMyPoints(entries[inTop10].total_points);
        } else {
          // Fetch player's own data
          const { data: myProfile } = await supabase
            .from("profiles")
            .select("total_points")
            .eq("id", user.id)
            .single();

          const pts = (myProfile?.total_points as number) ?? 0;
          setMyPoints(pts);

          // Count how many players have more points
          const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gt("total_points", pts);

          setMyRank(count !== null ? count + 1 : null);
        }
      }
    } catch (err) {
      console.error("Leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaderboard, myRank, myPoints, loading, refresh: fetchLeaderboard };
}
