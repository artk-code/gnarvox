# gnarvox Plan Review — Grok/Cursor Perspective

**Reviewer:** Grok/Cursor bike-shedder (independent)  
**Date:** 2026-06-18  
**Input:** `/home/artk/gnarvox/docs/PLAN.md` and repo context  
**Scope:** Local Art-voice lesson narration on Strix Halo (Windows 11 Pro + Ubuntu 26.04), Tauri 2 + Python worker, Chatterbox Turbo or validated alternative

---

## 1. Executive Verdict

**Adopt the plan's sequencing and architecture with targeted corrections, not a rewrite.**

The plan is unusually mature for a greenfield project: it correctly prioritizes empirical model selection over brand loyalty, treats licensing as a gate, defers fine-tuning, and builds durable workflow primitives (projects, chunks, takes, exports) before polishing UI chrome. The "CLI eval harness first, Tauri app second" ordering is the single most important decision in the document and should not be compromised.

**Conditional approval** for proceeding to Milestone 1 (evaluation harness), with two reservations:

1. **Chatterbox Turbo may be the wrong default narrator for long-form lessons.** Resemble's own README positions Turbo as optimized for *low-latency voice agents*, not sustained instructional narration. The plan acknowledges long-form drift but still labels Turbo the "initial likely winner" before any Art-specific listening tests. That is a reasonable hypothesis, not a recommendation — the synthesis agent should downgrade Turbo from presumptive winner to *speed-iteration candidate* and elevate **Chatterbox Original** (CFG/exaggeration tuning for expressive narration) and **Multilingual V3** (explicitly marketed for reduced hallucination) in the bake-off matrix.

2. **The plan spreads acceleration effort across too many backends too early.** PyTorch ROCm (Ubuntu), ONNX CPU (both OSes), ONNX DirectML (Windows), and ONNX MIGraphX (Ubuntu "later") are four distinct packaging and correctness surfaces. For MVP, pick **one primary accelerator** (PyTorch ROCm on Ubuntu) and **one portable fallback** (ONNX or PyTorch CPU). Treat everything else as explicitly deferred experiments with no milestone credit until the primary path ships.

Overall grade: **B+ as a planning doc, A- on principles, B on packaging/recoverability specificity.** The durable product is the lesson-production workflow; the plan mostly gets that right. What is missing is concrete IPC/recovery/stitching contracts and a sharper cut on scope that protects Art from maintaining four GPU stacks.

---

## 2. Strongest Parts of the Plan

### Workflow-first, model-second
Section 17's implementation principles and the repeated emphasis on reproducible takes, short recoverable jobs, and immutable raw samples are exactly right for a solo creator producing publishable audio over weeks, not a one-shot demo.

### Evaluation harness before desktop app
Milestone 1 before Milestone 2 is non-negotiable and well-specified. The benchmark matrix (Section 11.3), acceptance gates (Section 11.4), and immediate next actions (Section 18) form a credible empirical path to model choice.

### Model-neutral job boundary
The JSON job schema (Section 6.2) is the right abstraction width: engine, backend, voice profile, chunk text, style knobs, and structured response metadata (RTF, memory, watermark flag, warnings). This is what makes "Chatterbox Turbo or better" a product requirement rather than a dependency lock-in.

### Licensing hygiene
Excluding XTTS v2 by default, flagging F5-TTS CC-BY-NC weights, and requiring explicit license acceptance in the model manager (Section 12.3) are mature choices for distributable "Lessons with Art" content. The plan treats legal uncertainty as a first-class risk, not a footnote.

### Long-form realism
Short semantic chunking, section-level regeneration, stitch-with-controlled-silence, and explicit skepticism about single-pass full-lesson generation (Sections 7.2, 7.6) match how local TTS actually behaves in 2026. The `correction_pickup` style preset shows the author understands production editing, not just generation.

