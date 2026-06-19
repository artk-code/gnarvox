# gnarvox Plan

Current as of: 2026-06-19

gnarvox is a local-first voice-cloning and narration-production tool for Art
Kaiser to create Audible-style lesson audio for "Lessons with Art." This is the
canonical implementation plan after review synthesis. It is still a planning
document, not an implementation log.

## 0. Executive Recommendation

Build gnarvox as a Tauri 2 desktop application with a Rust host, system webview
UI, local SQLite project database, local media/model storage, and a separate
Python inference worker for the first production-quality MVP.

Do not start by building the full desktop app. First prove the load-bearing
assumption: local zero-shot or prompt-conditioned cloning can create listenable,
publishable lesson narration in Art's specific voice on Art's Strix Halo
machines.

Recommended sequence:

1. Run a brutal go/no-go spike that produces a 10-minute stitched lesson sample
   in Art's voice before any Tauri app code exists.
2. Build the CLI evaluation harness and export pipeline around real lesson
   artifacts, not isolated demo clips.
3. Select the MVP engine/backend from measured quality, reliability, licensing,
   runtime support, and packaging cost.
4. Build the desktop app around durable workflow primitives: projects, scripts,
   sections, normalized text, pronunciation dictionary, voice samples,
   generation jobs, audio takes, review notes, provenance, and exports.

Initial model posture:

- Chatterbox Turbo is the first integration target because it is small, fast,
  MIT-licensed according to Resemble AI, has official ONNX artifacts, supports
  zero-shot cloning, includes native paralinguistic tags, and uses PerTh
  watermarking.
- Chatterbox Original and Chatterbox Multilingual V3 are co-primary quality
  challengers for lesson narration. Turbo should not be treated as the winner
  until Art-specific long-form listening tests prove it.
- Kokoro ONNX/Python is the baseline engine for fast drafts, CI smoke tests, and
  fallback export-path testing. It is not expected to clone Art's voice.
- Fish Speech S2 is an optional quality challenger only if installation and
  licensing can be verified quickly.
- F5-TTS is evaluation-only unless commercially usable weights are identified.
  Its repo states code is MIT, but pretrained models are CC-BY-NC because of the
  training data.
- XTTS v2 is excluded from the default roadmap because the Coqui Public Model
  License is non-commercial for the model and outputs unless separate rights are
  secured.

Performance posture:

- gnarvox is an offline batch-production tool, not a real-time voice agent.
- Faster-than-real-time generation is useful, but not required for MVP.
- An overnight CPU or CPU/ONNX generation queue is acceptable if the resulting
  audio is high quality, reproducible, and can run unattended.
- GPU acceleration is an optimization and release claim only after long-running
  local validation on the target machines.

## 1. Product Scope

### 1.1 Target User

The primary user is Art. The tool should optimize for a single creator producing
polished lesson narration in Art's own voice, not for a multi-tenant voice
marketplace or general-purpose voice cloning product.

### 1.2 Target Outputs

MVP output should include:

- WAV master export.
- MP3 export with ID3 metadata.
- M4B audiobook export with chapters and cover art when supplied, unless the
  schedule slips; in that case WAV and MP3 ship first and M4B becomes Milestone
  5.5.
- Per-section WAV stems for later editing.
- Project manifest export with text, sections, model settings, reference sample
  IDs, take IDs, export metadata, hashes, and provenance.

Post-MVP output:

- FLAC archival master.
- AAC/M4A intermediary.
- Cue sheet or JSON chapter sidecar.
- Optional subtitle/transcript sidecar for generated audio.
- C2PA-style content credential if a practical local signing path exists.

### 1.3 Non-Goals for MVP

- Cloud sync.
- Public voice marketplace.
- Cloning voices other than Art's own voice.
- Real-time conversational voice agent mode.
- Fine-tuning pipeline.
- Multi-user permissions.
- Mobile app.
- Full DAW replacement.
- NPU or Vulkan inference.

## 2. Go/No-Go Spike

Before building the desktop app, run a 2-4 day spike with throwaway scripts.

Goal:

- Input: curated Art reference samples and one real lesson excerpt.
- Output: a 10-minute stitched, loudness-checked lesson sample in Art's voice.
- Engines: Chatterbox Turbo plus at least one of Chatterbox Original or
  Chatterbox Multilingual V3, using whatever backend works today.
- Export: WAV and MP3, with an M4B attempt if FFmpeg chapter packaging is
  already straightforward.

Required checks:

- Art listens to the full 10-minute output without knowing which engine/seed
  produced each candidate where practical.
- At least one second listener reviews the go/no-go sample for clarity,
  fatigue, glitches, pronunciation, and obvious synthetic artifacts.
- Run one correction pickup test by regenerating a whole chunk with neighbor
  context, not a bare sentence fragment.
- Run a hard-text paragraph with numbers, URLs, acronyms, code-ish terms,
  dates, names, and nested quotes.
- Log generation time, memory, crashes, warning count, ASR WER/CER, loudness,
  true peak, RMS, noise floor estimate, and watermark status where applicable.

Pass criteria:

- Art approves at least one engine as plausible for real lesson production.
- The stitched 10-minute sample has no severe hallucinations, skipped text, or
  repeated chunks.
- Correction pickup is usable at chunk granularity, even if not perfect.
- The selected engine's license permits the intended "Lessons with Art" use.
- At least one local fallback path runs on both Windows and Ubuntu, even if slow.

Failure branch:

- If no local engine is good enough, stop app development and write a Plan B:
  cloud TTS, hybrid local/cloud, or an assembly/export tool for Art's own
  recordings.
- If voice quality passes but acceleration fails, continue with CPU or CPU/ONNX
  as the MVP posture and keep GPU work behind diagnostics.
- If export/watermark/provenance fails, continue only if Art accepts the
  disclosure and artifact-retention workflow in writing.

## 3. Current Technical Landscape

### 3.1 Chatterbox Family

Sources:

- GitHub repo: https://github.com/resemble-ai/chatterbox
- Resemble model overview: https://www.resemble.ai/learn/models/chatterbox
- Chatterbox Turbo page:
  https://www.resemble.ai/learn/models/chatterbox-turbo
- Chatterbox Turbo ONNX model:
  https://huggingface.co/ResembleAI/chatterbox-turbo-ONNX
- Chatterbox Multilingual:
  https://www.resemble.ai/learn/models/chatterbox-multilingual

Source claims to verify locally:

- Chatterbox, Chatterbox Multilingual, and Chatterbox Turbo are MIT-licensed.
- Chatterbox Turbo is a 350M parameter English model.
- Chatterbox Original and Multilingual are around 500M models.
- Turbo is optimized for lower compute and lower latency than prior Chatterbox
  models.
- Turbo supports zero-shot cloning from short reference audio.
- Turbo supports paralinguistic tags such as `[sigh]`, `[gasp]`, `[cough]`,
  `[laugh]`, `[whisper]`, and `[breath]`.
