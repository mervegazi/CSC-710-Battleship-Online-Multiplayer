import { Fragment } from "react";
import type { CellState } from "../../types";
import { BoardCell } from "./BoardCell";

const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ROW_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface BoardGridProps {
    /** 10×10 matrix — outer = rows (0-9), inner = cols (0-9) */
    cells: CellState[][];
    /** Fired when a cell is clicked; (row, col) are 0-indexed */
    onCellClick?: (row: number, col: number) => void;
    onCellDrop?: (row: number, col: number) => void;
    onCellDragOver?: (row: number, col: number) => void;
    onCellDragStart?: (row: number, col: number) => void;
    onCellDragEnd?: () => void;
    previewMap?: Record<string, "valid" | "invalid">;
    /** When false the grid is view-only (no hover / click) */
    interactive?: boolean;
    /** Optional heading rendered above the grid */
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
    return (
        <div className="flex flex-col items-center gap-2 w-full">
            {title && (
                <h2 className="text-sm sm:text-base font-semibold text-slate-200 tracking-wide uppercase">
                    {title}
                </h2>
            )}

            {/* Responsive wrapper — never wider than 500 px, with breathing room on mobile */}
            <div
                className="w-full px-2 sm:px-0"
                style={{ maxWidth: "min(85vw, 500px)" }}
            >
                <div
                    className="grid gap-[2px] sm:gap-1"
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
                </div>
            </div>
        </div>
    );
}

