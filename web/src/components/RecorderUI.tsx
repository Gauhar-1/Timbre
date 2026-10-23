import React, { useState, useEffect, useRef } from 'react'
import { Sliders, Sparkles, Volume2, Shield, Database } from 'lucide-react'
import { CustomAudioPlayer } from './ui/CustomAudioPlayer'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { processAudio, DspEffect } from '../services/dsp'
import { saveRecordingToDatabase } from '../services/ai'
import { getClientId } from '../services/client'

export interface RecorderUIProps {
  onRecordingFinished?: (blob: Blob, durationMs: number) => void
  onOpenMastering?: (blob: Blob, durationMs: number) => void
}

export const RecorderUI: React.FC<RecorderUIProps> = ({
  onRecordingFinished,
  onOpenMastering,
}) => {
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
  const [processedAudioBlob, setProcessedAudioBlob] = useState<Blob | null>(null)
  const [selectedSource, setSelectedSource] = useState<'before' | 'after'>('before')
  const [activeEffect, setActiveEffect] = useState<DspEffect | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [dspError, setDspError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Track recording transition to trigger Mastering Bay automatically
  const wasRecordingRef = useRef(false)
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && audioBlob) {
      onRecordingFinished?.(audioBlob, recordingTime * 1000)
    }
    wasRecordingRef.current = isRecording
  }, [isRecording, audioBlob, recordingTime, onRecordingFinished])

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
    setProcessedAudioBlob(null)
    setActiveEffect(null)
    setSelectedSource('before')
    setDspError(null)
    setSavedId(null)
    resetHookRecording()
  }

  // Handle DSP Effect application via Rust WASM
  const handleApplyEffect = async (effect: DspEffect) => {
    if (!audioBlob) return

    try {
      setIsProcessing(true)
      setDspError(null)

      const { blob: newBlob, url: newUrl } = await processAudio(audioBlob, effect)

      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl)
      }

      setProcessedAudioUrl(newUrl)
      setProcessedAudioBlob(newBlob)
      setActiveEffect(effect)
      setSelectedSource('after') // Automatically switch to preview processed audio
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audio processing failed'
      setDspError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveSolo = async () => {
    const blobToSave = selectedSource === 'after' && processedAudioBlob ? processedAudioBlob : audioBlob
    if (!blobToSave) return

    try {
      setIsSaving(true)
      setDspError(null)
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const effectTag = selectedSource === 'after' && activeEffect ? ` (${activeEffect})` : ''
      const record = await saveRecordingToDatabase({
        audioBlob: blobToSave,
        title: `Solo Recording${effectTag} [${timestampStr}]`,
        durationMs: recordingTime * 1000,
        recordingType: 'solo',
        clientId: getClientId(),
      })
      setSavedId(record.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setDspError(msg)
    } finally {
      setIsSaving(false)
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
    <div className="w-full max-w-xl mx-auto space-y-6 select-none">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Subtle accent gradient glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
            isRecording
              ? 'bg-red-500/15 opacity-100'
              : processedAudioUrl
                ? 'bg-emerald-500/10 opacity-70'
                : 'bg-violet-500/10 opacity-60'
          }`}
        />

        {/* Header section */}
        <div className="relative flex flex-col items-center text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Solo Studio • Part 1 & 2 DSP
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            Voice Recorder & Processor
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-400">
            Capture single-track microphone audio and apply zero-copy Rust WASM effects.
          </p>
        </div>

        {/* Error notification banners */}
        {(recorderError || dspError) && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-400">
            {recorderError || dspError}
          </div>
        )}

        {/* Central Record / Stop Interactive Area */}
        <div className="relative my-7 flex flex-col items-center justify-center">
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
              className={`group relative z-10 flex h-24 w-24 items-center justify-center rounded-full border shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 cursor-pointer ${
                isRecording
                  ? 'border-red-500/40 bg-red-600 text-white shadow-red-500/40 hover:bg-red-700 focus:ring-red-500/30 active:scale-95'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:scale-105 hover:bg-zinc-800 focus:ring-violet-500/30 active:scale-95 shadow-violet-500/10'
              }`}
            >
              {isRecording ? (
                // Stop square icon
                <div className="h-7 w-7 rounded-md bg-white transition-transform group-hover:scale-95" />
              ) : (
                // Record red circular icon
                <div className="h-7 w-7 rounded-full bg-red-500 transition-transform group-hover:scale-110 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          </div>

          {/* Status Label & Timer */}
          <div className="mt-5 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isRecording ? 'animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-zinc-600'
                }`}
              />
              <span className="text-sm font-semibold tracking-wide text-zinc-200">
                {isRecording ? 'Recording Live...' : audioUrl ? 'Recording Captured' : 'Ready to Record'}
              </span>
            </div>

            {isRecording ? (
              <span className="font-mono text-2xl font-bold tracking-tight text-red-500">
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">
                {audioUrl ? 'Open Mastering Bay below or review playback' : 'Click the record button above to begin'}
              </span>
            )}
          </div>
        </div>

        {/* DSP Effects Control Panel */}
        {audioBlob && (
          <div className="relative mt-6 border-t border-zinc-800/80 pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  WASM Voice Effects
                </span>
                <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400 border border-violet-500/20">
                  Rust Zero-Copy
                </span>
              </div>
              {isProcessing && (
                <span className="text-xs font-medium text-violet-400 animate-pulse">
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
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all disabled:opacity-50 cursor-pointer ${
                  activeEffect === 'normalize' && selectedSource === 'after'
                    ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <Volume2 className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-semibold">Normalize</span>
                <span className="text-[10px] text-zinc-400">Peak to 0.95</span>
              </button>

              {/* Echo Effect Button */}
              <button
                type="button"
                id="btn-effect-echo"
                disabled={isProcessing || isRecording}
                onClick={() => handleApplyEffect('echo')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all disabled:opacity-50 cursor-pointer ${
                  activeEffect === 'echo' && selectedSource === 'after'
                    ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-semibold">Space Echo</span>
                <span className="text-[10px] text-zinc-400">280ms Decay</span>
              </button>

              {/* Anonymize Effect Button */}
              <button
                type="button"
                id="btn-effect-anonymize"
                disabled={isProcessing || isRecording}
                onClick={() => handleApplyEffect('anonymize')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all disabled:opacity-50 cursor-pointer ${
                  activeEffect === 'anonymize' && selectedSource === 'after'
                    ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <Shield className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-semibold">Anonymize</span>
                <span className="text-[10px] text-zinc-400">Voice Scramble</span>
              </button>
            </div>
          </div>
        )}

        {/* Playback & Audio Details Section */}
        {currentAudioSrc && (
          <div className="relative mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-5 transition-all space-y-4">
            {/* Header with Before / After Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-zinc-200">
                  Playback Preview
                </span>
                {audioBlob && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ({formatBytes(audioBlob.size)})
                  </span>
                )}
                {selectedSource === 'after' && activeEffect && (
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400 border border-violet-500/20 capitalize">
                    {activeEffect} Applied
                  </span>
                )}
              </div>

              {/* Before / After Toggle */}
              {processedAudioUrl && (
                <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSource('before')}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      selectedSource === 'before'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Original (A)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('after')}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      selectedSource === 'after'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Processed (B)
                  </button>
                </div>
              )}
            </div>

            {/* Custom Audio Player replacing native player */}
            <CustomAudioPlayer
              key={currentAudioSrc}
              src={currentAudioSrc}
              showReset={true}
              className="bg-zinc-900/60"
            />

            {savedId && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-400 font-medium">
                <span>✓ Persisted to Phoenix SQLite Vault</span>
                <span className="font-mono text-[10px] text-emerald-500/80">
                  ID: {savedId.substring(0, 12)}...
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {/* Open in Mastering & AI Bay Button */}
                <button
                  type="button"
                  id="btn-solo-open-mastering"
                  onClick={() =>
                    audioBlob && onOpenMastering?.(audioBlob, recordingTime * 1000)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Mastering & AI Bay</span>
                </button>

                <button
                  type="button"
                  id="btn-save-solo"
                  disabled={isSaving}
                  onClick={handleSaveSolo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 shadow-sm hover:bg-zinc-800 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : savedId ? 'Saved' : 'Quick Save'}</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Clear Recording
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecorderUI
