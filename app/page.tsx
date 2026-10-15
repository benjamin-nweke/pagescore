"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { ReaderPanel } from "@/components/ReaderPanel";
import { ConductorHUD } from "@/components/ConductorHUD";
import { CustomTextModal } from "@/components/CustomTextModal";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { useSoundEngine } from "@/hooks/useSoundEngine";
import { PRESET_STORIES } from "@/lib/presetStories";
import { clamp, smoothScrollTo } from "@/lib/utils";
import type { ScoredStory } from "@/types/score";

const PREFERS_REDUCED = typeof window !== "undefined"
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

export default function PageScorePage() {
  const [stories, setStories] = useState<ScoredStory[]>(PRESET_STORIES);
  const [activeStoryId, setActiveStoryId] = useState(PRESET_STORIES[0].id);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeChordIndex, setActiveChordIndex] = useState(0);
  const [lastArpNote, setLastArpNote] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [demoRunning, setDemoRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const readerRef = useRef<HTMLDivElement>(null);
  const demoAbortRef = useRef<(() => void) | null>(null);

  const engine = useSoundEngine();
  const story = stories.find((s) => s.id === activeStoryId) ?? stories[0];

  // Subscribe to discrete engine events (chords and arp notes)
  useEffect(() => {
    if (!engine.lastEvent) return;
    const e = engine.lastEvent;
    if (e.type === "chord") setActiveChordIndex(e.index);
    if (e.type === "arpNote") setLastArpNote(e.note);
  }, [engine.lastEvent]);

  // Transition scene when active index changes and audio is ready
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (engine.ready) {
      engine.transitionTo(story.scenes[activeSceneIndex]);
    }
  }, [activeSceneIndex, story.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSceneChange = useCallback((index: number) => {
    setActiveSceneIndex(index);
    setActiveChordIndex(0);
  }, []);

  const handleSelectStory = useCallback((id: string) => {
    setActiveStoryId(id);
    setActiveSceneIndex(0);
    setActiveChordIndex(0);
    setScrollProgress(0);
    if (readerRef.current) readerRef.current.scrollTop = 0;
    if (engine.ready) {
      const s = stories.find((st) => st.id === id);
      if (s) engine.transitionTo(s.scenes[0]);
    }
  }, [engine, stories]);

  const handlePlayPause = useCallback(async () => {
    if (!engine.ready) {
      await engine.init();
      engine.setVolume(volume);
      engine.setMuted(isMuted);
      engine.transitionTo(story.scenes[activeSceneIndex]);
      await engine.play();
      return;
    }
    if (engine.playing) {
      engine.pause();
    } else {
      await engine.play();
    }
  }, [engine, story, activeSceneIndex, volume, isMuted]);

  const handleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    engine.setMuted(next);
  }, [isMuted, engine]);

  const handleVolume = useCallback((v: number) => {
    setVolume(v);
    if (isMuted && v > 0) {
      setIsMuted(false);
      engine.setMuted(false);
    }
    engine.setVolume(v);
  }, [engine, isMuted]);

  // ── Demo controller ──────────────────────────────────────────────────────────
  const stopDemo = useCallback(() => {
    demoAbortRef.current?.();
    demoAbortRef.current = null;
    setDemoRunning(false);
  }, []);

  const startDemo = useCallback(async () => {
    setDemoRunning(true);

    if (!engine.ready) {
      await engine.init();
      engine.setVolume(volume);
      engine.setMuted(isMuted);
    }
    engine.transitionTo(story.scenes[0]);
    await engine.play();
    setActiveSceneIndex(0);
    setActiveChordIndex(0);

    let aborted = false;
    demoAbortRef.current = () => { aborted = true; };

    const container = readerRef.current;
    if (container) container.scrollTop = 0;

    for (let i = 0; i < story.scenes.length; i++) {
      if (aborted) break;

      setActiveSceneIndex(i);
      setActiveChordIndex(0);
      engine.transitionTo(story.scenes[i]);

      if (container) {
        const scrollable = container as HTMLDivElement & { scrollToScene?: (idx: number, dur?: number) => void };
        scrollable.scrollToScene?.(i, 1400);
      }

      const paraCount = story.scenes[i].paragraphs.length;
      const dwell = PREFERS_REDUCED ? 5000 : clamp(paraCount * 5000, 10000, 16000);

      if (!PREFERS_REDUCED && container) {
        const driftAmount = 60;
        const driftStart = container.scrollTop;
        const driftEnd = driftStart + driftAmount;
        const driftDur = dwell * 0.7;
        let driftCancel: (() => void) | null = null;
        setTimeout(() => {
          if (aborted) return;
          driftCancel = smoothScrollTo(container, driftEnd, driftDur);
        }, 1800);
        const prevAbort = demoAbortRef.current;
        demoAbortRef.current = () => { driftCancel?.(); prevAbort(); };
      }

      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, dwell);
        const prevAbort = demoAbortRef.current!;
        demoAbortRef.current = () => { clearTimeout(t); prevAbort(); resolve(); };
      });
    }

    if (!aborted) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 6000);
        const prevAbort = demoAbortRef.current!;
        demoAbortRef.current = () => { clearTimeout(t); prevAbort(); resolve(); };
      });
    }

    demoAbortRef.current = null;
    setDemoRunning(false);
  }, [engine, story, readerRef, volume, isMuted]);

  const handleDemoToggle = useCallback(() => {
    if (demoRunning) {
      stopDemo();
    } else {
      startDemo();
    }
  }, [demoRunning, stopDemo, startDemo]);

  // Cancel demo on manual user scroll
  useEffect(() => {
    const container = readerRef.current;
    if (!container || !demoRunning) return;
    const onWheel = () => stopDemo();
    const onTouchMove = () => stopDemo();
    container.addEventListener("wheel", onWheel, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchmove", onTouchMove);
    };
  }, [demoRunning, stopDemo]);

  // Global Keyboard Shortcuts Suite
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        if (modalOpen) setModalOpen(false);
        return;
      }

      if (modalOpen) return;

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleMute();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        handleDemoToggle();
      } else if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(activeSceneIndex + 1, story.scenes.length - 1);
        handleSceneChange(next);
        (readerRef.current as (HTMLDivElement & { scrollToScene?: (idx: number, dur?: number) => void }) | null)?.scrollToScene?.(next, 500);
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(activeSceneIndex - 1, 0);
        handleSceneChange(prev);
        (readerRef.current as (HTMLDivElement & { scrollToScene?: (idx: number, dur?: number) => void }) | null)?.scrollToScene?.(prev, 500);
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modalOpen,
    shortcutsOpen,
    handlePlayPause,
    handleMute,
    handleDemoToggle,
    handleSceneChange,
    activeSceneIndex,
    story.scenes.length,
    readerRef,
  ]);

  const handleModalSuccess = useCallback((newStory: ScoredStory) => {
    setStories((prev) => {
      const withoutPrev = prev.filter((s) => !s.id.startsWith("custom-"));
      return [...withoutPrev, newStory];
    });
    setActiveStoryId(newStory.id);
    setActiveSceneIndex(0);
    setActiveChordIndex(0);
    setScrollProgress(0);
    if (readerRef.current) readerRef.current.scrollTop = 0;
    if (engine.ready) engine.transitionTo(newStory.scenes[0]);
  }, [engine]);

  return (
    <div className="app-shell">
      <TopBar
        stories={stories}
        activeStoryId={activeStoryId}
        onSelectStory={handleSelectStory}
        onOpenModal={() => setModalOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        scrollProgress={scrollProgress}
        playing={engine.playing}
        muted={isMuted}
        volume={volume}
        audioReady={engine.ready}
        demoRunning={demoRunning}
        onPlayPause={handlePlayPause}
        onMute={handleMute}
        onVolumeChange={handleVolume}
        onDemoToggle={handleDemoToggle}
      />

      <main className="app-body">
        <ReaderPanel
          story={story}
          activeSceneIndex={activeSceneIndex}
          onSceneChange={handleSceneChange}
          onScrollProgress={setScrollProgress}
          audioReady={engine.ready}
          readerRef={readerRef}
        />
        <ConductorHUD
          story={story}
          activeSceneIndex={activeSceneIndex}
          activeChordIndex={activeChordIndex}
          lastArpNote={lastArpNote}
          getLiveParams={engine.getLiveParams}
          audioReady={engine.ready}
          playing={engine.playing}
          onSelectScene={(i) => {
            handleSceneChange(i);
            const scrollable = readerRef.current as (HTMLDivElement & { scrollToScene?: (idx: number) => void }) | null;
            scrollable?.scrollToScene?.(i);
          }}
          onOverrideBpm={engine.overrideBpm}
          onOverrideFilter={engine.overrideFilter}
          getWaveform={engine.getWaveform}
        />
      </main>

      <CustomTextModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
