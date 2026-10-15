import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sanitizePatch, sanitizeScene } from "@/lib/validateScore";
import type { ScoredStory, StoryScene } from "@/types/score";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are PageScore's Director: a film-score composer, synthesizer programmer, and literary analyst. You read a text, find its emotional turning points, and design a Tone.js synthesizer patch for each section.

SEGMENTATION
Divide the text into 3 to 6 scenes. Split only at genuine shifts in emotion, tension, or setting. Scenes must be contiguous, ordered, and cover every paragraph (0 to N-1). Return startParagraph and endParagraph as inclusive indices into the numbered paragraph list you receive.

MUSIC THEORY BY EMOTION
- Calm / nostalgic: major or Lydian/Dorian, maj7/add9 voicings, tempo 55-75, sine or triangle pad, filter 1200-2800 Hz, reverb decay 5-8, long wet 0.5-0.75.
- Dread / suspense: minor with dissonant intervals (tritone, b9, minor 2nd), pedal or heartbeat bass, tempo 70-95, filter 400-1200 Hz, reverb decay 5-8, wind or rumble.
- Action / panic: minor or harmonic minor, driving 16th bass, tempo 120-145, sawtooth or fatsawtooth, filter 3000-4500 Hz, reverb decay 2-3.5, short wet 0.2-0.35.
- Sadness / aftermath: minor 9ths, very slow tempo 55-72, sine pad, filter 600-1000 Hz, reverb decay 6-8, wet 0.6-0.8.
- Awe / peace: major 9ths or sus chords, slow tempo 55-68, sine pad, long reverb 0.65-0.8.
Higher tensionScore means higher tempo, brighter filter, busier bass rhythm, shorter reverb.