- Chatterbox outputs include PerTh watermarking by default.
- Chatterbox Multilingual V3 claims improved speaker similarity, hallucination
  reduction, and naturalness. Those claims matter for English long-form
  narration, not only multilingual work.

Known risks:

- Long-form behavior may degrade on long chunks. gnarvox should generate short
  chunks and stitch professionally.
- Short inputs can produce hallucination or gibberish in some Chatterbox
  reports. gnarvox must avoid bare-fragment regeneration.
- Output near quotes, abbreviations, numbers, and code-ish text can drift unless
  text normalization and ASR checks are used.
- PerTh watermark survival through loudness processing, MP3, and M4B must be
  tested.

Recommendation:

- Integrate Chatterbox Turbo first for harness velocity.
- Evaluate Turbo, Original, and Multilingual V3 head-to-head on lesson-shaped
  tasks before choosing the default narrator.
- Use the PerTh detector in acceptance tests if Chatterbox is used.

### 3.2 Fish Speech S2

Source:

- GitHub repo: https://github.com/fishaudio/fish-speech

Source claims:

- Fish Audio S2 Pro is described as a multilingual TTS system trained on large
  audio data, with emotion/prosody tags, multi-speaker, and multi-turn
  generation.
- Fish Speech S2 supports rapid voice cloning from roughly 10-30 second samples.
- The repo references server inference through SGLang-Omni and vLLM-Omni.

Recommendation:

- Include only as an optional one-off quality challenger if install takes less
  than one day and license terms for the exact weights are clear.
- Do not make Fish Speech S2 a Milestone 1 exit criterion.

### 3.3 F5-TTS

Source:

- GitHub repo: https://github.com/SWivid/F5-TTS

Recommendation:

- Evaluate only if Art wants non-commercial testing.
- Do not use pretrained weights for distributable "Lessons with Art" audio
  unless licensing is resolved in writing or a commercially usable checkpoint is
  selected.

### 3.4 Kokoro

Sources:

- GitHub repo: https://github.com/hexgrad/kokoro
- ONNX model:
  https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX

Recommendation:

- Add as a baseline engine and development fallback.
- Use it to test chunking, text normalization, export, metadata, queue, and CI
  behavior without requiring GPU setup.

### 3.5 XTTS v2

Source:

- Hugging Face license:
  https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt

Recommendation:

- Exclude from default roadmap.
- Revisit only if clear commercial rights are available and it materially
  outperforms alternatives.

## 4. Hardware and OS Assumptions

### 4.1 Target Machines

Target machines:

- Windows 11 Pro on AMD Strix Halo.
- Ubuntu 26.04 on AMD Strix Halo.

Likely CPU/GPU target:

- AMD Ryzen AI Max+ 395 or similar Ryzen AI Max part.
- AMD calls the former codename Strix Halo.
- Ryzen AI Max+ 395 specs include 16 Zen 5 cores, 32 threads, up to 128 GB
  LPDDR5x-8000, Radeon 8060S graphics with 40 graphics cores, and up to 50 NPU
  TOPS.

Source:

- AMD product page:
  https://www.amd.com/en/products/processors/laptop/ryzen/ai-300-series/amd-ryzen-ai-max-plus-395.html

### 4.2 Ubuntu 26.04 ROCm Path

Sources:

- ROCm Ryzen Linux compatibility:
  https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityryz/native_linux/native_linux_compatibility.html
- RDNA 3.5 optimization:
  https://rocm.docs.amd.com/en/latest/how-to/system-optimization/rdna3-5.html

Current source claims:

- AMD's ROCm Ryzen Linux matrix currently lists gfx1151 and AMD Ryzen AI Max+
  395, Ryzen AI Max 390, and Ryzen AI Max 385 for ROCm 7.2.1.
- PyTorch 2.9.1 with ROCm 7.2.1 and Python 3.12 is listed with official
  production support, but only FP16 is officially validated.
- RDNA 3.5 APUs require kernel fixes for KFD queue creation and memory checks.
- Ubuntu 26.04 is listed among distributions with the required fixes in native
  packaging.
- AMD recommends keeping dedicated VRAM reservation small and increasing shared
  TTM/GTT limits instead for Ryzen AI Max series APUs.

Operational posture:

- Treat Ubuntu ROCm as the likely production acceleration path, but not as a
  release blocker.
- Although current AMD docs list gfx1151, Strix Halo ROCm remains a moving stack
  in practice. The worker and queue must survive GPU hangs, worker death, OOM,
  and long-run instability.
- Export should be CPU-only. Audio export is cheap, and avoiding GPU encoder
  overlap reduces one class of sustained-GPU instability.

Validation steps:

1. Record exact hardware SKU, BIOS version, firmware, kernel, ROCm version,
   Python version, PyTorch version, and GPU target.
2. Run `rocminfo`, `rocm-smi`, and a PyTorch HIP smoke test.
3. Verify `torch.cuda.is_available()` in ROCm PyTorch, device name, FP16 tensor
   matmul, and a small transformer inference.
4. Run Chatterbox Turbo PyTorch on CPU and ROCm GPU with the same seed/input.
5. Measure wall-clock generation time, real-time factor, memory pressure, CPU
   usage, audio correctness, and failure modes.
6. Test long-running queue stability: at least 60 minutes of generated audio
   across many chunks without manual intervention.
7. Test thermals and power mode because Strix Halo systems may throttle
   differently under sustained audio generation.
8. Test AMD shared-memory configuration using `amd-ttm` or direct TTM settings.
9. Kill the worker mid-job and confirm retryable queue recovery.

### 4.3 Windows 11 Pro Path

Sources:

- ROCm Ryzen limitations:
  https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/limitations/limitationsryz.html
- ONNX Runtime DirectML:
  https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html
- PyTorch DirectML:
  https://learn.microsoft.com/en-us/windows/ai/directml/pytorch-windows

Current source claims:

- AMD's Ryzen ROCm Windows limitations page says only PyTorch is available on
  Windows; the rest of the ROCm stack is only supported on Linux.
- Windows support is constrained to Python 3.12 for that release.
- Windows security features such as WDAG and Smart App Control can interfere
  with ROCm functionality.
- ONNX Runtime DirectML exists for Windows GPU acceleration, but unsupported
  model ops or newer opsets may cause failure or poor performance.

Recommendation:

- Windows must support review, editing, export, and at least CPU fallback.
- Do not make Windows GPU acceleration a release blocker for MVP.
- Treat Windows ROCm PyTorch, ONNX DirectML, and Windows MIGraphX as experiments
  until exact install, model-op, quality, and stability results are known.

### 4.4 NPU and Vulkan

- Do not budget MVP work for the Ryzen AI NPU.
- Do not budget MVP work for Vulkan compute.
- Revisit only after the model and workflow are stable.

## 5. Frontend and Desktop Stack

### 5.1 Recommendation: Tauri 2

Sources:

- Tauri WebView versions:
  https://v2.tauri.app/reference/webview-versions/
