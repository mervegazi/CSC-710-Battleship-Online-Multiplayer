import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { RequestItem } from "./RequestItem";
import type { TableRequest } from "../../types";

interface HostTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: TableRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onCancelTable: () => void;
  loading?: boolean;
}

export function HostTableModal({
  isOpen,
  onClose,
  requests,
  onAccept,
  onReject,
  onCancelTable,
  loading,
}: HostTableModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Table">
      <div className="flex flex-col gap-4">
        {/* Status */}
        <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-4 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm text-amber-300">
            Waiting for challengers...
          </p>
        </div>

        {/* Incoming requests */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-300">
            Join Requests ({requests.length})
          </h4>
          {requests.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No requests yet. Other players will see your table in the lobby.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {requests.map((req) => (
                <RequestItem
                  key={req.id}
                  requestId={req.id}
                  requesterName={req.requester_name ?? "Unknown"}
                  onAccept={onAccept}
                  onReject={onReject}
                  disabled={loading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Cancel table */}
        <Button
          variant="secondary"
          fullWidth
          onClick={onCancelTable}
          disabled={loading}
          className="border-red-500/30 text-red-400 hover:border-red-400 hover:text-red-300"
        >
          Cancel Table
        </Button>
      </div>
    </Modal>
  );
}
