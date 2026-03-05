import type { CellState } from "../../types";

/** Ship segment position info for rendering ship shapes */
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

/* ─────────────────────────────────────────────────────────────────────
 * Ship segment SVG renderers
 * Each function returns a small SVG that fits one grid cell.
 * They tile together to form complete ship shapes.
 * ───────────────────────────────────────────────────────────────────── */

type SegmentType = "single" | "bow" | "hull" | "stern";
type Orientation = "h" | "v";

function classifySegment(seg: ShipSegment): { type: SegmentType; orientation: Orientation } {
  const { top, bottom, left, right } = seg;

  // Single cell ship
  if (!top && !bottom && !left && !right) return { type: "single", orientation: "h" };

  // Horizontal ship
  if (left || right) {
    if (!left && right) return { type: "bow", orientation: "h" };     // left end
    if (left && right) return { type: "hull", orientation: "h" };     // middle
    if (left && !right) return { type: "stern", orientation: "h" };   // right end
  }

  // Vertical ship
  if (top || bottom) {
    if (!top && bottom) return { type: "bow", orientation: "v" };     // top end
    if (top && bottom) return { type: "hull", orientation: "v" };     // middle
    if (top && !bottom) return { type: "stern", orientation: "v" };   // bottom end
  }

  return { type: "single", orientation: "h" };
}

/** SVG for a single-cell ship (small boat) */
function SingleShipSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Water line */}
      <ellipse cx="20" cy="28" rx="16" ry="5" fill="#1e3a5f" opacity="0.5" />
      {/* Hull */}
      <path d="M6 25 L12 32 L28 32 L34 25 Z" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck */}
      <rect x="10" y="20" width="20" height="6" rx="2" fill="#6b8fa8" stroke="#4a7088" strokeWidth="0.5" />
      {/* Cabin */}
      <rect x="15" y="14" width="10" height="7" rx="1" fill="#4a7088" stroke="#3d5a6e" strokeWidth="0.5" />
      {/* Mast */}
      <line x1="20" y1="6" x2="20" y2="14" stroke="#8ba4b5" strokeWidth="1.5" />
      {/* Flag */}
      <polygon points="20,6 28,9 20,12" fill="#e74c3c" opacity="0.9" />
    </svg>
  );
}

/** Horizontal bow (left end of ship) */
function HBowSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Hull - pointed left end */}
      <path d="M4 20 L14 8 L40 8 L40 32 L14 32 Z" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck line */}
      <path d="M12 16 L40 16 L40 24 L12 24 Z" fill="#6b8fa8" opacity="0.6" />
      {/* Port hole */}
      <circle cx="26" cy="20" r="3" fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.8" />
    </svg>
  );
}

/** Horizontal hull (middle) */
function HHullSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Hull body */}
      <rect x="0" y="8" width="40" height="24" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck */}
      <rect x="0" y="16" width="40" height="8" fill="#6b8fa8" opacity="0.6" />
      {/* Port hole */}
      <circle cx="20" cy="20" r="3" fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.8" />
      {/* Deck lines */}
      <line x1="0" y1="12" x2="40" y2="12" stroke="#4a7088" strokeWidth="0.5" opacity="0.5" />
      <line x1="0" y1="28" x2="40" y2="28" stroke="#4a7088" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
}

/** Horizontal stern (right end of ship) */
function HSternSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Hull - flat right end */}
      <path d="M0 8 L30 8 L36 14 L36 26 L30 32 L0 32 Z" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck */}
      <path d="M0 16 L30 16 L30 24 L0 24 Z" fill="#6b8fa8" opacity="0.6" />
      {/* Rudder */}
      <rect x="34" y="16" width="3" height="8" rx="1" fill="#3d5a6e" />
      {/* Port hole */}
      <circle cx="16" cy="20" r="3" fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.8" />
    </svg>
  );
}

/** Vertical bow (top end) */
function VBowSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Hull - pointed top */}
      <path d="M20 4 L32 14 L32 40 L8 40 L8 14 Z" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck line */}
      <path d="M16 12 L24 12 L24 40 L16 40 Z" fill="#6b8fa8" opacity="0.6" />
      {/* Port hole */}
      <circle cx="20" cy="26" r="3" fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.8" />
    </svg>
  );
}

/** Vertical hull (middle) */
function VHullSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Hull body */}
      <rect x="8" y="0" width="24" height="40" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck */}
      <rect x="16" y="0" width="8" height="40" fill="#6b8fa8" opacity="0.6" />
      {/* Port hole */}
      <circle cx="20" cy="20" r="3" fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.8" />
      {/* Lines */}
      <line x1="12" y1="0" x2="12" y2="40" stroke="#4a7088" strokeWidth="0.5" opacity="0.5" />
      <line x1="28" y1="0" x2="28" y2="40" stroke="#4a7088" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
}

/** Vertical stern (bottom end) */
function VSternSVG() {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Hull - rounded bottom */}
      <path d="M8 0 L32 0 L32 26 L26 36 L14 36 L8 26 Z" fill="#5b7a8f" stroke="#3d5a6e" strokeWidth="1" />
      {/* Deck */}
      <path d="M16 0 L24 0 L24 28 L16 28 Z" fill="#6b8fa8" opacity="0.6" />
      {/* Rudder */}
      <rect x="17" y="34" width="6" height="4" rx="1" fill="#3d5a6e" />
      {/* Port hole */}
      <circle cx="20" cy="14" r="3" fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.8" />
    </svg>
  );
}

/** Render the appropriate ship segment SVG */
function ShipSVG({ segment }: { segment: ShipSegment }) {
  const { type, orientation } = classifySegment(segment);

  if (type === "single") return <SingleShipSVG />;

  if (orientation === "h") {
    if (type === "bow") return <HBowSVG />;
    if (type === "hull") return <HHullSVG />;
    return <HSternSVG />;
  } else {
    if (type === "bow") return <VBowSVG />;
    if (type === "hull") return <VHullSVG />;
    return <VSternSVG />;
  }
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
  shipSegment,
}: BoardCellProps) {
  const isShip = state === "ship";
  const isHit = state === "hit";
  const isSunk = state === "sunk";
  const isMiss = state === "miss";

  let bgClass = "";
  let icon = "";
  const style: React.CSSProperties = {};

  if (isShip) {
    bgClass = "bg-slate-800/40";
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
        aspect-square flex items-center justify-center
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
      {isShip && shipSegment ? (
        <ShipSVG segment={shipSegment} />
      ) : (
        icon
      )}
    </button>
  );
}