- Tauri prerequisites:
  https://v2.tauri.app/start/prerequisites/

Why Tauri fits:

- The project explicitly wants Rust plus system webview, not Electron.
- Tauri gives a mature Rust host, packaging story, command IPC, filesystem
  access controls, updater options, and Windows/Linux support.
- gnarvox needs native filesystem, audio, FFmpeg, and process integration.

Frontend implementation:

- Tauri 2 host in Rust.
- Web UI in TypeScript, defaulting to Svelte unless Art chooses otherwise.
- Conservative canvas-based waveform and timeline UI.
- Rust commands for project IO, worker lifecycle, job orchestration, export,
  media analysis, audio capture, and filesystem access.

Webview risk posture:

- Linux uses WebKitGTK, which is the cross-platform UI risk for waveform and
  audio behavior.
- Do not make browser audio decoding, large WebAudio graphs, or MediaSource
  load-bearing in MVP.
- Compute waveform peaks, loudness, duration, and file validation in Rust using
  libraries such as `symphonia`, `hound`, `rubato`, or FFmpeg as appropriate.
- Send compact peak arrays and transport state to the webview.
- Prototype the waveform widget on Ubuntu WebKitGTK before investing in a fancy
  review UI.
- Pin and document the WebKitGTK version used for Ubuntu 26.04 testing.

### 5.2 Alternatives

- Wry directly: useful only if Tauri abstractions become a blocker.
- Dioxus Desktop: attractive for Rust-only UI, but the broader web ecosystem is
  useful for editor and waveform UI.
- Slint, Iced, egui: do not satisfy the explicit system-webview preference for
  the main app.

Decision:

- Use Tauri 2 for MVP.

## 6. Architecture

### 6.1 Process Model

Components:

- `gnarvox-ui`: web frontend inside Tauri WebView.
- `gnarvox-host`: Rust Tauri host.
- `gnarvox-worker`: Python inference worker process.
- `gnarvox-eval`: standalone CLI harness for model/runtime quality and
  performance tests.
- Export code: initially in the Rust host, calling FFmpeg with deterministic
  arguments. Split into `gnarvox-export` later only if needed.

Runtime responsibilities:

- UI:
  - Project navigation.
  - Script editor and section timeline.
  - Capture wizard.
  - Pronunciation and normalization review.
  - Generation queue view.
  - Audio audition and take selection.
  - Export panel.

- Rust host:
  - Owns trusted filesystem access.
  - Owns project database and migrations.
  - Starts/stops the worker.
  - Handles queue state, retries, and crash recovery.
  - Calls FFmpeg and Rust audio libraries for export and analysis.
  - Captures microphone audio through `cpal` or a comparable Rust audio backend.
  - Computes peaks/loudness/duration outside the webview.
  - Validates path access and prevents arbitrary frontend filesystem access.

- Python worker:
  - Loads selected model.
  - Reports backend capabilities and memory usage when available.
  - Accepts generation requests by chunk.
  - Writes WAV outputs to project-managed temp/chunks directory.
  - Returns structured metadata: model ID, settings, seed, text hash, reference
    sample ID, timing, sample rate, duration, warnings, and errors.

### 6.2 Worker IPC and Lifecycle

Default IPC:

- Use stdio JSON-RPC for production MVP.
- Optional loopback HTTP debug mode may be added for development.

Reasoning:

- stdio avoids Windows firewall prompts, port binding races, and exposing a
  local HTTP surface.
- The Rust host owns worker lifecycle and can terminate the child process
  cleanly.
- The frontend should never call the worker directly; it calls Rust commands.

Lifecycle contract:

- Host starts worker with project/session configuration.
- Worker reports `ready`, supported engines/backends, model cache path, Python
  version, Torch version, and device capabilities.
- Host sends heartbeat or health ping every 5 seconds while jobs are active.
- Cancel requests propagate to the active generation if the engine supports it;
  otherwise the host may terminate and restart the worker.
- OOM, crash, timeout, or nonzero exit marks the active job
  `failed_retryable`, not corrupt.
- Host may restart the worker up to 3 times per session before requiring user
  intervention.
- Timeouts are per chunk and engine-specific, with a generous default during
  evaluation.
- One loaded model at a time for MVP.

### 6.3 Internal API Boundary

Use a model-neutral job schema:

```json
{
  "job_id": "uuid",
  "project_id": "uuid",
  "engine": "chatterbox_turbo",
  "backend": "pytorch_rocm",
  "voice_profile_id": "uuid",
  "reference_sample_selection_policy": {
    "mode": "profile_default",
    "sample_ids": ["uuid"],
    "style_hint": "lesson_clear"
  },
  "section_id": "uuid",
  "chunk_id": "uuid",
  "text": {
    "original": "string",
    "normalized": "string",
    "engine_text": "string",
    "text_hash": "sha256"
  },
  "pronunciations": {},
  "style": {
    "preset": "lesson_clear",
    "compatible_engines": ["chatterbox_turbo"],
    "pace": 1.0,
    "emotion": 0.4,
    "cfg_weight": 0.5,
    "seed": 1234
  },
  "context": {
    "previous_chunk_text": "string",
    "next_chunk_text": "string",
    "repair_mode": false
  },
  "output": {
    "format": "wav",
    "sample_rate": 24000
  }
}
```

The worker should return:

```json
{
  "job_id": "uuid",
  "status": "succeeded",
  "output_wav": "relative/path.wav",
  "duration_sec": 12.34,
  "rtf": 0.42,
  "peak_memory_mb": 6132,
  "engine_version": "string",
  "model_revision": "string",
  "backend_version": "string",
  "seed_used": 1234,
  "reproducible": true,
  "watermark_detected": true,
  "warnings": []
}
```

### 6.4 Storage Layout

Use a project package directory:

```text
My Lesson.gnarvox/
  project.sqlite
  manifest.json
  scripts/
    imported/
    normalized/
  voices/
    art/
      raw/
      curated/
      transcripts/
      profiles/
  audio/
    chunks/
    takes/
    stems/
    exports/
  cache/
  logs/
```

Authority:

- SQLite is the source of truth.
- `manifest.json` is a derived artifact regenerated on demand for export,
  backup, or debugging.
- App-wide model cache lives in the platform app data/cache directory with
  checksums, pinned revisions, and explicit license metadata.

Privacy:

- No network calls during normal generation.
- No telemetry by default.
- Model downloads require explicit user action.
- Import/export paths are user-selected.
- Logs store IDs and hashes by default, not full private script text.

### 6.5 Database Entities

Core tables:

- `projects`
- `scripts`
- `sections`
- `chunks`
- `voice_profiles`
- `voice_samples`
- `normalization_rules`
- `pronunciation_entries`
- `style_presets`
- `generation_jobs`
- `takes`
- `exports`
- `model_installs`
- `audit_events`

Important fields:

- Project state: `draft`, `generating`, `review`, `locked_for_export`.
- Text hash per section/chunk.
- Audio hash per generated file.
- Model ID and revision.
- Backend and runtime versions.
- Reference sample IDs and selection policy.
- Prompt text/transcript for reference samples.
- Generation settings and seed behavior.
- Export loudness settings and measured RMS/LUFS/true peak/noise floor.
- Provenance record IDs.

## 7. Lesson Production Workflow

### 7.1 Script Import

Inputs:

- Plain text.
- Markdown.
- Paste from clipboard.
- DOCX only if Art's real workflow requires it; otherwise defer.

Import behavior:

- Normalize smart quotes and whitespace.
- Preserve headings as candidate chapters.
- Detect lists, callouts, examples, and code-ish snippets.
- Produce editable sections.
- Estimate spoken duration using measured Art WPM once available.

### 7.2 Text Normalization

Text normalization is a first-class, engine-independent component.

Responsibilities:

- Expand numbers, dates, ranges, currencies, units, percentages, fractions, and
  ordinals.
- Expand or clarify acronyms and abbreviations.
- Normalize URLs, email addresses, code identifiers, version strings, math-ish
  notation, and punctuation that TTS models commonly mishandle.
- Preserve original text, normalized text, and engine-specific text.
- Provide a review UI for risky substitutions before generation.
- Support golden tests for normalizer behavior.

Reasoning:

- Lesson audio will contain technical and educational text.
- Normalization improves every model and survives a model swap.
- Pronunciation dictionary entries alone do not scale to every number, URL, or
  unit in a lesson.

### 7.3 Chunking

Chunking goals:

- Keep model input below the range where hallucination or prosody drift appears.
- Avoid very short model inputs that trigger gibberish or hallucination.
- Prefer semantic boundaries: headings, paragraphs, sentences.
- Avoid cutting abbreviations, initials, decimals, URLs, and quoted phrases.
- Keep chunks short enough for repair and retry.

Initial strategy:

- Section: user-facing unit, often 30 seconds to 5 minutes.
- Chunk: model-facing unit, starting around 250-350 characters or 1-4
  sentences, adjusted after empirical results.
- Shrink chunks automatically after ASR mismatch, worker warnings, repeated text,
  long silence, or user-marked failures.
- Store original text, normalized text, engine text, pronunciation substitutions,
  expected pause after chunk, and generated take IDs.

### 7.4 Stitching and Repair

Defaults:

- Inter-chunk pause: start at 250-500 ms depending on punctuation and section
  style.
- Inter-section pause: start at 800-1200 ms.
- Crossfade: defer manual crossfade editor; use controlled silence and optional
  tiny equal-power fades only if tests show clicks or abrupt boundaries.
- Loudness match selected chunks before final export.

Repair policy:

- Do not regenerate bare words, "Hi!", "yes", single numbers, or arbitrary
  highlighted fragments through the model.
- Correction pickup regenerates a whole chunk with locked style/seed when
  possible and neighbor-context text supplied to the worker.
- If the highlighted text is inside a larger chunk, regenerate the containing
  chunk or a re-chunked paragraph-sized region.
- Provide a preview that plays the end of the previous selected chunk, the new
  chunk, and the start of the next selected chunk before accepting replacement.

Stitching metrics:

- Seam loudness delta at chunk boundaries.
- Silence duration and unexpected silence ratio.
- ASR WER/CER around boundaries.
- User rating for pickup match.
- Click/pop detection where practical.

### 7.5 Pronunciation Dictionary

Support:

- Word/phrase replacement.
- Phonetic spelling notes.
- Case-sensitive entries.
- Per-project and global dictionaries.
- Preview generation for a full sentence or chunk using the selected entry.

Implementation note:

- Start with text substitutions and engine-specific prompt hints.
- Do not promise IPA/ARPABET support unless the selected model runtime supports
  it reliably.
- Preview must use the same normalization and chunking path as production.

### 7.6 Markup Controls

MVP:

- Literal pause insertion such as `[pause:500ms]`.
- Native paralinguistic tags only after engine validation, such as `[breath]`,
  `[laugh]`, and `[sigh]` for Chatterbox if they behave reliably.

Deferred:

- General SSML.
- Custom `[emphasis]`, `[soft]`, and `[pace]` language until a selected engine
  actually honors those controls.

Storage:

- Store original text, normalized text, and engine-expanded text for
  reproducibility.
- Strip unsupported tags with warnings, never silently.

### 7.7 Style Presets

MVP:

- One default preset: `lesson_clear`.

Preset fields:

- Compatible engines.
- Reference sample selection policy.
- Pace/speed.
- Exaggeration/emotion.
- CFG or equivalent if supported.
- Seed policy.
- Silence policy.
- Loudness target.

Deferred presets:

- `lesson_warm`
- `recap`
- `story`
- `correction_pickup`

Reasoning:

- Style presets should be based on evaluation data, not guessed before the
  selected engine is understood.

### 7.8 Generation Queue

Capabilities:

- Generate whole lesson.
- Generate selected section.
- Generate selected chunks.
- Regenerate selected chunk with same seed/settings where reproducible.
- Regenerate with modified style.
- Pause/resume queue.
- Cancel active job safely.
- Mark failed chunks and retry.
- Keep multiple takes per chunk/section.
- Auto-select best take using objective checks, with human override.

Auto-selection inputs:

- ASR WER/CER.
- Clipping/peak.
- Silence ratio.
- Loudness range.
- Watermark status where applicable.
- Worker warnings.
- Duration outliers.

UI requirements:

- Queue row shows section, status, backend, elapsed time, output duration, RTF,
  estimated time remaining from rolling RTF, warnings, and retry count.
- Warnings are actionable: clipped audio, silence, long generation, watermark
  missing, text mismatch, loudness out of range, ASR mismatch, backend fallback.

### 7.9 Audition and Editing

MVP:

- Waveform display from Rust-precomputed peaks.
- Play/pause/seek.
- Loop section.
- A/B compare takes.
- Mark take as selected.
- Add note to take.
- Regenerate a chunk or section.
- Trim leading/trailing silence.
- Show chunk boundaries during audition.
- Preview repair boundaries before accepting regenerated chunks.

Post-MVP:

- Spectrogram view.
- Punch-in line repair.
- Crossfade editor.
- Breath level controls.
- Manual chapter boundary adjustment on waveform.

### 7.10 Export

Use FFmpeg for MVP export, launched by the Rust host with deterministic
arguments. Export should be CPU-only.

Export steps:

1. Render selected takes into a section timeline.
2. Apply silence trimming where enabled.
3. Insert configured inter-chunk and inter-section pauses.
4. Normalize loudness.
5. Export WAV master.
6. Encode MP3 and/or M4B.
7. Write chapters and metadata.
8. Write provenance metadata and derived manifest.
9. Verify duration, file readability, loudness, peak, and noise-floor metrics.
10. Run watermark detection before and after export formats where applicable.

ACX/Audible-style technical targets:

