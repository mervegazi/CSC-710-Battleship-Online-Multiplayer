import { Button } from "../common/Button";

interface CreateTableButtonProps {
  isHosting: boolean;
  hasActiveRequest: boolean;
  loading?: boolean;
  onCreateTable: () => void;
  onViewTable: () => void;
}

export function CreateTableButton({
  isHosting,
  hasActiveRequest,
  loading,
  onCreateTable,
  onViewTable,
}: CreateTableButtonProps) {
  if (isHosting) {
    return (
      <Button
        variant="secondary"
        fullWidth
        onClick={onViewTable}
        className="border-amber-500/50 text-amber-300 hover:border-amber-400 hover:text-amber-200"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          View Your Table
        </span>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      fullWidth
      onClick={onCreateTable}
      disabled={loading || hasActiveRequest}
      isLoading={loading}
    >
      + Create Table
    </Button>
  );
}
