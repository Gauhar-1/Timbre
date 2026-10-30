import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Sliders,
  Volume2,
  Shield,
  CheckCircle2,
  ArrowRight,
  Database,
  X,
  Cpu,
  AlertTriangle,
} from 'lucide-react'
import { CustomAudioPlayer } from '../CustomAudioPlayer'
import { processAudio, DspEffect } from '../../services/dsp'
import {
  transcribeAudio,
  generateTitleAndSummary,
  saveRecordingToDatabase,
  getGroqApiKey,
} from '../../services/ai'
import { getClientId } from '../../services/client'

export interface MasteringModalProps {
  isOpen: boolean
  onClose: () => void
  audioBlob: Blob | null
  recordingType?: 'solo' | 'merged'
  recording_type?: 'solo' | 'merged'
  durationMs: number
  roomId?: string
  onSavedSuccess?: (record: { id: string; title: string }) => void
  onOpenVault?: () => void
}

export const MasteringModalOrDrawer: React.FC<MasteringModalProps> = ({
  isOpen,
  onClose,
  audioBlob,
  recordingType,
  recording_type,
  durationMs,
  roomId,
  onSavedSuccess,
  onOpenVault,
}) => {
  const effectiveRecordingType = recording_type || recordingType || 'solo'

  // DSP States
  const [activeEffect, setActiveEffect] = useState<DspEffect | null>(null)
  const [isDspProcessing, setIsDspProcessing] = useState(false)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<'original' | 'processed'>('original')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)

  // Step 1: Explicit Sequential AI Pipeline & Disabled States
  const [isSaving, setIsSaving] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [transcriptText, setTranscriptText] = useState('')
  const [summaryText, setSummaryText] = useState('')
  const [titleText, setTitleText] = useState('')

  const [groqKey, setGroqKey] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [savedResult, setSavedResult] = useState<{
    id: string
    title: string
    summary: string
    transcript: string
  } | null>(null)

  // Initialize audio preview & reset states when new audioBlob is loaded
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

      // Reset pipeline state
      setIsSaving(false)
      setIsTranscribing(false)
      setIsSummarizing(false)
      setHasSaved(false)
      setTranscriptText('')
      setSummaryText('')
      setTitleText('')
      setSavedResult(null)
      setErrorMsg(null)
      setToastMessage(null)
      setGroqKey(getGroqApiKey())

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

  // Keep groqKey updated from storage
  useEffect(() => {
    if (isOpen) {
      setGroqKey(getGroqApiKey())
    }
  }, [isOpen])

  // Auto-dismiss toast notification after 5 seconds
  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

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
      setSelectedSource('processed')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'DSP processing failed'
      setErrorMsg(msg)
    } finally {
      setIsDspProcessing(false)
    }
  }

  // Active audio URL and Blob based on A/B selection
  const activeAudioUrl = selectedSource === 'processed' && processedUrl ? processedUrl : originalUrl
  const activeBlobToSave = selectedSource === 'processed' && processedBlob ? processedBlob : audioBlob

  // Action 1: Transcribe (Groq Whisper-large-v3)
  const handleTranscribe = async () => {
    const key = (groqKey || getGroqApiKey()).trim()
    if (!key) {
      setErrorMsg('No Groq API key found. Please configure your Groq key in the studio header.')
      return
    }
    if (!activeBlobToSave || isTranscribing || transcriptText) return

    try {
      setIsTranscribing(true)
      setErrorMsg(null)
      const text = await transcribeAudio(activeBlobToSave, key)
      setTranscriptText(text)
    } catch (err: unknown) {
      setIsTranscribing(false)
      const msg = err instanceof Error ? err.message : 'Transcription failed'
      const displayMsg = msg.includes('AI generation failed') ? msg : `AI generation failed: ${msg}`
      setErrorMsg(displayMsg)
      setToastMessage(displayMsg)
    } finally {
      setIsTranscribing(false)
    }
  }

  // Action 2: Summarize (Llama 3 / OpenAI LLM)
  const handleSummarize = async () => {
    const key = (groqKey || getGroqApiKey()).trim()
    if (!transcriptText.trim() || isSummarizing || summaryText) return

    try {
      setIsSummarizing(true)
      setErrorMsg(null)
      const { title, summary } = await generateTitleAndSummary(transcriptText, key)
      setSummaryText(summary)
      if (title) {
        setTitleText(title)
      }
    } catch (err: unknown) {
      setIsSummarizing(false)
      const msg = err instanceof Error ? err.message : 'Summarization failed'
      const displayMsg = msg.includes('AI generation failed') ? msg : `AI generation failed: ${msg}`
      setErrorMsg(displayMsg)
      setToastMessage(displayMsg)
    } finally {
      setIsSummarizing(false)
    }
  }

  // Action 3: Save to Vault (Uploads current state of Blob, Transcript, and Summary)
  const handleSaveToVault = async () => {
    if (!activeBlobToSave || isSaving || hasSaved) return

    try {
      setIsSaving(true)
      setErrorMsg(null)

      let finalBlob = activeBlobToSave
      // If effect selected but not yet processed
      if (activeEffect && !processedBlob && audioBlob) {
        const dspResult = await processAudio(audioBlob, activeEffect)
        finalBlob = dspResult.blob
        setProcessedBlob(dspResult.blob)
        setProcessedUrl(dspResult.url)
      }

      const clientId = getClientId()
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const fallbackTitle =
        titleText ||
        (summaryText ? summaryText.slice(0, 32) : `${effectiveRecordingType === 'merged' ? 'Multiplayer Session' : 'Solo Take'} (${timestampStr})`)

      const record = await saveRecordingToDatabase({
        audioBlob: finalBlob,
        title: fallbackTitle,
        durationMs: durationMs || 3000,
        transcript: transcriptText.trim() || undefined,
        summary: summaryText.trim() || undefined,
        recordingType: effectiveRecordingType,
        clientId,
        roomId: roomId || undefined,
      })

      setSavedResult({
        id: record.id,
        title: record.title,
        summary: summaryText,
        transcript: transcriptText,
      })
      setHasSaved(true)
      onSavedSuccess?.(record)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save recording to Vault'
      setErrorMsg(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const isBusy = isSaving || isTranscribing || isSummarizing || isDspProcessing

  const modalNode = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 select-none">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isBusy ? onClose : undefined}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Floating Toast Notification for AI errors */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              role="alert"
              data-testid="ai-toast-notification"
              className="fixed top-6 right-6 z-[250] flex max-w-sm items-center gap-3 rounded-2xl border border-red-500/40 bg-zinc-950/95 px-4 py-3 text-xs text-red-200 shadow-2xl backdrop-blur-xl"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <div className="flex-1 font-medium">{toastMessage}</div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer ml-1 text-sm leading-none"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
                      effectiveRecordingType === 'merged'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    }`}
                  >
                    {effectiveRecordingType === 'merged' ? 'Multiplayer Mix' : 'Solo Take'}
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
              disabled={isBusy}
              aria-label="Close dialog"
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body: Scrollable */}
          <div className="my-4 space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            {/* Success state view when save completes */}
            {hasSaved && savedResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"
              >
                <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-xs sm:text-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Recording Successfully Persisted to SQLite Vault!</span>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-100">
                      {savedResult.title}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      ID: {savedResult.id.substring(0, 12)}...
                    </span>
                  </div>
                  {savedResult.summary && (
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {savedResult.summary}
                    </p>
                  )}
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
            )}

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

              {/* Custom Audio Player with Volume Slider */}
              <div className="pt-1">
                <CustomAudioPlayer
                  key={activeAudioUrl || 'empty'}
                  src={activeAudioUrl}
                  showReset={true}
                  className="bg-zinc-900/60 border border-zinc-800/80"
                />
              </div>
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
                  disabled={isBusy}
                  onClick={() => handleSelectEffect('normalize')}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all cursor-pointer disabled:opacity-50 ${
                    activeEffect === 'normalize'
                      ? 'border-violet-500/80 bg-violet-600/15 text-violet-200 ring-1 ring-violet-500/40'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                  }`}
                >
                  <Sliders className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-semibold">Normalize</span>
                  <span className="text-[10px] text-zinc-400">Peak -1.0 dB</span>
                </button>

                {/* Effect 2: Echo */}
                <button
                  type="button"
                  id="mastering-effect-echo"
                  disabled={isBusy}
                  onClick={() => handleSelectEffect('echo')}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all cursor-pointer disabled:opacity-50 ${
                    activeEffect === 'echo'
                      ? 'border-violet-500/80 bg-violet-600/15 text-violet-200 ring-1 ring-violet-500/40'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                  }`}
                >
                  <Volume2 className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-semibold">Echo / Delay</span>
                  <span className="text-[10px] text-zinc-400">200ms • Decay</span>
                </button>

                {/* Effect 3: Anonymize */}
                <button
                  type="button"
                  id="mastering-effect-anonymize"
                  disabled={isBusy}
                  onClick={() => handleSelectEffect('anonymize')}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all cursor-pointer disabled:opacity-50 ${
                    activeEffect === 'anonymize'
                      ? 'border-violet-500/80 bg-violet-600/15 text-violet-200 ring-1 ring-violet-500/40'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                  }`}
                >
                  <Shield className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-semibold">Anonymizer</span>
                  <span className="text-[10px] text-zinc-400">Voice Scramble</span>
                </button>
              </div>
            </div>

            {/* Step 1: Sequential AI Pipeline & Action Buttons */}
            <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span>Sequential AI Pipeline & Vault</span>
                </span>
                {!groqKey && (
                  <span className="text-[10px] text-amber-400 font-mono">
                    (Requires Groq Key)
                  </span>
                )}
              </div>

              {/* Three Distinct Action Buttons with Strict Disabled States */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Button 1: Transcribe (Groq) */}
                <button
                  type="button"
                  id="btn-transcribe-groq"
                  data-testid="btn-transcribe-groq"
                  disabled={!groqKey || isTranscribing || !!transcriptText.trim()}
                  onClick={handleTranscribe}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:border-violet-500/60 hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isTranscribing ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                      <span>Transcribing...</span>
                    </>
                  ) : transcriptText ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Transcribed</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                      <span>Transcribe (Groq)</span>
                    </>
                  )}
                </button>

                {/* Button 2: Summarize (Llama 3) */}
                <button
                  type="button"
                  id="btn-summarize-llama"
                  data-testid="btn-summarize-llama"
                  disabled={!transcriptText.trim() || isSummarizing || !!summaryText.trim()}
                  onClick={handleSummarize}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:border-violet-500/60 hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSummarizing ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                      <span>Summarizing...</span>
                    </>
                  ) : summaryText ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Summarized</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="h-3.5 w-3.5 text-violet-400" />
                      <span>Summarize (Llama 3)</span>
                    </>
                  )}
                </button>

                {/* Button 3: Save to Vault */}
                <button
                  type="button"
                  id="btn-save-vault"
                  data-testid="btn-save-vault"
                  disabled={isSaving || hasSaved || isDspProcessing || !activeBlobToSave}
                  onClick={handleSaveToVault}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving...</span>
                    </>
                  ) : hasSaved ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Saved to Vault</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5" />
                      <span>Save to Vault</span>
                    </>
                  )}
                </button>
              </div>

              {/* Display Transcript Box if available */}
              {transcriptText && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                    <span className="flex items-center gap-1 text-violet-400">
                      <Sparkles className="h-3 w-3" />
                      Whisper Transcript
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {transcriptText.length} chars
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed max-h-24 overflow-y-auto select-text font-sans">
                    {transcriptText}
                  </p>
                </div>
              )}

              {/* Display Summary Box if available */}
              {summaryText && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                    <span className="flex items-center gap-1 text-violet-400">
                      <Cpu className="h-3 w-3" />
                      Executive Summary
                    </span>
                    {titleText && (
                      <span className="text-[10px] font-mono text-violet-300 bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 rounded-full">
                        {titleText}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed select-text font-sans">
                    {summaryText}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
            <div className="text-[11px] text-zinc-400 font-mono">
              {selectedSource === 'processed' ? 'Format: 16-bit WAV (DSP)' : 'Format: WebM Audio'}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {hasSaved ? 'Close' : 'Discard'}
              </button>

              <button
                type="button"
                id="btn-footer-save-to-vault"
                disabled={isSaving || hasSaved || isDspProcessing || !activeBlobToSave}
                onClick={handleSaveToVault}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Saving to Vault...</span>
                  </>
                ) : hasSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span>Saved to Vault</span>
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
        </motion.div>
      </div>
    )}
  </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode
}

export const MasteringBay = MasteringModalOrDrawer
export default MasteringModalOrDrawer
