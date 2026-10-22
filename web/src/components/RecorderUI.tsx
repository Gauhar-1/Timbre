import React, { useState, useEffect } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { processAudio, DspEffect } from '../services/dsp'

export const RecorderUI: React.FC = () => {
  const {
    startRecording,
    stopRecording,
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime,
    error: recorderError,
    resetRecording: resetHookRecording,
  } = useAudioRecorder()

  // DSP and playback states
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<'before' | 'after'>('before')
  const [activeEffect, setActiveEffect] = useState<DspEffect | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [dspError, setDspError] = useState<string | null>(null)

  // Revoke processed URL when replaced or unmounted
  useEffect(() => {
    return () => {
      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl)
      }
    }
  }, [processedAudioUrl])

  // Reset local processed states when starting a new recording or resetting
  const handleReset = () => {
    if (processedAudioUrl) {
      URL.revokeObjectURL(processedAudioUrl)
      setProcessedAudioUrl(null)
    }
    setActiveEffect(null)
    setSelectedSource('before')
    setDspError(null)
    resetHookRecording()
  }

  // Handle DSP Effect application via Rust WASM
  const handleApplyEffect = async (effect: DspEffect) => {
    if (!audioBlob) return

    try {
      setIsProcessing(true)
      setDspError(null)

      const newUrl = await processAudio(audioBlob, effect)

      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl)
      }

      setProcessedAudioUrl(newUrl)
      setActiveEffect(effect)
      setSelectedSource('after') // Automatically switch to preview processed audio
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audio processing failed'
      setDspError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Current audio source based on Before / After selection
  const currentAudioSrc =
    selectedSource === 'after' && processedAudioUrl ? processedAudioUrl : audioUrl

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-canvas-soft/80 p-8 shadow-sm backdrop-blur transition-all">
        {/* Subtle accent gradient glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
            isRecording
              ? 'bg-red-500/15 opacity-100'
              : processedAudioUrl
                ? 'bg-emerald-500/10 opacity-70'
                : 'bg-link/10 opacity-60'
          }`}
        />

        {/* Header section */}
        <div className="relative flex flex-col items-center text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-mute">
            Audio Studio • Part 2 DSP
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Voice Recorder & Processor
          </h2>
          <p className="mt-1.5 text-sm text-mute">
            Capture microphone audio and apply high-performance Rust WASM effects.
          </p>
        </div>

        {/* Error notification banners */}
        {(recorderError || dspError) && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-500">
            {recorderError || dspError}
          </div>
        )}

        {/* Central Record / Stop Interactive Area */}
        <div className="relative my-8 flex flex-col items-center justify-center">
          {/* Pulsing ring animation while recording */}
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <span className="absolute inline-flex h-28 w-28 animate-ping rounded-full bg-red-500/30 opacity-75" />
            )}

            {/* Large Record / Stop Toggle Button */}
            <button
              type="button"
              id="record-toggle-button"
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              className={`group relative z-10 flex h-24 w-24 items-center justify-center rounded-full border shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 ${
                isRecording
                  ? 'border-red-500/40 bg-red-600 text-white shadow-red-500/30 hover:bg-red-700 focus:ring-red-500/30 active:scale-95'
                  : 'border-hairline bg-ink text-canvas hover:scale-105 hover:bg-ink/90 focus:ring-link/30 active:scale-95'
              }`}
            >
              {isRecording ? (
                // Stop square icon
                <div className="h-7 w-7 rounded-md bg-white transition-transform group-hover:scale-95" />
              ) : (
                // Record red circular icon
                <div className="h-7 w-7 rounded-full bg-red-500 transition-transform group-hover:scale-110" />
              )}
            </button>
          </div>

          {/* Status Label & Timer */}
          <div className="mt-5 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isRecording ? 'animate-pulse bg-red-500' : 'bg-mute/60'
                }`}
              />
              <span className="text-sm font-semibold tracking-wide text-ink">
                {isRecording ? 'Recording Live...' : audioUrl ? 'Recording Captured' : 'Ready to Record'}
              </span>
            </div>

            {isRecording ? (
              <span className="font-mono text-2xl font-bold tracking-tight text-red-500">
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-xs text-mute">
                {audioUrl ? 'Apply DSP effects below or review playback' : 'Click the button above to begin'}
              </span>
            )}
          </div>
        </div>

        {/* DSP Effects Control Panel */}
        {audioBlob && (
          <div className="relative mt-6 border-t border-hairline pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                  WASM Voice Effects
                </span>
                <span className="rounded bg-link/10 px-1.5 py-0.5 text-[10px] font-medium text-link">
                  Rust Zero-Copy
                </span>
              </div>
              {isProcessing && (
                <span className="text-xs font-medium text-link animate-pulse">
                  Processing Audio...
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Normalize Effect Button */}
              <button
                type="button"
                id="btn-effect-normalize"
                disabled={isProcessing || isRecording}
                onClick={() => handleApplyEffect('normalize')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all disabled:opacity-50 cursor-pointer ${
                  activeEffect === 'normalize' && selectedSource === 'after'
                    ? 'border-link bg-link/10 text-link ring-2 ring-link/20'
                    : 'border-hairline bg-canvas hover:border-hairline-strong text-ink hover:bg-canvas-soft'
                }`}
              >
                <span className="text-xs font-semibold">Normalize</span>
                <span className="text-[10px] text-mute">Peak to 0.95</span>
              </button>

              {/* Echo Effect Button */}
              <button
                type="button"
                id="btn-effect-echo"
                disabled={isProcessing || isRecording}
                onClick={() => handleApplyEffect('echo')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all disabled:opacity-50 cursor-pointer ${
                  activeEffect === 'echo' && selectedSource === 'after'
                    ? 'border-link bg-link/10 text-link ring-2 ring-link/20'
                    : 'border-hairline bg-canvas hover:border-hairline-strong text-ink hover:bg-canvas-soft'
                }`}
              >
                <span className="text-xs font-semibold">Echo</span>
                <span className="text-[10px] text-mute">240ms Feedback</span>
              </button>

              {/* Anonymize Effect Button */}
              <button
                type="button"
                id="btn-effect-anonymize"
                disabled={isProcessing || isRecording}
                onClick={() => handleApplyEffect('anonymize')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all disabled:opacity-50 cursor-pointer ${
                  activeEffect === 'anonymize' && selectedSource === 'after'
                    ? 'border-link bg-link/10 text-link ring-2 ring-link/20'
                    : 'border-hairline bg-canvas hover:border-hairline-strong text-ink hover:bg-canvas-soft'
                }`}
              >
                <span className="text-xs font-semibold">Anonymize</span>
                <span className="text-[10px] text-mute">Voice Scrambler</span>
              </button>
            </div>
          </div>
        )}

        {/* Playback & Audio Details Section */}
        {currentAudioSrc && (
          <div className="relative mt-6 rounded-xl border border-hairline bg-canvas p-5 transition-all">
            {/* Header with Before / After Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-ink">Playback Preview</span>
                {selectedSource === 'after' && activeEffect && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 capitalize">
                    {activeEffect} Applied
                  </span>
                )}
              </div>

              {/* Before / After Toggle (rendered when processed audio exists) */}
              {processedAudioUrl && (
                <div className="inline-flex rounded-lg border border-hairline bg-canvas-soft p-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSource('before')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      selectedSource === 'before'
                        ? 'bg-canvas text-ink shadow-sm'
                        : 'text-mute hover:text-ink'
                    }`}
                  >
                    Before (Original)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('after')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      selectedSource === 'after'
                        ? 'bg-canvas text-link shadow-sm'
                        : 'text-mute hover:text-ink'
                    }`}
                  >
                    After (Processed)
                  </button>
                </div>
              )}
            </div>

            {/* Native HTML audio element as required */}
            <audio
              key={currentAudioSrc}
              src={currentAudioSrc}
              controls
              className="mt-4 w-full rounded-lg outline-none"
            />

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-hairline">
              <div className="text-[11px] text-mute font-mono">
                {selectedSource === 'after' ? (
                  <span>Format: 16-bit PCM WAV (WASM processed)</span>
                ) : (
                  <span>
                    Original: {audioBlob ? formatBytes(audioBlob.size) : ''} • {audioBlob?.type || 'audio/webm'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-mute hover:text-ink transition-colors cursor-pointer"
              >
                Clear Recording
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecorderUI
