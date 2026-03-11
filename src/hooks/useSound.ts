import { useCallback } from "react";
import { soundService, type SoundId } from "../lib/soundService";

export function useSound() {
  const play = useCallback((id: SoundId) => {
    soundService.play(id);
  }, []);

  return { play, soundService };
}
