// Module-level singleton — no React dependency.
// Manages a single AudioContext, preloads audio buffers, and plays sounds.

export type SoundId =
  | "cannon"
  | "splash"
  | "explosion"
  | "sunk"
  | "hit_incoming"
  | "splash_incoming"
  | "your_turn"
  | "ship_placed"
  | "match_found"
  | "victory"
  | "defeat"
  | "chat_receive";

const PREFS_KEY = "battleship_audio_prefs";

interface AudioPrefs {
  masterMuted: boolean;
  sfxVolume: number; // 0-100
  schemaVersion: number;
}

const DEFAULT_PREFS: AudioPrefs = {
  masterMuted: false,
  sfxVolume: 70,
  schemaVersion: 1,
};

// Per-sound relative volume (0-1) so combat sounds are louder than UI pings
const SOUND_GAIN: Partial<Record<SoundId, number>> = {
  cannon: 0.8,
  splash: 0.6,
  explosion: 0.7,
  sunk: 0.85,
  hit_incoming: 0.7,
  splash_incoming: 0.6,
  your_turn: 0.5,
  ship_placed: 0.4,
  match_found: 0.7,
  victory: 0.8,
  defeat: 0.7,
  chat_receive: 0.35,
};

function detectAudioExt(): "ogg" | "mp3" {
  const audio = document.createElement("audio");
  return audio.canPlayType('audio/ogg; codecs="vorbis"') !== "" ? "ogg" : "mp3";
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AudioPrefs;
      if (parsed.schemaVersion === 1) return parsed;
    }
  } catch {
    // corrupt — fall through to defaults
  }
  // Respect reduced-motion preference as a heuristic for sensory sensitivity
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const prefs = { ...DEFAULT_PREFS, masterMuted: reducedMotion };
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return prefs;
}

function savePrefs(prefs: AudioPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

class SoundService {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  private prefs: AudioPrefs;
  private preloaded = false;
  private ext: string;
  private unlocked = false;

  constructor() {
    this.prefs = loadPrefs();
    this.ext = typeof document !== "undefined" ? detectAudioExt() : "mp3";
    if (typeof document !== "undefined") {
      this.attachUnlockListeners();
      this.attachVisibilityListener();
    }
  }

  // --- AudioContext management ---

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private attachUnlockListeners(): void {
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      const ctx = this.getCtx();
      // iOS silent buffer trick
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      src.disconnect();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchend", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("click", unlock, { once: false });
    document.addEventListener("touchend", unlock, { once: false });
    document.addEventListener("keydown", unlock, { once: false });
  }

  private attachVisibilityListener(): void {
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.visibilityState === "hidden") {
        void this.ctx.suspend();
      } else if (document.visibilityState === "visible") {
        if (this.ctx.state === "suspended") {
          void this.ctx.resume();
        }
      }
    });
  }

  // --- Preload ---

  async preload(): Promise<void> {
    if (this.preloaded) return;
    this.preloaded = true;

    // Respect Data Saver
    if ((navigator as any).connection?.saveData) return;

    const base = import.meta.env.BASE_URL;
    const ids: SoundId[] = [
      "cannon",
      "splash",
      "explosion",
      "sunk",
      "hit_incoming",
      "splash_incoming",
      "your_turn",
      "ship_placed",
      "match_found",
      "victory",
      "defeat",
      "chat_receive",
    ];

    const ctx = this.getCtx();
    await Promise.allSettled(
      ids.map(async (id) => {
        try {
          const res = await fetch(`${base}sounds/${id}.${this.ext}`);
          if (!res.ok) return;
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          this.buffers.set(id, audioBuf);
        } catch {
          // Missing file — fail silently
        }
      })
    );
  }

  // --- Playback ---

  play(id: SoundId): void {
    if (this.prefs.masterMuted) return;
    const buffer = this.buffers.get(id);
    if (!buffer) return;

    const ctx = this.getCtx();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const relativeGain = SOUND_GAIN[id] ?? 0.6;
    gain.gain.value = (this.prefs.sfxVolume / 100) * relativeGain;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    source.onended = () => source.disconnect();
  }

  // --- Preferences ---

  isMuted(): boolean {
    return this.prefs.masterMuted;
  }

  setMuted(muted: boolean): void {
    this.prefs.masterMuted = muted;
    savePrefs(this.prefs);
  }

  getVolume(): number {
    return this.prefs.sfxVolume;
  }

  setVolume(v: number): void {
    this.prefs.sfxVolume = Math.max(0, Math.min(100, v));
    savePrefs(this.prefs);
  }

  // --- Cleanup ---

  async dispose(): Promise<void> {
    this.buffers.clear();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundService = new SoundService();