- Average level: -23 dB to -18 dB RMS per file.
- Peak values: no higher than -3 dB.
- Noise floor: no higher than -60 dB RMS.
- MP3 for ACX-style submission: 192 kbps or higher, 44.1 kHz, constant bit
  rate.

gnarvox may also track LUFS and true peak for internal consistency, but ACX
compatibility should not be described as LUFS-only.

Metadata:

- Title.
- Author/creator.
- Album/course.
- Lesson number.
- Date.
- Chapters from script headings.
- Cover art.
- Disclosure tag if enabled.
- Provenance manifest hash.

## 8. Voice Capture Workflow

### 8.1 Capture Goals

Capture enough clean Art voice samples to support:

- Zero-shot cloning prompt selection.
- Evaluation across delivery styles.
- Consistent repair/pickup attempts.
- Future fine-tuning if licensing/model choice allows it.

### 8.2 Recording Stack

- Capture through the Rust host using `cpal` or a comparable cross-platform
  audio I/O crate.
- Save raw microphone capture as WAV before any processing.
- Prefer 48 kHz/24-bit capture if available, then downsample per model needs.
- Run quality gates in Rust before samples enter curated profiles.
- Store raw and curated samples separately.

### 8.3 Recording Wizard

Workflow:

1. Select microphone/interface.
2. Select sample rate and bit depth.
3. Monitor input level.
4. Record room tone/noise profile.
5. Record guided prompts in several styles:
   - neutral lesson explanation,
   - warm welcome,
   - emphasis,
   - correction pickup,
   - slower careful diction,
   - example/story mode.
6. Run quality gates.
7. Save raw and curated clips separately.
8. Ask Art to approve samples for use.

### 8.4 Quality Gates

Automated checks:

- Peak level not clipped.
- RMS/loudness within target range.
- Noise floor below configured threshold.
- Minimum speech duration.
- No long leading/trailing silence.
- Basic voice activity detection pass.
- Transcript alignment confidence if ASR is available.

Manual checks:

- Art approves the sample.
- Sample is Art's own voice.
- Sample does not include guests, students, music, copyrighted media, or private
  third-party speech.
- Sample style is labeled accurately.

### 8.5 Transcript Alignment

MVP:

- Store intended prompt text and sample audio.
- Allow manual transcript correction.
- Use local ASR in the evaluation harness for generated-output WER/CER.

Post-MVP:

- Use local Whisper/faster-whisper or another local ASR backend to align capture
  samples.
- Flag mismatches between expected and spoken text.
- Use aligned clips to select clean 5-20 second reference prompts.

## 9. Ethics, Consent, and Provenance

gnarvox is a tool for Art to synthesize Art's own voice. The product should make
that constraint visible in data model, UI, and default policies.

### 9.1 Consent

Rules:

- Voice profile creation requires an explicit "this is my voice or I have
  documented permission" confirmation.
- The default profile should be "Art Kaiser."
- Do not include sample celebrity voices or third-party voices.
- Do not ship workflows encouraging impersonation.

Audit:

- Store voice-profile consent metadata locally:
  - profile owner,
  - consent statement,
  - date,
  - source of samples,
  - whether commercial/public distribution is allowed.

### 9.2 Disclosure, Watermarking, and Provenance

Options:

- Keep Chatterbox PerTh watermarking enabled if using Chatterbox.
- Provide export metadata disclosure options:
  - "Narration generated locally from Art Kaiser's authorized voice model."
  - "AI-assisted narration based on Art Kaiser's own voice."
- Provide optional spoken disclosure bumper as a project setting.

Verification:

- If Chatterbox is used, run PerTh watermark detection before and after final
  export formats.
- Missing watermark after processing should warn, not hard-block export of Art's
  own authorized voice.
- Keep the WAV master and generation metadata so provenance remains auditable.

Provenance:

- Embed gnarvox's own provenance metadata in exports where formats allow.
- The provenance record should bind export file hash, project ID, consent
  record, model ID/revision, generation settings, selected take IDs, and export
  timestamp.
- Investigate a signed manifest or C2PA-style credential post-MVP.

### 9.3 Dataset Hygiene

- Raw samples are never overwritten.
- Curated samples are derived with recorded provenance.
- Samples containing other people are rejected by default.
- Samples with background music or copyrighted media are rejected by default.
- Deletion removes project DB rows and files after confirmation.
- Exports should not include reference samples.

### 9.4 Abuse Resistance

Because this is a private local tool, controls should be practical:

- No public API exposed by default.
- Worker uses stdio JSON-RPC by default, not a network listener.
- No bundled non-Art voices.
- Clear local audit log for voice profile creation, consent changes, and export.
- Optional "Art-only mode" blocks additional voice profiles unless a config flag
  is changed, and bypass is logged.

## 10. Inference Backends

### 10.1 MVP Backend: Python Worker with PyTorch

Why:

- Fastest path to current model support.
- Chatterbox and most alternatives are Python-first.
- ROCm PyTorch is the most plausible Ubuntu acceleration path.
- Keeps Tauri/Rust app stable while model dependencies change.

Python version:

- Do not lock to Python 3.12 until `chatterbox-tts` and selected dependencies
  are verified against PyTorch/ROCm on the target machines.
- If Chatterbox remains pinned around Python 3.11 upstream, prefer 3.11 for the
  worker and document the ROCm compatibility tradeoff.
- Record the chosen version and install procedure in `docs/DEV.md`.

Backend implementation order:

1. `kokoro_onnx_cpu`: lightweight baseline and CI path.
2. `chatterbox_turbo_pytorch_cpu`: correctness baseline.
3. `chatterbox_turbo_pytorch_rocm`: Ubuntu acceleration candidate.
4. `chatterbox_original_pytorch_rocm`: co-primary narration quality challenger.
5. `chatterbox_multilingual_v3_pytorch_rocm`: co-primary stability challenger
   if install is practical or Turbo/Original show hallucination issues.
6. `chatterbox_turbo_onnx_cpu`: portable fallback after PyTorch parity checks.

Experimental/post-MVP unless needed to unblock:

- `chatterbox_turbo_onnx_directml`
- `chatterbox_turbo_onnx_migraphx`
- Windows ROCm PyTorch
- Fish Speech S2
- F5-TTS

### 10.2 ONNX Runtime Path

Sources:

- ONNX Runtime DirectML:
  https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html
- ONNX Runtime ROCm provider notice:
  https://onnxruntime.ai/docs/execution-providers/ROCm-ExecutionProvider.html
- ONNX Runtime MIGraphX:
  https://onnxruntime.ai/docs/execution-providers/MIGraphX-ExecutionProvider.html

Important current detail:

- ONNX Runtime's ROCm Execution Provider page says ROCm EP has been removed
  since ONNX Runtime 1.23 and applications should migrate to MIGraphX EP for
  ROCm 7.1+.

Implications:

- For cross-platform fallback, keep ONNX CPU support.
- For Linux ONNX acceleration, evaluate MIGraphX only after PyTorch ROCm is
  blocked or after ONNX CPU output is proven equivalent enough.