### Hardware honesty
Section 4 is one of the plan's best sections: Strix Halo shared-memory tuning, FP16-only ROCm validation, Windows ROCm limitations, NPU/Vulkan deferral, and "do not make Windows GPU a release blocker" are all grounded in current AMD/ONNX Runtime documentation. The ONNX ROCm EP removal → MIGraphX migration note (Section 10.2) is accurate per [ONNX Runtime docs](https://onnxruntime.ai/docs/execution-providers/ROCm-ExecutionProvider.html).

### Ethics scoped to reality
Section 9 avoids performative "AI safety theater" while still encoding consent metadata, Art-only defaults, audit events, and watermark verification. Appropriate for a private local tool.

### Risk register
Section 16 covers the right failure modes: long-form drift, Windows acceleration instability, export damaging watermarks, thermal throttling, and reference-sample contamination.

---

## 3. Weakest / Overfit / Under-Specified Parts

### Overfit: Chatterbox Turbo as presumptive MVP engine
The plan invests disproportionate narrative weight on Turbo before empirical validation. Turbo's official positioning emphasizes agent latency and paralinguistic tags — valuable for lessons, but not the same optimization target as 20–45 minute Audible-style narration with stable prosody. **Original** and **Multilingual V3** deserve equal bake-off priority for lesson excerpts, not "compare later" status.

### Overfit: Fish Speech S2 in the default matrix
Fish Speech S2 is a quality challenger worth *one* eval slot if time permits, but the plan lists SGLang/vLLM serving paths that are hostile to desktop packaging. For English-only Art lessons, Fish Speech is likely a research detour unless the harness proves install is trivial on Ubuntu. Risk: weeks lost on packaging a challenger that cannot ship.

### Under-specified: chunk-to-chunk stitching
Section 7.2 says "controlled silence and optional crossfade" but does not define:
- default inter-chunk gap duration,
- whether crossfade is MVP or post-MVP,
- loudness matching between chunks,
- seam detection criteria,
- or what happens when regenerated chunk N differs in room tone from chunk N-1.

Stitching is where long-form lessons succeed or fail; it needs a subsection with acceptance tests, not a bullet.

### Under-specified: dual source of truth (SQLite + manifest.json)
Section 6.3 lists both `project.sqlite` and `manifest.json`. The plan does not say which is authoritative, how they stay in sync, or whether manifest is export-only. This will cause migration bugs and "reopen project" corruption unless resolved early.

### Under-specified: worker IPC and lifecycle
Section 5.1 prefers loopback HTTP "for debuggability" but Section 6.1 also lists stdio JSON-RPC. The plan should pick a **default** and document:
- health check / heartbeat interval,
- graceful shutdown on cancel,
- behavior when worker OOMs mid-queue,
- whether the host restarts worker automatically or marks jobs failed,
- timeout policy per chunk.

