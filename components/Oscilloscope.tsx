"use client";

import { useRef, useEffect, useCallback } from "react";
import { hexToRgba } from "@/lib/utils";

interface OscilloscopeProps {
  getWaveform: () => Float32Array | null;
  accentHex: string;
  running: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
}

export function Oscilloscope({ getWaveform, accentHex, running }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const isTabVisibleRef = useRef(true);
  const particlesRef = useRef<Particle[]>([]);

  // Initialize or reset particles
  useEffect(() => {
    particlesRef.current = Array.from({ length: 18 }, () => ({
      x: Math.random() * 300,
      y: Math.random() * 120,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.2 - Math.random() * 0.4,
      alpha: 0.1 + Math.random() * 0.4,
      size: 1 + Math.random() * 1.5,
    }));
  }, []);

  const draw = useCallback(() => {
    // If tab is hidden in background, stop drawing
    if (!isTabVisibleRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Atmospheric dark persistence wipe
    ctx.fillStyle = "rgba(7, 9, 15, 0.32)";
    ctx.fillRect(0, 0, w, h);

    // Subtle acoustic baseline grid
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 0.5;

    // Center zero axis
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.restore();

    const waveform = getWaveform();

    if (!waveform || !running) {
      // Idle state: Slow, graceful analog sine breath
      phaseRef.current += 0.024;
      const t = phaseRef.current;
      const amp = 14 + Math.sin(t * 0.5) * 4;

      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = accentHex;
      ctx.strokeStyle = hexToRgba(accentHex, 0.65);
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = h / 2 + Math.sin(x * 0.025 + t) * amp * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Sharp core line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
    } else {
      // Live state: Fluid silk-ribbon acoustic wave with Bézier smoothing
      const points: { x: number; y: number }[] = [];
      const step = Math.max(1, Math.floor(waveform.length / 96));

      for (let i = 0; i < waveform.length; i += step) {
        const x = (i / (waveform.length - 1)) * w;
        const v = waveform[i]; // -1 to 1
        const y = ((v * 0.85 + 1) / 2) * h;
        points.push({ x, y });
      }

      if (points.length > 2) {
        // Gradient fill under the wave
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, hexToRgba(accentHex, 0.16));
        grad.addColorStop(0.5, hexToRgba(accentHex, 0.05));
        grad.addColorStop(1, "transparent");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(points[0].x, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Glowing outer phosphor stroke
        ctx.shadowBlur = 14;
        ctx.shadowColor = accentHex;
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 2.0;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();

        // Crisp white core filament
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();

        // Gentle floating acoustic dust particles
        ctx.save();
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < 0) {
            p.y = h;
            p.x = Math.random() * w;
          }
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;

          ctx.fillStyle = hexToRgba(accentHex, p.alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [getWaveform, accentHex, running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Visibility observer to pause RAF when tab is hidden
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        rafRef.current = requestAnimationFrame(draw);
      } else if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    });
    ro.observe(canvas);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <div className="soundstage-card soundstage-card--waveform">
      <div className="soundstage-card-meta">
        <span className="card-kicker">Acoustic Ribbon</span>
        <span className="card-status-pip font-mono text-[11px]">
          {running ? "Real-time FFT · Tone.js" : "Standby"}
        </span>
      </div>
      <div className="waveform-screen-bay">
        <canvas
          ref={canvasRef}
          className="waveform-canvas-el"
          aria-label="Real-time acoustic ribbon oscilloscope"
          role="img"
        />
        <div className="waveform-overlay-readout" aria-hidden="true">
          <span>+1.0</span>
          <span className="text-amber-300/60 font-mono">0.0V</span>
          <span>-1.0</span>
        </div>
      </div>
    </div>
  );
}