- For Windows ONNX acceleration, DirectML is experimental until operator
  compatibility, speed, and output quality are measured.
- ONNX is a second implementation path; if output differs materially from
  PyTorch on Art's voice, treat it as fallback or testing-only.

### 10.3 Rust-Native Path

Possible later work:

- Rust wrapper around ONNX Runtime.
- Rust orchestration with C/C++ ONNX Runtime libraries.
- Rust audio processing via `symphonia`, `rubato`, `hound`, `lofty`, or FFmpeg
  bindings where practical.

Do not attempt:

- Reimplement model inference in Rust for MVP.
- Write custom GPU kernels.
- Depend on immature Vulkan ports for core product success.

## 11. Evaluation Harness

Build `gnarvox-eval` before the desktop MVP. It should be runnable from CLI on
Windows and Linux, without Tauri, without SQLite, and without GUI. It should
write outputs to a timestamped directory with `report.json`, `report.md`, logs,
WAV/MP3 artifacts, and optional M4B.

### 11.1 Test Corpus

Private inputs:

- 5-20 second Art reference samples in multiple styles.
- 30-60 second lesson excerpts.
- 3-5 minute lesson excerpts.
- 10-minute lesson-shaped sample.

Commit-safe repo inputs:

- `eval/manifest.template.json` with placeholder paths.
- Synthetic text fixtures for numbers, URLs, acronyms, nested quotes, names,
  units, math-ish notation, and code identifiers.
- Rubric template for 1-5 subjective scores with anchors.

Keep private Art samples out of git unless Art explicitly decides otherwise.

### 11.2 Metrics

Objective:

- Real-time factor: generation wall time / output audio duration.
- Startup/load time.
- Peak memory and average memory where measurable.
- Output duration.
- Sample rate and channel correctness.
- Crash/failure count.
- Retry success.
- Silence ratio.
- Clipping/peak.
- RMS, LUFS, true peak, and noise floor estimate before/after normalization.
- ASR WER/CER against normalized input text using a local ASR model.
- Watermark detection before and after export if applicable.
- Boundary loudness delta and click/pop detection where practical.
- Thermal/power observations during 60-minute runs.
- Output WAV content hash.

Subjective:

- Art voice similarity.
- Naturalness.
- Lesson clarity.
- Fatigue over 10+ minutes.
- Prosody consistency across chunks.
- Correction pickup match.
- Pronunciation correctness.
- Breaths and pauses.
- Emotional appropriateness.

Scoring:

- Use a 1-5 rubric for each subjective category.
- Use blind A/B where practical so Art is not told the engine/seed first.
- Include at least one second listener for the final go/no-go decision.
- Store raw generated audio for A/B comparison.
- Mark runs explicitly as reproducible or non-reproducible when seeds are
  ignored by a backend.

### 11.3 Benchmark Matrix

Required Milestone 1 matrix:

| Engine | Backend | OS | Required result |
| --- | --- | --- | --- |
| Kokoro | ONNX CPU | Windows | Runs, exports WAV/MP3, validates export path |
| Kokoro | ONNX CPU | Ubuntu | Runs, exports WAV/MP3, validates export path |
| Chatterbox Turbo | PyTorch CPU | Windows | Correctness baseline |
| Chatterbox Turbo | PyTorch CPU | Ubuntu | Correctness baseline |
| Chatterbox Turbo | PyTorch ROCm | Ubuntu 26.04 | Candidate acceleration |
| Chatterbox Original | PyTorch ROCm or CPU | Ubuntu 26.04 | Narration quality comparison |
| Chatterbox Turbo ONNX | CPU | Windows/Ubuntu | Candidate fallback after parity check |

Conditional Milestone 1 matrix:

| Engine | Backend | OS | Condition |
| --- | --- | --- | --- |
| Chatterbox Multilingual V3 | PyTorch ROCm or CPU | Ubuntu | If install is practical or hallucination/stability is an issue |
| Chatterbox Turbo ONNX | DirectML | Windows | If ONNX CPU parity passes |
| Fish Speech S2 | Best practical | Ubuntu | If install plus license check is under one day |
| F5-TTS | PyTorch ROCm | Ubuntu | Non-commercial evaluation only |

Deferred:

- MIGraphX until PyTorch ROCm baseline is green and ONNX CPU parity is proven,
  or until PyTorch ROCm is blocked.
- Windows ROCm unless a known-good local setup emerges.

### 11.4 Acceptance Gate for Model Choice

Pick the default model only after:

- Art rates 10-minute listening fatigue acceptable.
- A second listener rates the sample acceptable for clarity and absence of
  distracting artifacts.
- Voice similarity is acceptable to Art.
- Pronunciation can be corrected without heroic prompt hacks.
- Chunk-to-chunk prosody is acceptable after stitching.
- Correction pickup works at chunk granularity with neighbor context.
- ASR WER/CER is within a threshold defined after first baseline runs.
- Boundary loudness jumps are within a threshold defined after first stitch
  prototype.
- At least 60 minutes of generated audio can be produced without manual
  intervention.
- Worker kill/restart recovery does not corrupt outputs or queue state.
- Licensing permits intended lesson distribution.
- Windows and Ubuntu have at least one working local fallback path.

## 12. Packaging and Installation

### 12.1 Development Setup

Repo should eventually include:

- `README.md` quickstart.
- `docs/DEV.md`.
- `scripts/bootstrap-linux.sh`.
- `scripts/bootstrap-windows.ps1`.
- `pyproject.toml` for worker/eval.
- Rust workspace for Tauri host.
- Model install command that downloads exact revisions and records checksums.

Do not vendor model weights in git.

### 12.2 User Install

Tauri packages:

- Windows: NSIS or MSI. Prefer NSIS initially unless enterprise MSI features are
  needed.
- Linux: deb package for Ubuntu 26.04 first unless AppImage proves smoother with
  WebKitGTK dependency handling.

Worker packaging recommendation:

- MVP development and first internal release: managed Python environment with
  `uv` or similar, launched and diagnosed by the Rust host.
- First run creates/validates the venv, checks Python/Torch/ROCm versions, and
  shows a diagnostics page.
- Tauri sidecar packaging may be used for helper binaries. If used, document
  `externalBin` naming and target-triple suffixes.
- Later: optional bundled CPU/ONNX worker for easy Windows install.

FFmpeg:

- Decide bundled vs system FFmpeg before Milestone 5.
- Windows should not depend on a missing system FFmpeg.
- Linux should document exact package expectations or bundle a tested binary
  where licensing permits.

### 12.3 Model Installation

UX:

- First-run model manager.
- Shows model name, license, size, backend compatibility, status, and expected
  disk footprint.
- Requires explicit acceptance of license terms.
- Downloads from official source or user-provided local file.
- Verifies checksum and pinned revision.
- Allows uninstalling models.
- Supports air-gapped import from USB with checksum verification.

