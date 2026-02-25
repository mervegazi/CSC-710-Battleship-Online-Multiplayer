import { Button } from "../common/Button";

interface TableCardProps {
  tableId: string;
  hostName: string;
  createdAt: string;
  isOwnTable: boolean;
  canJoin: boolean;
  onJoin: (tableId: string) => void;
}

export function TableCard({
  tableId,
  hostName,
  createdAt,
  isOwnTable,
  canJoin,
  onJoin,
}: TableCardProps) {
  const timeAgo = getTimeAgo(createdAt);

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm">
          🎯
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">
            {hostName}
            {isOwnTable && (
              <span className="ml-1.5 text-xs text-blue-400">(You)</span>
            )}
          </p>
          <p className="text-xs text-slate-500">{timeAgo}</p>
        </div>
      </div>

      {!isOwnTable && (
        <Button
          variant="primary"
          onClick={() => onJoin(tableId)}
          disabled={!canJoin}
          className="px-3 py-1.5 text-xs"
        >
          Request to Join
        </Button>
      )}

      {isOwnTable && (
        <span className="text-xs text-amber-400">Waiting for challengers...</span>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
