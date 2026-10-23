import React, { useRef, useEffect, useState } from 'react'
import { useWebRTCMixer } from '../hooks/useWebRTCMixer'
import {
  transcribeAudio,
  summarizeText,
  saveRecordingToDatabase,
  getGroqApiKey,
  setGroqApiKey,
} from '../services/ai'

// Sub-component to manage each remote audio stream playback safely
const RemoteStreamPlayer: React.FC<{ stream: MediaStream; index: number }> = ({ stream, index }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [volume, setVolume] = useState<number>(0.05) // Default to 5% volume to prevent feedback

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream
      audioRef.current.volume = volume
    }
  }, [stream, volume])

  return (
    <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas p-3.5 shadow-xs transition-all">
      <div className="flex items-center gap-3">
        {/* Animated Audio Visualizer */}
        <div className="flex items-end gap-1 h-5 w-6 px-1 py-0.5 rounded bg-emerald-500/10">
          <span
            className="w-1 bg-emerald-500 rounded-full animate-pulse h-full"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1 bg-emerald-500 rounded-full animate-pulse h-3/4"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1 bg-emerald-500 rounded-full animate-pulse h-1/2"
            style={{ animationDelay: '300ms' }}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">Peer Stream #{index + 1}</span>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
              Live
            </span>
          </div>
          <span className="font-mono text-[10px] text-mute truncate max-w-[150px]">
            {stream.id}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-mute">Vol (anti-feedback):</span>
        <input
          type="range"
          min="0"
          max="0.2"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-16 h-1 bg-hairline rounded cursor-pointer accent-emerald-500"
          title="Kept low to avoid acoustic feedback on local speakers"
        />
        <span className="font-mono text-[10px] text-mute w-6">{Math.round(volume * 100)}%</span>

        {/* Step 3: Render native <audio autoPlay playsInline> element */}
        <audio ref={audioRef} autoPlay playsInline />
      </div>
    </div>
  )
}

