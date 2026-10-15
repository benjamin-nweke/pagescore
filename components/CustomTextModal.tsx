"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoredStory } from "@/types/score";

const SAMPLE_TEXT = `The letter arrived on a Tuesday, which Miriam had always considered an unremarkable day for remarkable things.

She recognised the handwriting on the envelope before she saw the postmark: her brother's tight, leftward slant, unchanged since childhood. She had not heard from Daniel in four years, not since their mother's estate was settled and the last civility between them was exhausted.

She made tea before opening it. The kettle took three minutes and forty seconds. She counted.

The letter was two pages, front and back. It did not apologise for the silence. It did not explain it either, which she found she respected. What it did instead was describe, in considerable detail, a specific afternoon in 1987 when their father had taken them both fishing at the reservoir outside town and caught nothing, and how he had laughed about it all the way home, and how she, Miriam, had fallen asleep against Daniel's shoulder in the back of the car. She had no memory of this. None.

She read the letter again. Outside, a delivery truck backed up the narrow street, beeping its warning into the still morning air. When she finished the second reading she sat for a long time with the pages flat on the table, thinking about memory, and what it chose to keep, and what it quietly let go.`;

interface ComposingStep {
  label: string;
  durationMs: number;
}

const COMPOSE_STEPS: ComposingStep[] = [
  { label: "Reading the text", durationMs: 3500 },
  { label: "Finding the turning points", durationMs: 5000 },
  { label: "Writing the synth patches", durationMs: 6000 },
  { label: "Checking the notes", durationMs: 3000 },
];

interface CustomTextModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (story: ScoredStory) => void;
}

export function CustomTextModal({ open, onClose, onSuccess }: CustomTextModalProps) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKeyField, setShowKeyField] = useState(false);
  const [composing, setComposing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved key from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ps_api_key");
      if (saved) setApiKey(saved);
    } catch { /* empty */ }
  }, []);

  const saveKey = (k: string) => {
    setApiKey(k);
    try { localStorage.setItem("ps_api_key", k); } catch { /* empty */ }
  };

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
  };

  const startStepAdvancer = (stepIdx: number, steps: ComposingStep[]) => {
    if (stepIdx >= steps.length - 1) return;
    stepTimerRef.current = setTimeout(() => {
      setStepIndex(stepIdx + 1);
      startStepAdvancer(stepIdx + 1, steps);
    }, steps[stepIdx].durationMs);
  };

  const handleCompose = async () => {
    if (text.trim().length < 400) {
      setError("Paste at least 400 characters of text.");
      return;
    }
    setError(null);
    setComposing(true);
    setStepIndex(0);
    setElapsed(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    startStepAdvancer(0, COMPOSE_STEPS);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey.trim()) headers["x-user-api-key"] = apiKey.trim();

      const res = await fetch("/api/compose", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: text.trim(), title: title.trim() }),
      });

      clearTimers();

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed." }));
        const msg = data.error ?? "Something went wrong.";
        if (res.status === 401 && !showKeyField) {
          setShowKeyField(true);
          setError(msg + " Enter your Anthropic API key below.");
        } else {
          setError(msg);
        }
        setComposing(false);
        return;
      }

      const story: ScoredStory = await res.json();
      setComposing(false);
      onSuccess(story);
      onClose();
    } catch {
      clearTimers();
      setComposing(false);
      setError("Network error. Check your connection and try again.");
    }
  };

  const handleClose = () => {
    if (composing) return;
    clearTimers();
    setError(null);
    onClose();
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const charCount = text.length;
  const charOk = charCount >= 400 && charCount <= 20000;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          role="dialog"
          aria-modal="true"
          aria-label="Score custom text"
        >
          <motion.div
            className="modal-box"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">Score custom text</h2>
              <button
                onClick={handleClose}
                disabled={composing}
                className="modal-close"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {/* Title input */}
              <div className="modal-field">
                <label className="modal-label" htmlFor="modal-title">Title (optional)</label>
                <input
                  id="modal-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leave blank to auto-detect"
                  className="modal-input"
                  disabled={composing}
                  maxLength={60}
                />
              </div>

              {/* Text area */}
              <div className="modal-field">
                <div className="modal-label-row">
                  <label className="modal-label" htmlFor="modal-text">Story text</label>
                  <span className={cn("char-counter", !charOk && charCount > 0 && "char-counter--warn")}>
                    {charCount.toLocaleString()} / 20,000
                  </span>
                </div>
                <textarea
                  id="modal-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your story here (400 to 20,000 characters)..."
                  className="modal-textarea"
                  disabled={composing}
                  rows={10}
                />
                <button
                  onClick={() => setText(SAMPLE_TEXT)}
                  className="sample-btn"
                  disabled={composing}
                  type="button"
                >
                  Try a sample
                </button>
              </div>

              {/* API key toggle */}
              <div className="modal-field">
                <button
                  onClick={() => setShowKeyField((v) => !v)}
                  className="key-toggle"
                  type="button"
                  disabled={composing}
                  aria-expanded={showKeyField}
                >
                  {showKeyField ? "Hide" : "Use my own Anthropic API key"}
                </button>
                {showKeyField && (
                  <div className="key-field-wrap">
                    <label className="modal-label" htmlFor="modal-api-key">Anthropic API key</label>
                    <input
                      id="modal-api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => saveKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="modal-input"
                      disabled={composing}
                      autoComplete="off"
                    />
                    <p className="key-note">Stored only in this browser. Sent only to this app&apos;s own /api/compose endpoint.</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="modal-error" role="alert">
                  {error}
                  {!composing && (
                    <button onClick={handleCompose} className="retry-btn" type="button">Retry</button>
                  )}
                </div>
              )}

              {/* Compose steps overlay */}
              {composing && (
                <div className="composing-overlay">
                  <div className="composing-steps">
                    {COMPOSE_STEPS.map((step, i) => (
                      <div key={i} className={cn("compose-step", i === stepIndex && "compose-step--active", i < stepIndex && "compose-step--done")}>
                        <span className="compose-step-dot" />
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="composing-elapsed">{elapsed}s</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                onClick={handleCompose}
                disabled={composing || !charOk}
                className="compose-btn"
                type="button"
              >
                {composing ? "Composing" : "Compose score"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
