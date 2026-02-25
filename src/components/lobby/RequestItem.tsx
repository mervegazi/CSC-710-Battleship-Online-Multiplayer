import { Button } from "../common/Button";

interface RequestItemProps {
  requestId: string;
  requesterName: string;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  disabled?: boolean;
}

export function RequestItem({
  requestId,
  requesterName,
  onAccept,
  onReject,
  disabled,
}: RequestItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">👤</span>
        <span className="text-sm font-medium text-slate-200">
          {requesterName}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={() => onAccept(requestId)}
          disabled={disabled}
          className="bg-emerald-600 px-2.5 py-1 text-xs hover:bg-emerald-500"
        >
          Accept
        </Button>
        <Button
          variant="secondary"
          onClick={() => onReject(requestId)}
          disabled={disabled}
          className="px-2.5 py-1 text-xs"
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
