# PageScore: AI Narrative Dramaturg & Neural Film-Score Conductor

**PageScore** is an AI-first creative system that turns any piece of reading into an adaptive, cinematic film score. 

Rather than treating AI as an auxiliary chatbot or decorative feature, **the AI is the composer and director at the center of the entire product**. An LLM reads raw prose, analyzes narrative tension arcs, segments text into emotional movements, and programmatically writes complete multi-voice synthesizer compositions that morph in real time as the reader scrolls.

Zero audio files. Zero pre-recorded samples. 100% procedural Web Audio driven by large language model dramaturgy.

---

## The AI Architecture: How Claude Scores Literature

```
                  ┌────────────────────────────────────────┐
                  │          Raw Narrative Text            │
                  │ (Literature, Chapter, Creative Writing)│
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       Anthropic Claude (Director)      │
                  │   • Narrative Dramaturgy & Arc Parsing │
                  │   • Emotional Turning Point Detection  │
                  │   • Music Theory: Keys, Scales, Chords │
                  │   • Synthesizer Patch Programming      │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       Validated Score JSON Schema      │
                  │  4-Part Chords · Basslines · Arps ·    │
                  │  BPM · Filters · Foley · Tension Scores│
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │      Tone.js Procedural Synthesis      │
                  │  • PolySynth (Pads) • MonoSynth (Bass) │
                  │  • Ping-Pong Arp   • Pink Noise Foley  │
                  │  • Real-Time Focal Scroll Morphing     │
                  └────────────────────────────────────────┘
```

### Why AI is Essential to the Build
Traditional audio apps rely on static loops or generic genre tags. PageScore cannot function without advanced semantic reasoning:
1. **Dramatic Arc Parsing:** Claude identifies subtle psychological turning points in literature (e.g. rising dread, sudden revelations, or quiet nostalgia) and maps them to numerical tension scores (0–100).
2. **Music Theory Voicing:** The AI acts as a classical film composer, selecting modal scales (Dorian, Lydian, Harmonic Minor), voicing four-part chords across specific octaves (C2–C5), and writing matching basslines and arpeggios that adhere to harmonic rules.
3. **Synthesizer Parameterization:** Claude directly configures the physical synthesizer architecture: filter cutoffs (180–4500 Hz), reverb decay, oscillator waveforms (sine, triangle, fatsawtooth), and procedural atmospheric foley (rain, wind, vintage vinyl crackle, subterranean rumble).
4. **Zero-Latency Upfront Generation:** The AI analyzes the text once upfront to produce a complete movement score. Once generated, the browser executes the performance client-side, eliminating API lag during active reading.

---

## Features

- **Autonomous "Listen & Read" Mode:** Press `D` or click *Listen & Read* to let the neural conductor autonomously guide your reading pace through chapters while morphing audio stages.
- **Procedural Tone.js Engine:** Zero MP3s. All audio is synthesized directly on your device via the Web Audio API with a 60 FPS live oscilloscope.
- **Tactile Sound Console:** Interactive controls for master volume (calibrated with a wide logarithmic decibel curve), filter cutoff overrides, BPM modulation, and ambient foley switches.
- **Editorial Reading Typography:** Elegant editorial layout with sticky Roman numeral navigation rails, hairline reading progress ribbons, and dark cinematic themes.
- **Pre-Scored Master Stories:** Ships with pre-compiled master scores (*The North Sea Station*, *The Cartographer's Archive*, and Arthur Conan Doyle's *Sherlock Holmes*), alongside custom text scoring.

---

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/benjamin-nweke/pagescore.git
cd pagescore

# 2. Install dependencies
npm install

# 3. Configure Anthropic API key
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY in .env.local

# 4. Run local development server
npm run dev
```

Open `http://localhost:3000` in your browser. Click **"Score Your Story"** to score your own custom text, or press **Space** to listen to the pre-scored literature immediately.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router, Server Components, API Routes)
- **AI Engine:** Anthropic Claude (`claude-sonnet-4-6` with active fallback pipeline)
- **Audio Synthesis:** Tone.js + Web Audio API (Analysers, Limiters, Filters, Convolution Reverbs)
- **Styling & Motion:** Tailwind CSS + Vanilla CSS Tokens + Framer Motion Spring Physics
- **Typography:** Google Fonts (`Lora` editorial serif + `Inter` UI + `JetBrains Mono`)

---

## License

MIT &bull; Created by [Benjamin Nweke](https://github.com/benjamin-nweke)