export const MultiplayerStudio: React.FC = () => {
  const {
    localPeerId,
    connectedPeers,
    remoteStreams,
    isRoomConnected,
    isRecordingMixed,
    recordingTime,
    mixedAudioBlob,
    mixedAudioUrl,
    error,
    startMixedRecording,
    stopMixedRecording,
    resetMixedRecording: resetBaseRecording,
  } = useWebRTCMixer('room:lobby')

  // AI Pipeline & Persistence states
  const [isSaving, setIsSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState<string>('')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // API Key management
  const [groqKey, setGroqKey] = useState<string>(() => getGroqApiKey())
  const [showKeyConfig, setShowKeyConfig] = useState(false)

  const handleKeySave = (val: string) => {
    setGroqKey(val)
    setGroqApiKey(val)
    setShowKeyConfig(false)
  }

  const handleReset = () => {
    setTranscript(null)
    setSummary(null)
    setSavedRecordId(null)
    setSaveError(null)
    resetBaseRecording()
  }

  // Step 4: Transcribe, Summarize, and Save to Phoenix API
  const handleSaveAndTranscribe = async () => {
    if (!mixedAudioBlob) return

    try {
      setIsSaving(true)
      setSaveError(null)

      // 1. Transcribe mixed audio using Whisper-large-v3
      setSavingStatus('Transcribing mixed audio (Whisper-large-v3)...')
      const transcribedText = await transcribeAudio(mixedAudioBlob, groqKey)
      setTranscript(transcribedText)

      // 2. Generate 2-sentence summary using openai/gpt-oss-20b
      setSavingStatus('Generating 2-sentence summary (GPT-OSS-20B)...')
      const summaryText = await summarizeText(transcribedText, groqKey)
      setSummary(summaryText)

      // 3. Save to Phoenix API /api/recordings
      setSavingStatus('Saving to Phoenix SQLite database...')
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const record = await saveRecordingToDatabase({
        audioBlob: mixedAudioBlob,
        title: `Multiplayer Session (${timestampStr})`,
        durationMs: recordingTime * 1000,
        transcript: transcribedText,
        summary: summaryText,
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
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-canvas-soft/80 p-8 shadow-sm backdrop-blur transition-all">
        {/* Ambient background glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
            isRecordingMixed
              ? 'bg-red-500/15 opacity-100'
              : isRoomConnected
                ? 'bg-link/15 opacity-70'
                : 'bg-hairline opacity-40'
          }`}
        />

        {/* Studio Header */}
        <div className="relative flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-mute">
              Part 3 • WebRTC & AI Intelligence
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isRoomConnected
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-amber-500/10 text-amber-500 animate-pulse'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isRoomConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {isRoomConnected ? 'Room: lobby' : 'Connecting...'}
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Multiplayer Audio Mixer
          </h2>
          <p className="mt-1.5 text-sm text-mute">
            Mix multiple voices live, transcribe with Whisper, and summarize with GPT-OSS-20B.
          </p>

          {/* Quick API Key Toggle */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowKeyConfig((p) => !p)}
              className="text-[11px] text-mute hover:text-ink underline cursor-pointer"
            >
              {groqKey ? '🔑 Groq API Key Configured' : '⚙️ Configure Groq API Key (Optional)'}
            </button>
          </div>
        </div>

        {/* Collapsible API Key Config Form */}
        {showKeyConfig && (
          <div className="mt-4 rounded-xl border border-hairline bg-canvas p-4 text-left transition-all">
            <label className="block text-xs font-semibold text-ink mb-1">
              Groq API Key (for Whisper-large-v3 & GPT-OSS-20B)
            </label>
            <p className="text-[11px] text-mute mb-2">
              Keys are stored locally in your browser. Leave blank to use zero-cost demo simulation.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="gsk_..."
                defaultValue={groqKey}
                id="groq-key-input"
                className="flex-1 rounded-lg border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-ink outline-none focus:border-link font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('groq-key-input') as HTMLInputElement | null
                  handleKeySave(el?.value || '')
                }}
                className="rounded-lg bg-ink text-canvas px-3 py-1.5 text-xs font-semibold hover:bg-ink/90 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Error notification */}
        {(error || saveError) && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-500">
            {error || saveError}
          </div>
        )}

        {/* Session Participants */}
        <div className="relative mt-6 rounded-xl border border-hairline bg-canvas p-4">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink">
              Session Participants ({connectedPeers.length + 1})
            </span>
            <span className="text-[11px] font-mono text-mute">
              Active Audio Streams: {remoteStreams.length + 1}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Local participant badge */}
            <div className="flex items-center gap-2 rounded-lg border border-link/30 bg-link/10 px-3 py-1.5 text-xs text-link font-medium">
              <span className="h-2 w-2 rounded-full bg-link animate-pulse" />
              <span>You ({localPeerId})</span>
              <span className="text-[10px] bg-link/20 px-1 rounded">Host</span>
            </div>

            {/* Remote participants */}
            {connectedPeers.map((peerId) => (
              <div
                key={peerId}
                className="flex items-center gap-2 rounded-lg border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-ink font-medium transition-all"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{peerId}</span>
                <span className="text-[10px] text-mute">Remote Peer</span>
              </div>
            ))}

            {connectedPeers.length === 0 && (
              <div className="w-full text-center py-2 text-xs text-mute italic">
                Open this app in a second browser tab to join and mix multiple voices.
              </div>
            )}
          </div>
        </div>

        {/* Remote Audio Streams Monitor Panel */}
        {remoteStreams.length > 0 && (
          <div className="relative mt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-mute">
                Incoming Audio Streams ({remoteStreams.length})
              </span>
              <span className="text-[10px] text-mute italic">
                Acoustic feedback limiter active (volume &le; 20%)
              </span>
            </div>

            <div className="space-y-2">
              {remoteStreams.map((stream, idx) => (
                <RemoteStreamPlayer key={stream.id} stream={stream} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* Central Record Mixed Session Interactive Area */}
        <div className="relative my-8 flex flex-col items-center justify-center">
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
              className={`group relative z-10 flex h-24 w-24 items-center justify-center rounded-full border shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 cursor-pointer ${
                isRecordingMixed
                  ? 'border-red-500/40 bg-red-600 text-white shadow-red-500/30 hover:bg-red-700 focus:ring-red-500/30 active:scale-95'
                  : 'border-hairline bg-ink text-canvas hover:scale-105 hover:bg-ink/90 focus:ring-link/30 active:scale-95'
              }`}
            >
              {isRecordingMixed ? (
                <div className="h-7 w-7 rounded-md bg-white transition-transform group-hover:scale-95" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-red-500 transition-transform group-hover:scale-110" />
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isRecordingMixed ? 'animate-pulse bg-red-500' : 'bg-mute/60'
                }`}
              />
              <span className="text-sm font-semibold tracking-wide text-ink">
                {isRecordingMixed
                  ? 'Recording Mixed Stream (All Peers)...'
                  : mixedAudioUrl
                    ? 'Mixed Session Ready'
                    : 'Ready to Record Mixed Session'}
              </span>
            </div>

            {isRecordingMixed ? (
              <span className="font-mono text-2xl font-bold tracking-tight text-red-500">
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-xs text-mute">
                {mixedAudioUrl
                  ? 'Review playback, transcribe with AI, or save to database below'
                  : 'Click the button above to capture all participants into one recording'}
              </span>
            )}
          </div>
        </div>

        {/* Mixed Session Playback & AI Action Section */}
        {mixedAudioUrl && (
          <div className="relative mt-6 rounded-xl border border-hairline bg-canvas p-5 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-ink">
                  Mixed Session Recording
                </span>
                <span className="rounded-full bg-link/10 px-2 py-0.5 text-[10px] font-medium text-link">
                  Combined Audio
                </span>
              </div>
              {mixedAudioBlob && (
                <div className="flex items-center gap-2 text-[11px] text-mute font-mono">
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
              className="w-full rounded-lg outline-none"
            />

            {/* AI Transcribe & Save Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-hairline">
              <button
                type="button"
                id="btn-save-ai"
                disabled={isSaving}
                onClick={handleSaveAndTranscribe}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-link px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-link/90 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{savingStatus || 'Processing AI Intelligence...'}</span>
                  </>
                ) : savedRecordId ? (
                  <span>✓ Saved & Transcribed</span>
                ) : (
                  <span>⚡ Transcribe, Summarize & Save</span>
                )}
              </button>

              <div className="flex items-center gap-4 text-xs">
                <a
                  href={mixedAudioUrl}
                  download="timbre-multiplayer-mixed.webm"
                  className="font-medium text-mute hover:text-ink transition-colors cursor-pointer"
                >
                  Download Audio
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-medium text-mute hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Step 5: Render Transcript & Summary below the <audio> playback element */}
            {(summary || transcript) && (
              <div className="mt-4 space-y-3.5 border-t border-hairline pt-4">
                {/* Database Persisted Notice */}
                {savedRecordId && (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-600 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">✓</span>
                      <span>Persisted to Phoenix SQLite Database</span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-700/80">
                      ID: {savedRecordId.substring(0, 18)}...
                    </span>
                  </div>
                )}

                {/* 2-Sentence AI Summary */}
                {summary && (
                  <div className="rounded-xl border border-link/25 bg-link/5 p-4 text-left transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-link flex items-center gap-1.5">
                        <span>🤖</span> AI Summary (GPT-OSS-20B)
                      </span>
                      <span className="text-[10px] text-mute font-mono">2-sentence synthesis</span>
                    </div>
                    <p className="text-xs sm:text-sm text-ink leading-relaxed font-sans">
                      {summary}
                    </p>
                  </div>
                )}

                {/* Full Transcript */}
                {transcript && (
                  <div className="rounded-xl border border-hairline bg-canvas p-4 text-left transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
                        <span>📝</span> Full Audio Transcript (Whisper-large-v3)
                      </span>
                      <span className="text-[10px] text-mute font-mono">Groq API</span>
                    </div>
                    <p className="text-xs text-body leading-relaxed whitespace-pre-wrap font-sans">
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