NOTE RULES
- Scientific pitch notation only. Use # or b (ASCII), never Unicode ♯ or ♭.
- chordProgression: exactly 4 chords of 3-4 notes each, voiced between C2 and C5 (octaves 2-4).
- bassNotes: exactly 4 root notes in octaves 1-2, matching each chord's root.
- arpNotes: 4-8 notes in octaves 4-5, drawn from the key and chords.
- All chord/arp/bass notes must belong to the stated keyAndScale (the dominant's leading tone is allowed in minor).
- Adjacent scenes should differ audibly; modulate key only for genuine ruptures in the text.

RANGES
bpm: 55-145 | filterCutoffHz: 180-4500 | reverbDecay: 1.5-8.0 | reverbWet: 0.15-0.85 | ambienceIntensity: 0.0-0.45

DIRECTOR NOTES
1-2 sentences. Cite the specific image, line, or action in the text that drove the musical choice. No generic filler.

VISUAL THEMES
Dark cinematic backgrounds (low luminance). bgHexFrom and bgHexTo are dark and related. accentHex is vivid and legible on dark. Reflect the scene's mood in the color temperature.

MOOD AND TITLE
moodLabel: 2-3 evocative words. sceneTitle: short cinematic title, not a summary.

OUTPUT FORMAT (JSON only):
{
  "title": "Story Title",
  "authorOrGenre": "Author or Genre",
  "scenes": [
    {
      "startParagraph": 0,
      "endParagraph": 1,
      "sceneTitle": "Scene Name",
      "moodLabel": "2-3 Words",
      "tensionScore": 30,
      "directorNotes": "Reason for musical choice.",
      "visualTheme": { "bgHexFrom": "#0a0a0f", "bgHexTo": "#14151f", "accentHex": "#c99a50" },
      "synthPatch": {
        "bpm": 74,
        "keyAndScale": "D Minor",
        "chordProgression": [["D3", "F3", "A3"], ["G3", "Bb3", "D4"], ["A3", "C#4", "E4"], ["D3", "F3", "A3"]],
        "bassNotes": ["D2", "G1", "A1", "D2"],
        "bassRhythm": "sustained",
        "arpNotes": ["D4", "F4", "A4", "D5"],
        "arpPattern": "upDown",
        "arpSubdivision": "8n",
        "padWaveform": "triangle",
        "filterCutoffHz": 1200,
        "reverbDecay": 5.0,
        "reverbWet": 0.5,
        "ambienceType": "rain",
        "ambienceIntensity": 0.2
      }
    }
  ]
}
Return valid JSON only, no markdown fences.`;

// ── Paragraph splitting ───────────────────────────────────────────────────────

function splitIntoParagraphs(text: string): string[] {
  let paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  // If fewer than 3 paragraphs, split into sentence groups
  if (paras.length < 3) {
    const sentences = text.match(/[^.!?]+[.!?]+["']?/g) ?? [text];
    const groupSize = Math.ceil(sentences.length / 4);
    paras = [];
    for (let i = 0; i < sentences.length; i += groupSize) {
      const group = sentences.slice(i, i + groupSize).join(" ").trim();
      if (group) paras.push(group);
    }
    if (paras.length < 3) paras = [text]; // fallback
  }

  return paras.slice(0, 60);
}

// ── Range repair ──────────────────────────────────────────────────────────────

interface RawScene {
  startParagraph: number;
  endParagraph: number;
  sceneTitle?: string;
  moodLabel?: string;
  tensionScore?: number;
  directorNotes?: string;
  visualTheme?: Record<string, string>;
  synthPatch?: Record<string, unknown>;
}

function repairRanges(rawScenes: RawScene[], paraCount: number): RawScene[] | null {
  if (!rawScenes.length) return null;

  const scenes = rawScenes
    .map((s) => ({ ...s, startParagraph: Math.max(0, s.startParagraph), endParagraph: Math.min(paraCount - 1, s.endParagraph) }))
    .sort((a, b) => a.startParagraph - b.startParagraph);

  // Close gaps: extend previous scene's end to one before next start
  for (let i = 0; i < scenes.length - 1; i++) {
    const next = scenes[i + 1];
    if (scenes[i].endParagraph < next.startParagraph - 1) {
      scenes[i].endParagraph = next.startParagraph - 1;
    }
    // Fix overlap: push next start forward
    if (scenes[i].endParagraph >= next.startParagraph) {
      next.startParagraph = scenes[i].endParagraph + 1;
    }
    if (next.startParagraph > next.endParagraph) return null;
  }

  // Must start at 0 and end at paraCount-1
  scenes[0].startParagraph = 0;
  scenes[scenes.length - 1].endParagraph = paraCount - 1;

  return scenes;
}

// ── Parse LLM response ────────────────────────────────────────────────────────

function parseLlmJson(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(text);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText: string = typeof body.text === "string" ? body.text.trim() : "";
    const titleHint: string = typeof body.title === "string" ? body.title.trim() : "";

    if (rawText.length < 400) {
      return NextResponse.json({ error: "Text is too short. Paste at least 400 characters." }, { status: 400 });
    }
    if (rawText.length > 20000) {
      return NextResponse.json({ error: "Text exceeds the 20,000 character limit. Please shorten it." }, { status: 400 });
    }

    // Key resolution: header first, then env
    const headerKey = req.headers.get("x-user-api-key")?.trim();
    const apiKey = headerKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "No Anthropic API key configured. Add one in the modal or set ANTHROPIC_API_KEY in .env.local." },
        { status: 401 }
      );
    }

    const paragraphs = splitIntoParagraphs(rawText);
    if (paragraphs.length > 60) {
      return NextResponse.json({ error: "Text has too many paragraphs (max 60). Please shorten it." }, { status: 400 });
    }

    const numberedList = paragraphs.map((p, i) => `[${i}] ${p}`).join("\n\n");
    const titleLine = titleHint ? `Title hint: "${titleHint}"\n\n` : "";

    const userPrompt = `${titleLine}Paragraphs (${paragraphs.length} total, indices 0–${paragraphs.length - 1}):\n\n${numberedList}\n\nReturn a complete scored story JSON as specified.`;

    const client = new Anthropic({ apiKey });

    const CANDIDATE_MODELS = [
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-5-20250929",
      "claude-3-5-sonnet-latest",
      "claude-3-5-sonnet-20241022",
    ];

    const callClaude = async (): Promise<string> => {
      let lastErr: unknown = null;
      for (const model of CANDIDATE_MODELS) {
        try {
          const message = await client.messages.create({
            model,
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          });
          const block = message.content.find((b) => b.type === "text");
          if (block && block.type === "text") return block.text;
        } catch (err: unknown) {
          lastErr = err;
          const status = (err as { status?: number })?.status;
          if (status === 404) {
            console.warn(`[api/compose] Model ${model} returned 404, falling back...`);
            continue;
          }
          throw err;
        }
      }
      throw lastErr ?? new Error("No compatible Anthropic model available");
    };

    let parsed: Record<string, unknown>;
    try {
      const raw = await callClaude();
      parsed = parseLlmJson(raw);
    } catch {
      // One automatic retry
      try {
        const raw = await callClaude();
        parsed = parseLlmJson(raw);
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : String(err2);
        if (msg.includes("401") || msg.includes("authentication")) {
          return NextResponse.json({ error: "Anthropic API key is invalid or expired." }, { status: 401 });
        }
        if (msg.includes("429") || msg.includes("rate")) {
          return NextResponse.json({ error: "Rate limit reached. Wait a moment and try again." }, { status: 429 });
        }
        return NextResponse.json({ error: "The model returned an invalid score. Try again, or shorten the text." }, { status: 502 });
      }
    }

    const rawScenes = (parsed.scenes as RawScene[]) ?? [];
    let repairedRaw = repairRanges(rawScenes, paragraphs.length);
    if (!repairedRaw) {
      // Second retry for range repair
      try {
        const raw2 = await callClaude();
        const parsed2 = parseLlmJson(raw2);
        repairedRaw = repairRanges((parsed2.scenes as RawScene[]) ?? [], paragraphs.length);
      } catch {
        // fall through
      }
      if (!repairedRaw) {
        return NextResponse.json({ error: "The model could not segment the text cleanly. Try again." }, { status: 502 });
      }
    }

    const storyId = `custom-${Date.now()}`;
    const scenes: StoryScene[] = repairedRaw.map((s, i) => {
      const sceneParagraphs = paragraphs.slice(s.startParagraph, s.endParagraph + 1);
      const sanitized = sanitizeScene(
        { ...s, id: `${storyId}-s${i + 1}`, synthPatch: sanitizePatch(s.synthPatch ?? {}) },
        i,
        sceneParagraphs
      );
      return sanitized;
    });

    const story: ScoredStory = {
      id: storyId,
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim().slice(0, 60)
          : titleHint || "Custom Story",
      authorOrGenre: typeof parsed.authorOrGenre === "string" ? parsed.authorOrGenre.trim().slice(0, 40) : "Custom",
      scenes,
    };

    return NextResponse.json(story);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("authentication")) {
      return NextResponse.json({ error: "Anthropic API key is invalid or expired." }, { status: 401 });
    }
    if (msg.includes("429") || msg.includes("rate")) {
      return NextResponse.json({ error: "Rate limit reached. Wait a moment and try again." }, { status: 429 });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
