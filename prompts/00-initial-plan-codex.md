# gnarvox initial planning task

You are the initial planning agent for `/home/artk/gnarvox`, a private repo for Art Kaiser.

Goal: write a concrete, technically current plan for **gnarvox**: a local voice-cloning / narration-production tool so Art can create Audible-style lesson audio for “Lessons with Art”. This is planning only; do not build the app yet.

Hard requirements and context:
- User wants local-first voice cloning/narration generation, likely on AMD Strix Halo hardware.
- Target machines: one Strix Halo with Windows 11 Pro and another with Ubuntu 26.04.
- Evaluate **Chatterbox Turbo** and any clearly better current alternatives for voice cloning / TTS / zero-shot cloning / long-form narration. Be explicit about uncertainty, licensing, quality, latency, VRAM, AMD ROCm / DirectML / Vulkan / ONNX viability, and what must be verified empirically.
- App frontend should be cross-platform Windows + Linux and use the Rust system-webview stack, not Electron. The likely framework is **Tauri** (system WebView2 on Windows and WebKitGTK on Linux), but compare any better Rust-native/system-webview options if applicable.
- Need a plan that can become a real implementation roadmap: architecture, local model runtime options, data/privacy model, UX flows, package/install story, evaluation harness, acceptance tests, risk register, and milestones.
- Include voice ethics/safety: consent, watermarking/disclosure options, dataset hygiene, local storage of samples, avoiding impersonation beyond Art’s own voice.
- Think about lesson workflow: script import, chunking, pronunciation dictionary, style presets, audio generation queue, regeneration by section, waveform/audition, export to WAV/MP3/M4B, chapters/metadata, normalization/loudness, silence trimming, breaths, SSML-ish controls if model supports it.
- Think about capture workflow: recording Art’s reference samples, noise profile, quality gates, transcript alignment, sample management.
- Think about inference backends: Python service, Rust wrapper, ONNX/ORT, ROCm PyTorch, DirectML/Windows, CPU fallback. Recommend a pragmatic MVP path and a later acceleration path.
- Include Strix Halo specific assumptions and validation steps. Do not invent benchmark numbers; propose how to measure.
- Repository deliverable: create or update `/home/artk/gnarvox/docs/PLAN.md` with the final plan. You may add small supporting docs if useful, but keep the main deliverable in docs/PLAN.md.
- Do not modify files outside `/home/artk/gnarvox`.
- Do not commit unless explicitly instructed by a human/monitor later.

Working style:
1. Inspect the repo first.
2. Do web/current-doc research if your tools allow it; if not, clearly mark claims that need later verification.
3. Produce an actionable plan, not just a brainstorm.
4. Final summary must list files changed and any unknowns/blockers.
