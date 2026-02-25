import type { CellState } from "../../types";

interface BoardCellProps {
  state: CellState;
  label: string;
  onClick?: () => void;
  onDrop?: () => void;
  onDragOver?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  previewStatus?: "valid" | "invalid";
  disabled?: boolean;
}

const cellConfig: Record<CellState, { bg: string; icon: string }> = {
  empty: { bg: "bg-slate-800 hover:bg-slate-700", icon: "" },
  ship: { bg: "bg-blue-600", icon: "" },
  hit: { bg: "bg-red-600 animate-pulse", icon: "🔥" },
  miss: { bg: "bg-slate-700", icon: "•" },
  sunk: { bg: "bg-red-900", icon: "💀" },
};

export function BoardCell({
  state,
  label,
  onClick,
  onDrop,
  onDragOver,
  onDragStart,
  onDragEnd,
  previewStatus,
  disabled
}: BoardCellProps) {
  const { bg, icon } = cellConfig[state];

  return (
    <button
      type="button"
      aria-label={label}
      draggable={Boolean(onDragStart) && !disabled}
      disabled={disabled}
      onClick={onClick}
      onDragStart={() => onDragStart?.()}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(event) => {
        if (disabled || !onDrop) return;
        event.preventDefault();
        onDragOver?.();
      }}
      onDrop={(event) => {
        if (disabled || !onDrop) return;
        event.preventDefault();
        onDrop();
      }}
      className={`
        aspect-square flex items-center justify-center
        rounded-sm border border-slate-700/50
        text-[10px] sm:text-xs md:text-sm
        transition-colors duration-150
        disabled:cursor-default
        ${previewStatus === "valid" ? "ring-2 ring-emerald-400" : ""}
        ${previewStatus === "invalid" ? "ring-2 ring-red-400" : ""}
        ${bg}
        ${!disabled && state === "empty" ? "cursor-pointer" : "cursor-default"}
      `}
    >
      {icon}
    </button>
  );
}
