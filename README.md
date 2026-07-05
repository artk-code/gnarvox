# gnarvox

Local voice‑cloning / lesson‑narration project for **Lessons with Art**.

This repo contains:

1. **The product design** — a detailed, local‑first plan for a Tauri 2 + Rust +
   Python voice‑cloning desktop app for producing Audible‑style lesson audio in
   Art's own voice. See [`docs/PLAN.md`](docs/PLAN.md) and
   [`docs/REVIEW-SYNTHESIS.md`](docs/REVIEW-SYNTHESIS.md).
2. **gnarvox Studio** — a desktop app (Windows + Linux) and web app that runs
   the lesson‑narration workflow end to end, **100% locally**: a synthetic demo
   engine with zero setup, plus the **Kokoro‑82M neural TTS** for real
   narration. No API keys, no telemetry.

---

## gnarvox Studio

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
- **Generate** — renders each chunk with the active **voice engine** (below).
  A generation queue shows per‑chunk status, duration, and warnings.
- **Audition** (PLAN §7.9) — the chunks are stitched with inter‑chunk /
  inter‑section pauses and loudness‑normalized; a canvas waveform with a
  play/seek transport lets you listen.
- **Export** (PLAN §7.10) — save a 16‑bit WAV master plus a provenance
  `manifest.json` binding the audio to its text, per‑chunk seeds, settings,
  consent statement, and a SHA‑256 content hash. ACX‑style RMS/peak targets are
  checked and reported. In the desktop app this uses native save dialogs.

### Voice engines

- **Kokoro‑82M neural TTS** (real speech, local): an open Apache‑2.0 model that
  runs on CPU via ONNX Runtime, entirely on your machine. The **Voice engine**
  panel manages the model per PLAN §12.3:
  - explicit one‑time download (~92 MB for the recommended `q8` variant) — the
    app never downloads silently;
  - choose the quantization/size (`q8`, `fp16`, `q4`, `q4f16`, `fp32`);
  - download from the official Hugging Face repo **or a custom mirror /
    self‑hosted URL**;
  - **import from a local folder** for air‑gapped machines (desktop app);
  - see exactly which files are installed, where, and delete them anytime.
  All 28 Kokoro voices (US/UK, male/female) ship with the app and work offline.
- **Synthetic engine** (always available, zero setup): a pure‑DSP "narration"
  placeholder. Deterministic — same text + voice + seed ⇒ byte‑identical
  audio — and fully unit‑tested. Useful for demoing the workflow instantly.

> No human voice is cloned. The real local voice‑cloning product — engine
> selection (Chatterbox / …), ROCm backends, capture, consent, and
> watermarking — is specified in [`docs/PLAN.md`](docs/PLAN.md).

---

## Desktop app (Windows + Linux)

The desktop app is a Tauri 2 shell around the same frontend.

### Install

Grab the latest installer from the GitHub **Releases** page:

- **Linux (Debian/Ubuntu — recommended)**: the `.deb` package.

  ```bash
  sudo apt install ./gnarvox-studio_x.y.z_amd64.deb
  ```

  Then launch **gnarvox-studio** from your app menu, or run `gnarvox-studio`
  in a terminal. The deb uses your system WebKitGTK, which renders reliably;
  it declares its dependencies, so apt pulls in anything missing.
- **Windows**: `gnarvox-studio_x.y.z_x64-setup.exe` (NSIS, per‑user install).

> **Why not AppImage?** AppImages bundle their own GTK/WebKit libraries, which
> currently conflict with the GPU/EGL stack on some systems (blank window,
> `Could not create default EGL display` in the log). The `.deb` avoids this
> entirely. You can still build an AppImage with
> `BUNDLES=appimage,deb bash scripts/build-linux.sh` if you want to experiment.

Model files live under the app data dir (Linux:
`~/.local/share/com.gnarvox.studio/models`).

### Test drive (2 minutes)

1. Install and launch the app.
2. Click **⚡ Generate lesson** — the bundled sample script renders instantly
   with the synthetic demo voice; audition the waveform and try **Save WAV**.
3. For real speech: in **0 · Voice engine** pick **Kokoro‑82M neural TTS**,
   click **⬇ Download model** (~92 MB, one time), then **Generate lesson**
   again. Switch voices (28 included) in the top‑left Voice selector.

### Troubleshooting

- **Blank/empty window on Linux**: your WebKitGTK + GPU combo may need
  compositing workarounds. Try:

  ```bash
  WEBKIT_DISABLE_DMABUF_RENDERER=1 gnarvox-studio
  ```

- Logs print to the terminal you launched from; please include them in bug
  reports.

### Develop

Requirements: Node ≥ 20, Rust (stable), and on Linux the Tauri system deps
(`libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf`).

```bash
npm install
npm run tauri dev     # desktop app with hot reload
npm run tauri build   # native packages for the current OS
```

### Package for Linux without polluting the host

```bash
docker build -t gnarvox-linux-builder -f scripts/linux-builder.Dockerfile scripts
docker run --rm -v "$PWD:/work" -w /work \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  gnarvox-linux-builder bash scripts/build-linux.sh
```

The `.deb` lands in `src-tauri/target/release/bundle/deb/`. Building inside
Ubuntu 24.04 keeps the binary portable to 24.04+. Set `BUNDLES=appimage,deb`
to also produce an AppImage (see the caveat above).

### Releases (CI)

Pushing a tag like `v0.2.0` triggers `.github/workflows/release.yml`, which
builds the Windows NSIS installer and the Linux `.deb` on GitHub runners and
attaches them to a draft GitHub Release.

---

## Web app

The same UI runs as a plain web app (models cache in browser storage instead
of the filesystem):

```bash
npm install
npm run dev        # → http://localhost:5173
```

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
    numberWords.ts     cardinal / ordinal / year number-to-words (tested)
    normalize.ts       spoken-form text normalization pipeline (tested)
    chunk.ts           sectioning + chunking (tested)
    engine.ts          deterministic synthetic voice engine, pure DSP (tested)
    engines/
      kokoro.ts        Kokoro-82M neural TTS engine (kokoro-js + ONNX, local)
      kokoroVoices.ts  bundled Kokoro voice catalog
    models/
      modelSource.ts   model download sources: HF / mirror / local (tested)
      modelStore.ts    model file storage (Tauri fs / browser Cache API)
      modelManager.ts  status, explicit download, delete, folder import
    audio.ts           stitch, loudness, waveform peaks, WAV encode (tested)
    manifest.ts        provenance export manifest
    hash.ts            deterministic seed hash + SHA-256
    tauri.ts           desktop integration (native save dialogs)
    speech.ts          optional browser SpeechSynthesis preview
    preview.ts         one-shot Web Audio preview playback
    *.test.ts          vitest suites (incl. an end-to-end pipeline test)
  components/          React panels: Engine, Script, Normalize, Chunks,
                       Audition, Export
  hooks/               useAudioPlayer (Web Audio playback + playhead)
  store.ts             zustand store wiring the workflow (settings persist)
  App.tsx, main.tsx    app shell
src-tauri/             Tauri 2 desktop shell (Rust)
scripts/               Linux package builder (Docker) + icon generator
.github/workflows/     tag-triggered Windows/Linux release builds
docs/                  the full product plan + review synthesis
prompts/               the planning prompts that produced docs/
```

The core lesson‑production logic (normalize, chunk, engine, stitch, WAV) is
pure and runs in Node, so it is covered by fast unit tests and one
full‑pipeline integration test.

---

## Status & next steps

- gnarvox Studio now covers PLAN Milestones 2 + 4 + 5 in spirit: a desktop
  skeleton, the full lesson workflow, audio review, and export — plus a real
  local neural TTS (Kokoro) behind the engine switch.
- The remaining production roadmap (go/no‑go voice-cloning spike, evaluation
  harness, capture wizard, Chatterbox/ROCm backends) lives in
  [`docs/PLAN.md`](docs/PLAN.md), Milestones 0.5–6.
