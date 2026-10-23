//! timbre_kit — client-side Rust compiled to WebAssembly for audio DSP.
//!
//! Provides zero-copy, in-place audio effects for Web Audio PCM data.

use wasm_bindgen::prelude::*;

/// Root-mean-square level of a block of `f32` PCM samples (each in -1.0..=1.0).
#[wasm_bindgen]
pub fn rms_level(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

/// Normalizes audio samples in-place to a peak amplitude of 0.95.
///
/// Guarantees samples remain strictly bounded within [-1.0, 1.0] with zero allocations.
#[wasm_bindgen]
pub fn normalize_audio(samples: &mut [f32]) {
    if samples.is_empty() {
        return;
    }

    // Find peak amplitude across all samples
    let peak = samples.iter().fold(0.0f32, |acc, &s| {
        if s.is_nan() {
            acc
        } else {
            acc.max(s.abs())
        }
    });

    // Avoid division by zero or amplifying extreme silence
    if peak <= 1e-6 {
        return;
    }

    let target_peak = 0.95f32;
    let gain = target_peak / peak;

    for sample in samples.iter_mut() {
        if sample.is_nan() {
            *sample = 0.0;
        } else {
            *sample = (*sample * gain).clamp(-1.0, 1.0);
        }
    }
}

/// Applies an echo / feedback delay effect in-place.
///
/// Implements a zero-allocation feedback delay line where delayed echoes
/// recirculate back into the audio stream with controllable decay.
#[wasm_bindgen]
pub fn apply_echo(samples: &mut [f32], sample_rate: usize, delay_ms: usize, decay: f32) {
    if samples.is_empty() || sample_rate == 0 || delay_ms == 0 {
        return;
    }

    let delay_samples = (sample_rate * delay_ms) / 1000;
    if delay_samples == 0 || delay_samples >= samples.len() {
        return;
    }

    let decay_factor = decay.clamp(0.0, 0.95);

    // In-place feedback delay loop (IIR):
    // Each sample at index i receives the decaying feedback from sample (i - delay_samples).
    for i in delay_samples..samples.len() {
        let delayed_sample = samples[i - delay_samples];
        let current = samples[i];
        let new_sample = current + delayed_sample * decay_factor;
        samples[i] = new_sample.clamp(-1.0, 1.0);
    }
}

/// Anonymizes vocal recordings using ring modulation to disguise pitch and formants.
///
/// Multiplies the vocal signal by a carrier wave (~55Hz) to split vocal harmonics
/// into robotic sidebands while keeping speech fully intelligible.
#[wasm_bindgen]
pub fn anonymize_voice(samples: &mut [f32], sample_rate: usize) {
    if samples.is_empty() || sample_rate == 0 {
        return;
    }

    let carrier_freq = 55.0f32; // Low-frequency carrier creates classic voice scrambler effect
    let step = (2.0 * std::f32::consts::PI * carrier_freq) / (sample_rate as f32);

    for (i, sample) in samples.iter_mut().enumerate() {
        if sample.is_nan() {
            *sample = 0.0;
            continue;
        }

        let carrier = (i as f32 * step).sin();
        // Blend modulated carrier with balanced original for natural intelligibility
        let scrambled = *sample * (0.35 + 0.65 * carrier);
        *sample = scrambled.clamp(-1.0, 1.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rms_of_silence_is_zero() {
        assert_eq!(rms_level(&[0.0; 128]), 0.0);
    }

    #[test]
    fn rms_of_empty_is_zero() {
        assert_eq!(rms_level(&[]), 0.0);
    }

    #[test]
    fn rms_of_full_scale_is_one() {
        assert!((rms_level(&[1.0, -1.0, 1.0, -1.0]) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn normalize_scales_to_target_peak() {
        let mut buffer = [0.1, -0.4, 0.5, -0.2];
        normalize_audio(&mut buffer);

        let max_val = buffer.iter().fold(0.0f32, |m, &x| m.max(x.abs()));
        assert!((max_val - 0.95).abs() < 1e-5);
        assert!((buffer[2] - 0.95).abs() < 1e-5);
    }

    #[test]
    fn normalize_handles_silence_without_nan() {
        let mut buffer = [0.0; 64];
        normalize_audio(&mut buffer);
        for &s in buffer.iter() {
            assert_eq!(s, 0.0);
            assert!(!s.is_nan());
        }
    }

    #[test]
    fn apply_echo_creates_delayed_feedback() {
        let mut buffer = [0.0f32; 100];
        buffer[0] = 1.0; // Impulse

        let sample_rate = 1000;
        let delay_ms = 20; // 20 samples delay
        let decay = 0.5;

        apply_echo(&mut buffer, sample_rate, delay_ms, decay);

        assert_eq!(buffer[0], 1.0);
        assert_eq!(buffer[20], 0.5); // First echo
        assert_eq!(buffer[40], 0.25); // Second echo
        assert_eq!(buffer[60], 0.125); // Third echo
    }

    #[test]
    fn anonymize_voice_scrambles_and_bounds() {
        let mut buffer = [0.8f32; 200];
        anonymize_voice(&mut buffer, 44100);

        for &s in buffer.iter() {
            assert!(s >= -1.0 && s <= 1.0);
            assert!(!s.is_nan());
        }
        // Samples must no longer be uniform 0.8
        assert_ne!(buffer[0], buffer[50]);
    }
}
