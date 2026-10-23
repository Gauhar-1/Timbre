import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Check,
  Sliders,
  Users,
  Download,
  AlertCircle,
  Mic,
  MicOff,
  Disc,
  Square,
  Sparkles,
  X,
} from 'lucide-react'
import { useWebRTCMixer } from '../hooks/useWebRTCMixer'
import { AudioWaveform } from './AudioWaveform'
import { CustomAudioPlayer } from './ui/CustomAudioPlayer'
import {
  getGroqApiKey,
  setGroqApiKey,
} from '../services/ai'
import { MasteringBay } from './mastering/MasteringBay'
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

  // Local Microphone Mute state
  const [isMuted, setIsMuted] = useState(false)

  // Step 3 Bug Fix: Local MasteringBay trigger state
  const [isMasteringOpen, setIsMasteringOpen] = useState(false)

  // Copy toast state
  const [copiedInvite, setCopiedInvite] = useState(false)

  // Groq API Key spring-based input animation states
  const [groqKey, setGroqKey] = useState<string>(() => getGroqApiKey())
  const [isKeyInputOpen, setIsKeyInputOpen] = useState(false)
  const [tempKey, setTempKey] = useState<string>(() => getGroqApiKey())

  // Toggle local mic audio tracks
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = !next
        })
      }
      return next
    })
  }

  // Step 3: Pass merged Blob into MasteringBay upon recording completion
  const wasRecordingMixedRef = useRef(false)
  useEffect(() => {
    if (wasRecordingMixedRef.current && !isRecordingMixed && mixedAudioBlob) {
      if (onRecordingFinished) {
        onRecordingFinished(mixedAudioBlob, recordingTime * 1000, activeRoomKey)
      } else {
        setIsMasteringOpen(true)
      }
    }
    wasRecordingMixedRef.current = isRecordingMixed
  }, [isRecordingMixed, mixedAudioBlob, recordingTime, activeRoomKey, onRecordingFinished])

  const handleOpenMastering = () => {
    if (!mixedAudioBlob) return
    if (onOpenMastering) {
      onOpenMastering(mixedAudioBlob, recordingTime * 1000, activeRoomKey)
    } else {
      setIsMasteringOpen(true)
    }
  }

  const handleKeySave = (val: string) => {
    const trimmed = val.trim()
    setGroqKey(trimmed)
    setGroqApiKey(trimmed)
  }

  const handleCopyInvite = async () => {
    const ok = await copyInviteLink(activeRoomKey)
    if (ok) {
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2500)
    }
  }

  const handleReset = () => {
    setIsMasteringOpen(false)
    resetBaseRecording()
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
    <div className="w-full max-w-5xl mx-auto space-y-6 select-none pb-28">
      {/* Studio Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl transition-all">
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
        <div className="relative flex flex-col items-center text-center space-y-2.5">
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
              <span>{connectedPeers.length + 1} Mesh Nodes</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Multiplayer Live Mixer
          </h2>
          <p className="text-xs text-zinc-400 max-w-lg">
            Low-latency WebRTC mesh audio mixer with synchronized HTML5 waveforms and master destination recording.
          </p>

          {/* Action Bar: Invite Link + Spring Animated Groq Key Input */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
            {/* Copy Invite Link Button */}
            <button
              type="button"
              id="btn-copy-invite-link"
              onClick={handleCopyInvite}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                copiedInvite
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
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

            {/* Step 4: Groq API Key Input Animation */}
            <AnimatePresence mode="wait">
              {!isKeyInputOpen ? (
                <motion.button
                  key="status-pill"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  type="button"
                  id="groq-pill-trigger"
                  onClick={() => {
                    setTempKey(groqKey)
                    setIsKeyInputOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-all cursor-pointer shadow-sm"
                >
                  <Sparkles className="h-3 w-3 text-violet-400" />
                  <span>{groqKey ? 'Groq Key Active' : 'Configure Groq'}</span>
                </motion.button>
              ) : (
                <motion.div
                  key="input-form"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                  className="flex items-center gap-1.5 overflow-hidden rounded-full border border-violet-500/40 bg-zinc-900/90 px-3 py-1 shadow-xl backdrop-blur-md"
                >
                  <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleKeySave(tempKey)
                        setIsKeyInputOpen(false)
                      }
                    }}
                    id="groq-key-input"
                    className="bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none w-36 sm:w-52 font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleKeySave(tempKey)
                      setIsKeyInputOpen(false)
                    }}
                    className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-500 transition-colors shadow cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsKeyInputOpen(false)}
                    className="rounded-full p-0.5 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-center text-xs font-medium text-red-400 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Step 3: Responsive Multi-Stream Grid (gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <span>📊</span> Audio Waveform Canvas Grid ({remoteStreams.length + 1} Channels)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            HTML5 Canvas • AnalyserNode
          </span>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Cell 1: Local Microphone Waveform */}
          <div className="h-44">
            <AudioWaveform
              stream={localStream}
              isActive={!isMuted}
              isLocal={true}
              label={`You (${localPeerId.substring(0, 8)}...)`}
              sublabel="Host • Local Mic"
              className="h-full w-full"
            />
          </div>

          {/* Cells 2+: Remote WebRTC Streams Waveforms */}
          {remoteStreams.map((stream, idx) => (
            <div key={stream.id} className="h-44">
              <AudioWaveform
                stream={stream}
                isActive={true}
                isLocal={false}
                label={`Peer #${idx + 1}`}
                sublabel={connectedPeers[idx] ? `${connectedPeers[idx].substring(0, 8)}...` : stream.id}
                className="h-full w-full"
              />
            </div>
          ))}

          {/* Empty peer slots card if fewer than 2 peers connected */}
          {remoteStreams.length === 0 && (
            <div className="h-44 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <Users className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-zinc-300">Awaiting Remote Peers</h4>
                <p className="text-[10px] text-zinc-500 max-w-[200px]">
                  Share your invite link with another tab or browser to stream live waveforms.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 underline cursor-pointer"
              >
                Copy Invite Link
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mixed Take Review & AI Bay Trigger Section (if recorded) */}
      {mixedAudioUrl && (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-200">
                Mixed Master Take
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider border border-emerald-500/20">
                Merged Stream
              </span>
            </div>
            {mixedAudioBlob && (
              <span className="text-[10px] font-mono text-zinc-400">
                {formatBytes(mixedAudioBlob.size)} • {mixedAudioBlob.type || 'audio/webm'}
              </span>
            )}
          </div>

          {/* Custom Audio Player replacing native player */}
          <CustomAudioPlayer
            src={mixedAudioUrl}
            showReset={true}
            className="bg-zinc-900/60"
          />

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-open-mastering-bay"
                onClick={handleOpenMastering}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Open in Mastering Bay</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
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
        </div>
      )}

      {/* Step 3: Fixed Control Bar localized strictly to the bottom of the Multiplayer component */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-4 rounded-full border border-zinc-800/90 bg-zinc-900/90 px-6 py-3 shadow-2xl backdrop-blur-xl pointer-events-auto">
        {/* Mute Mic Button */}
        <button
          type="button"
          id="btn-multi-mute"
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`group flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer shadow-sm ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
              : 'bg-zinc-800 text-zinc-300 border border-zinc-700/60 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          {isMuted ? (
            <MicOff className="h-4 w-4 text-red-400" />
          ) : (
            <Mic className="h-4 w-4 text-zinc-300 group-hover:text-white" />
          )}
          <span>{isMuted ? 'Mic Muted' : 'Mute Mic'}</span>
        </button>

        {/* Record Mix Primary Button */}
        <div className="relative flex items-center gap-2">
          {isRecordingMixed && (
            <span className="font-mono text-xs font-bold text-red-500 animate-pulse pl-1">
              {formatTime(recordingTime)}
            </span>
          )}

          <button
            type="button"
            id="record-mixed-toggle-button"
            onClick={isRecordingMixed ? stopMixedRecording : startMixedRecording}
            aria-label={isRecordingMixed ? 'Stop recording mixed session' : 'Record Mixed Session'}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-xl cursor-pointer ${
              isRecordingMixed
                ? 'bg-red-600 text-white shadow-red-500/40 hover:bg-red-700 active:scale-95 animate-pulse'
                : 'bg-violet-600 text-white shadow-violet-600/40 hover:bg-violet-500 active:scale-95 hover:shadow-violet-600/60'
            }`}
          >
            {isRecordingMixed ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                <span>Stop Mix</span>
              </>
            ) : (
              <>
                <Disc className="h-4 w-4 fill-current" />
                <span>Record Mix</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 3: Standalone MasteringBay component handoff if not mounted under App-level modal */}
      {!onOpenMastering && !onRecordingFinished && (
        <MasteringBay
          isOpen={isMasteringOpen}
          onClose={() => setIsMasteringOpen(false)}
          audioBlob={mixedAudioBlob}
          recording_type="merged"
          durationMs={recordingTime * 1000}
          roomId={activeRoomKey}
        />
      )}
    </div>
  )
}

export default MultiplayerStudio