Tauri has a first-class [sidecar pattern](https://v2.tauri.app/develop/sidecar/) for bundled binaries; the plan never maps `gnarvox-worker` to sidecar vs external managed venv — a packaging fork that should be decided now.

### Under-specified: Python runtime version mismatch
The plan standardizes on **Python 3.12** (Sections 4.2, 10.1). Chatterbox's upstream `pyproject.toml` states development/testing on **Python 3.11 on Debian 11** with pinned dependencies. This is a real integration risk on ROCm stacks where wheel availability is narrow. The plan should require verifying `chatterbox-tts` install on 3.12 *before* committing the worker to 3.12, or pin 3.11 with documented ROCm wheel compatibility.

### Under-specified: recording/capture stack
Milestone 3 promises a recording wizard, level meter, and quality gates, but names no capture backend (e.g., `cpal` in Rust host, or delegating to worker). Voice capture is on the critical path to cloning quality; "wizard UI" without an audio I/O spec is a hole.

### Under-specified: FFmpeg acquisition
Export (Section 7.8) assumes FFmpeg from the Rust host but does not say bundled vs system dependency. On Windows, missing FFmpeg is a top support ticket; on Linux, distro FFmpeg vs static build affects codec support for M4B/AAC.

### Under-specified: project recoverability
Section 14.3 mentions queue survival on worker failure, but there is no autosave cadence, WAL mode for SQLite, crash-safe partial take writes, or "resume interrupted export" flow. For hour-long generation queues, recoverability should be a Milestone 2 exit criterion, not implied.

### Under-specified: primary production OS
Art has two machines. The plan benchmarks both but never states whether Ubuntu ROCm is the *production generation* environment and Windows is *review/portable fallback*, or whether feature parity is mandatory for daily use on both. That decision affects acceptable CPU fallback RTF and packaging investment.

### Scope creep risk: M4B + chapters + cover art in MVP
Audible-style output is the right north star, but M4B with chapters, cover art, and loudness normalization is a non-trivial FFmpeg/`ffmpeg`/`ffprobe`/`atomicparsley` pipeline. Consider shipping WAV + MP3 in Milestone 5 and M4B in Milestone 5.5 unless the eval harness proves export is trivial.

---

## 4. Model, Inference, and Acceleration Critique

### Chatterbox family: right family, wrong default bet

| Model | Plan treatment | Reviewer assessment |
| --- | --- | --- |
| **Turbo** | Lead candidate | Best for iteration speed and tag support; *unproven* for 10+ min lesson fatigue |
| **Original** | Quality comparison row | Should be **co-primary** for lesson narration bake-off |
| **Multilingual V3** | Optional if non-English needed | V3's "reduced hallucination" claim is directly relevant to chunk stability even for English |
| **Kokoro** | Baseline/fallback | Correct; keep in CI |
| **F5-TTS** | Eval only, NC weights | Correct exclusion from distributable output |
| **Fish Speech S2** | Quality challenger | Defer unless harness install < 1 day |
| **XTTS v2** | Excluded | Correct |

**Recommendation:** Structure the bake-off around three lesson-shaped tasks, not model marketing categories:
1. **Correction pickup** — regenerate one sentence in a paragraph.
2. **10-minute continuous listen** — stitched chunks, subjective fatigue.
3. **Hard words paragraph** — names, numbers, URLs, acronyms.

Score Turbo, Original, and V3 on those three before declaring an MVP engine.

### Zero-shot reference selection is under-designed
The plan stores voice samples and profiles but does not specify how the worker *selects* among curated references per chunk (fixed profile clip vs style-dependent clip vs per-section clip). Reference choice often matters more than `cfg_weight` tuning for prosody continuity across chunks. Add `reference_sample_selection_policy` to the job schema.

### ONNX path: correctness before acceleration
Chatterbox Turbo ONNX exists on Hugging Face, but ONNX is a **second implementation** of the model graph. The plan wisely says to compare output quality against PyTorch — make that a **hard gate**: if ONNX output fails perceptual A/B on Art's voice, ONNX is fallback-only on CPU for packaging smoke tests, not a Windows GPU strategy.

**MIGraphX** should not appear in the Milestone 1 matrix at all unless PyTorch ROCm is blocked. It is a third runtime surface with its own operator support story. DirectML on Windows is a reasonable *single* experiment after CPU baseline passes.

### One model at a time: keep it
Section 10.1's "one loaded model at a time for MVP" is correct. Model hot-swap and concurrent engines are premature.

### Watermarking: verify the full chain early
PerTh detection is listed in acceptance tests — good. Move watermark survive tests to **Milestone 1** alongside the first export pipeline prototype (WAV → MP3 at minimum). If loudnorm or MP3 encoding breaks detection, the disclosure workflow (Section 9.2) needs redesign before building UI around it.

### ASR validation timing is too late
Post-MVP Whisper alignment (Section 8.4) is mis-prioritized. For catching hallucinations, skipped words, and repetitions, a local ASR pass on generated chunks is high leverage and should enter the eval harness in Milestone 1 as an objective metric (WER/CER), even if rough. Art's ears remain the final judge, but ASR catches failures Art might miss on pass 3 of a long queue.

### NPU / Vulkan deferral: agree
No disagreement. Revisit after MVP ships.

### Reference architecture the plan should cite
Community projects like [Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) may inform worker API design and queue patterns. The synthesis agent should add "survey existing local TTS server wrappers" as a Milestone 0.5 task — not to adopt wholesale, but to avoid reinventing job queues poorly.

---

## 5. Desktop Frontend and Packaging Critique

### Tauri 2: correct choice
Matches Art's explicit system-webview + Rust preference. Alternatives section (5.2) is fair; no change needed.

### Sidecar vs managed venv: decide explicitly
The plan's Option A (managed Python via `uv`) vs Option B (PyInstaller bundle) is honest, but the **development** and **shipping** stories diverge:

| Approach | Dev | Ship | GPU |
| --- | --- | --- | --- |
| Managed venv + `uv` | Excellent | Hard for non-technical user | ROCm wheels manageable |
| PyInstaller sidecar | Harder to debug | Simpler launch | ROCm bundling often breaks |
| Hybrid: venv in dev, CPU ONNX sidecar in release | Pragmatic | Good MVP | Ubuntu ROCm doc-led setup |

**Recommendation:** MVP dev on managed venv; release v1 as Tauri app + bootstrap script that creates/validates venv on first run, with a diagnostics page showing Python/Torch/ROCm versions. Optional CPU ONNX sidecar for Windows users who refuse Python setup. Document Tauri `externalBin` sidecar naming (`-$TARGET_TRIPLE` suffix) in packaging section.

### WebView cross-platform UI risk is real but manageable
Waveform editors in WebKitGTK are historically painful. The plan says "conservative UI" — amplify that:
- Prefer **canvas** waveform with precomputed peaks from Rust (not decode in WebView).
- Avoid heavy WebAudio graph features on Linux until probed in Milestone 2.
- Test Ubuntu WebKitGTK **before** investing in a fancy script editor; plain textarea + markdown preview may suffice for MVP.

### Svelte as default frontend: fine, don't bike-shed further
Framework choice is low risk if UI stays simple. Spend complexity budget on Rust host + worker protocol, not React vs Svelte.

### Linux packaging: AppImage vs deb
AppImage bundles WebKitGTK dependencies inconsistently; deb targeting Ubuntu 26.04 is often smoother for Art's stated distro. If AppImage is chosen, add explicit WebKitGTK version pinning to acceptance tests.

### Component count: slight over-engineering
`gnarvox-export` as a separate module (Section 6.1) may be unnecessary for MVP — FFmpeg orchestration from `gnarvox-host` with golden-file tests is enough. Split later if Python export logic grows.

### Missing from packaging section
- Code signing (Windows Smart App Control already noted for ROCm; same applies to unsigned Tauri binaries).
- Model cache location and size expectations (Chatterbox weights + ONNX duplicates could exceed 5–10 GB).
- Offline install story: USB copy of model files with checksum verification.

---

## 6. Product Workflow Critique for Long-Form Lessons

### Section/chunk hierarchy: sound
User-facing sections (30s–5min) vs model chunks (1–4 sentences) is the right two-level model. Add a **starting default** of ~250–350 characters per chunk with automatic shrink on ASR mismatch or worker warnings — the plan's "1–4 sentences" is too vague across Art's writing style.

### Pronunciation dictionary: pragmatic but limited
Text substitution without IPA/ARPABET is the right MVP scope. Add **preview-on-one-sentence** as a Milestone 4 exit criterion (already mentioned in 7.3) and ensure previews use the same chunking path as production, not a special short-circuit that lies about results.

### Style presets: good set, missing linkage
Presets reference engine-specific knobs (`cfg_weight`, `exaggeration`) but the plan does not say presets are **engine-tagged** (a `lesson_warm` preset for Turbo may not translate to Original). Tag presets with `compatible_engines[]` in the schema.

### Generation queue UX: strong
Actionable warnings (watermark missing, loudness out of range, text mismatch) are exactly what Art needs during multi-hour queues. Add **estimated time remaining** based on rolling RTF — trivial from stored job metadata, high UX value.

### Audition workflow: MVP is thin for real editing
MVP audition (waveform, A/B, trim silence) is acceptable. Flag that **punch-in line repair** (post-MVP 7.7) will be heavily used; ensure chunk boundaries in the script editor are visible during audition so Art knows what will change on regenerate.

### Export loudness: validate target empirically
-18 LUFS integrated is a reasonable starting point but Audible and podcast platforms differ. The plan says "measure what sounds right" — add a **reference track comparison** step in eval: normalize a known commercial narration sample and match integrated LUFS/true peak profile.

### Lesson production states missing
Add project-level states: `draft`, `generating`, `review`, `locked for export`. Prevents accidental full-lesson regen after Art approves section 3 of 12.

### Script import: DOCX deferral may hurt
If Art's lesson scripts live in Word, DOCX import deferred to post-MVP may block daily use. At minimum, validate whether pandoc/zip-based DOCX text extraction is a 2-day addition worth Milestone 4.

### Inter-section pauses and chapter boundaries
Headings → chapters is correct for M4B. Specify default inter-section pause (e.g., 800ms–1200ms) and whether chapter markers include trailing silence or start at first speech sample.

---

## 7. Test / Evaluation Harness Recommendations

### Keep the harness standalone
`gnarvox-eval` should remain runnable without Tauri, without SQLite, and without GUI — write outputs to a timestamped directory with `report.json` + `report.md`. This enables CI and pre-commit regression on Kokoro.

### Expand objective metrics

| Metric | Priority | Notes |
| --- | --- | --- |
| RTF, memory, startup | P0 | Already in plan |
| WER/CER via local ASR | P0 | Add in Milestone 1 |
| True peak, LUFS, silence ratio | P0 | Already in plan |
| Watermark detect pre/post encode | P0 | Move earlier |
| Seam loudness delta at chunk boundaries | P1 | New — detect bad stitches |
| DNSMOS/UTMOS (if runnable locally) | P2 | Optional quality proxy |
| Thermal throttle events during 60min run | P1 | Log `rocm-smi` or CPU freq drops |

### Golden files and reproducibility
- Store `text_hash`, `seed`, `engine_version`, `model_revision`, `backend`, `reference_sample_id` per output — plan has this; enforce in harness first.
- Add **content hash of output WAV** to reports for regression diffing.
- Mark runs as `reproducible` or `non-reproducible` explicitly when seeds are ignored by backend.

### Corpus design
Keep private Art samples out of git — correct. Add to repo:
- `eval/manifest.template.json` with placeholder paths
- `eval/text/fixtures/` with **synthetic** stress passages (numbers, URLs, nested quotes) safe to commit
- Rubric template for Art's 1–5 scores with anchor descriptions

### CI strategy
- Linux CI: Kokoro ONNX CPU only (no GPU, no secrets).
- GPU benchmarks: manual or self-hosted Strix Halo runner, not GitHub-hosted.
- Contract tests: job schema round-trip, pronunciation substitution, chunker golden outputs.

### Benchmark matrix trim (suggested)

**Milestone 1 required:**
- Kokoro CPU — Windows + Ubuntu
- Chatterbox Turbo PyTorch CPU — Windows + Ubuntu
- Chatterbox Turbo PyTorch ROCm — Ubuntu
- Chatterbox Original PyTorch ROCm — Ubuntu (lesson narration comparison)
- Chatterbox Turbo ONNX CPU — Windows + Ubuntu

**Milestone 1 optional / Milestone 6:**
- Chatterbox Turbo ONNX DirectML — Windows
- Chatterbox Multilingual V3 PyTorch ROCm — Ubuntu (if hallucination is an issue in Turbo)
- Fish Speech — Ubuntu only if install < 1 day
- F5-TTS — non-commercial eval only, offline machine

**Remove from near-term matrix:**
- MIGraphX until PyTorch ROCm baseline is green and ONNX CPU parity is proven

### Acceptance gate additions
Add to Section 11.4:
- Max seam loudness jump between adjacent chunks < X dB (define after first stitch prototype).
- ASR WER on lesson excerpt < Y% (define per engine; failure triggers chunk size reduction).
- Worker restart recovery: kill -9 worker mid-job, resume queue without corrupting project DB.

---

## 8. Security / Privacy / Data Retention Concerns

### What the plan gets right
- Loopback-only worker binding
- Per-session token
- No default telemetry
- Explicit model download consent
- Biometric-like treatment of voice samples (Section 13)
- Audit events for profile creation and export
- Art-only mode option

### Gaps and hardening recommendations

**Loopback HTTP vs stdio:** HTTP on `127.0.0.1` with a random token is acceptable but adds port-binding race conditions and CSRF-like confusion if another local process probes ports. **Prefer stdio JSON-RPC as default IPC** for MVP; optional `--http-debug-port` for development. Simpler attack surface, no firewall edge cases, natural fit for Tauri sidecar stdin/stdout.

**Logs and script text:** Section 13 says logs should avoid full private script text — enforce structurally: log `text_hash` and `chunk_id`, not `text`. Add log rotation and max size per project.

**Encryption at rest:** Deferred — acceptable for MVP on Art's private machines. Document that project directories contain sensitive biometric data and belong on encrypted volumes (BitLocker/LUKS) as an install recommendation.

**Deletion flows:** "Delete voice profile" and "Delete project" are listed — specify whether deletion is secure wipe or filesystem unlink, and whether SQLite VACUUM reclaims space. Raw samples immutable is good; add **export backup prompt** before profile deletion.

**Model download integrity:** Checksums are mentioned — also pin Hugging Face revision hashes and support air-gapped import from USB.

**Tauri capabilities:** Plan mentions command allowlist — add explicit CSP for frontend, deny arbitrary `fetch()` to non-loopback origins, and scope filesystem access to project roots via Tauri v2 permissions model.

**Worker token storage:** Store session token in Rust host memory only; never expose to frontend JS except as opaque "worker ready" state. Frontend should call Rust commands, not HTTP directly.

**Retention policy:** Unspecified. Suggest defaults: keep all takes until Art deletes; cap `cache/` size with LRU eviction of regenerable intermediates; retain `logs/` for 30 days or last N MB per project.

---

## 9. Concrete Suggested Edits for the Final Synthesis Agent

### Adopt (high confidence)

1. **Reframe Turbo** from "initial likely winner" to "first integrated candidate"; elevate **Chatterbox Original** to co-primary in bake-off for lesson narration quality.

2. **Trim acceleration scope for MVP** to: PyTorch ROCm (Ubuntu primary) + CPU fallback (both OSes). Defer MIGraphX and DirectML to post-MVP experiments unless harness blockers force them.

3. **Pick default worker IPC:** stdio JSON-RPC for production; optional HTTP debug mode. Document heartbeat, cancel, OOM, and restart semantics.

4. **Resolve SQLite vs manifest authority:** recommend SQLite as source of truth; `manifest.json` generated on export/open-for-backup only.

5. **Add stitching subsection** under 7.2 with defaults (gap ms, loudness match, seam tests) and Milestone 5 acceptance criteria.

6. **Move ASR WER/CER** from post-MVP to Milestone 1 harness metrics.

7. **Move watermark survive tests** to Milestone 1 (WAV → MP3 minimum).

8. **Verify Python 3.12 vs 3.11** against `chatterbox-tts` pins before locking worker version; document outcome in `docs/DEV.md`.

9. **Specify recording stack** in Milestone 3: e.g., Rust `cpal` capture to WAV in host, quality gates in Rust before samples enter DB.

10. **Add recoverability** to Milestone 2 exit: SQLite WAL, autosave every N seconds, worker crash → jobs marked retryable without DB corruption.

11. **Tag style presets** with compatible engines; add `reference_sample_selection_policy` to job schema.

12. **Define primary OS role** explicitly (suggested: Ubuntu ROCm for batch generation, Windows for review with CPU acceptable for corrections).

13. **Add Tauri sidecar/venv hybrid packaging** paragraph to Section 12 referencing `externalBin` and first-run bootstrap diagnostics.

14. **Reduce Fish Speech** to optional one-off eval unless install is trivial; remove from required Milestone 1 exit criteria.

15. **Add chunk default** (~250–350 chars) and automatic shrink on ASR/warning failure.

### Adopt (medium confidence)

16. Split M4B export to Milestone 5.5 if WAV+MP3+Milestone 5 timeline slips; keep M4B as goal but not hard MVP gate.

17. Add lesson project states (`draft` / `review` / `locked`).

18. Precompute waveform peaks in Rust for WebView performance.

19. Add `eval/text/fixtures/` synthetic stress passages and `manifest.template.json` to repo in Milestone 1.

20. Survey Chatterbox-TTS-Server and similar for worker queue patterns (Milestone 0.5).

### Reject or defer (with rationale)

| Suggestion in plan | Action | Why |
| --- | --- | --- |
| MIGraphX in near-term benchmark matrix | Defer | Third runtime; ROCm EP removed; only pursue if PyTorch path fails |
| Fish Speech as required challenger | Defer | Packaging cost likely exceeds English-only lesson benefit |
| `gnarvox-export` as separate component MVP | Defer | FFmpeg from host is enough initially |
| Full SSML/IPA pronunciation MVP | Reject | Correctly scoped out already |
| NPU/Vulkan MVP work | Reject | Already deferred; agree |
| Real-time conversational mode | Reject | Correct non-goal |

### Text patches for PLAN.md (for synthesis agent to apply)

- **Section 1, "Initial likely winner":** Replace language implying Turbo wins by default with "harness-ranked winner after bake-off; Turbo is first integration target for speed, Original/V3 are narration quality challengers."

- **Section 6.1:** Add bullet list for worker lifecycle: spawn, health ping every 5s, cancel propagates to inference thread, OOM → job `failed_retryable`, host may restart worker max 3 times per session.

- **Section 6.3:** Add sentence: "SQLite is authoritative; `manifest.json` is a derived export artifact regenerated on demand."

- **Section 7.2:** New subsection **7.2.1 Chunk stitching** with gap defaults, loudness matching, seam QA metric.

- **Section 10.1:** Reorder backends; mark DirectML/MIGraphX as `experimental_post_mvp`.

- **Section 11.3:** Remove MIGraphX from required matrix; add Original ROCm as required; add seam/WER columns to required results.

- **Section 12.2:** Add "Hybrid MVP packaging" third option (Tauri + uv bootstrap + diagnostics page).

- **Section 14.3:** Add worker kill -9 recovery test and SQLite WAL requirement.

- **New open unknown (Section 19):** "Optimal reference sample length and count for Art's voice on Turbo vs Original."

---

## Summary for Synthesis Agent

This plan is **worth implementing** with a tighter backend scope, a more skeptical default toward Chatterbox Turbo for long-form narration, and explicit contracts for stitching, IPC, recoverability, and data authority. The eval-first milestone ordering is the plan's spine — protect it from UI enthusiasm and from expanding the benchmark matrix into a research program.

The final product Art needs is not "the best 2026 TTS model" but **a reliable local studio** where a bad chunk can be regenerated in minutes, exports are reproducible, and voice data never leaves the machine. The plan is ~80% of the way to that studio definition; the remaining 20% is operational detail that determines whether Art trusts the tool on lesson 47, not just lesson 1.

---

*End of Grok/Cursor review.*