"use client";

import { motion } from "framer-motion";
import type { StoryScene } from "@/types/score";

interface TelemetryCardProps {
  scene: StoryScene;
  audioReady: boolean;
}

export function TelemetryCard({ scene, audioReady }: TelemetryCardProps) {
  const currentScore = Math.max(1, Math.min(10, scene.tensionScore));
  const fillPct = (currentScore / 10) * 100;
  const accent = scene.visualTheme.accentHex;

  return (
    <div className="soundstage-card soundstage-card--atmosphere">
      {/* Header Meta */}
      <div className="soundstage-card-meta">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full transition-colors duration-500"
            style={{ backgroundColor: accent }}
          />
          <span className="card-kicker">Atmosphere & Tension</span>
        </div>
        <span className="card-status-pip font-mono text-[11px]">
          {audioReady ? "Score Morphing" : "Awaiting Transport"}
        </span>
      </div>

      {/* Title & Key */}
      <div className="atmosphere-headline">
        <h3 className="atmosphere-title">{scene.sceneTitle}</h3>
        <div className="atmosphere-badges">
          <span className="mood-badge" style={{ color: accent, borderColor: `${accent}33`, backgroundColor: `${accent}12` }}>
            {scene.moodLabel}
          </span>
          <span className="key-badge font-mono text-[11.5px]">
            {scene.synthPatch.keyAndScale}
          </span>
        </div>
      </div>

      {/* Tactile Harmonic Tension Gauge */}
      <div className="tension-gauge-deck">
        <div className="gauge-label-row">
          <span className="gauge-title">Harmonic Tension</span>
          <div className="gauge-score-value font-mono">
            <span className="gauge-num" style={{ color: accent }}>{scene.tensionScore}</span>
            <span className="gauge-max">/10</span>
          </div>
        </div>

        <div className="gauge-track-chassis" role="meter" aria-valuenow={currentScore} aria-valuemin={1} aria-valuemax={10}>
          <motion.div
            className="gauge-fill-ribbon"
            style={{ backgroundColor: accent }}
            initial={false}
            animate={{ width: `${fillPct}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
          />
          {/* Subtle analog tick divisions */}
          <div className="gauge-ticks-overlay" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="gauge-tick" />
            ))}
          </div>
        </div>
      </div>

      {/* Composer's Scoring Intent (Claude Field Journal) */}
      <div className="composer-journal-entry" style={{ borderLeftColor: accent }}>
        <span className="journal-kicker font-mono">Composer&apos;s Field Note</span>
        <motion.p
          key={scene.id}
          className="journal-quote"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          &ldquo;{scene.directorNotes}&rdquo;
        </motion.p>
      </div>
    </div>
  );
}
