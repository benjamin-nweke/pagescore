"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSoundEngine } from "@/lib/soundEngine";
import type { EngineEvent } from "@/lib/soundEngine";
import type { StoryScene } from "@/types/score";

export interface UseSoundEngineResult {
  ready: boolean;
  playing: boolean;
  init: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  setMuted: (muted: boolean) => void;
  setVolume: (v: number) => void;
  transitionTo: (scene: StoryScene) => void;
  overrideBpm: (bpm: number) => void;
  overrideFilter: (hz: number) => void;
  getWaveform: () => Float32Array | null;
  getLiveParams: () => { bpm: number; filterHz: number };
  lastEvent: EngineEvent | null;
}

export function useSoundEngine(): UseSoundEngineResult {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [lastEvent, setLastEvent] = useState<EngineEvent | null>(null);
  // Use a ref so callbacks always see the latest value without causing re-renders
  const engineRef = useRef(getSoundEngine());

  useEffect(() => {
    const engine = engineRef.current;

    const unsub = engine.subscribe((e) => {
      setLastEvent(e);
      if (e.type === "state") setPlaying(e.playing);
    });

    // Reflect current ready state in case init already ran
    if (engine.isReady()) setReady(true);

    return () => {
      unsub();
      // Only dispose on true unmount. Under React Strict Mode this fires once
      // after the second mount, but we guard inside dispose() with disposed flag.
      engine.dispose();
      setReady(false);
      setPlaying(false);
    };
  }, []);

  const init = useCallback(async () => {
    const engine = engineRef.current;
    await engine.init();
    setReady(engine.isReady());
  }, []);

  const play = useCallback(async () => {
    await engineRef.current.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current.pause();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    engineRef.current.setMuted(muted);
  }, []);

  const setVolume = useCallback((v: number) => {
    engineRef.current.setVolume(v);
  }, []);

  const transitionTo = useCallback((scene: StoryScene) => {
    engineRef.current.transitionToScene(scene);
  }, []);

  const overrideBpm = useCallback((bpm: number) => {
    engineRef.current.overrideBpm(bpm);
  }, []);

  const overrideFilter = useCallback((hz: number) => {
    engineRef.current.overrideFilter(hz);
  }, []);

  const getWaveform = useCallback(() => {
    return engineRef.current.getWaveform();
  }, []);

  const getLiveParams = useCallback(() => {
    return engineRef.current.getLiveParams();
  }, []);

  return {
    ready,
    playing,
    init,
    play,
    pause,
    setMuted,
    setVolume,
    transitionTo,
    overrideBpm,
    overrideFilter,
    getWaveform,
    getLiveParams,
    lastEvent,
  };
}
