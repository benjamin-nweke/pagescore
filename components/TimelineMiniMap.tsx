"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScoredStory, StoryScene } from "@/types/score";

interface TimelineMiniMapProps {
  story: ScoredStory;
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function TimelineMiniMap({ story, activeSceneIndex, onSelectScene }: TimelineMiniMapProps) {
  const totalParas = story.scenes.reduce((acc: number, s: StoryScene) => acc + s.paragraphs.length, 0);

  return (
    <div className="soundstage-card soundstage-card--timeline">
      <div className="soundstage-card-meta">
        <span className="card-kicker">Narrative Chronology</span>
        <span className="card-status-pip font-mono text-[11px]">
          {story.scenes.length} Movements
        </span>
      </div>

      <div className="timeline-chassis-track" role="navigation" aria-label="Movement timeline">
        {story.scenes.map((scene: StoryScene, i: number) => {
          const isActive = i === activeSceneIndex;
          const widthPct = (scene.paragraphs.length / totalParas) * 100;
          const accent = scene.visualTheme.accentHex;
          const roman = ROMAN_NUMERALS[i] ?? String(i + 1);

          return (
            <button
              key={scene.id}
              onClick={() => onSelectScene(i)}
              className={cn("timeline-movement-cell", isActive && "timeline-movement-cell--active")}
              style={{
                width: `${widthPct}%`,
                borderColor: isActive ? accent : "rgba(255, 255, 255, 0.08)",
              }}
              aria-label={`Movement ${roman}: ${scene.sceneTitle}`}
              aria-pressed={isActive}
              title={`${roman}. ${scene.sceneTitle} (${scene.moodLabel})`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTimelineGlowPill"
                  className="timeline-cell-glider"
                  style={{ backgroundColor: `${accent}25`, borderTop: `2px solid ${accent}` }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="cell-roman font-mono" style={{ color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.45)" }}>
                {roman}
              </span>
            </button>
          );
        })}
      </div>

      {/* Movement Mood Readout */}
      <div className="timeline-labels-row">
        {story.scenes.map((scene: StoryScene, i: number) => {
          const isActive = i === activeSceneIndex;
          const widthPct = (scene.paragraphs.length / totalParas) * 100;
          return (
            <div
              key={scene.id}
              className={cn("movement-sublabel font-mono", isActive && "movement-sublabel--active")}
              style={{
                width: `${widthPct}%`,
                color: isActive ? scene.visualTheme.accentHex : undefined,
              }}
            >
              {scene.moodLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
}
