import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Check,
  Sliders,
  Users,
  Settings,
  Download,
  AlertCircle,
} from 'lucide-react'
import { useWebRTCMixer } from '../hooks/useWebRTCMixer'
import { AudioWaveform } from './AudioWaveform'
import {
  transcribeAudio,
  summarizeText,
  saveRecordingToDatabase,
  getGroqApiKey,
  setGroqApiKey,
} from '../services/ai'
import { copyInviteLink, getUrlRoomId } from '../services/client'

export interface MultiplayerStudioProps {
  roomId?: string
  onRecordingFinished?: (blob: Blob, durationMs: number, roomId: string) => void
  onOpenMastering?: (blob: Blob, durationMs: number, roomId: string) => void
}

export const MultiplayerStudio: React.FC<MultiplayerStudioProps> = ({
  roomId: propRoomId,
  onRecordingFinished,
  onOpenMastering,
}) => {
  // Determine active room ID (normalized for Phoenix channel topic `room:<name>`)
  const urlRoom = getUrlRoomId()
  const rawRoom = propRoomId || urlRoom || 'lobby'
  const activeRoomKey = rawRoom.replace(/^room:/, '')
  const channelTopic = `room:${activeRoomKey}`

  const {
    localPeerId,
    connectedPeers,
    remoteStreams,
    localStream,
    isRoomConnected,
    isRecordingMixed,
    recordingTime,
    mixedAudioBlob,
    mixedAudioUrl,
    error,
    startMixedRecording,
    stopMixedRecording,
    resetMixedRecording: resetBaseRecording,
  } = useWebRTCMixer(channelTopic)

  // AI Pipeline & Persistence states
  const [isSaving, setIsSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState<string>('')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Copy toast state
  const [copiedInvite, setCopiedInvite] = useState(false)

  // Track recording transition to trigger Mastering Bay
  const wasRecordingMixedRef = useRef(false)
  useEffect(() => {
    if (wasRecordingMixedRef.current && !isRecordingMixed && mixedAudioBlob) {
      onRecordingFinished?.(mixedAudioBlob, recordingTime * 1000, activeRoomKey)
    }
    wasRecordingMixedRef.current = isRecordingMixed
  }, [isRecordingMixed, mixedAudioBlob, recordingTime, activeRoomKey, onRecordingFinished])

  // API Key management
  const [groqKey, setGroqKey] = useState<string>(() => getGroqApiKey())
  const [showKeyConfig, setShowKeyConfig] = useState(false)

  const handleKeySave = (val: string) => {
    setGroqKey(val)
    setGroqApiKey(val)
    setShowKeyConfig(false)
  }

  const handleCopyInvite = async () => {
    const ok = await copyInviteLink(activeRoomKey)
    if (ok) {
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2500)
    }
  }

  const handleReset = () => {
    setTranscript(null)
    setSummary(null)
    setSavedRecordId(null)
    setSaveError(null)
    resetBaseRecording()
  }

  // Direct Transcribe, Summarize, and Save fallback
  const handleSaveAndTranscribe = async () => {
    if (!mixedAudioBlob) return

    try {
      setIsSaving(true)
      setSaveError(null)

      setSavingStatus('Transcribing mixed audio (Whisper-large-v3)...')
      const transcribedText = await transcribeAudio(mixedAudioBlob, groqKey)
      setTranscript(transcribedText)

      setSavingStatus('Generating 2-sentence summary (GPT-OSS-20B)...')
      const summaryText = await summarizeText(transcribedText, groqKey)
      setSummary(summaryText)

      setSavingStatus('Saving to Phoenix SQLite database...')
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const record = await saveRecordingToDatabase({
        audioBlob: mixedAudioBlob,
        title: `Multiplayer Session (${timestampStr})`,
        durationMs: recordingTime * 1000,
        transcript: transcribedText,
        summary: summaryText,
        recordingType: 'merged',
        clientId: localPeerId,
        roomId: channelTopic,
      })

      setSavedRecordId(record.id)
      setSavingStatus('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transcription/saving failed'
      setSaveError(msg)
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

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 select-none">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Ambient background glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
            isRecordingMixed
              ? 'bg-red-500/15 opacity-100'
              : isRoomConnected
                ? 'bg-violet-500/15 opacity-80'
                : 'bg-zinc-800 opacity-40'
          }`}
        />

        {/* Studio Header & Real-time WebRTC Status Badges */}
        <div className="relative flex flex-col items-center text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Part 3 • Live Mixer
            </span>

            {/* Connection badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                isRoomConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isRoomConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-amber-500'
                }`}
              />
              {isRoomConnected ? `Room: ${activeRoomKey}` : 'Connecting...'}
            </span>

            {/* Active peer count badge */}
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
              <Users className="h-3 w-3 text-violet-400" />
              <span>{connectedPeers.length + 1} Online</span>
            </span>
          </div>

          <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            Multiplayer Live Mixer
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Real-time WebRTC mesh audio mixer with synchronized HTML5 waveforms.
          </p>

          {/* Action Bar: Invite Link + Key Config */}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5">
            {/* Copy Invite Link Button */}
            <button
              type="button"
              id="btn-copy-invite-link"
              onClick={handleCopyInvite}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                copiedInvite
                  ? 'bg-emerald-600 text-white'
                  : 'bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 hover:text-white'
              }`}
            >
              {copiedInvite ? (
                <>
                  <Check className="h-3.5 w-3.5 text-white" />
                  <span>Invite Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>

            {/* API Key Settings Button */}
            <button
              type="button"
              onClick={() => setShowKeyConfig((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Settings className="h-3 w-3" />
              <span>{groqKey ? 'Groq Key Set' : 'Configure Groq'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible API Key Config Form */}
        <AnimatePresence>
          {showKeyConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition-all"
            >
              <label className="block text-xs font-semibold text-zinc-200 mb-1">
                Groq API Key (for Whisper-large-v3 & GPT-OSS-20B)
              </label>
              <p className="text-[11px] text-zinc-400 mb-2.5">
                Keys persist securely in browser localStorage. Leave blank to use instant demo simulation.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="gsk_..."
                  defaultValue={groqKey}
                  id="groq-key-input"
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('groq-key-input') as HTMLInputElement | null
                    handleKeySave(el?.value || '')
                  }}
                  className="rounded-xl bg-violet-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-violet-500 cursor-pointer shadow"
                >
                  Save
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error notification banner */}
        {(error || saveError) && (
          <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-400 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error || saveError}</span>
          </div>
        )}

        {/* Session Participants Grid */}
        <div className="relative mt-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-violet-400" />
              <span>Session Mesh Participants ({connectedPeers.length + 1})</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Streams: {remoteStreams.length + 1}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Local participant badge */}
            <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 font-medium">
              <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <span>You ({localPeerId.substring(0, 10)}...)</span>
              <span className="text-[9px] bg-violet-500/20 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                Host
              </span>
            </div>

            {/* Remote participants */}
            {connectedPeers.map((peerId) => (
              <div
                key={peerId}
                className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-300 font-medium transition-all"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{peerId.substring(0, 10)}...</span>
                <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded font-mono">
                  Peer
                </span>
              </div>
            ))}

            {connectedPeers.length === 0 && (
              <div className="w-full text-center py-2 text-xs text-zinc-400 italic">
                Share the invite link to join and mix multiple voices in real time.
              </div>
            )}
          </div>
        </div>

        {/* Live HTML5 Canvas Waveform Grid */}
        <div className="relative mt-5 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <span>📊</span> Live Waveforms ({remoteStreams.length + 1})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              HTML5 Canvas • Violet Glow
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Local Microphone Waveform */}
            <AudioWaveform
              stream={localStream}
              isActive={true}
              isLocal={true}
              label={`You (${localPeerId.substring(0, 8)}...)`}
              sublabel="Host • Local Mic"
            />

            {/* Remote WebRTC Streams Waveforms */}
            {remoteStreams.map((stream, idx) => (
              <AudioWaveform
                key={stream.id}
                stream={stream}
                isActive={true}
                isLocal={false}
                label={`Peer Stream #${idx + 1}`}
                sublabel={connectedPeers[idx] ? `${connectedPeers[idx].substring(0, 8)}...` : stream.id}
              />
            ))}
          </div>
        </div>

        {/* Central Record Mixed Session Interactive Area */}
        <div className="relative my-7 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {isRecordingMixed && (
              <span className="absolute inline-flex h-28 w-28 animate-ping rounded-full bg-red-500/30 opacity-75" />
            )}

            {/* Large Record / Stop Mixed Session Button */}
            <button
              type="button"
              id="record-mixed-toggle-button"
              onClick={isRecordingMixed ? stopMixedRecording : startMixedRecording}
              aria-label={isRecordingMixed ? 'Stop recording mixed session' : 'Record Mixed Session'}
              className={`group relative z-10 flex h-24 w-24 items-center justify-center rounded-full border shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 cursor-pointer ${
                isRecordingMixed
                  ? 'border-red-500/40 bg-red-600 text-white shadow-red-500/40 hover:bg-red-700 focus:ring-red-500/30 active:scale-95'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:scale-105 hover:bg-zinc-800 focus:ring-violet-500/30 active:scale-95 shadow-violet-500/10'
              }`}
            >
              {isRecordingMixed ? (
                <div className="h-7 w-7 rounded-md bg-white transition-transform group-hover:scale-95" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-red-500 transition-transform group-hover:scale-110 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isRecordingMixed ? 'animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-zinc-600'
                }`}
              />
              <span className="text-sm font-semibold tracking-wide text-zinc-200">
                {isRecordingMixed
                  ? 'Recording Mixed Master (All Peers)...'
                  : mixedAudioUrl
                    ? 'Mixed Take Captured'
                    : 'Ready to Record Mixed Session'}
              </span>
            </div>

            {isRecordingMixed ? (
              <span className="font-mono text-2xl font-bold tracking-tight text-red-500">
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">
                {mixedAudioUrl
                  ? 'Open in Mastering Bay or review playback below'
                  : 'Captures all participant audio into a single destination stream'}
              </span>
            )}
          </div>
        </div>

        {/* Mixed Session Playback & Action Section */}
        {mixedAudioUrl && (
          <div className="relative mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-5 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-zinc-200">
                  Mixed Session Recording
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Master Mix
                </span>
              </div>
              {mixedAudioBlob && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                  <span>{formatBytes(mixedAudioBlob.size)}</span>
                  <span>•</span>
                  <span>{mixedAudioBlob.type || 'audio/webm'}</span>
                </div>
              )}
            </div>

            {/* Native HTML audio playback element */}
            <audio
              src={mixedAudioUrl}
              controls
              className="w-full rounded-xl outline-none"
            />

            {/* Mastering & AI Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {/* Mastering & AI Bay Button */}
                <button
                  type="button"
                  id="btn-open-mastering-bay"
                  onClick={() =>
                    mixedAudioBlob &&
                    onOpenMastering?.(mixedAudioBlob, recordingTime * 1000, activeRoomKey)
                  }
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Mastering & AI Bay</span>
                </button>

                <button
                  type="button"
                  id="btn-save-ai"
                  disabled={isSaving}
                  onClick={handleSaveAndTranscribe}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 shadow-sm hover:bg-zinc-800 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{savingStatus || 'Processing...'}</span>
                    </>
                  ) : savedRecordId ? (
                    <span>✓ Saved to Vault</span>
                  ) : (
                    <span>⚡ Quick Transcribe & Save</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <a
                  href={mixedAudioUrl}
                  download={`timbre-multiplayer-${activeRoomKey}.webm`}
                  className="font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-medium text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Inline Transcript & Summary view */}
            {(summary || transcript) && (
              <div className="mt-4 space-y-3.5 border-t border-zinc-800/80 pt-4">
                {savedRecordId && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-400 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">✓</span>
                      <span>Persisted to Phoenix SQLite Vault</span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-500/80">
                      ID: {savedRecordId.substring(0, 14)}...
                    </span>
                  </div>
                )}

                {summary && (
                  <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4 text-left">
                    <span className="text-xs font-semibold uppercase tracking-wider text-violet-300 block mb-1">
                      🤖 AI Summary (GPT-OSS-20B)
                    </span>
                    <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                      {summary}
                    </p>
                  </div>
                )}

                {transcript && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 block mb-1">
                      📝 Full Audio Transcript (Whisper-large-v3)
                    </span>
                    <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans">
                      {transcript}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MultiplayerStudio
