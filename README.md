# gnarvox

Local voice‑cloning / lesson‑narration planning project for **Lessons with Art**.

This repo contains two things:

1. **The product design** — a detailed, local‑first plan for a Tauri 2 + Rust +
   Python voice‑cloning desktop app for producing Audible‑style lesson audio in
   Art's own voice. See [`docs/PLAN.md`](docs/PLAN.md) and
   [`docs/REVIEW-SYNTHESIS.md`](docs/REVIEW-SYNTHESIS.md).
2. **gnarvox Studio** — a runnable, **100% offline** web app that demonstrates
   the lesson‑narration *workflow* end to end, today, with **no API keys and no
   model downloads**. It's the working slice you can click through while the
   full desktop app and TTS backends are still being evaluated.

---

## gnarvox Studio (the runnable app)

gnarvox Studio walks a lesson script through the exact pipeline the plan
describes:

```
Script ─▶ Normalize ─▶ Chunk ─▶ Generate ─▶ Audition ─▶ Export
```

- **Script** — paste a lesson. Markdown headings (`#`) become chapters;
  paragraphs are split into sections.
- **Normalize** (PLAN §7.2) — a real, first‑class text normalizer expands
  numbers, ordinals, currency, percentages, decimals, years, units, URLs,
  emails, and acronyms to spoken form, and shows every substitution for review.
- **Chunk** (PLAN §7.3) — text is packed into 1–4 sentence chunks at a target
  size, preferring semantic boundaries and merging too‑short fragments.
- **Generate** — a **deterministic offline synthetic voice engine** renders each
  chunk to speech‑like audio. Same text + voice + seed ⇒ byte‑identical audio,
  so every "take" is reproducible (PLAN §17). A generation queue shows per‑chunk
  status, duration, and warnings.
- **Audition** (PLAN §7.9) — the chunks are stitched with inter‑chunk /
  inter‑section pauses and loudness‑normalized; a canvas waveform with a
  play/seek transport lets you listen.
- **Export** (PLAN §7.10) — download a 16‑bit WAV master plus a provenance
  `manifest.json` binding the audio to its text, per‑chunk seeds, settings,
  consent statement, and a SHA‑256 content hash. ACX‑style RMS/peak targets are
  checked and reported.

### Two voice paths

- **Synthetic engine** (always on, offline): a pure‑DSP "narration" placeholder.
  It is intentionally not a real cloned voice — it exercises the whole workflow,
  is reproducible, and is fully unit‑tested. This is what gets generated and
  exported.
- **Live browser voice** (optional, fun): when running in a real browser, each
  chunk's `🔊 voice` button speaks the text aloud using the system
  SpeechSynthesis voice. Never required.

> No human voice is cloned in this demo. The real local voice‑cloning product —
> engine selection (Chatterbox / Kokoro / …), ROCm/ONNX backends, capture,
> consent, and watermarking — is specified in [`docs/PLAN.md`](docs/PLAN.md).

---

## Running it

Requirements: **Node ≥ 20** (developed on Node 24) and npm.

```bash
npm install      # install dependencies (no network needed at runtime)
npm run dev      # start the dev server → open the printed http://localhost:5173
```

Then click **⚡ Generate lesson** to render the sample script, audition the
waveform, and export a WAV + manifest. Edit the script or change the voice /
seed / pace / chunk size and regenerate.

### Other commands

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm test           # run the unit + pipeline test suite (vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## Project layout

```
src/
  lib/
    numberWords.ts   cardinal / ordinal / year number-to-words (tested)
    normalize.ts     spoken-form text normalization pipeline (tested)
    chunk.ts         sectioning + chunking (tested)
    engine.ts        deterministic synthetic voice engine, pure DSP (tested)
    audio.ts         stitch, loudness, waveform peaks, WAV encode (tested)
    manifest.ts      provenance export manifest
    hash.ts          deterministic seed hash + SHA-256
    speech.ts        optional browser SpeechSynthesis preview
    preview.ts       one-shot Web Audio preview playback
    *.test.ts        vitest suites (incl. an end-to-end pipeline test)
  components/        React panels: Script, Normalize, Chunks, Audition, Export
  hooks/             useAudioPlayer (Web Audio playback + playhead)
  store.ts           zustand store wiring the workflow
  App.tsx, main.tsx  app shell
docs/                the full product plan + review synthesis
prompts/             the planning prompts that produced docs/
```

The core lesson‑production logic (normalize, chunk, engine, stitch, WAV) is pure
and runs in Node, so it is covered by fast unit tests and one full‑pipeline
integration test.

---

## Status & next steps

- gnarvox Studio is a workflow demo, **not** the production app. It deliberately
  uses a synthetic engine so it runs anywhere with zero setup.
- The production roadmap (go/no‑go voice spike, evaluation harness, Tauri
  desktop skeleton, capture, real TTS backends, ROCm/ONNX) lives in
  [`docs/PLAN.md`](docs/PLAN.md), Milestones 0.5–6.
- A natural next step is to swap the synthetic engine behind a `VoiceEngine`
  interface for a real local TTS adapter (Kokoro ONNX first) without changing
  the surrounding workflow.
