import init, { normalize_audio, apply_echo, anonymize_voice } from 'timbre_kit'

export type DspEffect = 'normalize' | 'echo' | 'anonymize'

let wasmReadyPromise: Promise<unknown> | null = null

/**
 * Ensures the WebAssembly runtime is loaded before applying any DSP effect.
 */
export async function ensureWasmReady(): Promise<void> {
  if (!wasmReadyPromise) {
    wasmReadyPromise = init()
  }
  await wasmReadyPromise
}

/**
 * Converts an AudioBuffer into an audio/wav Blob using 16-bit PCM encoding.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const numSamples = buffer.length
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')

  // "fmt " sub-chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = Linear PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // "data" sub-chunk
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Collect channel buffers
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  // Interleave and scale samples to signed 16-bit PCM [-32768, 32767]
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1.0, Math.min(1.0, channels[c][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/**
 * Asynchronously decodes an audio Blob, passes PCM samples to Rust WASM in-place,
 * and encodes the resulting AudioBuffer into a playable WAV Object URL.
 */
export async function processAudio(
  audioBlob: Blob,
  effect: DspEffect
): Promise<string> {
  await ensureWasmReady()

  const arrayBuffer = await audioBlob.arrayBuffer()
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioContextClass()

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    // Extract first channel samples
    const channelData = audioBuffer.getChannelData(0)
    const samples = new Float32Array(channelData)

    switch (effect) {
      case 'normalize':
        normalize_audio(samples)
        break
      case 'echo':
        // 240ms delay with 45% feedback decay
        apply_echo(samples, audioBuffer.sampleRate, 240, 0.45)
        break
      case 'anonymize':
        anonymize_voice(samples, audioBuffer.sampleRate)
        break
      default:
        throw new Error(`Unknown DSP effect: ${effect}`)
    }

    // Write back processed samples to channel 0
    audioBuffer.copyToChannel(samples, 0)

    // If stereo, mirror to second channel as well for consistent spatial playback
    if (audioBuffer.numberOfChannels > 1) {
      audioBuffer.copyToChannel(samples, 1)
    }

    const wavBlob = audioBufferToWavBlob(audioBuffer)
    return URL.createObjectURL(wavBlob)
  } finally {
    await audioCtx.close()
  }
}
