import { Fragment, useMemo } from "react";
import type { CellState } from "../../types";
import { BoardCell } from "./BoardCell";

const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ROW_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface ShipInfo {
    startRow: number;
    startCol: number;
    length: number;
    orientation: "h" | "v";
}

/** Detect all ships from the board cells */
function detectShips(cells: CellState[][]): ShipInfo[] {
    const visited = Array.from({ length: 10 }, () => Array(10).fill(false));
    const ships: ShipInfo[] = [];

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if (cells[r][c] !== "ship" || visited[r][c]) continue;
            visited[r][c] = true;

            // Check horizontal extent
            let hLen = 1;
            while (c + hLen < 10 && cells[r][c + hLen] === "ship" && !visited[r][c + hLen]) {
                visited[r][c + hLen] = true;
                hLen++;
            }

            if (hLen > 1) {
                ships.push({ startRow: r, startCol: c, length: hLen, orientation: "h" });
                continue;
            }

            // Check vertical extent
            let vLen = 1;
            while (r + vLen < 10 && cells[r + vLen][c] === "ship" && !visited[r + vLen][c]) {
                visited[r + vLen][c] = true;
                vLen++;
            }

            ships.push({ startRow: r, startCol: c, length: vLen, orientation: vLen > 1 ? "v" : "h" });
        }
    }
    return ships;
}

/** Horizontal ship SVG — scales width based on length */
function HorizontalShipSVG({ length }: { length: number }) {
    const w = length * 40;
    const h = 40;
    // Hull proportions
    const bowX = 4;
    const sternX = w - 4;
    const hullTop = 8;
    const hullBot = h - 6;
    const deckTop = 13;
    const deckBot = h - 12;

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            style={{ pointerEvents: "none" }}
        >
            {/* Hull body */}
            <path
                d={`M${bowX} ${h / 2} L${bowX + 12} ${hullTop} L${sternX - 6} ${hullTop} L${sternX} ${hullTop + 4} L${sternX} ${hullBot - 4} L${sternX - 6} ${hullBot} L${bowX + 12} ${hullBot} Z`}
                fill="#5b7a8f"
                stroke="#3d5a6e"
                strokeWidth="1.2"
            />
            {/* Deck */}
            <rect x={bowX + 14} y={deckTop} width={w - 36} height={deckBot - deckTop} rx="2" fill="#6b8fa8" opacity="0.6" />
            {/* Cabin */}
            <rect x={w * 0.35} y={hullTop + 2} width={w * 0.2} height={deckTop - hullTop} rx="1" fill="#4a7088" stroke="#3d5a6e" strokeWidth="0.5" />
            {/* Mast */}
            <line x1={w * 0.45} y1={3} x2={w * 0.45} y2={hullTop + 2} stroke="#8ba4b5" strokeWidth="1.5" />
            {/* Flag */}
            <polygon points={`${w * 0.45},3 ${w * 0.45 + 10},6 ${w * 0.45},9`} fill="#e74c3c" opacity="0.9" />
            {/* Port holes */}
            {Array.from({ length: Math.min(length, 4) }, (_, i) => {
                const cx = bowX + 20 + i * ((w - 40) / Math.max(length - 1, 1));
                return <circle key={i} cx={cx} cy={h / 2} r={2.5} fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.6" />;
            })}
        </svg>
    );
}

/** Vertical ship SVG — scales height based on length */
function VerticalShipSVG({ length }: { length: number }) {
    const w = 40;
    const h = length * 40;
    const bowY = 4;
    const sternY = h - 4;
    const hullLeft = 8;
    const hullRight = w - 8;
    const deckLeft = 13;
    const deckRight = w - 13;

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            style={{ pointerEvents: "none" }}
        >
            {/* Hull body */}
            <path
                d={`M${w / 2} ${bowY} L${hullRight} ${bowY + 12} L${hullRight} ${sternY - 6} L${hullRight - 4} ${sternY} L${hullLeft + 4} ${sternY} L${hullLeft} ${sternY - 6} L${hullLeft} ${bowY + 12} Z`}
                fill="#5b7a8f"
                stroke="#3d5a6e"
                strokeWidth="1.2"
            />
            {/* Deck */}
            <rect x={deckLeft} y={bowY + 14} width={deckRight - deckLeft} height={h - 36} rx="2" fill="#6b8fa8" opacity="0.6" />
            {/* Cabin */}
            <rect x={hullLeft + 2} y={h * 0.35} width={deckLeft - hullLeft} height={h * 0.2} rx="1" fill="#4a7088" stroke="#3d5a6e" strokeWidth="0.5" />
            {/* Mast */}
            <line x1={w / 2} y1={bowY + 14} x2={w / 2} y2={bowY + 3} stroke="#8ba4b5" strokeWidth="1.5" />
            {/* Flag */}
            <polygon points={`${w / 2},${bowY + 3} ${w / 2 + 8},${bowY + 6} ${w / 2},${bowY + 9}`} fill="#e74c3c" opacity="0.9" />
            {/* Port holes */}
            {Array.from({ length: Math.min(length, 4) }, (_, i) => {
                const cy = bowY + 20 + i * ((h - 40) / Math.max(length - 1, 1));
                return <circle key={i} cx={w / 2} cy={cy} r={2.5} fill="#1e3a5f" stroke="#3d5a6e" strokeWidth="0.6" />;
            })}
        </svg>
    );
}

