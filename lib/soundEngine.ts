"use client";

// Tone.js is never imported at module level to avoid SSR issues.
// All Tone imports are dynamic, inside init().
import type * as ToneNS from "tone";
import type { StoryScene, SynthPatch } from "@/types/score";
import { sanitizePatch } from "@/lib/validateScore";
import { clamp, debug } from "@/lib/utils";

type AmbienceType = SynthPatch["ambienceType"];

type EngineEvent =
  | { type: "chord"; index: number }
  | { type: "arpNote"; note: string }
  | { type: "scene"; sceneId: string }
  | { type: "state"; playing: boolean };

type Subscriber = (e: EngineEvent) => void;

// Foley bus entry — created once, morphed via gain ramps
interface FoleyEntry {
  noise: ToneNS.Noise;
  gain: ToneNS.Gain;
}

class SoundEngine {
  private Tone: typeof ToneNS | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private disposed = false;

  // Instruments
  private pad: ToneNS.PolySynth | null = null;
  private arp: ToneNS.Synth | null = null;
  private bass: ToneNS.MonoSynth | null = null;

  // FX chain
  private pingPong: ToneNS.PingPongDelay | null = null;
  private masterFilter: ToneNS.Filter | null = null;
  private reverb: ToneNS.Reverb | null = null;
  private limiter: ToneNS.Limiter | null = null;
  private analyser: ToneNS.Analyser | null = null;

  // Gain nodes
  private padGain: ToneNS.Gain | null = null;
  private arpGain: ToneNS.Gain | null = null;
  private bassGain: ToneNS.Gain | null = null;
  private foleyBus: ToneNS.Gain | null = null;
  private masterGain: ToneNS.Gain | null = null;

  // Foley per-type nodes
  private foleyEntries: Partial<Record<AmbienceType, FoleyEntry>> = {};
  private currentAmbienceType: AmbienceType = "none";

  // Scheduling state
  private chordLoop: ToneNS.Loop | null = null;
  private arpPattern: ToneNS.Pattern<string> | null = null;
  private bassLoop: ToneNS.Loop | null = null;
  private barIndex = 0;
  private bassStep = 0;

  // Live patch references (read by callbacks at fire time)
  private currentPatch: SynthPatch | null = null;
  private liveChords: string[][] = [];
  private liveArpNotes: string[] = [];
  private liveBassNotes: string[] = [];
  private pendingPadWaveform: SynthPatch["padWaveform"] | null = null;

  // Queue for scenes that arrive before init is done
  private pendingScene: StoryScene | null = null;

  // Subscribers
  private subscribers: Set<Subscriber> = new Set();

  // Reverb state
  private currentReverbDecay = 5.0;

  // Dispose-guard for async callbacks
  private disposeId = 0;

  // Master volume and mute state
  private currentVolume = 0.7;
  private currentMuted = false;

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private emit(e: EngineEvent) {
    this.subscribers.forEach((cb) => cb(e));
  }

  isReady(): boolean {
    return this.initialized && !this.disposed;
  }

  getWaveform(): Float32Array | null {
    if (!this.analyser || !this.initialized) return null;
    try {
      return this.analyser.getValue() as Float32Array;
    } catch {
      return null;
    }
  }

  getLiveParams(): { bpm: number; filterHz: number } {
    if (!this.Tone || !this.masterFilter) {
      return { bpm: this.currentPatch?.bpm ?? 90, filterHz: this.currentPatch?.filterCutoffHz ?? 1400 };
    }
    const transport = this.Tone.getTransport();
    return {
      bpm: transport.bpm.value,
      filterHz: Number(this.masterFilter.frequency.value),
    };
  }

  async init(): Promise<void> {
    if (this.disposed) {
      // Reset so we can rebuild after a dispose
      this.disposed = false;
      this.initialized = false;
      this.initPromise = null;
    }
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._build();
    return this.initPromise;
  }