Do not:

- Silently download models.
- Mix licenses in the same "default" install without surfacing terms.
- Hide non-commercial restrictions.

## 13. Security and Privacy Model

Local-first rules:

- Projects, samples, generated audio, and logs stay local by default.
- No analytics.
- No crash uploads without explicit export by Art.
- No internet needed after model install unless user asks to update.

Sensitive data:

- Reference samples are biometric-like personal data.
- Generated voice is sensitive, especially before publication.
- Logs must avoid storing full private script text by default.

Protections:

- App-specific directory allowlist.
- Tauri command allowlist and scoped filesystem permissions.
- Frontend CSP.
- Deny arbitrary frontend fetch to non-loopback origins.
- Worker token only if HTTP debug mode is used, stored in Rust host memory.
- Clear "delete voice profile" and "delete project" flows.
- SQLite WAL for crash resilience.
- Log rotation and max log size.
- Recommend encrypted volumes such as BitLocker or LUKS for project storage.
- Optional project encryption later; defer unless Art requests it.

Retention defaults:

- Keep all takes until Art deletes them.
- Cap regenerable cache size with LRU eviction.
- Retain logs for 30 days or last N MB per project, whichever is smaller.

## 14. Acceptance Tests

### 14.1 App-Level MVP Acceptance

MVP is acceptable when:

- Art can create a project.
- Art can record or import reference samples.
- The app rejects obviously bad samples or warns clearly.
- Art can import/paste a lesson script.
- The app normalizes, sections, and chunks the script.
- Art can edit sections, normalization decisions, and pronunciation entries.
- Art can generate one selected section.
- Art can regenerate a chunk/section and choose between takes.
- Art can generate a full lesson queue.
- Art can play waveform previews with stable behavior on Ubuntu WebKitGTK and
  Windows WebView2.
- Art can export WAV and MP3.
- Art can export M4B with chapters, or M4B is explicitly split to Milestone 5.5.
- Exported loudness/noise/peak are measured and reported.
- The app works on both target machines with at least CPU fallback.
- Ubuntu ROCm acceleration works if selected as a release claim.
- Windows acceleration is either working or explicitly labeled experimental.

### 14.2 Quality Acceptance

Quality gate:

- 10-minute lesson sample approved by Art.
- No severe hallucinations.
- No skipped sections.
- No repeated chunks.
- No obvious clipping.
- Pronunciation dictionary and normalization fix known hard terms.
- Regenerated correction pickup is usable with minimal manual editing.
- Exported MP3/M4B survives playback in common players.

### 14.3 Technical Acceptance

Technical gate:

- Queue survives worker failure and marks jobs retryable.
- `kill -9` worker mid-job does not corrupt project DB or selected takes.
- SQLite uses WAL and migrations are tested.
- Autosave cadence is defined and tested.
- Project can be closed and reopened without losing selected takes.
- Model/runtime versions are recorded.
- Generated files are content-addressable or hash-verified.
- Export is reproducible from selected takes.
- Tests cover chunking, normalization, pronunciation substitution, project
  migrations, queue state transitions, worker protocol, and export manifest
  generation.

## 15. Milestones

### Milestone 0: Planning and Research

Deliverables:

- `docs/PLAN.md`.
- `docs/REVIEW-SYNTHESIS.md`.
- Source links and known unknowns.

Done when:

- Plan is reviewed and updated after feedback.

### Milestone 0.5: Brutal Go/No-Go Spike

Deliverables:

- Throwaway script or notebook that generates a 10-minute stitched lesson sample.
- WAV/MP3 output and optional M4B.
- Short written go/no-go report.
- Plan B if local cloning is not good enough.

Exit criteria:

- Art and at least one second listener score the output.
- Chatterbox Turbo and at least one Chatterbox quality challenger are compared.
- Local cloning is either approved for harness work or explicitly rejected.

### Milestone 1: Evaluation Harness

Deliverables:

- Standalone CLI harness for model/backend evaluation.
- Private local sample manifest.
- Commit-safe synthetic fixture texts.
- Benchmark report template.
- License matrix.
- Basic export pipeline producing listenable WAV/MP3 and attempting M4B.
- ASR WER/CER metric.
- Watermark survival check for WAV to MP3 at minimum.

Tasks:

- Implement model adapter interface.
- Add Kokoro baseline.
- Add Chatterbox Turbo PyTorch adapter.
- Add Chatterbox Original and/or Multilingual V3 adapter.
- Add Chatterbox Turbo ONNX CPU adapter if feasible.
- Add text normalization tests.
- Add report generation.
- Run on Windows and Ubuntu.

Exit criteria:

- At least one fallback engine runs on both OSes.
- Chatterbox Turbo has measured results on Ubuntu ROCm or a documented blocker.
- At least one Chatterbox quality challenger is scored.
- Art has scored sample outputs.
- The harness emits a listenable exported artifact, not just metrics.

### Milestone 2: Desktop Skeleton

Deliverables:

- Tauri app shell.
- Project create/open/save.
- SQLite schema, WAL, and migrations.
- Worker lifecycle management over stdio JSON-RPC.
- Basic settings/model manager.
- Diagnostics page.
- Crash-safe queue state.

Exit criteria:

- App starts on both target OSes.
- Worker can run a smoke generation.
- Project can persist generation metadata.
- Worker crash marks jobs retryable without DB corruption.

### Milestone 3: Voice Capture and Sample Management

Deliverables:

- Recording wizard using Rust audio capture.
- Input level meter.
- Room tone capture.
- Quality gates.
- Voice profile/sample browser.
- Consent metadata and audit events.

Exit criteria:

- Art can record and approve curated reference samples.
- Bad samples produce useful warnings.

### Milestone 4: Lesson Workflow MVP

Deliverables:

- Script import/paste.
- Text normalization review.
- Section and chunk editor.
- Pronunciation dictionary.
- One default style preset.
- Generation queue.
- Take management.
- Auto-take-selection by objective checks with human override.

Exit criteria:

- Art can generate, review, repair, and regenerate a multi-section lesson.

### Milestone 5: Audio Review and Export

Deliverables:

- Waveform audition from precomputed peaks.
- Section playback.
- Repair preview across adjacent chunks.
- Silence trimming.
- Loudness normalization.
- WAV/MP3 export.
- M4B export with chapters and metadata if schedule allows.
- Watermark/disclosure/provenance checks where applicable.

Exit criteria:

- Art can produce a publishable lesson file from a project.
- If M4B is split out, WAV/MP3 export is shippable and M4B has a defined 5.5
  milestone.

### Milestone 6: Hardening

Deliverables:

- Installer/package for Windows and Ubuntu.
- Diagnostics page refined from real failures.
- Recovery from failed jobs and interrupted exports.
- Regression tests.
- Performance profile on Strix Halo.
- Model cache management and offline import.

Exit criteria:

- A complete lesson can be produced on both machines without developer
  intervention.

