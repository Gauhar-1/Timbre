import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Sliders,
  Volume2,
  Shield,
  Play,
  Pause,
  CheckCircle2,
  ArrowRight,
  Database,
  X,
  Cpu,
} from 'lucide-react'
import { processAudio, DspEffect } from '../../services/dsp'
import {
  transcribeAudio,
  generateTitleAndSummary,
  saveRecordingToDatabase,
} from '../../services/ai'
import { getClientId } from '../../services/client'

export interface MasteringModalProps {
  isOpen: boolean
  onClose: () => void
  audioBlob: Blob | null
  recordingType: 'solo' | 'merged'
  durationMs: number
  roomId?: string
  onSavedSuccess?: (record: { id: string; title: string }) => void
  onOpenVault?: () => void
}

type SaveStep = 'idle' | 'dsp' | 'transcribing' | 'summarizing' | 'saving' | 'done'

export const MasteringModalOrDrawer: React.FC<MasteringModalProps> = ({
  isOpen,
  onClose,
  audioBlob,
  recordingType,
  durationMs,
  roomId,
  onSavedSuccess,
  onOpenVault,
}) => {
  // DSP States
  const [activeEffect, setActiveEffect] = useState<DspEffect | null>(null)
  const [isDspProcessing, setIsDspProcessing] = useState(false)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<'original' | 'processed'>('original')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)

  // Audio Playback
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

  // Save & AI Pipeline States
  const [saveStep, setSaveStep] = useState<SaveStep>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [savedResult, setSavedResult] = useState<{
    id: string
    title: string
    summary: string
    transcript: string
  } | null>(null)

  // Initialize original audio URL when modal opens with a new blob
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob)
      setOriginalUrl(url)
      setSelectedSource('original')
      setActiveEffect(null)
      setProcessedBlob(null)
      if (processedUrl) {
        URL.revokeObjectURL(processedUrl)
        setProcessedUrl(null)
      }
      setSaveStep('idle')
      setSavedResult(null)
      setErrorMsg(null)
      setIsPlaying(false)

      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [audioBlob])

  // Cleanup processed URL on unmount
  useEffect(() => {
    return () => {
      if (processedUrl) {
        URL.revokeObjectURL(processedUrl)
      }
    }
  }, [processedUrl])

  // Handle DSP Effect application via Rust WASM
  const handleSelectEffect = async (effect: DspEffect) => {
    if (!audioBlob) return

    if (activeEffect === effect && processedBlob) {
      // Toggle off effect
      setActiveEffect(null)
      setSelectedSource('original')
      return
    }

    try {
      setIsDspProcessing(true)
      setErrorMsg(null)

      const result = await processAudio(audioBlob, effect)

      if (processedUrl) {
        URL.revokeObjectURL(processedUrl)
      }

      setProcessedBlob(result.blob)
      setProcessedUrl(result.url)
      setActiveEffect(effect)
      setSelectedSource('processed') // Switch preview to processed audio
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'DSP processing failed'
      setErrorMsg(msg)
    } finally {
      setIsDspProcessing(false)
    }
  }

  // Active audio URL based on A/B selection
  const activeAudioUrl = selectedSource === 'processed' && processedUrl ? processedUrl : originalUrl
  const activeBlobToSave = selectedSource === 'processed' && processedBlob ? processedBlob : audioBlob

  // Handle Play/Pause
  const togglePlayPause = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }

  // Handle Seek
  const handleSeek = (newTime: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  // Execute Save & AI Pipeline
  const handleSaveToVault = async () => {
    if (!activeBlobToSave) return

    try {
      setErrorMsg(null)

      // Step 1: DSP
      if (activeEffect && !processedBlob) {
        setSaveStep('dsp')
        const result = await processAudio(audioBlob!, activeEffect)
        setProcessedBlob(result.blob)
        setProcessedUrl(result.url)
      }

      // Step 2: Transcribe
      setSaveStep('transcribing')
      const transcript = await transcribeAudio(activeBlobToSave)

      // Step 3: AI Title & Summary JSON
      setSaveStep('summarizing')
      const { title, summary } = await generateTitleAndSummary(transcript)

      // Step 4: Persist to SQLite via Phoenix API
      setSaveStep('saving')
      const clientId = getClientId()
      const record = await saveRecordingToDatabase({
        audioBlob: activeBlobToSave,
        title,
        durationMs: durationMs || Math.round(totalDuration * 1000) || 3000,
        transcript,
        summary,
        recordingType,
        clientId,
        roomId: roomId || undefined,
      })

      setSavedResult({
        id: record.id,
        title,
        summary,
        transcript,
      })
      setSaveStep('done')
      onSavedSuccess?.(record)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pipeline execution failed'
      setErrorMsg(msg)
      setSaveStep('idle')
    }
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const rem = Math.floor(secs % 60)
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={saveStep === 'idle' || saveStep === 'done' ? onClose : undefined}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-800 bg-[#0c0c0e] p-6 shadow-2xl text-zinc-100 max-h-[92vh] flex flex-col justify-between"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                <Sliders className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-zinc-50 flex items-center gap-2">
                  <span>Mastering & AI Bay</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      recordingType === 'merged'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    }`}
                  >
                    {recordingType === 'merged' ? 'Multiplayer Mix' : 'Solo Take'}
                  </span>
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Preview in-place DSP effects, generate AI intelligence, and sync to vault.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saveStep !== 'idle' && saveStep !== 'done'}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body: Scrollable if viewport is small */}
          <div className="my-4 space-y-5 overflow-y-auto pr-1">
            {errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            {/* Success state view when save completes */}
            {saveStep === 'done' && savedResult ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"
              >
                <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Recording Successfully Persisted to SQLite Vault!</span>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-100 text-sm">
                      {savedResult.title}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      ID: {savedResult.id.substring(0, 12)}...
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {savedResult.summary}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenVault?.()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-violet-500 transition-all cursor-pointer"
                  >
                    <span>View in Recording Vault</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <>
                {/* 1. Audio Player Preview with A/B Toggle */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Audio Preview
                      </span>
                      {selectedSource === 'processed' && activeEffect && (
                        <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 capitalize">
                          {activeEffect} Applied
                        </span>
                      )}
                    </div>

                    {/* Original / Processed A/B Toggle Switch */}
                    <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedSource('original')}
                        className={`rounded-lg px-2.5 py-1 font-medium transition-all cursor-pointer ${
                          selectedSource === 'original'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Original (A)
                      </button>
                      <button
                        type="button"
                        disabled={!processedUrl}
                        onClick={() => setSelectedSource('processed')}
                        className={`rounded-lg px-2.5 py-1 font-medium transition-all cursor-pointer disabled:opacity-40 ${
                          selectedSource === 'processed'
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Processed (B)
                      </button>
                    </div>
                  </div>

                  {/* Custom Seek Bar & Transport Controls */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      disabled={!activeAudioUrl}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md hover:bg-violet-500 transition-all cursor-pointer"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="h-4 w-4 fill-current translate-x-0.5" />
                      )}
                    </button>

                    <div className="flex-1 space-y-1">
                      <input
                        type="range"
                        min="0"
                        max={totalDuration || 1}
                        step="0.05"
                        value={currentTime}
                        onChange={(e) => handleSeek(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-violet-500"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(totalDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hidden Native Audio Element Driving Playback */}
                  {activeAudioUrl && (
                    <audio
                      ref={audioRef}
                      key={activeAudioUrl}
                      src={activeAudioUrl}
                      onTimeUpdate={() => {
                        if (audioRef.current) {
                          setCurrentTime(audioRef.current.currentTime)
                        }
                      }}
                      onLoadedMetadata={() => {
                        if (audioRef.current) {
                          setTotalDuration(audioRef.current.duration || 0)
                        }
                      }}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                  )}
                </div>

                {/* 2. DSP Effects Rack (Part 2) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-violet-400" />
                      <span>Rust WASM DSP Rack</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Zero-Copy • Float32
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Effect 1: Normalize */}
                    <button
                      type="button"
                      id="mastering-effect-normalize"
                      disabled={isDspProcessing || saveStep !== 'idle'}
                      onClick={() => handleSelectEffect('normalize')}
                      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all cursor-pointer ${
                        activeEffect === 'normalize'
                          ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                      }`}
                    >
                      <Volume2 className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-semibold">Normalize</span>
                      <span className="text-[10px] text-zinc-400">Peak 0.95</span>
                    </button>

                    {/* Effect 2: Space Echo */}
                    <button
                      type="button"
                      id="mastering-effect-echo"
                      disabled={isDspProcessing || saveStep !== 'idle'}
                      onClick={() => handleSelectEffect('echo')}
                      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all cursor-pointer ${
                        activeEffect === 'echo'
                          ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                      }`}
                    >
                      <Sparkles className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-semibold">Space Echo</span>
                      <span className="text-[10px] text-zinc-400">280ms Decay</span>
                    </button>

                    {/* Effect 3: Voice Anonymizer */}
                    <button
                      type="button"
                      id="mastering-effect-anonymize"
                      disabled={isDspProcessing || saveStep !== 'idle'}
                      onClick={() => handleSelectEffect('anonymize')}
                      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all cursor-pointer ${
                        activeEffect === 'anonymize'
                          ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                      }`}
                    >
                      <Shield className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-semibold">Anonymizer</span>
                      <span className="text-[10px] text-zinc-400">Voice Scramble</span>
                    </button>
                  </div>
                </div>

                {/* 3. Multi-Step Save Pipeline Progress Indicator */}
                {saveStep !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-2.5"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Processing Pipeline
                    </span>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            saveStep === 'dsp'
                              ? 'bg-violet-400 animate-ping'
                              : activeEffect
                                ? 'bg-emerald-400'
                                : 'bg-zinc-600'
                          }`}
                        />
                        <span
                          className={
                            saveStep === 'dsp'
                              ? 'text-violet-400 font-semibold'
                              : 'text-zinc-400'
                          }
                        >
                          1. Applying Rust WASM DSP (In-Place PCM)
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            saveStep === 'transcribing'
                              ? 'bg-violet-400 animate-ping'
                              : saveStep === 'summarizing' || saveStep === 'saving'
                                ? 'bg-emerald-400'
                                : 'bg-zinc-600'
                          }`}
                        />
                        <span
                          className={
                            saveStep === 'transcribing'
                              ? 'text-violet-400 font-semibold'
                              : 'text-zinc-400'
                          }
                        >
                          2. Transcribing Audio (Groq Whisper-large-v3)
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            saveStep === 'summarizing'
                              ? 'bg-violet-400 animate-ping'
                              : saveStep === 'saving'
                                ? 'bg-emerald-400'
                                : 'bg-zinc-600'
                          }`}
                        />
                        <span
                          className={
                            saveStep === 'summarizing'
                              ? 'text-violet-400 font-semibold'
                              : 'text-zinc-400'
                          }
                        >
                          3. Generating AI Title & Summary (GPT-OSS-20B)
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            saveStep === 'saving'
                              ? 'bg-violet-400 animate-ping'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span
                          className={
                            saveStep === 'saving'
                              ? 'text-violet-400 font-semibold'
                              : 'text-zinc-400'
                          }
                        >
                          4. Syncing to Phoenix SQLite Vault
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* Footer Action Bar */}
          {saveStep !== 'done' && (
            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
              <div className="text-[11px] text-zinc-400 font-mono">
                {selectedSource === 'processed' ? 'Format: 16-bit WAV (DSP)' : 'Format: WebM Audio'}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saveStep !== 'idle'}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Discard
                </button>

                <button
                  type="button"
                  id="btn-save-to-vault"
                  disabled={saveStep !== 'idle' || isDspProcessing}
                  onClick={handleSaveToVault}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saveStep !== 'idle' ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving to Vault...</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      <span>Save to Vault</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default MasteringModalOrDrawer
