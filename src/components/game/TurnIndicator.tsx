interface TurnIndicatorProps {
  isMyTurn: boolean;
  opponentName: string;
}

export function TurnIndicator({ isMyTurn, opponentName }: TurnIndicatorProps) {
  if (isMyTurn) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-center text-sm font-semibold text-emerald-300">
        Your Turn — Click a cell to fire!
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 text-center text-sm font-semibold text-amber-300">
      Waiting for {opponentName}...
    </div>
  );
}
