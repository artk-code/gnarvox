# gnarvox Review Synthesis

Current as of: 2026-06-19

This document summarizes the final synthesis of:

- `docs/PLAN.md`
- `docs/agent-feedback/dangermouse-review.md`
- `docs/agent-feedback/grok-cursor-review.md`

The result is an updated canonical `docs/PLAN.md`.

## Executive Decision

Both reviews agreed with the plan's core philosophy: local-first, evaluation
first, Tauri/Rust host, Python inference worker, model-neutral job boundary,
SQLite project storage, and licensing as a gate. Those principles were kept.

The main change is scope and sequencing. The updated plan now requires a brutal
go/no-go voice-quality spike before desktop app work, narrows the MVP backend
surface, promotes text normalization and repair/stitching to first-class design
areas, and treats GPU acceleration as an optimization rather than a release
requirement.

## Feedback Accepted

### Add a Go/No-Go Spike

Accepted. The plan now has Milestone 0.5: a 2-4 day spike that produces a
10-minute stitched lesson sample in Art's voice before any Tauri app code.

Reason:

- The product's value depends on whether local cloning is good enough for Art's
  specific voice and lesson material.
- Building the full desktop workflow before that proof creates unnecessary sunk
  cost.

### Downgrade Chatterbox Turbo from Presumptive Winner

Accepted. Turbo remains the first integration target, but not the assumed final
engine. Chatterbox Original and Chatterbox Multilingual V3 are now co-primary
quality challengers for long-form lesson narration.

Reason:

- Turbo is attractive for speed, packaging, tags, ONNX availability, and MIT
  licensing claims.
- Long-form instructional narration may favor Original or V3 if they produce
  more stable prosody or fewer hallucinations.

### Treat GPU Speed as an Optimization

Accepted. The plan now states that overnight CPU or CPU/ONNX batch generation is
acceptable if quality and unattended reliability are good.

Reason:

- gnarvox is an offline production tool, not a real-time voice agent.
- Requiring real-time factor under 1.0 would overfit the project to an unstable
  acceleration stack.

### Narrow the MVP Backend Matrix

Accepted. The required Milestone 1 matrix now focuses on Kokoro CPU/ONNX,
Chatterbox Turbo PyTorch CPU, Chatterbox Turbo PyTorch ROCm on Ubuntu,
Chatterbox Original as a quality challenger, and Chatterbox Turbo ONNX CPU as a
fallback candidate.

Reason:

- DirectML, MIGraphX, Windows ROCm, Fish Speech, and F5-TTS each add a separate
  packaging/correctness surface.
- They should not consume milestone credit unless the primary paths fail or the
  harness proves they are easy and valuable.

### Prefer stdio JSON-RPC for Worker IPC

Accepted. The plan now chooses stdio JSON-RPC as the production MVP IPC, with
optional loopback HTTP debug mode.

Reason:

- stdio avoids firewall prompts, port binding races, local HTTP exposure, and
  frontend direct worker access.
- The Rust host owns worker lifecycle naturally.

### Define Worker Recovery Semantics

Accepted. The plan now specifies heartbeat, cancellation behavior, OOM/crash
handling, retryable job state, max worker restarts, and kill/restart acceptance
tests.

Reason:

- Long unattended generation queues need recovery from worker failure from the
  beginning, not only in late hardening.

### Resolve SQLite vs Manifest Authority

Accepted. SQLite is now the source of truth. `manifest.json` is a derived export,
backup, or debugging artifact regenerated on demand.

Reason:

- Dual authority would create reopen, migration, and corruption bugs.

### Promote Text Normalization

Accepted. Text normalization is now its own first-class section with tests and
review requirements.

Reason:

- Lessons will contain numbers, dates, units, URLs, acronyms, code-ish terms,
  and technical vocabulary.
- Normalization improves every model and survives model swaps.

### Redesign Correction Pickup

Accepted. The plan now forbids bare-fragment regeneration for MVP and requires
whole-chunk regeneration with locked style/seed where possible, neighbor
context, and adjacent-chunk preview before accepting repairs.

Reason:

- Short-input hallucination and tonal mismatch are direct threats to the most
  important editing workflow.

### Add Stitching Detail

Accepted. The plan now defines initial inter-chunk and inter-section pauses,
loudness matching, repair preview, and stitching metrics.

Reason:

- Chunk-to-chunk continuity is where long-form generated narration succeeds or
  fails.

### Move ASR and Watermark Checks Earlier

Accepted. ASR WER/CER and watermark survival checks are now Milestone 1 harness
requirements.

Reason:

- These catch hallucinations, skipped text, repetitions, and export-chain
  effects before UI work depends on generated artifacts being trustworthy.

### Precompute Waveform Peaks in Rust

Accepted. The plan now keeps audio decode, peak computation, duration, and
loudness analysis in Rust/FFmpeg rather than relying on WebKitGTK/WebAudio.

Reason:

- WebKitGTK is the cross-platform UI risk for a Tauri audio app.
- The webview should render compact data, not decode multi-minute audio.

### Specify Capture Stack

Accepted. The plan now specifies Rust host capture through `cpal` or a
comparable Rust audio backend, raw WAV preservation, and Rust-side quality
gates.

Reason:

- Reference sample quality is critical to cloning quality.

### Strengthen Provenance

Accepted. The plan now distinguishes PerTh watermarking from gnarvox provenance
and requires export metadata binding file hash, consent record, model revision,
selected takes, and settings.

Reason:

- PerTh can indicate synthetic Chatterbox output, but it does not prove Art's
  authorization or link a clip to a consent record.

### Add Blind A/B and Second Listener

Accepted. The final model gate now includes blind A/B where practical and at
least one second listener for the final go/no-go sample.

Reason:

- Self-evaluation of one's own synthetic voice is biased and inconsistent.

### Pin ACX-Style Export Targets

Accepted with a correction. The plan now lists ACX-style RMS/peak/noise floor
targets rather than treating -18 LUFS as the spec.

Reason:

- ACX-style requirements are commonly expressed as -23 dB to -18 dB RMS,
  peak no higher than -3 dB, noise floor no higher than -60 dB RMS, and MP3
  192 kbps or higher CBR at 44.1 kHz.
- LUFS and true peak remain useful internal metrics, but should not be confused
  with ACX RMS requirements.

## Feedback Rejected or Deferred

### Calling gfx1151 Unsupported

Rejected as written, but the caution was adopted.

Reason:

- Current AMD ROCm Ryzen Linux documentation lists gfx1151 and Ryzen AI Max+
  395 for ROCm 7.2.1.
- The updated plan therefore does not call Strix Halo wholly unsupported.
- It does treat Strix Halo ROCm as operationally immature until Art's exact
  machines pass long-run validation.

### Making Fish Speech S2 a Required Challenger

Deferred. Fish Speech S2 remains optional if install and license verification
take less than one day.

Reason:

- It may be high quality, but SGLang/vLLM-style serving and larger runtime
  complexity are likely a packaging detour for an English-only Art lesson MVP.

### Keeping F5-TTS in the Required Matrix

Deferred. F5-TTS is evaluation-only unless commercially usable weights are found.

Reason:

- The known pretrained model license issue makes it unsuitable for distributable
  lesson output without further rights.

### MIGraphX in Near-Term Milestone 1 Work

Deferred. MIGraphX is now post-MVP or blocker-driven.

Reason:

- ONNX Runtime ROCm EP removal means MIGraphX matters eventually for Linux ONNX
  acceleration, but it is a third runtime surface.
- It should wait until PyTorch ROCm and ONNX CPU parity are understood.

### Full SSML and Rich Style Presets in MVP

Deferred. MVP now has one default preset and only literal pauses plus validated
native tags.

Reason:

- A custom markup language is premature until the selected engine's actual
  controllability is measured.

### M4B as an Unconditional MVP Gate

Partially deferred. M4B remains an MVP target, but the plan allows it to move to
Milestone 5.5 if WAV/MP3 are ready and M4B packaging is the only remaining
delay.

