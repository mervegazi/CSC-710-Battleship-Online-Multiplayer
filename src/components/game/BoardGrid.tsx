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
    /** When false the grid is view-only (no hover / click) */
    interactive?: boolean;
    /** Optional heading rendered above the grid */
    title?: string;
}

export function BoardGrid({
    cells,
    onCellClick,
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

            {/* Responsive wrapper — never wider than 500 px, fills 90 vw on small screens */}
            <div
                className="w-full"
                style={{ maxWidth: "min(90vw, 500px)" }}
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
                            {COL_LABELS.map((colLabel, colIdx) => (
                                <BoardCell
                                    key={`${rowIdx}-${colIdx}`}
                                    state={cells[rowIdx][colIdx]}
                                    label={`${colLabel}${rowLabel}`}
                                    onClick={
                                        interactive && onCellClick
                                            ? () => onCellClick(rowIdx, colIdx)
                                            : undefined
                                    }
                                    disabled={!interactive}
                                />
                            ))}
                        </Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}

