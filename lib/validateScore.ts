import type { SynthPatch, StoryScene } from "@/types/score";
import { clamp } from "@/lib/utils";

const NOTE_RE = /^[A-G](#|b)?[0-8]$/;

function isValidNote(n: unknown): n is string {
  return typeof n === "string" && NOTE_RE.test(n);
}

function isValidHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

// Transpose a note up by one octave (e.g. "D3" -> "D4")
function octaveUp(note: string): string {
  const oct = parseInt(note.slice(-1), 10);
  return note.slice(0, -1) + Math.min(oct + 1, 8);
}

export function sanitizePatch(raw: unknown): SynthPatch {
  const r = (raw ?? {}) as Record<string, unknown>;

  // Validate/filter chords
  let progression: string[][] = [];
  if (Array.isArray(r.chordProgression)) {
    for (const chord of r.chordProgression as unknown[]) {
      if (!Array.isArray(chord)) continue;
      const valid = (chord as unknown[]).filter(isValidNote);
      if (valid.length >= 2) {
        progression.push(valid.slice(0, 4));
      }
    }
  }
  // Must have exactly 4 chords; pad by repeating
  while (progression.length < 4) {
    progression.push(progression.length > 0 ? [...progression[progression.length - 1]] : ["C3", "E3", "G3"]);
  }
  progression = progression.slice(0, 4);
  // Each chord needs at least 3 notes
  progression = progression.map((chord) => {
    while (chord.length < 3) chord.push(chord[chord.length - 1]);
    return chord;
  });

  // Validate arp notes
  let arpNotes: string[] = [];
  if (Array.isArray(r.arpNotes)) {
    arpNotes = (r.arpNotes as unknown[]).filter(isValidNote);
  }
  if (arpNotes.length < 4) {
    // Derive from first chord, one octave up
    arpNotes = progression[0].map(octaveUp);
    while (arpNotes.length < 4) arpNotes.push(arpNotes[arpNotes.length - 1]);
  }
  arpNotes = arpNotes.slice(0, 8);

  // Validate bass notes
  let bassNotes: string[] = [];
  if (Array.isArray(r.bassNotes)) {
    bassNotes = (r.bassNotes as unknown[]).filter(isValidNote);
  }
  if (bassNotes.length < 4) {
    bassNotes = progression.map((chord) => {
      const root = chord[0];
      const oct = parseInt(root.slice(-1), 10);
      const newOct = Math.max(oct - 1, 1);
      return root.slice(0, -1) + newOct;
    });
  }
  bassNotes = bassNotes.slice(0, 4);

  const arpPatternOptions = ["up", "down", "upDown", "random"] as const;
  const arpSubdivisionOptions = ["8n", "16n", "4n"] as const;
  const padWaveformOptions = ["sine", "triangle", "sawtooth", "fatsawtooth"] as const;
  const bassRhythmOptions = ["sustained", "pulsing_8n", "driving_16n", "heartbeat"] as const;
  const ambienceTypeOptions = ["rain", "wind", "vinyl_crackle", "deep_rumble", "none"] as const;

  function pickEnum<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return options.includes(value as T) ? (value as T) : fallback;
  }

  return {
    bpm: clamp(typeof r.bpm === "number" ? r.bpm : 90, 55, 145),
    keyAndScale: typeof r.keyAndScale === "string" ? r.keyAndScale.trim().slice(0, 40) : "C Major",
    chordProgression: progression,
    arpNotes,
    arpPattern: pickEnum(r.arpPattern, arpPatternOptions, "upDown"),
    arpSubdivision: pickEnum(r.arpSubdivision, arpSubdivisionOptions, "8n"),
    padWaveform: pickEnum(r.padWaveform, padWaveformOptions, "triangle"),
    bassNotes,
    bassRhythm: pickEnum(r.bassRhythm, bassRhythmOptions, "sustained"),
    filterCutoffHz: clamp(typeof r.filterCutoffHz === "number" ? r.filterCutoffHz : 1400, 180, 4500),
    reverbDecay: clamp(typeof r.reverbDecay === "number" ? r.reverbDecay : 4.0, 1.5, 8.0),
    reverbWet: clamp(typeof r.reverbWet === "number" ? r.reverbWet : 0.4, 0.15, 0.85),
    ambienceType: pickEnum(r.ambienceType, ambienceTypeOptions, "none"),
    ambienceIntensity: clamp(typeof r.ambienceIntensity === "number" ? r.ambienceIntensity : 0, 0.0, 0.45),
  };
}

export function sanitizeScene(raw: unknown, index: number, paragraphs: string[]): StoryScene {
  const r = (raw ?? {}) as Record<string, unknown>;

  const vt = (r.visualTheme ?? {}) as Record<string, unknown>;
  const bgFrom = isValidHex(vt.bgHexFrom) ? vt.bgHexFrom : "#0b1020";
  const bgTo = isValidHex(vt.bgHexTo) ? vt.bgHexTo : "#1b2440";
  const accent = isValidHex(vt.accentHex) ? vt.accentHex : "#7dd3fc";

  const sceneId = typeof r.id === "string" ? r.id : `scene-${index + 1}`;

  return {
    id: sceneId,
    sceneNumber: index + 1,
    sceneTitle: typeof r.sceneTitle === "string" ? r.sceneTitle.trim().slice(0, 60) : `Scene ${index + 1}`,
    moodLabel: typeof r.moodLabel === "string" ? r.moodLabel.trim().slice(0, 40) : "Unknown",
    tensionScore: clamp(typeof r.tensionScore === "number" ? Math.round(r.tensionScore) : 5, 1, 10),
    directorNotes: typeof r.directorNotes === "string" ? r.directorNotes.trim().slice(0, 280) : "",
    paragraphs,
    visualTheme: { bgHexFrom: bgFrom, bgHexTo: bgTo, accentHex: accent },
    synthPatch: sanitizePatch(r.synthPatch),
  };
}
