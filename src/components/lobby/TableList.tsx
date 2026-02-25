import { TableCard } from "./TableCard";
import type { Table } from "../../types";

interface TableListProps {
  tables: Table[];
  currentUserId: string;
  canJoin: boolean;
  onJoinRequest: (tableId: string) => void;
}

export function TableList({
  tables = [],
  currentUserId,
  canJoin,
  onJoinRequest,
}: TableListProps) {
  return (
    <div className="flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900">
      <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-300">
        Open Tables ({tables.length})
      </h3>
      {tables.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-slate-500">
            No tables yet. Create a table or use Quick Match.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              tableId={table.id}
              hostName={table.host_name ?? "Unknown"}
              createdAt={table.created_at}
              isOwnTable={table.host_id === currentUserId}
              canJoin={canJoin && table.host_id !== currentUserId}
              onJoin={onJoinRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
