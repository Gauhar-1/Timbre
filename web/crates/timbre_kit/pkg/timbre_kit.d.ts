/* tslint:disable */
/* eslint-disable */

/**
 * Anonymizes vocal recordings using ring modulation to disguise pitch and formants.
 *
 * Multiplies the vocal signal by a carrier wave (~55Hz) to split vocal harmonics
 * into robotic sidebands while keeping speech fully intelligible.
 */
export function anonymize_voice(samples: Float32Array, sample_rate: number): void;

/**
 * Applies an echo / feedback delay effect in-place.
 *
 * Implements a zero-allocation feedback delay line where delayed echoes
 * recirculate back into the audio stream with controllable decay.
 */
export function apply_echo(samples: Float32Array, sample_rate: number, delay_ms: number, decay: number): void;

/**
 * Normalizes audio samples in-place to a peak amplitude of 0.95.
 *
 * Guarantees samples remain strictly bounded within [-1.0, 1.0] with zero allocations.
 */
export function normalize_audio(samples: Float32Array): void;

/**
 * Root-mean-square level of a block of `f32` PCM samples (each in -1.0..=1.0).
 */
export function rms_level(samples: Float32Array): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly anonymize_voice: (a: number, b: number, c: any, d: number) => void;
    readonly apply_echo: (a: number, b: number, c: any, d: number, e: number, f: number) => void;
    readonly normalize_audio: (a: number, b: number, c: any) => void;
    readonly rms_level: (a: number, b: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
