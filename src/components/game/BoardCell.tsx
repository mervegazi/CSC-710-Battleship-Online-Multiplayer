import type { CellState } from "../../types";

interface BoardCellProps {
  state: CellState;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

const cellConfig: Record<CellState, { bg: string; icon: string }> = {
  empty: { bg: "bg-slate-800 hover:bg-slate-700", icon: "" },
  ship: { bg: "bg-blue-600", icon: "" },
  hit: { bg: "bg-red-600 animate-pulse", icon: "🔥" },
  miss: { bg: "bg-slate-700", icon: "•" },
  sunk: { bg: "bg-red-900", icon: "💀" },
};

export function BoardCell({ state, label, onClick, disabled }: BoardCellProps) {
  const { bg, icon } = cellConfig[state];

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`
        aspect-square flex items-center justify-center
        rounded-sm border border-slate-700/50
        text-[10px] sm:text-xs md:text-sm
        transition-colors duration-150
        disabled:cursor-default
        ${bg}
        ${!disabled && state === "empty" ? "cursor-pointer" : "cursor-default"}
      `}
    >
      {icon}
    </button>
  );
}
