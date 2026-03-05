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

/** Visual config per cell state */
const cellConfig: Record<CellState, { bg: string; icon: string; style?: React.CSSProperties }> = {
  empty: {
    bg: "bg-slate-800 hover:bg-slate-700",
    icon: "",
  },
  ship: {
    bg: "",
    icon: "⚓",
    style: {
      background: "linear-gradient(135deg, #334155 0%, #475569 40%, #64748b 60%, #475569 100%)",
      borderTop: "2px solid #94a3b8",
      borderBottom: "2px solid #1e293b",
    },
  },
  hit: {
    bg: "animate-pulse",
    icon: "🔥",
    style: {
      background: "linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #b91c1c 100%)",
    },
  },
  miss: {
    bg: "bg-slate-700",
    icon: "•",
  },
  sunk: {
    bg: "",
    icon: "💀",
    style: {
      background: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #450a0a 100%)",
    },
  },
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
  disabled,
}: BoardCellProps) {
  const { bg, icon, style } = cellConfig[state];

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
        ${state === "ship" ? "ship-cell" : ""}
      `}
      style={style}
    >
      {icon}
    </button>
  );
}
