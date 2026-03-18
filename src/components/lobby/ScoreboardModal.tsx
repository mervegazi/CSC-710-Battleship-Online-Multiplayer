import { useEffect } from "react";
import { Modal } from "../common/Modal";
import { useLeaderboard } from "../../hooks/useLeaderboard";
import { useAuth } from "../../hooks/useAuth";

interface ScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScoreboardModal({ isOpen, onClose }: ScoreboardModalProps) {
  const { user } = useAuth();
  const { leaderboard, myRank, myPoints, loading, refresh } = useLeaderboard();

  // Refresh data when modal opens
  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🏆 Scoreboard">
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-blue-400" />
          </div>
        ) : (
          <>
            {/* Top 10 Table */}
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/80">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Rank
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Player
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                      W/L
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-sm text-slate-500"
                      >
                        No players yet. Be the first to score!
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((entry, idx) => {
                      const rank = idx + 1;
                      const isMe = entry.id === user?.id;
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-slate-800 transition-colors ${
                            isMe
                              ? "bg-blue-950/30"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-sm">
                            {rank <= 3 ? (
                              <span className="text-lg">{medals[rank - 1]}</span>
                            ) : (
                              <span className="text-slate-400 font-medium">
                                #{rank}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`font-medium ${
                                isMe ? "text-blue-300" : "text-slate-200"
                              }`}
                            >
                              {entry.display_name}
                              {isMe && (
                                <span className="ml-1.5 text-[10px] uppercase text-blue-400">
                                  (you)
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs">
                            <span className="text-green-400">{entry.wins}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-red-400">{entry.losses}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-bold text-amber-400">
                              {entry.total_points.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Current player rank (if not in top 10) */}
            {user && myRank !== null && myRank > 10 && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-400">
                      #{myRank}
                    </span>
                    <span className="text-sm font-medium text-blue-300">
                      Your Ranking
                    </span>
                  </div>
                  <span className="font-bold text-amber-400">
                    {myPoints.toLocaleString()} pts
                  </span>
                </div>
              </div>
            )}

            {/* If user has no rank at all - hasn't played */}
            {user && myRank !== null && myRank <= 10 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {myRank <= 3 ? medals[myRank - 1] : `#${myRank}`}
                    </span>
                    <span className="text-sm font-medium text-emerald-300">
                      Your Ranking
                    </span>
                  </div>
                  <span className="font-bold text-amber-400">
                    {myPoints.toLocaleString()} pts
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
