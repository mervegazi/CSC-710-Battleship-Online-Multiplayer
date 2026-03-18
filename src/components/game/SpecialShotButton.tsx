import { useState } from "react";

const COL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ROW_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface SpecialShotButtonProps {
  isMyTurn: boolean;
  specialShotUsed: boolean;
  isPlaying: boolean;
  onSpecialAttack: (direction: "row" | "col", index: number) => Promise<void>;
}

type Direction = "row" | "col" | null;

export function SpecialShotButton({
  isMyTurn,
  specialShotUsed,
  isPlaying,
  onSpecialAttack,
}: SpecialShotButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [firing, setFiring] = useState(false);

  // Don't render if not during gameplay
  if (!isPlaying) return null;

  const handleToggle = () => {
    if (specialShotUsed) return;
    setIsOpen((prev) => !prev);
    setDirection(null);
    setSelectedIndex(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setDirection(null);
    setSelectedIndex(null);
  };

  const handleDirectionPick = (dir: Direction) => {
    setDirection(dir);
    setSelectedIndex(null);
  };

  const handleFire = async () => {
    if (!direction || selectedIndex === null || firing) return;
    setFiring(true);
    try {
      await onSpecialAttack(direction, selectedIndex);
      handleClose();
    } finally {
      setFiring(false);
    }
  };

  const targetLabel =
    direction === "col"
      ? `Column ${COL_LABELS[selectedIndex ?? 0]}`
      : `Row ${ROW_LABELS[selectedIndex ?? 0]}`;

  const disabled = specialShotUsed || !isMyTurn;

  return (
    <>
      {/* Floating button — fixed on left side */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title={
          specialShotUsed
            ? "Special shot already used"
            : !isMyTurn
            ? "Wait for your turn"
            : "Special Shot — Attack entire row or column"
        }
        className={`
          fixed left-3 top-1/2 -translate-y-1/2 z-40
          flex items-center justify-center
          w-12 h-12 sm:w-14 sm:h-14
          rounded-full shadow-lg border-2
          transition-all duration-200
          ${
            specialShotUsed
              ? "bg-slate-800 border-slate-600 opacity-50 cursor-not-allowed"
              : disabled
              ? "bg-slate-800 border-slate-600 opacity-60 cursor-not-allowed"
              : isOpen
              ? "bg-red-600 border-red-400 hover:bg-red-500 scale-110"
              : "bg-gradient-to-br from-amber-500 to-red-600 border-amber-400 hover:scale-110 hover:shadow-amber-500/40 hover:shadow-xl animate-pulse"
          }
        `}
      >
        <span className="text-xl sm:text-2xl select-none">
          {specialShotUsed ? "✗" : "🚀"}
        </span>
      </button>

      {/* "Used" badge */}
      {specialShotUsed && (
        <div className="fixed left-2 top-1/2 translate-y-5 sm:translate-y-6 z-40 text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider text-center w-14 sm:w-16">
          Used
        </div>
      )}

      {/* Panel overlay */}
      {isOpen && !specialShotUsed && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={handleClose}
          />

          {/* Panel — side panel on desktop, bottom sheet on mobile */}
          <div
            className={`
              fixed z-50
              md:left-20 md:top-1/2 md:-translate-y-1/2 md:w-72
              max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full
              rounded-xl md:rounded-xl max-md:rounded-t-2xl max-md:rounded-b-none
              border border-slate-700 bg-slate-900/95 backdrop-blur-sm
              shadow-2xl
              animate-in
            `}
            style={{
              animation: "fadeSlideIn 0.2s ease-out",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                🚀 Special Shot
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Step 1: Direction picker */}
              <div>
                <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
                  Choose Direction
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectionPick("row")}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      direction === "row"
                        ? "border-amber-400 bg-amber-950/40 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="text-lg">↔️</span>
                    <span>Horizontal</span>
                    <span className="text-[10px] text-slate-500 font-normal">Row 1–10</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionPick("col")}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      direction === "col"
                        ? "border-amber-400 bg-amber-950/40 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="text-lg">↕️</span>
                    <span>Vertical</span>
                    <span className="text-[10px] text-slate-500 font-normal">Column A–J</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Target selector */}
              {direction && (
                <div>
                  <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
                    Select {direction === "row" ? "Row" : "Column"}
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(direction === "col" ? COL_LABELS : ROW_LABELS).map(
                      (label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setSelectedIndex(idx)}
                          className={`rounded-md border px-2 py-1.5 text-xs font-bold transition-colors ${
                            selectedIndex === idx
                              ? "border-red-400 bg-red-950/50 text-red-300"
                              : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {direction && selectedIndex !== null && (
                <button
                  type="button"
                  onClick={handleFire}
                  disabled={firing || !isMyTurn}
                  className={`
                    mt-1 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all
                    ${
                      firing || !isMyTurn
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 shadow-lg hover:shadow-red-500/30"
                    }
                  `}
                >
                  {firing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-white" />
                      Firing...
                    </span>
                  ) : (
                    `🔥 Fire at ${targetLabel}`
                  )}
                </button>
              )}

              {/* Info note */}
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                Attacks all 10 cells in the selected {direction === "row" ? "row" : direction === "col" ? "column" : "line"}.
                You can only use this once per game!
              </p>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (min-width: 768px) {
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translate(0, -50%) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translate(0, -50%) scale(1);
            }
          }
        }
      `}</style>
    </>
  );
}
