import type { CellState } from "../../types";

export interface ShipSegment {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

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
  shipSegment?: ShipSegment;
}

/** Small ship SVG that fits within a single cell — mast, flag, cabin, hull */
function ShipIcon() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="w-[70%] h-[70%]"
      xmlns="http://www.w3.org/2000/svg"
      style={{ pointerEvents: "none" }}
    >
      {/* Hull */}
      <path d="M6 26 L12 33 L28 33 L34 26 Z" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck */}
      <rect x="10" y="21" width="20" height="6" rx="2" fill="#6b8fa8" stroke="#4a7088" strokeWidth="0.5" />
      {/* Cabin */}
      <rect x="15" y="15" width="10" height="7" rx="1" fill="#4a7088" stroke="#3d5a6e" strokeWidth="0.5" />
      {/* Mast */}
      <line x1="20" y1="7" x2="20" y2="15" stroke="#8ba4b5" strokeWidth="1.5" />
      {/* Flag */}
      <polygon points="20,7 28,10 20,13" fill="#e74c3c" opacity="0.9" />
    </svg>
  );
}

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
  const isShip = state === "ship";
  const isHit = state === "hit";
  const isSunk = state === "sunk";
  const isMiss = state === "miss";

  let bgClass = "";
  let icon: React.ReactNode = null;
  const style: React.CSSProperties = {};

  if (isShip) {
    bgClass = "bg-slate-800";
    icon = <ShipIcon />;
  } else if (isHit) {
    style.background = "linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #b91c1c 100%)";
    bgClass = "animate-pulse";
    icon = "🔥";
  } else if (isSunk) {
    style.background = "linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #450a0a 100%)";
    icon = "💀";
  } else if (isMiss) {
    bgClass = "bg-slate-700";
    icon = "•";
  } else {
    bgClass = "bg-slate-800 hover:bg-slate-700";
  }

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
        aspect-square flex items-center justify-center overflow-hidden
        rounded-sm border border-slate-700/50
        text-[10px] sm:text-xs md:text-sm
        transition-colors duration-150
        disabled:cursor-default
        ${previewStatus === "valid" ? "ring-2 ring-emerald-400" : ""}
        ${previewStatus === "invalid" ? "ring-2 ring-red-400" : ""}
        ${bgClass}
        ${!disabled && state === "empty" ? "cursor-pointer" : "cursor-default"}
      `}
      style={style}
    >
      {icon}
    </button>
  );
}
