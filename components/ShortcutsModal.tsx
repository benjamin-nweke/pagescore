"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Command } from "lucide-react";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space", desc: "Play or Pause score" },
  { key: "M", desc: "Mute / Unmute audio" },
  { key: "D", desc: "Toggle Listen & Read follow mode" },
  { key: "J / ↓", desc: "Next narrative movement" },
  { key: "K / ↑", desc: "Previous narrative movement" },
  { key: "?", desc: "Toggle keyboard shortcuts" },
  { key: "Esc", desc: "Close open dialog" },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">
          <motion.div
            className="shortcuts-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="shortcuts-header">
              <div className="flex items-center gap-2">
                <Command size={14} className="text-amber-400" />
                <h3 className="shortcuts-title font-mono text-[12px] uppercase tracking-wider">Keyboard Navigation</h3>
              </div>
              <button onClick={onClose} className="modal-close" aria-label="Close shortcuts">
                <X size={15} />
              </button>
            </div>

            <div className="shortcuts-list">
              {SHORTCUTS.map((item, idx) => (
                <div key={idx} className="shortcut-row">
                  <span className="shortcut-desc">{item.desc}</span>
                  <kbd className="shortcut-kbd font-mono">{item.key}</kbd>
                </div>
              ))}
            </div>

            <div className="shortcuts-footer font-mono text-[10px] text-neutral-500">
              Shortcuts are inactive while composing in text fields.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
