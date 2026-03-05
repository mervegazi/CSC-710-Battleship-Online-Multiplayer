import type { CellState } from "../../types";

/** Ship segment position info for rendering ship shapes */
export interface ShipSegment {
  /** Whether adjacent cells in each direction are also ship cells */
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
  /** Ship neighbor info for rendering connected ship shapes */
  shipSegment?: ShipSegment;
}

/** Build border-radius based on which neighbors are ships (round exposed edges) */
function getShipRadius(seg: ShipSegment): string {
  const r = "6px";
  const z = "2px";
  // top-left, top-right, bottom-right, bottom-left
  const tl = (!seg.top && !seg.left) ? r : z;
  const tr = (!seg.top && !seg.right) ? r : z;
  const br = (!seg.bottom && !seg.right) ? r : z;
  const bl = (!seg.bottom && !seg.left) ? r : z;
  return `${tl} ${tr} ${br} ${bl}`;
}

/** Build border config: hide borders between connected ship cells */
function getShipBorders(seg: ShipSegment): React.CSSProperties {
  return {
    borderTopWidth: seg.top ? "0px" : "2px",
    borderBottomWidth: seg.bottom ? "0px" : "2px",
    borderLeftWidth: seg.left ? "0px" : "2px",
    borderRightWidth: seg.right ? "0px" : "2px",
    borderTopColor: "#94a3b8",
    borderBottomColor: "#1e293b",
    borderLeftColor: "#64748b",
    borderRightColor: "#334155",
    borderStyle: "solid",
  };
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

  // Ship-related styling
  const shipStyle: React.CSSProperties = {};
  let shipClass = "";

  if (isShip && shipSegment) {
    shipStyle.background = "linear-gradient(160deg, #4a6274 0%, #3a5060 30%, #2d4050 60%, #3a5060 100%)";
    shipStyle.borderRadius = getShipRadius(shipSegment);
    Object.assign(shipStyle, getShipBorders(shipSegment));
    shipClass = "ship-cell";
  } else if (isShip) {
    shipStyle.background = "linear-gradient(160deg, #4a6274 0%, #3a5060 30%, #2d4050 60%, #3a5060 100%)";
    shipClass = "ship-cell";
  } else if (isHit) {
    shipStyle.background = "linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #b91c1c 100%)";
  } else if (isSunk) {
    shipStyle.background = "linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #450a0a 100%)";
  }

  // Determine cell background class
  let bgClass = "";
  if (!isShip && !isHit && !isSunk) {
    bgClass = isMiss ? "bg-slate-700" : "bg-slate-800 hover:bg-slate-700";
  }
  if (isHit) bgClass += " animate-pulse";

  // Icon
  let icon = "";
  if (isHit) icon = "🔥";
  else if (isSunk) icon = "💀";
  else if (isMiss) icon = "•";

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
        ${!isShip || !shipSegment ? "rounded-sm border border-slate-700/50" : ""}
        text-[10px] sm:text-xs md:text-sm
        transition-colors duration-150
        disabled:cursor-default
        ${previewStatus === "valid" ? "ring-2 ring-emerald-400" : ""}
        ${previewStatus === "invalid" ? "ring-2 ring-red-400" : ""}
        ${bgClass}
        ${!disabled && state === "empty" ? "cursor-pointer" : "cursor-default"}
        ${shipClass}
      `}
      style={shipStyle}
    >
      {icon}
    </button>
  );
}
