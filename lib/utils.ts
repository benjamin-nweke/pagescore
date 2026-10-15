import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Map a linear 0..1 value to a logarithmic frequency range
export function linToLogFreq(t: number, min: number, max: number): number {
  return min * Math.pow(max / min, t);
}

// Inverse: freq to 0..1 position on a log slider
export function logFreqToLin(freq: number, min: number, max: number): number {
  return Math.log(freq / min) / Math.log(max / min);
}

// Convert a hex color to an rgba string with alpha
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derive a dimmer version of a hex accent for backgrounds
export function dimHex(hex: string, factor: number = 0.15): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Interpolate between two hex colors (0=a, 1=b)
export function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

// Easing functions for smooth animations
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// Smooth scroll to an element over a given duration
export function smoothScrollTo(
  container: HTMLElement,
  targetY: number,
  duration: number,
  onComplete?: () => void
): () => void {
  const startY = container.scrollTop;
  const distance = targetY - startY;
  const startTime = performance.now();
  let rafId: number;

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(t);
    container.scrollTop = startY + distance * eased;
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(rafId);
}

// Extract the root note name from a note string (e.g. "D#3" -> "D#")
export function noteRoot(note: string): string {
  return note.replace(/\d$/, "");
}

// Format Hz for display
export function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}k`;
  return `${Math.round(hz)}`;
}

// Debug helper that only logs in development
export function debug(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[PageScore]", ...args);
  }
}
