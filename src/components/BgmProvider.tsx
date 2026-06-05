"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type BgmTrack = "default";
type EffectTrack = "ranking";

type BgmContextType = {
  enabled: boolean;
  ready: boolean;
  volume: number;
  toggle: () => Promise<void>;
  stop: () => void;
  setTrack: (track: BgmTrack) => Promise<void>;
  playEffect: (track: EffectTrack) => Promise<void>;
  setVolume: (volume: number) => void;
};

const BgmContext = createContext<BgmContextType | null>(null);

const trackSources: Record<BgmTrack, string> = {
  default: "/bgm.mp3",
};

const effectSources: Record<EffectTrack, string> = {
  ranking: "/ranking.mp3",
};

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, volume));
}

export function BgmProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const effectAudioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<BgmTrack>("default");
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("bgm-enabled") === "true";
  });
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 35;
    const saved = Number(window.localStorage.getItem("bgm-volume") ?? "35");
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 35;
  });

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(trackSources.default);
      audio.loop = true;
      audio.volume = clampVolume(volume / 100);
      audioRef.current = audio;
    } else {
      audioRef.current.volume = clampVolume(volume / 100);
    }

    return audioRef.current;
  }, [volume]);

  const stop = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setEnabled(false);
    window.localStorage.setItem("bgm-enabled", "false");
  }, [ensureAudio]);

  const toggle = useCallback(async () => {
    const audio = ensureAudio();
    if (!audio) return;

    if (enabled) {
      audio.pause();
      audio.currentTime = 0;
      setEnabled(false);
      window.localStorage.setItem("bgm-enabled", "false");
      return;
    }

    try {
      await audio.play();
      setEnabled(true);
      window.localStorage.setItem("bgm-enabled", "true");
    } catch {
      setEnabled(false);
      window.localStorage.setItem("bgm-enabled", "false");
    }
  }, [enabled, ensureAudio]);

  const setTrack = useCallback(
    async (nextTrack: BgmTrack) => {
      const audio = ensureAudio();
      if (!audio) return;
      if (trackRef.current === nextTrack) return;

      const shouldResume = enabled && !audio.paused;
      audio.pause();
      audio.currentTime = 0;
      audio.src = trackSources[nextTrack];
      audio.load();
      trackRef.current = nextTrack;

      if (enabled || shouldResume) {
        try {
          await audio.play();
          setEnabled(true);
          window.localStorage.setItem("bgm-enabled", "true");
        } catch {
          setEnabled(false);
          window.localStorage.setItem("bgm-enabled", "false");
        }
      }
    },
    [enabled, ensureAudio]
  );

  const playEffect = useCallback(async (nextTrack: EffectTrack) => {
    if (!effectAudioRef.current) {
      const effectAudio = new Audio(effectSources[nextTrack]);
      effectAudio.volume = 0.28;
      effectAudioRef.current = effectAudio;
    }

    const effectAudio = effectAudioRef.current;
    effectAudio.volume = 0.28;
    effectAudio.pause();
    effectAudio.currentTime = 0;
    effectAudio.src = effectSources[nextTrack];
    effectAudio.load();

    try {
      await effectAudio.play();
    } catch {
      // Ignore autoplay failures; the page remains usable.
    }
  }, []);

  const setVolume = useCallback(
    (nextVolume: number) => {
      const normalized = Math.min(100, Math.max(0, Math.round(nextVolume)));
      setVolumeState(normalized);
      window.localStorage.setItem("bgm-volume", String(normalized));

      const audio = ensureAudio();
      if (audio) {
        audio.volume = clampVolume(normalized / 100);
      }
    },
    [ensureAudio]
  );

  const value = useMemo(() => {
    return {
      enabled,
      ready: true,
      volume,
      toggle,
      stop,
      setTrack,
      playEffect,
      setVolume,
    };
  }, [enabled, playEffect, setTrack, setVolume, stop, toggle, volume]);

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}

export function useBgm() {
  const context = useContext(BgmContext);
  if (!context) {
    throw new Error("useBgm must be used within BgmProvider");
  }
  return context;
}
