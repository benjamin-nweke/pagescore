"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn, formatHz, logFreqToLin, linToLogFreq } from "@/lib/utils";
import type { StoryScene } from "@/types/score";

interface SynthMatrixCardProps {
  scene: StoryScene;
  activeChordIndex: number;
  lastArpNote: string | null;
  liveParams?: { bpm: number; filterHz: number };
  getLiveParams?: () => { bpm: number; filterHz: number };
  onOverrideBpm: (bpm: number) => void;
  onOverrideFilter: (hz: number) => void;
}

function noteToRoot(note: string): string {
  return note.replace(/\d$/, "");
}

export function SynthMatrixCard({
  scene,
  activeChordIndex,
  lastArpNote,
  liveParams,
  getLiveParams,
  onOverrideBpm,
  onOverrideFilter,
}: SynthMatrixCardProps) {
  const patch = scene.synthPatch;
  const [flashNote, setFlashNote] = useState<string | null>(null);

  // Localized 10Hz polling to isolate re-renders strictly to this component
  const [localParams, setLocalParams] = useState(() =>
    getLiveParams ? getLiveParams() : (liveParams ?? { bpm: scene.synthPatch.bpm, filterHz: scene.synthPatch.filterCutoffHz })
  );

  useEffect(() => {
    if (!getLiveParams) return;
    let last = 0;
    let rafId: number;
    function tick(now: number) {
      if (now - last > 100) {
        last = now;
        const current = getLiveParams!();
        setLocalParams((prev) =>
          prev.bpm === current.bpm && prev.filterHz === current.filterHz ? prev : current
        );
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [getLiveParams]);

  const activeParams = getLiveParams ? localParams : (liveParams ?? localParams);

  useEffect(() => {
    if (!lastArpNote) return;
    setFlashNote(lastArpNote);
    const t = setTimeout(() => setFlashNote(null), 180);
    return () => clearTimeout(t);
  }, [lastArpNote]);

  const accent = scene.visualTheme.accentHex;

  const foleyNames: Record<string, string> = {
    rain: "Rain Acoustic Bus",
    wind: "Atmospheric Wind",
    vinyl_crackle: "33-RPM Vinyl Noise",
    deep_rumble: "Sub-Acoustic Drone",
    none: "Pure Analog Synth",
  };

  return (
    <div className="soundstage-card soundstage-card--synth">
      {/* Header Meta */}
      <div className="soundstage-card-meta">
        <span className="card-kicker">Synthesizer Architecture</span>
        <span className="card-status-pip font-mono text-[11px]">
          {patch.padWaveform.toUpperCase()} · {foleyNames[patch.ambienceType] ?? patch.ambienceType}
        </span>
      </div>

      {/* Living Chord Matrix (Tactile Hardware Plates) */}
      <div className="harmonic-plates-bay">
        <div className="plates-sublabel">
          <span>Harmonic Progression</span>
          <span className="font-mono text-[10px] text-neutral-400">4-Bar Downbeat Cycle</span>
        </div>

        <div className="chord-plates-grid">
          {patch.chordProgression.map((chord, idx) => {
            const isActive = idx === activeChordIndex;
            const root = noteToRoot(chord[0] ?? "");

            return (
              <div
                key={idx}
                className={cn("chord-hardware-plate", isActive && "chord-hardware-plate--active")}
                style={isActive ? { borderColor: `${accent}77` } : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeChordIndicator"
                    className="chord-live-bezel"
                    style={{ backgroundColor: accent }}
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="chord-root-name font-mono">{root}</span>
                <span className="chord-sub-notes font-mono">
                  {chord.slice(0, 3).map((n) => noteToRoot(n)).join(" · ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arpeggio Note Stream */}
      <div className="arpeggio-stream-bay">
        <div className="plates-sublabel">
          <span>Arpeggiator Motifs</span>
          <span className="font-mono text-[10px] text-neutral-400">16th Ping-Pong Delay</span>
        </div>

        <div className="arp-chips-cluster">
          {patch.arpNotes.map((note, idx) => {
            const isFlashing = flashNote === note;
            return (
              <span
                key={idx}
                className={cn("arp-chip-pill font-mono", isFlashing && "arp-chip-pill--strike")}
                style={isFlashing ? { backgroundColor: accent, color: "#000000", borderColor: accent } : undefined}
              >
                {note}
              </span>
            );
          })}
        </div>
      </div>

      {/* Tactile Hardware Faders (Tempo & Filter Cutoff) */}
      <div className="tactile-faders-chassis">
        {/* Tempo Fader */}
        <div className="fader-channel">
          <div className="fader-header">
            <span className="fader-label font-mono">BPM TEMPO</span>
            <span className="fader-value font-mono">{Math.round(activeParams.bpm)}</span>
          </div>
          <input
            type="range"
            min={50}
            max={140}
            step={1}
            value={Math.round(activeParams.bpm)}
            onChange={(e) => onOverrideBpm(parseFloat(e.target.value))}
            className="hardware-fader-track"
            aria-label="Tempo BPM fader"
          />
        </div>

        {/* Resonant Filter Fader */}
        <div className="fader-channel">
          <div className="fader-header">
            <span className="fader-label font-mono">LP FILTER</span>
            <span className="fader-value font-mono">{formatHz(activeParams.filterHz)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={logFreqToLin(activeParams.filterHz, 180, 4500)}
            onChange={(e) => onOverrideFilter(linToLogFreq(parseFloat(e.target.value), 180, 4500))}
            className="hardware-fader-track"
            aria-label="Resonant filter cutoff fader"
          />
        </div>
      </div>
    </div>
  );
}
