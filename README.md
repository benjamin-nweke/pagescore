# PageScore

A browser-native film-score conductor for reading. Load a story, and a procedural synthesizer composes a multi-layered cinematic score that morphs in real time as you move between passages. No audio files. No per-scroll API calls.

## How it works

1. You paste a story into the compose modal. The text is sent once to Claude (via Anthropic's API), which segments it into 3-6 emotional scenes and designs a complete Tone.js synthesizer patch for each: key, chord progression, BPM, oscillator waveform, filter cutoff, reverb, arpeggio pattern, bass rhythm, and procedural foley (rain, wind, vinyl crackle, deep rumble).

2. The browser's Web Audio graph reads those patches and plays everything live via Tone.js: a pad synth, a ping-pong-delayed arp lead, a bass synth, and noise-based ambient layers. An `IntersectionObserver` watches your scroll position and triggers patch morphs at scene boundaries, crossfading BPM, filter frequency, reverb wet/decay, foley layers, and waveform over two seconds.

3. Three preset stories ship with hand-authored patches, so the demo works with no API key.

## Setup

```bash
git clone <repo>
cd pagescore
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Then open `http://localhost:3000`. Click "Start audio and auto-scroll demo" to hear and watch the full preset story hands-free.

## Adding your Anthropic API key

Either set `ANTHROPIC_API_KEY` in `.env.local`, or enter it directly in the "Score custom text" modal (it's stored only in your browser's `localStorage` and sent only to this app's own `/api/compose` endpoint).

The compose route uses Anthropic Claude (`claude-sonnet-4-6` with active fallback). You can use any Claude model that supports long-form structured output.

## Limits

- Custom text: 400 to 20,000 characters, up to 60 paragraphs.
- The LLM call can take 15-45 seconds for longer texts.
- Audio requires a user gesture to start (browser policy). The demo button handles this.
- Tone.js runs entirely in the browser. There is no audio processing on the server.
- The app does not fall back to keyword/sentiment matching if the API call fails. If there's no key, the presets still play.
