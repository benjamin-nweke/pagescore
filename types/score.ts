export interface SynthPatch {
  bpm: number; // 55 to 145
  keyAndScale: string; // e.g. "D Minor", "F Major", "C Dorian"
  chordProgression: string[][]; // exactly 4 chords, each 3-4 valid Tone.js notes
  arpNotes: string[]; // 4 to 8 valid Tone.js pitch strings
  arpPattern: "up" | "down" | "upDown" | "random";
  arpSubdivision: "8n" | "16n" | "4n";
  padWaveform: "sine" | "triangle" | "sawtooth" | "fatsawtooth";
  bassNotes: string[]; // exactly 4 low root notes matching the chords
  bassRhythm: "sustained" | "pulsing_8n" | "driving_16n" | "heartbeat";
  filterCutoffHz: number; // 180 to 4500
  reverbDecay: number; // 1.5 to 8.0 seconds
  reverbWet: number; // 0.15 to 0.85
  ambienceType: "rain" | "wind" | "vinyl_crackle" | "deep_rumble" | "none";
  ambienceIntensity: number; // 0.0 to 0.45
}

export interface StoryScene {
  id: string;
  sceneNumber: number;
  sceneTitle: string;
  moodLabel: string;
  tensionScore: number; // 1 to 10
  directorNotes: string; // 1-2 sentences: WHY these chords/synths for this text
  paragraphs: string[];
  visualTheme: {
    bgHexFrom: string; // dark cinematic gradient start
    bgHexTo: string; // dark cinematic gradient end
    accentHex: string; // glowing accent
  };
  synthPatch: SynthPatch;
}

export interface ScoredStory {
  id: string;
  title: string;
  authorOrGenre: string;
  scenes: StoryScene[];
}