## 16. Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Local cloning is not good enough for Art's voice | Medium | High | Milestone 0.5 go/no-go before app work; write Plan B |
| Turbo is fast but poor for long-form lesson narration | Medium | High | Compare Original and Multilingual V3 before choosing default |
| Short-input regeneration hallucinates | High | High | Regenerate whole chunks with neighbor context; avoid bare fragments |
| Text normalization errors hurt lesson clarity | High | High | First-class normalizer with tests and review UI |
| Long-form generation hallucinates or drifts | High | High | Short semantic chunking, ASR validation, take review, regeneration workflow |
| Ubuntu ROCm stack is unstable on target Strix Halo machines | Medium | High | CPU fallback acceptable; long-run validation; crash-resume worker |
| Windows AMD acceleration is unstable | High | Medium | Do not make it an MVP blocker; support CPU/ONNX fallback |
| ONNX output differs from PyTorch or fails on DirectML | Medium | Medium | Use ONNX only after quality parity checks |
| F5-TTS licensing blocks use | High | Medium | Evaluation only unless commercial rights are resolved |
| Fish Speech packaging becomes a research detour | Medium | Medium | Optional only if install/license check is under one day |
| WebKitGTK breaks waveform/editor assumptions | Medium | Medium | Prototype early on Ubuntu; precompute peaks in Rust |
| Audio export damages watermark | Medium | Medium | Detect before/after export; warn; retain WAV master and provenance |
| Reference samples include third-party voices or copyrighted audio | Low | High | Capture workflow gates, consent metadata, sample review |
| Model downloads are large and brittle | Medium | Medium | Model manager with checksums, pinned revisions, resume, diagnostics |
| Sustained Strix Halo thermals throttle generation | Medium | Medium | Benchmark long queues; record power/thermal mode; tune concurrency |

## 17. Implementation Principles

- Workflow first, model second. The durable product is the narration workflow,
  not a single model integration.
- Prove Art's voice quality before building the desktop app.
- Every generated audio file must be reproducible from stored metadata or marked
  as non-reproducible.
- Never hide licensing uncertainty.
- Never claim acceleration support without benchmark results from the target
  machines.
- Prefer short, recoverable jobs over large opaque generations.
- Treat CPU fallback as a valid production posture if quality and unattended
  runtime are acceptable.
- Keep the first version single-user and local.
- Keep raw voice samples immutable.
- Treat generated narration as editable takes, not final truth.
- Build repair around whole chunks and context, not tiny highlighted fragments.

## 18. Immediate Next Actions

1. Run Milestone 0.5:
   - prepare Art reference samples,
   - generate a 10-minute lesson sample with Chatterbox Turbo,
   - compare at least one Chatterbox quality challenger,
   - export WAV/MP3,
   - score with Art and a second listener,
   - write go/no-go and Plan B.
2. Create `docs/EVAL-MATRIX.md` with exact test passages and scoring rubric.
3. Build `gnarvox-eval`:
   - install Kokoro,
   - install Chatterbox Turbo,
   - install Chatterbox Original or Multilingual V3,
   - generate the same excerpts,
   - run ASR/loudness/watermark checks,
   - export a report.
4. Validate Ubuntu 26.04 ROCm on Strix Halo:
   - ROCm version,
   - kernel,
   - PyTorch FP16,
   - Chatterbox generation,
   - 60-minute queue stability.
5. Validate Windows:
   - CPU generation,
   - Chatterbox Turbo ONNX CPU,
   - DirectML only if ONNX CPU parity passes.
6. Decide default engine and backend from measured results.
7. Only then scaffold the Tauri app.

## 19. Open Unknowns and Empirical Checks

Must verify:

- Actual Chatterbox Turbo voice similarity for Art.
- Whether Chatterbox Original or Multilingual V3 sounds better than Turbo for
  lesson narration.
- Maximum safe chunk size for each model.
- Minimum safe chunk size before short-input hallucination becomes likely.
- Best reference sample length, count, and selection policy for Art's voice.
- Whether Chatterbox paralinguistic tags are controllable enough for breaths and
  pauses in lesson narration.
- Whether PerTh watermark detection survives gnarvox's final export chain.
- ROCm PyTorch stability on Ubuntu 26.04 with the exact Strix Halo systems.
- Windows ONNX compatibility and quality for Chatterbox Turbo.
- Windows ROCm PyTorch install viability and stability.
- Fish Speech S2 license for exact chosen weights and its packaging feasibility.
- Whether CPU fallback is fast enough for full unattended lessons and short
  corrections.
- Best loudness/mastering target for Art's distribution channel.
- Whether local ASR validation is accurate enough to catch skipped/repeated
  text.
- Whether DOCX import is required for Art's real script workflow.
- Whether M4B export with cover art/chapters is trivial enough for MVP or should
  be Milestone 5.5.

## 20. Source Links

Model sources:

- Chatterbox GitHub: https://github.com/resemble-ai/chatterbox
- Chatterbox overview:
  https://www.resemble.ai/learn/models/chatterbox
- Chatterbox Turbo:
  https://www.resemble.ai/learn/models/chatterbox-turbo
- Chatterbox Turbo ONNX:
  https://huggingface.co/ResembleAI/chatterbox-turbo-ONNX
- Chatterbox Multilingual:
  https://www.resemble.ai/learn/models/chatterbox-multilingual
- Fish Speech: https://github.com/fishaudio/fish-speech
- F5-TTS: https://github.com/SWivid/F5-TTS
- Kokoro: https://github.com/hexgrad/kokoro
- Kokoro ONNX:
  https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- XTTS v2 license:
  https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt

AMD/runtime sources:

- AMD Ryzen AI Max+ 395:
  https://www.amd.com/en/products/processors/laptop/ryzen/ai-300-series/amd-ryzen-ai-max-plus-395.html
- ROCm Ryzen Linux compatibility:
  https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityryz/native_linux/native_linux_compatibility.html
- ROCm RDNA 3.5 optimization:
  https://rocm.docs.amd.com/en/latest/how-to/system-optimization/rdna3-5.html
- ROCm Ryzen limitations:
  https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/limitations/limitationsryz.html
- ONNX Runtime DirectML:
  https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html
- ONNX Runtime ROCm provider:
  https://onnxruntime.ai/docs/execution-providers/ROCm-ExecutionProvider.html
- ONNX Runtime MIGraphX:
  https://onnxruntime.ai/docs/execution-providers/MIGraphX-ExecutionProvider.html
- PyTorch DirectML:
  https://learn.microsoft.com/en-us/windows/ai/directml/pytorch-windows

Desktop/audio sources:

- Tauri WebView versions:
  https://v2.tauri.app/reference/webview-versions/
- Tauri prerequisites:
  https://v2.tauri.app/start/prerequisites/
- Wry: https://github.com/tauri-apps/wry
- Dioxus Desktop: https://docs.rs/dioxus-desktop
- ACX audio submission requirements:
  https://help.acx.com/s/article/what-are-the-acx-audio-submission-requirements
