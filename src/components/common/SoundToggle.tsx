import { useState, useRef, useEffect } from "react";
import { soundService } from "../../lib/soundService";

export function SoundToggle() {
  const [muted, setMuted] = useState(soundService.isMuted());
  const [volume, setVolume] = useState(soundService.getVolume());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Global M key to toggle mute (only when not typing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "m" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        const next = !soundService.isMuted();
        soundService.setMuted(next);
        setMuted(next);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    soundService.setMuted(next);
    setMuted(next);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    soundService.setVolume(v);
    setVolume(v);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        aria-pressed={muted}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
        title="Sound settings (M to mute)"
      >
        {muted ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sound Settings
          </p>

          <div className="mt-3 flex items-center justify-between">
            <label htmlFor="sfx-volume" className="text-xs text-slate-300">
              SFX Volume
            </label>
            <span className="text-xs tabular-nums text-slate-500">
              {volume}%
            </span>
          </div>
          <input
            id="sfx-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={handleVolume}
            disabled={muted}
            aria-label="SFX volume"
            aria-valuetext={`${volume} percent`}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          />

          <button
            type="button"
            onClick={toggleMute}
            className="mt-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            {muted ? "Unmute" : "Mute All"}
          </button>

          <p className="mt-2 text-center text-[10px] text-slate-600">
            Press M to toggle mute
          </p>
        </div>
      )}
    </div>
  );
}
