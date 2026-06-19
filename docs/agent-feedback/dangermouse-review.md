# gnarvox PLAN.md — dangermouse review

Reviewer: dangermouse (independent bike-shedder #1)
Date: 2026-06-18
Target: `docs/PLAN.md` (current as of 2026-06-19)

---

## 1. Executive verdict

**This is a strong, unusually disciplined plan. Its biggest risk is not being wrong — it's being too big before it's been proven right.**

The plan correctly refuses to hard-code a model, leads with an evaluation harness, separates the durable workflow from the swappable engine, and treats every performance/licensing claim as unverified until measured. That instinct is exactly right and I'd keep it.

But the plan is ~1,400 lines describing a 6-milestone, multi-process desktop application whose entire value proposition rests on **one untested empirical question: can local zero-shot cloning produce Audible-publishable quality of *Art's specific voice* on this hardware?** If the answer is "no" or "only with heroic effort," then Tauri, SQLite, the queue, the M4B exporter, and the style-preset system are all sunk cost. The plan puts the eval harness first (good) but designs the entire 20-section architecture in parallel (risky). I'd compress hard toward a brutal go/no-go spike before committing to the cathedral.

Secondary concern: the plan optimizes heavily for **real-time factor and GPU acceleration**, which is the wrong thing to obsess over for *offline batch narration production*. Art is not doing live conversation. Overnight CPU/ONNX batch is perfectly acceptable for a single creator; the RTF-and-ROCm anxiety is partly misplaced effort.

Verdict: **Adopt the plan's philosophy, cut its scope by ~40% for the first proof, and reorder so a listenable M4B comes out of the eval harness itself — not milestone 5.**

---

## 2. What the plan gets right

- **Workflow-first, model-second** (§17). The single best decision in the document. The engine adapter boundary (§6.2 model-neutral job schema) is the right seam.
- **Eval harness before app** (§11, §18). Correct sequencing in principle.
- **Licensing is treated as a first-class gate**, not an afterthought (XTTS/F5-TTS non-commercial exclusions in §1, §3.3, §3.5). For a *commercially distributed* "Lessons with Art," this is the difference between shipping and a takedown. Genuinely well done.
- **Reproducibility-by-metadata** (§6.4, §17): text hash, audio hash, model revision, seed, settings stored per take. This is what makes regeneration and audit possible. Keep it.
- **Chunk-and-stitch instead of single-shot long-form** (§3.1, §7.2). Matches the documented reality of these models (see §3 below).
- **Honest treatment of AMD pain**: the ONNX Runtime ROCm EP removal (§10.2) is correctly captured — confirmed: ROCm EP was removed in ONNX Runtime 1.23; ROCm 7.0 is the last supported, migrate to MIGraphX EP for 7.1+. The plan caught a fast-moving detail most would miss.
- **Loopback-only worker + per-session token + no telemetry** (§6.3, §13). Sane local-first posture.
- **Raw samples immutable, consent metadata, watermark verification across export** (§9). The ethics section is thoughtful rather than performative.

Credit where due: this is better than most funded product specs.

---

## 3. High-risk assumptions / missing verification

### 3.1 The load-bearing assumption is buried as "must verify" (§19)
The whole product assumes *Art's* voice clones acceptably. That is unknown until Milestone 1, yet Milestones 2–6 are fully specified around it succeeding. **Add an explicit kill-criteria / go-no-go gate**: a 2–3 day spike that produces a 10-minute narrated lesson sample in Art's voice *before any Tauri code exists*, with a written "if this isn't good enough, here's plan B" (cloud TTS, hybrid, or Art self-records with the tool only doing assembly/export). Right now there is no defined failure branch — only a list of things to measure.

### 3.2 "gfx1151 is supported" is overstated
The plan reads (§4.2) as if ROCm 7.2.1 *officially supports* Strix Halo. Reality from current sources: **gfx1151 is not on AMD's official ROCm support matrix** — it works via community/driver effort and AMD's prebuilt images, but sits in an "awkward spot." More concretely, there are active reports of **GPU hangs, VRAM loss, and desktop crashes on Strix Halo under sustained ROCm AI workloads** (ROCm issue #5665), and a PyTorch issue (#171687) showing gfx1151 decode dominated by `hipMemcpyWithStream` — i.e., **not compute-bound, memory-copy-bound**, so "40 CU / 50 TOPS" does not translate to expected throughput. The plan's "validate empirically" stance covers this, but the framing should change from "supported, verify" to **"unsupported/experimental, expect instability, design the worker to survive GPU death."** The plan's crash-resume queue is the right mitigation — make it a Milestone-1 requirement, not Milestone-6 hardening.

### 3.3 GPU video-encode and ROCm inference can collide
Export uses FFmpeg (§7.8). If FFmpeg ever uses GPU video/au​dio encode while a ROCm job runs (or vice versa), issue #5665 specifically implicates **concurrent video encoding** in the GPU hangs. Mitigation: keep export CPU-only (it's cheap for audio), and never overlap a GPU generation job with GPU-accelerated encode. Cheap to state, expensive to discover.

### 3.4 Short-segment hallucination directly threatens the correction-pickup feature
This is the gap I'd most want the synthesis agent to fix. Chatterbox has a **documented failure mode: short inputs ("Hi!", "Yes", single words/numbers) produce gibberish/hallucinations** (chatterbox issue #97), plus end-of-sentence hallucination around quotes and occasional drift to British English. The plan's `correction_pickup` preset (§7.5) and "regenerate from highlighted text" (§7.7) and "regenerate selected take" workflow are *exactly* the short-input case. **Re-narrating one fixed sentence to match its neighbors is the single hardest thing this tool will attempt** — it combines (a) short-input instability, (b) seed/prosody non-determinism between takes, and (c) the human ear's sensitivity to a tonal seam mid-sentence. The plan treats it as one bullet. It deserves its own design note and its own eval metric ("regeneration pickup match," which §11.2 has — good — but the chunking strategy must guarantee corrections regenerate *whole chunks with surrounding context*, never bare fragments).

### 3.5 Text normalization is under-specified and is probably more important than model choice
"Lessons with Art" sounds technical/educational. That means numbers, units, dates, math notation, code identifiers, URLs, acronyms, and abbreviations — the exact things TTS models butcher. The plan has a pronunciation dictionary (§7.3) but **no dedicated text front-end / normalization layer** (number-to-words, unit expansion, math-to-speech, "v2" → "version two"). This is **engine-independent and high-leverage**: it improves clarity on *every* model and survives a model swap. Right now it's a per-entry dictionary, which doesn't scale to "every number in every lesson." Recommend promoting normalization to a first-class component with its own tests, ahead of style presets.

### 3.6 n=1 self-evaluation is biased
Subjective scoring (§11.2) is "Art rates it." People judge synthetic copies of *their own* voice unusually harshly and unusually inconsistently (voice-confrontation effect). Recommend: (a) blind A/B where Art doesn't know which engine/seed produced which take, and (b) at least one second listener for the final go/no-go. Otherwise the acceptance gate is a coin flip dressed as a rubric.

### 3.7 Loudness target is hand-waved; cite the actual spec
§7.8 says "-18 LUFS, for example." If the distribution target is Audible/ACX, the spec is concrete and should be pinned: **integrated loudness −23 to −18 LUFS, true peak ≤ −3 dBTP, noise floor ≤ −60 dB RMS.** State the real target so the loudness/normalization metric has a pass/fail line instead of "measure what sounds right."

---

## 4. Architecture and model/runtime recommendations

- **Confirm the engine candidates are still right, then narrow brutally.** Chatterbox Turbo's MIT license, 350M params, native paralinguistic tags (`[laugh]`, `[cough]`, etc.), and PerTh watermark are all confirmed accurate as of now. **But also evaluate Chatterbox Multilingual v3**, which Resemble explicitly markets as *fewer hallucinations and better long-form narration stability* than prior Chatterbox models — for an English long-form narration tool, the v3 improvements may matter more than Turbo's speed. The plan mentions Multilingual only as a fallback for non-English (§3.1); given the long-form use case, it deserves a head-to-head with Turbo on stability, not just language coverage.
- **Stop treating RTF < 1.0 as a requirement.** This is offline batch production. An overnight queue at RTF 3–5 on CPU is fine. Reframe the perf goal as "can produce a full lesson in one unattended session," not "real-time." This **de-risks the entire AMD GPU dependency** — GPU becomes a nice-to-have accelerator, not a release blocker. The plan half-says this (§4.3 "don't block MVP on Windows GPU"); make it the explicit default posture for *both* OSes.
- **Pick stdio JSON-RPC over loopback HTTP for the worker** (§5.1 leaves it open). For a single-user local tool, HTTP adds a port, a token, and — critically — **Windows Defender Firewall prompts and AV interference** (the plan even notes WDAG/Smart App Control interference in §4.3). stdio is simpler, has no port surface, dies cleanly with the parent, and the Rust host already owns the worker lifecycle. Reserve HTTP only if you need to attach a debugger.
- **One loaded model at a time (§10.1) is right for MVP** — but document the model-load latency cost, because switching engines mid-session (e.g., Kokoro draft → Chatterbox final) will pay a multi-second reload each time. Consider a "draft vs final" mode that batches all draft work, then all final work.
- **Move waveform peak computation into Rust, not the webview** (see §5). Decode WAV with `symphonia`/`hound` in the host, compute downsampled min/max peaks, ship a small peaks array to the UI. Do **not** decode multi-minute WAVs inside WebKitGTK.

---

## 5. Frontend / Tauri / cross-platform concerns

- **Tauri 2 is the right call** and matches the stated Rust-system-webview requirement. No argument.
- **WebKitGTK is the real cross-platform risk, and it's an audio app.** webkit2gtk on Linux has historically inconsistent Web Audio API, MediaSource, and large-canvas performance versus Chromium WebView2. The plan flags this (§5.1, risk register) but the mitigation is "keep UI conservative," which is vague. Make it concrete:
  - Don't rely on Web Audio decoding or `<audio>` for anything load-bearing; do audio decode/peaks/loudness in Rust and treat the webview as a *renderer of precomputed data + a transport control*.
  - Prototype the waveform widget on **Ubuntu WebKitGTK first** (worst case), not Windows. If it's smooth there, Windows is free.
  - Pin and document the WebKitGTK version; WebKitGTK behavior changes meaningfully across distro versions and Ubuntu 26.04 is new.
- **Playback seeking/looping across multi-minute stems** in webview is a known pain point. Consider streaming decoded PCM chunks from Rust or using a tiny native audio playback path rather than HTML media elements for the audition view.
- **Svelte default is fine.** Don't bikeshed the framework; the plan's "Svelte unless Art prefers otherwise" is correct. The framework is not the risk; the audio integration is.

---

## 6. UX workflow concerns for lesson production

- **Correction pickup is the make-or-break UX** (see §3.4). If re-narrating a fixed line never matches the surrounding take, Art will re-record the whole section every time and the "regenerate by section" promise collapses. Design for this explicitly: regenerate at *chunk* granularity with neighboring-context priming, keep the original seed/style locked, and give Art a seam-preview (play last 2s of prior chunk → new chunk → first 2s of next) before accepting.
- **"Take management" + "multiple takes per chunk" is great but will explode storage and decision fatigue.** A single 30-minute lesson with 3 takes per chunk is a lot of audio and a lot of A/B. Add a default "auto-pick best by ASR-WER + loudness + no-clip, surface only conflicts for human review" so Art isn't auditioning hundreds of fragments. The plan has the metrics (§11.2) — wire them into auto-selection.
- **Defer the custom SSML-ish markup language (§7.4) until eval proves which tags work.** Shipping `[pace:slow]`, `[soft]`, `[emphasis]` before you know the engine honors them is inventing a spec the model may ignore. Start with *only* the paralinguistic tags Chatterbox natively supports (verified in eval) and a literal pause insertion; add markup later.
- **Style presets (5 of them, §7.5) are premature.** You can't tune `lesson_clear` vs `lesson_warm` vs `recap` until you know how the model responds to reference-sample selection and exaggeration/CFG. Ship **one** preset for MVP and let the eval data define the rest.
- **Estimated spoken duration from "measured Art WPM"** (§7.1) is a nice touch — keep it, it's cheap and genuinely useful for lesson planning.

---

## 7. Ethics, consent, and misuse controls

The section is good for an Art-only private tool. Two real gaps:

- **The consent record isn't bound to the output.** §9.1 stores consent metadata in the DB; §9.2 relies on Resemble's PerTh watermark (which marks audio as *machine-generated*, attributable to Resemble's detector — **not** as "Art's authorized voice with consent record X"). Recommend embedding gnarvox's own provenance into export metadata and, ideally, a **C2PA-style content credential / signed manifest** linking the file to the consent record + model + project. That's the thing that protects *Art* if a clip is later disputed. PerTh proves "synthetic"; it doesn't prove "authorized."
- **"Art-only mode" is opt-out via a config flag** (§9.4) — i.e., trivially bypassed, which the plan honestly admits ("practical rather than performative"). Fine for a private tool, but if there's any chance this gets shared/open-sourced, the bypass should at least be logged to the audit trail and the default profile creation should *require* the typed consent affirmation every time, not once. Cheap, and it keeps the ethical posture honest.
- **Watermark-survival verification (§9.2) is good — but don't *block* export on a missing watermark.** If loudnorm/MP3/M4B strips PerTh detectability, the plan says "warn, keep WAV master with watermark." Correct. Just make sure the warning doesn't become a hard gate that prevents Art from shipping his own authorized voice — it's his voice and his consent; the watermark is belt-and-suspenders, not a license check.

---

## 8. Milestone/scope changes I recommend

**Reordered, leaner sequence:**

- **Milestone 0.5 — Brutal spike (NEW, 2–4 days).** No app, no DB, no UI. A throwaway script: Art's 20s sample in → 10-minute lesson sample out (Chatterbox Turbo + Multilingual v3, on whatever backend runs *today*). Art listens. **Go/no-go on local cloning at all.** Define plan B in writing if no-go. *Nothing else proceeds until this passes.*
- **Milestone 1 — Eval harness (keep, but fold in capture quality-gates and a real exporter).** The harness should emit a *listenable, loudness-normalized M4B*, not just a metrics report. Move basic export (FFmpeg WAV/MP3/M4B + loudnorm to the ACX spec) *into* the harness so "acceptable" is judged on the real output format. Add the **text-normalization component** here. Trim the benchmark matrix: drop F5-TTS unless Art explicitly wants non-commercial testing, and treat Fish Speech S2 as stretch.
- **Milestone 2 — Desktop skeleton (keep).** Add: worker designed for crash-resume from job 1 (not deferred to Milestone 6).
- **Milestone 3 — merge capture into the harness/skeleton** rather than a standalone milestone; the quality gates already belong to eval.
- **Milestone 4 — Lesson workflow (keep, descope).** One style preset. Native-only paralinguistic tags. Pronunciation dict + normalization. Auto-take-selection by metrics with human override.
- **Milestone 5 — Audio review/export (mostly already done in M1).** Adds the human audition/seam-preview UI and take A/B.
- **Milestone 6 — Hardening/packaging (keep).**

**Cut or defer for real:** DOCX import, spectrogram, crossfade editor, punch-in repair, project encryption, Fish Speech, F5-TTS, NPU, Vulkan, bundled-Python installer. (The plan already defers most of these — just be ruthless that they stay deferred.)

---

## 9. Concrete suggested edits for the final synthesis agent

1. **Add a §0 go/no-go spike** with explicit kill criteria and a written Plan B (cloud/hybrid/assembly-only). Make all other milestones depend on it.
2. **Reframe §4 (hardware):** change "gfx1151 supported" to "gfx1151 unofficial/experimental; expect GPU hangs and VRAM loss (cite ROCm #5665, PyTorch #171687); worker must survive GPU death." Move crash-resume to Milestone 1/2.
3. **Demote RTF/GPU from requirement to optimization.** State that overnight CPU/ONNX batch is an acceptable shipping posture on both OSes; GPU is acceleration, never a release blocker.
4. **Promote text normalization (§7.3) to a first-class, engine-independent component** with its own tests, ahead of style presets.
5. **Rewrite the correction-pickup design (§7.5/§7.7):** chunk-granularity regeneration with neighbor context, locked seed/style, seam-preview before accept. Add short-input hallucination (chatterbox #97) to the risk register as High/High.
6. **Add Chatterbox Multilingual v3 to the head-to-head (§3.1)** as a long-form-stability candidate, not just a non-English fallback.
7. **Pin the loudness target (§7.8)** to the real ACX/Audible spec (−23 to −18 LUFS integrated, ≤ −3 dBTP, ≤ −60 dB RMS noise floor) so the metric has a pass line.
8. **Choose stdio JSON-RPC for the worker (§5.1)** to avoid Windows firewall/AV friction; note HTTP as debug-only.
9. **Move waveform peak/loudness/decode into Rust (§5)**; treat WebKitGTK as a renderer of precomputed data. Prototype waveform on Ubuntu WebKitGTK first.
10. **Strengthen provenance (§9):** add signed/C2PA-style content credentials binding export → consent record + model, distinct from PerTh. Don't hard-gate export on watermark survival.
11. **Add anti-bias to eval (§11.2):** blind A/B and a second listener for the final model decision.
12. **Descope MVP:** one style preset, native-only tags, auto-take-selection; keep DOCX/spectrogram/crossfade/Fish/F5/NPU/Vulkan deferred.

---

### Sources consulted
- Chatterbox Turbo: <https://www.resemble.ai/chatterbox-turbo/>, <https://huggingface.co/ResembleAI/chatterbox-turbo>
- Chatterbox short-segment hallucination: <https://github.com/resemble-ai/chatterbox/issues/97>
- Chatterbox Multilingual v3 (long-form stability claims): <https://www.resemble.ai/resources/chatterbox-multilingual-v3-tts-with-embedded-watermarking-for-25-languages>
- Strix Halo / gfx1151 ROCm hangs + VRAM loss: <https://github.com/ROCm/ROCm/issues/5665>
- gfx1151 memcpy-bound decode: <https://github.com/pytorch/pytorch/issues/171687>
- ONNX Runtime ROCm EP removed → MIGraphX: <https://onnxruntime.ai/docs/execution-providers/ROCm-ExecutionProvider.html>, <https://onnxruntime.ai/docs/execution-providers/MIGraphX-ExecutionProvider.html>
