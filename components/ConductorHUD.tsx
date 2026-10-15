"use client";

import { TelemetryCard } from "@/components/TelemetryCard";
import { SynthMatrixCard } from "@/components/SynthMatrixCard";
import { Oscilloscope } from "@/components/Oscilloscope";
import { TimelineMiniMap } from "@/components/TimelineMiniMap";
import type { ScoredStory } from "@/types/score";

interface ConductorHUDProps {
  story: ScoredStory;
  activeSceneIndex: number;
  activeChordIndex: number;
  lastArpNote: string | null;
  liveParams?: { bpm: number; filterHz: number };
  getLiveParams?: () => { bpm: number; filterHz: number };
  audioReady: boolean;
  playing: boolean;
  onSelectScene: (index: number) => void;
  onOverrideBpm: (bpm: number) => void;
  onOverrideFilter: (hz: number) => void;
  getWaveform: () => Float32Array | null;
}

export function ConductorHUD({
  story,
  activeSceneIndex,
  activeChordIndex,
  lastArpNote,
  liveParams,
  getLiveParams,
  audioReady,
  playing,
  onSelectScene,
  onOverrideBpm,
  onOverrideFilter,
  getWaveform,
}: ConductorHUDProps) {
  const scene = story.scenes[activeSceneIndex];
  if (!scene) return null;

  const accent = scene.visualTheme.accentHex;

  return (
    <aside className="soundstage-panel" aria-label="Acoustic Soundstage Conductor">
      <TelemetryCard scene={scene} audioReady={audioReady} />
      <Oscilloscope
        getWaveform={getWaveform}
        accentHex={accent}
        running={audioReady && playing}
      />
      <SynthMatrixCard
        scene={scene}
        activeChordIndex={activeChordIndex}
        lastArpNote={lastArpNote}
        liveParams={liveParams}
        getLiveParams={getLiveParams}
        onOverrideBpm={onOverrideBpm}
        onOverrideFilter={onOverrideFilter}
      />
      <TimelineMiniMap
        story={story}
        activeSceneIndex={activeSceneIndex}
        onSelectScene={onSelectScene}
      />
    </aside>
  );
}
