"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { cn, smoothScrollTo } from "@/lib/utils";
import type { ScoredStory, StoryScene } from "@/types/score";

interface ReaderPanelProps {
  story: ScoredStory;
  activeSceneIndex: number;
  onSceneChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void;
  audioReady?: boolean;
  readerRef: React.RefObject<HTMLDivElement>;
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const ReaderPanel = React.memo(function ReaderPanel({
  story,
  activeSceneIndex,
  onSceneChange,
  onScrollProgress,
  readerRef,
}: ReaderPanelProps) {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const programmaticScrollUntil = useRef(0);
  const activeSceneRef = useRef(activeSceneIndex);
  const rafId = useRef<number | null>(null);

  // Keep activeSceneRef in sync
  useEffect(() => {
    activeSceneRef.current = activeSceneIndex;
  }, [activeSceneIndex]);

  // Calculate estimated reading time
  const readTimeMinutes = useMemo(() => {
    const totalWords = story.scenes.reduce(
      (sum, s) => sum + s.paragraphs.reduce((pSum, p) => pSum + p.split(/\s+/).filter(Boolean).length, 0),
      0
    );
    return Math.max(1, Math.round(totalWords / 200));
  }, [story]);

  // Deterministic, single-focal-point reading detector
  const checkActiveScene = useCallback(() => {
    const container = readerRef.current;
    if (!container) return;

    // Report scroll progress for TopBar hairline ribbon
    if (onScrollProgress) {
      const maxScroll = container.scrollHeight - container.clientHeight;
      const progress = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
      onScrollProgress(progress);
    }

    if (Date.now() < programmaticScrollUntil.current) return;

    const containerRect = container.getBoundingClientRect();
    // Natural human reading eye line: 28% from the top of the container
    const focalY = containerRect.top + containerRect.height * 0.28;

    let targetIdx = -1;

    for (let i = 0; i < sectionRefs.current.length; i++) {
      const el = sectionRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= focalY && rect.bottom >= focalY) {
        targetIdx = i;
        break;
      }
    }

    // Edge cases: scrolled past bottom or above top
    if (targetIdx === -1) {
      if (container.scrollTop < 60) {
        targetIdx = 0;
      } else if (container.scrollTop + container.clientHeight >= container.scrollHeight - 60) {
        targetIdx = story.scenes.length - 1;
      }
    }

    if (targetIdx !== -1 && targetIdx !== activeSceneRef.current) {
      activeSceneRef.current = targetIdx;
      onSceneChange(targetIdx);
    }
  }, [onSceneChange, onScrollProgress, readerRef, story.scenes.length]);

  // Scroll listener with requestAnimationFrame throttling
  useEffect(() => {
    const container = readerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        checkActiveScene();
        rafId.current = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Run initial progress check on mount
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [checkActiveScene, readerRef]);

  // Smooth programmatic scroll to scene
  const scrollToScene = useCallback(
    (index: number, duration = 600) => {
      const container = readerRef.current;
      const target = sectionRefs.current[index];
      if (!container || !target) return;

      const top = target.offsetTop - 36;
      programmaticScrollUntil.current = Date.now() + duration + 100;
      activeSceneRef.current = index;
      onSceneChange(index);
      smoothScrollTo(container, top, duration);
    },
    [readerRef, onSceneChange]
  );

  // Expose scrollToScene on reader container for external triggers (demo / HUD)
  useEffect(() => {
    const container = readerRef.current;
    if (container) {
      (container as HTMLDivElement & { scrollToScene?: (idx: number, dur?: number) => void }).scrollToScene = scrollToScene;
    }
  }, [scrollToScene, readerRef]);

  const handleSceneClick = (index: number) => {
    scrollToScene(index, 500);
  };

  const currentScene = story.scenes[activeSceneIndex];
  const accent = currentScene?.visualTheme.accentHex ?? "#f5b968";

  return (
    <div className="reader-viewport" ref={readerRef}>
      {/* Sticky Chapter Gutter Rail in Left Margin */}
      <nav className="chapter-gutter-rail" aria-label="Movement navigation rail">
        {story.scenes.map((scene, idx) => {
          const isActive = idx === activeSceneIndex;
          const roman = ROMAN_NUMERALS[idx] ?? String(idx + 1);
          return (
            <button
              key={scene.id}
              onClick={() => scrollToScene(idx, 500)}
              className={cn("gutter-roman-btn font-mono", isActive && "gutter-roman-btn--active")}
              style={isActive ? { color: accent, borderColor: `${accent}66` } : undefined}
              aria-label={`Jump to Movement ${roman}: ${scene.sceneTitle}`}
              title={`Movement ${roman}: ${scene.sceneTitle}`}
            >
              {roman}
            </button>
          );
        })}
      </nav>

      {/* Smooth Organic Ambient Lighting Aura */}
      <div className="reader-ambient-aura" aria-hidden="true">
        <div
          className="ambient-aura-glow"
          style={{
            background: `radial-gradient(ellipse 70% 50% at 50% 25%, ${accent}18 0%, transparent 75%)`,
            transition: "background 1s cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        />
      </div>

      <article className="reader-prose-column">
        {/* Story Masthead with Reading Time Estimate */}
        <header className="story-masthead">
          <div className="story-kicker">
            <span>{story.authorOrGenre}</span>
            <span className="kicker-sep">·</span>
            <span>~{readTimeMinutes} min read</span>
            <span className="kicker-sep">·</span>
            <span>{story.scenes.length} Movements</span>
          </div>
          <h1 className="story-hero-title">{story.title}</h1>
          <div className="story-crest-rule" style={{ backgroundColor: `${accent}40` }} />
        </header>

        {/* Narrative Movements */}
        <div className="narrative-scenes-flow">
          {story.scenes.map((scene: StoryScene, index: number) => {
            const isActive = index === activeSceneIndex;
            const sceneAccent = scene.visualTheme.accentHex;
            const roman = ROMAN_NUMERALS[index] ?? String(index + 1);

            return (
              <section
                key={scene.id}
                ref={(el) => { sectionRefs.current[index] = el; }}
                data-scene-index={index}
                className={cn(
                  "narrative-movement",
                  isActive ? "narrative-movement--active" : "narrative-movement--muted"
                )}
                onClick={() => handleSceneClick(index)}
                role="region"
                aria-label={`Movement ${roman}: ${scene.sceneTitle}`}
              >
                {/* Movement Header */}
                <div className="movement-header">
                  <div className="movement-act-badge">
                    <span
                      className="act-roman"
                      style={{ color: isActive ? sceneAccent : "inherit" }}
                    >
                      Movement {roman}
                    </span>
                    <span className="act-divider">·</span>
                    <span className="act-mood">{scene.moodLabel}</span>
                  </div>

                  <span
                    className={cn(
                      "active-acoustic-pip",
                      isActive && "active-acoustic-pip--visible"
                    )}
                    style={{ backgroundColor: sceneAccent }}
                  />
                </div>

                {/* Scene Title */}
                <h2
                  className="movement-title"
                  style={{ color: isActive ? "#ffffff" : "var(--paper-400)" }}
                >
                  {scene.sceneTitle}
                </h2>

                {/* Literary Prose */}
                <div className="movement-body">
                  {scene.paragraphs.map((para: string, pi: number) => {
                    const isDropCap = index === 0 && pi === 0;
                    return (
                      <p
                        key={pi}
                        className={cn(
                          "prose-paragraph",
                          isDropCap && "prose-paragraph--dropcap"
                        )}
                      >
                        {para}
                      </p>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Comfortable reading footer margin */}
        <div style={{ height: "40vh" }} aria-hidden="true" />
      </article>
    </div>
  );
});