interface BoardGridProps {
    cells: CellState[][];
    onCellClick?: (row: number, col: number) => void;
    onCellDrop?: (row: number, col: number) => void;
    onCellDragOver?: (row: number, col: number) => void;
    onCellDragStart?: (row: number, col: number) => void;
    onCellDragEnd?: () => void;
    previewMap?: Record<string, "valid" | "invalid">;
    interactive?: boolean;
    title?: string;
}

export function BoardGrid({
    cells,
    onCellClick,
    onCellDrop,
    onCellDragOver,
    onCellDragStart,
    onCellDragEnd,
    previewMap,
    interactive = true,
    title,
}: BoardGridProps) {
    // Detect ships for overlay rendering
    const ships = useMemo(() => detectShips(cells), [cells]);

    return (
        <div className="flex flex-col items-center gap-2 w-full">
            {title && (
                <h2 className="text-sm sm:text-base font-semibold text-slate-200 tracking-wide uppercase">
                    {title}
                </h2>
            )}

            {/* Responsive wrapper */}
            <div
                className="w-full px-3 sm:px-0"
                style={{ maxWidth: "min(90vw, 500px)" }}
            >
                <div
                    className="grid gap-[2px] sm:gap-1 relative"
                    style={{
                        gridTemplateColumns: "auto repeat(10, 1fr)",
                        gridTemplateRows: "auto repeat(10, 1fr)",
                    }}
                >
                    {/* ──── Corner cell ──── */}
                    <div className="aspect-square" />

                    {/* ──── Column headers A-J ──── */}
                    {COL_LABELS.map((col) => (
                        <div
                            key={`col-${col}`}
                            className="flex items-center justify-center text-[10px] sm:text-xs font-bold text-blue-400 aspect-square"
                        >
                            {col}
                        </div>
                    ))}

                    {/* ──── Rows ──── */}
                    {ROW_LABELS.map((rowLabel, rowIdx) => (
                        <Fragment key={`row-${rowIdx}`}>
                            {/* Row header */}
                            <div className="flex items-center justify-center text-[10px] sm:text-xs font-bold text-blue-400 aspect-square">
                                {rowLabel}
                            </div>

                            {/* Data cells */}
                            {COL_LABELS.map((colLabel, colIdx) => {
                                const cellState = cells[rowIdx][colIdx];

                                return <BoardCell
                                    key={`${rowIdx}-${colIdx}`}
                                    state={cellState}
                                    label={`${colLabel}${rowLabel}`}
                                    onClick={
                                        interactive && onCellClick
                                            ? () => onCellClick(rowIdx, colIdx)
                                            : undefined
                                    }
                                    onDrop={
                                        interactive && onCellDrop
                                            ? () => onCellDrop(rowIdx, colIdx)
                                            : undefined
                                    }
                                    onDragOver={
                                        interactive && onCellDragOver
                                            ? () => onCellDragOver(rowIdx, colIdx)
                                            : undefined
                                    }
                                    onDragStart={
                                        interactive && onCellDragStart && cellState === "ship"
                                            ? () => onCellDragStart(rowIdx, colIdx)
                                            : undefined
                                    }
                                    onDragEnd={interactive ? onCellDragEnd : undefined}
                                    previewStatus={previewMap?.[`${rowIdx},${colIdx}`]}
                                    disabled={!interactive}
                                />;
                            })}
                        </Fragment>
                    ))}

                    {/* ──── Ship SVG overlays ──── */}
                    {ships.map((ship, idx) => {
                        // +2 because row/col 1 is the header
                        const gridRowStart = ship.startRow + 2;
                        const gridColStart = ship.startCol + 2;

                        return (
                            <div
                                key={`ship-${idx}`}
                                className="pointer-events-none z-10"
                                style={{
                                    gridRow: ship.orientation === "v"
                                        ? `${gridRowStart} / span ${ship.length}`
                                        : `${gridRowStart} / span 1`,
                                    gridColumn: ship.orientation === "h"
                                        ? `${gridColStart} / span ${ship.length}`
                                        : `${gridColStart} / span 1`,
                                }}
                            >
                                {ship.orientation === "h" ? (
                                    <HorizontalShipSVG length={ship.length} />
                                ) : (
                                    <VerticalShipSVG length={ship.length} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
