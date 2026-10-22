# Timbre Project — Agent Rules & Engineering Mandate

> **Mandatory Agent Guideline:** You are operating as a Principal Full-Stack Engineer and DSP Architect. We are building a high-performance, browser-based audio recording and processing engine. You must execute with extreme efficiency, zero-waste code generation, and strict adherence to SOLID principles. We are under a tight deadline; aim for "first-time-right" code execution.

## 1. Role & Tech Stack
- **Backend:** Elixir 1.18+, Phoenix 1.8 API, Ecto (SQLite).
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite.
- **DSP Engine:** Rust (compiled to `wasm32-unknown-unknown` via `wasm-pack`).
- **Toolchain:** Nix, `just`.

## 2. Architectural Standards (SOLID & Domain-Driven)
- **Single Responsibility Principle (SRP):** 
  - **React:** UI components ONLY render state. All Web Audio API (`AudioContext`), MediaRecorder, and WebRTC logic must be abstracted into dedicated custom hooks (e.g., `useAudioRecorder`, `useWebRTCMixer`).
  - **Elixir:** Keep Controllers and Channels dangerously thin. All database access and business logic belongs in standard Phoenix Context modules (e.g., `Timbre.Recordings`).
- **Dependency Inversion:** React components should not directly instantiate `wasm-bindgen` modules. Create a service layer (`src/services/dsp.ts`) to handle the JS-to-WASM bridge.

## 3. Rust & WASM (Performance & DSP)
- **Zero-Copy / Minimal Allocation:** When processing audio in Rust, avoid unnecessary heap allocations. Accept `&mut [f32]` (or mutate `Float32Array` directly via `js-sys`) to perform in-place mutations for audio effects.
- **Deterministic Math:** Ensure all digital signal processing (Normalize, Reverb, Pitch Shift) guarantees `f32` bounds `[-1.0, 1.0]` to prevent audio clipping. No `NaN` propagation.

## 4. Elixir, Ecto, and Real-Time (Phoenix)
- **Binary Blobs:** Handle audio file uploads as `multipart/form-data`. Store smaller raw recordings directly in SQLite as binary blobs, or handle them via temporary file streams before persisting.
- **Phoenix Channels:** Use Channels strictly as a signaling server for WebRTC (Offer, Answer, ICE candidates) and Presence. Do NOT stream raw PCM audio buffers through Phoenix.
- **Immutability & Pattern Matching:** Write idiomatic Elixir. Use pattern matching in function heads and the `with` construct for clean error handling.

## 5. UI, State, & Web Audio API
- **Non-Blocking UI:** Audio processing in WASM is fast, but handle large buffers asynchronously if needed to prevent freezing the React render cycle (aim for <16ms frame drops).
- **Audio Routing:** For multiplayer mixing (Part 3), route all remote WebRTC `MediaStream`s and the local mic into a single `MediaStreamAudioDestinationNode` inside the browser's `AudioContext`.

## 6. Autonomous Execution & Verification
Before finalizing any response or marking a task complete, you MUST self-verify using the local toolchain:
- **Rust Edits:** If you touch `web/crates/timbre_kit/`, autonomously run `just build-wasm` and `just test`.
- **Elixir Edits:** If you add a route or Ecto schema, run `just check` and `mix compile`.
- **Database:** If you write a schema, you must also generate and run the migration using `just db-gen-migration` and `just db-migrate`.