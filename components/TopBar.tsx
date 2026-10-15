"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Sparkles, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoredStory } from "@/types/score";

interface TopBarProps {
  stories: ScoredStory[];
  activeStoryId: string;
  onSelectStory: (id: string) => void;
  onOpenModal: () => void;
  onOpenShortcuts?: () => void;
  scrollProgress?: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  audioReady: boolean;
  demoRunning: boolean;
  onPlayPause: () => void;
  onMute: () => void;
  onVolumeChange: (v: number) => void;
  onDemoToggle: () => void;
}

export const TopBar = React.memo(function TopBar({
  stories,
  activeStoryId,
  onSelectStory,
  onOpenModal,
  onOpenShortcuts,
  scrollProgress = 0,
  playing,
  muted,
  volume,
  audioReady,
  demoRunning,
  onPlayPause,
  onMute,
  onVolumeChange,
  onDemoToggle,
}: TopBarProps) {
  const activeStory = stories.find((s) => s.id === activeStoryId);
  const activeAccent = activeStory?.scenes[0]?.visualTheme.accentHex ?? "#f5b968";

  return (
    <header className="topbar-glass" role="banner">
      {/* Hairline Reading Progress Bar (GPU accelerated scaleX) */}
      <div className="topbar-progress-track" aria-hidden="true">
        <div
          className="topbar-progress-fill"
          style={{
            transform: `scaleX(${Math.max(0, Math.min(1, scrollProgress))})`,
            backgroundColor: activeAccent,
          }}
        />
      </div>

      {/* Brand & Acoustic Jewel */}
      <div className="brand-cluster">
        <div className="acoustic-jewel-wrap" title={playing ? "Score Synthesizer Playing" : "Synthesizer Ready"}>
          <motion.div
            className={cn("acoustic-jewel", playing && "acoustic-jewel--pulse")}
            animate={playing ? { scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] } : { scale: 1, opacity: 0.5 }}
            transition={playing ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            style={{ backgroundColor: playing ? activeAccent : "#64748b" }}
          />
        </div>
        <div className="brand-titles">
          <span className="brand-name">PageScore</span>
          <span className="brand-dot">·</span>
          <span className="brand-mode">Autonomous Film Score</span>
        </div>
      </div>

      {/* Story Chapter Selector (Floating Pill Island) */}
      <nav className="story-nav-island" aria-label="Story library">
        <div className="story-tabs-track">
          {stories.map((story) => {
            const isActive = story.id === activeStoryId;
            return (
              <button
                key={story.id}
                onClick={() => onSelectStory(story.id)}
                className={cn("story-tab-pill", isActive && "story-tab-pill--active")}
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeStoryPill"
                    className="story-pill-glider"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="story-tab-title">{story.title}</span>
              </button>
            );
          })}

          <button
            onClick={onOpenModal}
            className="compose-action-pill"
            aria-label="Compose custom score with Claude"
          >
            <Sparkles size={12} className="text-amber-400" />
            <span>Score Your Story</span>
          </button>
        </div>
      </nav>

      {/* Acoustic Console Controls */}
      <div className="transport-cluster">
        {/* Listen & Follow Autonomous Reading Demo */}
        <button
          onClick={onDemoToggle}
          className={cn("demo-stream-btn", demoRunning && "demo-stream-btn--live")}
          aria-label={demoRunning ? "Pause reading demo" : "Auto-scroll and autonomous audio demo"}
          title="Auto-reads and guides the score through the narrative [D]"
        >
          <Headphones size={13} className={demoRunning ? "animate-pulse" : ""} />
          <span>{demoRunning ? "Follow Active" : "Listen & Read"}</span>
        </button>

        {/* Master Play / Pause with Physical Tactile Disc */}
        <button
          onClick={onPlayPause}
          disabled={!audioReady}
          className={cn("tactile-play-disc", playing && "tactile-play-disc--playing")}
          aria-label={playing ? "Pause score" : "Start score"}
          title={playing ? "Pause Score [Space]" : "Play Score [Space]"}
        >
          {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
        </button>

        {/* Volume & Mute Deck */}
        <div className="volume-deck">
          <button
            onClick={onMute}
            disabled={!audioReady}
            className={cn("mute-toggle-btn", muted && "mute-toggle-btn--muted")}
            aria-label={muted ? "Unmute audio [M]" : "Mute audio [M]"}
            title="Mute/Unmute [M]"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="volume-slider-range"
            aria-label="Master volume"
            title={muted ? "Muted [M]" : `Volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        {/* Keyboard Shortcuts Trigger Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="shortcuts-trigger-btn"
            aria-label="Keyboard Shortcuts [?]"
            title="Keyboard Shortcuts [?]"
          >
            <kbd className="font-mono text-[10.5px]">?</kbd>
          </button>
        )}
      </div>
    </header>
  );
});