  private async _build(): Promise<void> {
    const Tone = await import("tone");
    this.Tone = Tone;

    if (this.disposed) return; // disposed while we were importing

    await Tone.start();

    // ── Master gain / destination ──────────────────────────────────────────
    Tone.getDestination().mute = this.currentMuted;
    this.setVolume(this.currentVolume);

    // ── Build signal chain ─────────────────────────────────────────────────
    this.masterGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("waveform", 256);
    this.limiter = new Tone.Limiter(-1);
    this.reverb = new Tone.Reverb({ decay: 5, wet: 0.5 });
    await this.reverb.ready;
    this.currentReverbDecay = 5.0;
    this.masterFilter = new Tone.Filter({ type: "lowpass", frequency: 1400, Q: 0.8, rolloff: -24 });

    // Chain: masterGain -> masterFilter -> reverb -> limiter -> analyser -> destination
    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.reverb);
    this.reverb.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(Tone.getDestination());

    // ── Gain buses feeding masterGain (rich, cinematic presence) ─────────
    this.padGain = new Tone.Gain(this._dbToLinear(-8));
    this.arpGain = new Tone.Gain(this._dbToLinear(-10));
    this.bassGain = new Tone.Gain(this._dbToLinear(-7));
    this.foleyBus = new Tone.Gain(1);

    this.padGain.connect(this.masterGain);
    this.arpGain.connect(this.masterGain);
    this.bassGain.connect(this.masterGain);
    this.foleyBus.connect(this.masterGain);