Reason:

- Audible-style output is a project goal.
- Blocking the whole MVP on chapter/cover-art packaging would be poor sequencing
  if the core narration workflow is otherwise working.

### Project Encryption in MVP

Deferred.

Reason:

- Local project directories contain sensitive voice data, but for Art's private
  machines the immediate recommendation is encrypted volumes such as BitLocker
  or LUKS.
- In-app project encryption can come later if Art requests it.

### Spectrogram, Crossfade Editor, and Punch-In Line Repair

Deferred.

Reason:

- These are likely useful, but the first version needs reliable chunk repair,
  audition, and export before DAW-like editing tools.

### Bundled Python Worker as First Release Default

Deferred.

Reason:

- Bundling PyTorch/ROCm is brittle and large.
- The MVP path is managed venv with diagnostics, with a later optional CPU/ONNX
  sidecar.

## Major Plan Changes

- Added Section 2, "Go/No-Go Spike," and Milestone 0.5.
- Reframed Turbo as first integration target, not likely winner.
- Elevated Chatterbox Original and Multilingual V3 for long-form narration
  quality testing.
- Moved from loopback HTTP preference to stdio JSON-RPC.
- Added explicit worker lifecycle, heartbeat, crash, retry, and restart
  semantics.
- Made SQLite authoritative and `manifest.json` derived.
- Added project states: `draft`, `generating`, `review`, `locked_for_export`.
- Promoted text normalization ahead of pronunciation/style controls.
- Added chunk defaults, automatic shrink policy, and short-input avoidance.
- Added chunk repair and stitching policy with adjacent preview.
- Reduced MVP style presets to one default.
- Added auto-take-selection from objective checks.
- Added Rust-side waveform peak/loudness/duration computation.
- Added Rust audio capture stack guidance.
- Added ASR WER/CER and watermark survival to the evaluation harness.
- Trimmed the required backend matrix and moved DirectML/MIGraphX/Fish/F5 to
  conditional or deferred status.
- Changed export loudness framing from example LUFS target to ACX-style
  RMS/peak/noise-floor targets.
- Added provenance metadata distinct from Chatterbox watermarking.
- Added packaging requirements for venv bootstrap diagnostics, FFmpeg decision,
  model cache size, pinned revisions, and offline import.
- Added technical acceptance tests for SQLite WAL, worker kill recovery,
  autosave, migrations, and export reproducibility.

## Remaining Unknowns Needing Empirical Validation

- Whether any local model can produce Art-approved 10-minute lesson narration in
  Art's voice.
- Whether Chatterbox Turbo, Original, or Multilingual V3 is best for Art's
  long-form instructional delivery.
- Whether Multilingual V3's reduced-hallucination claims improve English lesson
  narration enough to justify its runtime cost.
- Maximum and minimum safe chunk sizes for each candidate engine.
- Best reference sample length, count, style, and selection policy for Art's
  voice.
- Whether Chatterbox paralinguistic tags are useful and controllable in real
  lessons.
- How often short-input hallucination appears in the selected model and whether
  chunk-level repair fully avoids it.
- Whether PerTh watermark detection survives WAV, loudness processing, MP3, and
  M4B export.
- Whether Ubuntu 26.04 ROCm on Art's exact Strix Halo machines can sustain
  60-minute generation queues without manual intervention.
- Whether Windows CPU/ONNX fallback is fast enough for real correction work.
- Whether Windows DirectML or Windows ROCm is worth pursuing after CPU fallback.
- Whether local ASR is accurate enough to catch skipped/repeated text for Art's
  lesson material.
- Whether DOCX import is necessary for Art's real script workflow.
- Whether M4B export with chapters and cover art is simple enough for MVP or
  should be Milestone 5.5.
- Whether FFmpeg should be bundled or treated as a managed system dependency on
  each target OS.
- Whether a signed manifest or C2PA-style content credential is practical for
  local exports.

## Files Changed

- `docs/PLAN.md`
- `docs/REVIEW-SYNTHESIS.md`