    // ── Pad ────────────────────────────────────────────────────────────────
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 2.5 },
    });
    this.pad.maxPolyphony = 8;
    this.pad.connect(this.padGain);

    // ── Arp ────────────────────────────────────────────────────────────────
    this.arp = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.6 },
    });
    this.pingPong = new Tone.PingPongDelay({ delayTime: "8n.", feedback: 0.3, wet: 0.35 });
    this.arp.connect(this.pingPong);
    this.pingPong.connect(this.arpGain);

    // ── Bass ───────────────────────────────────────────────────────────────
    this.bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", frequency: 400, Q: 1 },
      filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 120, octaves: 2 },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.5 },
    });
    this.bass.connect(this.bassGain);

    // ── Foley bus ──────────────────────────────────────────────────────────
    await this._buildFoley(Tone);

    // ── Transport ──────────────────────────────────────────────────────────
    const transport = Tone.getTransport();
    transport.bpm.value = 90;

    // ── Loops ──────────────────────────────────────────────────────────────
    this._buildLoops(Tone);

    this.initialized = true;
    this.setVolume(this.currentVolume);

    // Apply any scene that arrived before init finished
    if (this.pendingScene) {
      const s = this.pendingScene;
      this.pendingScene = null;
      this.transitionToScene(s);
    }

    debug("SoundEngine built");
  }

  private async _buildFoley(Tone: typeof ToneNS): Promise<void> {
    // Rain: pink noise, highpass 600, lowpass 7000
    const rainNoise = new Tone.Noise("pink").start();
    const rainHp = new Tone.Filter({ type: "highpass", frequency: 600 });
    const rainLp = new Tone.Filter({ type: "lowpass", frequency: 7000 });
    const rainGain = new Tone.Gain(0);
    rainNoise.connect(rainHp);
    rainHp.connect(rainLp);
    rainLp.connect(rainGain);
    rainGain.connect(this.foleyBus!);
    this.foleyEntries["rain"] = { noise: rainNoise, gain: rainGain };

    // Wind: brown noise, AutoFilter slow
    const windNoise = new Tone.Noise("brown").start();
    const windFilter = new Tone.AutoFilter({ frequency: 0.12, baseFrequency: 300, octaves: 2.5, depth: 0.8 }).start();
    const windGain = new Tone.Gain(0);
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.foleyBus!);
    this.foleyEntries["wind"] = { noise: windNoise, gain: windGain };

    // Vinyl crackle: pink noise, highpass 2500, tremolo gate
    const vinylNoise = new Tone.Noise("pink").start();
    const vinylHp = new Tone.Filter({ type: "highpass", frequency: 2500 });
    const vinylTrem = new Tone.Tremolo({ frequency: 7, depth: 0.85, wet: 0.7 }).start();
    const vinylGain = new Tone.Gain(0);
    vinylNoise.connect(vinylHp);
    vinylHp.connect(vinylTrem);
    vinylTrem.connect(vinylGain);
    vinylGain.connect(this.foleyBus!);
    this.foleyEntries["vinyl_crackle"] = { noise: vinylNoise, gain: vinylGain };

    // Deep rumble: brown noise, lowpass 120, very slow autofilter
    const rumbleNoise = new Tone.Noise("brown").start();
    const rumbleLp = new Tone.Filter({ type: "lowpass", frequency: 120 });
    const rumbleAf = new Tone.AutoFilter({ frequency: 0.07, baseFrequency: 60, octaves: 1.5, depth: 0.5 }).start();
    const rumbleGain = new Tone.Gain(0);
    rumbleNoise.connect(rumbleLp);
    rumbleLp.connect(rumbleAf);
    rumbleAf.connect(rumbleGain);
    rumbleGain.connect(this.foleyBus!);
    this.foleyEntries["deep_rumble"] = { noise: rumbleNoise, gain: rumbleGain };

    // none — no node needed; just zeroing all gains is the off state
    this.foleyEntries["none"] = {
      noise: new Tone.Noise("pink"), // never started
      gain: new Tone.Gain(0),
    };
  }

  private _buildLoops(Tone: typeof ToneNS): void {
    // ── Chord loop: every bar ──────────────────────────────────────────────
    this.chordLoop = new Tone.Loop((time) => {
      try {
        if (!this.pad || !this.liveChords.length) return;

        // Apply pending waveform change between bars
        if (this.pendingPadWaveform) {
          const wf = this.pendingPadWaveform;
          this.pendingPadWaveform = null;
          const oscType = (
            wf === "fatsawtooth"
              ? { type: "fatsawtooth", count: 3, spread: 20 }
              : { type: wf }
          ) as unknown as Partial<ToneNS.OmniOscillatorOptions>;
          this.pad.set({ oscillator: oscType });
        }

        const chord = this.liveChords[this.barIndex % 4];
        const dur = Tone.Time("1m").toSeconds() * 0.98;
        this.pad.triggerAttackRelease(chord, dur, time, 0.72);

        const idx = this.barIndex % 4;
        Tone.getDraw().schedule(() => {
          this.emit({ type: "chord", index: idx });
        }, time);

        this.barIndex++;
      } catch (err) {
        debug("chord loop error", err);
      }
    }, "1m");

    this.chordLoop.start(0);

    // ── Arp pattern ────────────────────────────────────────────────────────
    this.arpPattern = new Tone.Pattern(
      (time, note) => {
        try {
          if (!this.arp || !note) return;
          // Slight velocity variation without Math.random in audio path
          const velocity = 0.5 + (this.barIndex % 7) * 0.028;
          this.arp.triggerAttackRelease(note, "16n", time, clamp(velocity, 0.5, 0.7));
          Tone.getDraw().schedule(() => {
            this.emit({ type: "arpNote", note: note as string });
          }, time);
        } catch (err) {
          debug("arp callback error", err);
        }
      },
      ["C5", "E5", "G5", "A5"],
      "upDown"
    );
    this.arpPattern.interval = "8n";
    this.arpPattern.start(0);

    // ── Bass loop: 16th-note step sequencer ───────────────────────────────
    this.bassStep = 0;
    this.bassLoop = new Tone.Loop((time) => {
      try {
        if (!this.bass || !this.liveBassNotes.length || !this.currentPatch) return;

        const step = this.bassStep;
        const bar = Math.floor(step / 16);
        const noteIdx = (this.barIndex > 0 ? this.barIndex - 1 : 0) % 4;
        const note = this.liveBassNotes[noteIdx];
        const rhythm = this.currentPatch.bassRhythm;

        const trigger = (n: string, dur: ToneNS.Unit.Time, vel: number) => {
          this.bass!.triggerAttackRelease(n, dur, time, vel);
        };

        if (rhythm === "sustained" && step % 16 === 0) {
          trigger(note, "1m", 0.7);
        } else if (rhythm === "pulsing_8n" && step % 2 === 0) {
          trigger(note, "8n", step % 16 === 0 ? 0.75 : 0.55);
        } else if (rhythm === "driving_16n") {
          const accent = step % 4 === 0;
          trigger(note, "16n", accent ? 0.8 : 0.5);
        } else if (rhythm === "heartbeat") {
          if (step % 16 === 0) trigger(note, "16n", 0.9);
          else if (step % 16 === 3) trigger(note, "16n", 0.6);
        }

        this.bassStep = (step + 1) % (16 * 4); // 4 bars then reset
        void bar; // suppress unused warning
      } catch (err) {
        debug("bass loop error", err);
      }
    }, "16n");

    this.bassLoop.start(0);
  }

  async play(): Promise<void> {
    if (!this.Tone || !this.initialized) return;
    const transport = this.Tone.getTransport();
    if (this.masterGain) {
      this.masterGain.gain.rampTo(1, 0.3);
    }
    transport.start("+0.1");
    this.emit({ type: "state", playing: true });
  }

  pause(): void {
    if (!this.Tone || !this.initialized) return;
    if (this.masterGain) {
      this.masterGain.gain.rampTo(0, 0.3);
    }
    const capturedId = this.disposeId;
    setTimeout(() => {
      if (this.disposeId !== capturedId) return;
      if (!this.Tone || !this.initialized) return;
      this.Tone.getTransport().pause();
      this.emit({ type: "state", playing: false });
    }, 350);
  }

  setMuted(muted: boolean): void {
    this.currentMuted = muted;
    if (!this.Tone || !this.initialized) return;
    this.Tone.getDestination().mute = muted;
  }

  setVolume(linear0to1: number): void {
    this.currentVolume = linear0to1;
    if (!this.Tone) return;

    if (linear0to1 <= 0.001) {
      this.Tone.getDestination().mute = true;
      if (this.masterGain) {
        if (this.initialized) this.masterGain.gain.rampTo(0, 0.04);
        else this.masterGain.gain.value = 0;
      }
      return;
    }
    // If not explicitly muted, ensure audio destination is unmuted
    if (!this.currentMuted) {
      this.Tone.getDestination().mute = false;
    }

    // Wide dynamic range perceptual audio curve:
    // linear0to1:
    // 1.0  -> +8 dB  (loud, high cinematic impact; limiter transparently catches peaks)
    // 0.85 -> +4.5 dB
    // 0.7  -> +0.5 dB (~0 dB nominal reference listening volume)
    // 0.5  -> -6.5 dB
    // 0.35 -> -14 dB
    // 0.2  -> -25 dB
    // 0.1  -> -40 dB (ambient whisper)
    const db = 48 * Math.log10(linear0to1) + 8;
    const clamped = clamp(db, -60, 8);

    if (this.initialized) {
      this.Tone.getDestination().volume.rampTo(clamped, 0.04);
      if (this.masterGain) {
        this.masterGain.gain.rampTo(1, 0.04);
      }
    } else {
      this.Tone.getDestination().volume.value = clamped;
    }
  }

  overrideBpm(bpm: number): void {
    if (!this.Tone) return;
    this.Tone.getTransport().bpm.rampTo(clamp(bpm, 55, 145), 0.15);
  }

  overrideFilter(hz: number): void {
    if (!this.masterFilter) return;
    this.masterFilter.frequency.rampTo(clamp(hz, 180, 4500), 0.15);
  }

  transitionToScene(scene: StoryScene): void {
    if (!this.initialized) {
      this.pendingScene = scene;
      return;
    }
    if (!this.Tone) return;

    const patch = sanitizePatch(scene.synthPatch);
    this.currentPatch = patch;

    const Tone = this.Tone;
    const transport = Tone.getTransport();

    // BPM
    transport.bpm.rampTo(patch.bpm, 2.0);

    // Filter
    this.masterFilter?.frequency.rampTo(patch.filterCutoffHz, 2.0);

    // Reverb wet + optional decay change
    if (this.reverb) {
      const decayDiff = Math.abs(patch.reverbDecay - this.currentReverbDecay);
      if (decayDiff > 0.75) {
        // Dip wet first, change decay, restore
        this.reverb.wet.rampTo(patch.reverbWet * 0.6, 0.5);
        const capturedId = this.disposeId;
        setTimeout(() => {
          if (this.disposeId !== capturedId || !this.reverb) return;
          this.reverb.decay = patch.reverbDecay;
          this.currentReverbDecay = patch.reverbDecay;
          this.reverb.ready.then(() => {
            if (this.disposeId !== capturedId || !this.reverb) return;
            this.reverb!.wet.rampTo(patch.reverbWet, 1.2);
          });
        }, 560);
      } else {
        this.reverb.wet.rampTo(patch.reverbWet, 2.0);
      }
    }

    // Foley crossfade
    this._transitionFoley(patch.ambienceType, patch.ambienceIntensity);

    // Pad gain (sawtooth variants get extra -3 dB)
    if (this.padGain) {
      const sawExtra = patch.padWaveform === "sawtooth" || patch.padWaveform === "fatsawtooth" ? -3 : 0;
      const targetDb = -10 + sawExtra;
      this.padGain.gain.rampTo(this._dbToLinear(targetDb), 2.0);
    }

    // Schedule pad waveform change at next bar boundary
    this.pendingPadWaveform = patch.padWaveform;

    // Swap live arrays and reset bar index
    this.liveChords = patch.chordProgression;
    this.liveArpNotes = patch.arpNotes;
    this.liveBassNotes = patch.bassNotes;
    this.barIndex = 0;
    this.bassStep = 0;

    // Update arp pattern live
    if (this.arpPattern) {
      this.arpPattern.values = patch.arpNotes;
      this.arpPattern.pattern = patch.arpPattern;
      this.arpPattern.interval = patch.arpSubdivision;
    }

    this.emit({ type: "scene", sceneId: scene.id });
    debug("transitionToScene", scene.id, patch.bpm, patch.keyAndScale);
  }

  private _transitionFoley(type: AmbienceType, intensity: number): void {
    const RAMP = 2.0;
    // Ramp out current
    if (this.currentAmbienceType !== type) {
      const prev = this.foleyEntries[this.currentAmbienceType];
      if (prev) prev.gain.gain.rampTo(0, RAMP);
    }
    // Ramp in new
    const entry = this.foleyEntries[type];
    if (entry && type !== "none") {
      const maxDb = -12;
      const minDb = -60;
      const db = intensity <= 0 ? minDb : minDb + (maxDb - minDb) * (intensity / 0.45);
      const linear = this._dbToLinear(db);
      entry.gain.gain.rampTo(linear, RAMP);
    }
    this.currentAmbienceType = type;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeId++;
    this.initialized = false;
    this.initPromise = null;

    if (!this.Tone) return;
    const transport = this.Tone.getTransport();

    try { this.chordLoop?.stop(); this.chordLoop?.dispose(); } catch { /* empty */ }
    try { this.arpPattern?.stop(); this.arpPattern?.dispose(); } catch { /* empty */ }
    try { this.bassLoop?.stop(); this.bassLoop?.dispose(); } catch { /* empty */ }

    transport.cancel(0);
    transport.stop();

    const nodes = [
      this.pad, this.arp, this.bass, this.pingPong,
      this.padGain, this.arpGain, this.bassGain, this.foleyBus,
      this.masterGain, this.masterFilter, this.reverb, this.limiter, this.analyser,
    ];
    nodes.forEach((n) => { try { n?.dispose(); } catch { /* empty */ } });

    Object.values(this.foleyEntries).forEach((entry) => {
      if (!entry) return;
      try { entry.noise.stop(); entry.noise.dispose(); } catch { /* empty */ }
      try { entry.gain.dispose(); } catch { /* empty */ }
    });

    this.pad = null; this.arp = null; this.bass = null;
    this.pingPong = null; this.masterFilter = null; this.reverb = null;
    this.limiter = null; this.analyser = null;
    this.padGain = null; this.arpGain = null; this.bassGain = null;
    this.foleyBus = null; this.masterGain = null;
    this.chordLoop = null; this.arpPattern = null; this.bassLoop = null;
    this.foleyEntries = {};
    this.currentPatch = null;
    this.liveChords = []; this.liveArpNotes = []; this.liveBassNotes = [];
    this.Tone = null;

    debug("SoundEngine disposed");
  }

  // Helpers
  private _dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  private _linearToDb(linear: number): number {
    return 20 * Math.log10(linear);
  }
}

// Singleton
let instance: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!instance) instance = new SoundEngine();
  return instance;
}

export type { EngineEvent };
