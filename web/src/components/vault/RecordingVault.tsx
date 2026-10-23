import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  X,
  Play,
  Pause,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  FileText,
  User,
  Clock,
} from 'lucide-react'
import { getClientId } from '../../services/client'

export interface RecordingItem {
  id: string
  title: string
  recording_type: 'solo' | 'merged'
  client_id?: string
  room_id?: string
  content_type?: string
  duration_ms?: number
  transcript?: string
  summary?: string
  inserted_at: string
  updated_at?: string
}

export interface RecordingVaultProps {
  isOpen: boolean
  onClose: () => void
  onSelectRecording?: (item: RecordingItem) => void
}

type FilterTab = 'all' | 'solo' | 'merged'

export const RecordingVault: React.FC<RecordingVaultProps> = ({ isOpen, onClose }) => {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [onlyThisBrowser, setOnlyThisBrowser] = useState<boolean>(false)
  const currentClientId = getClientId()

  // Audio Player State (Single-player singleton across list)
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Accordion open states
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({})

  // Copy toast state
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Fetch recordings from API
  const fetchRecordings = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/recordings')
      if (!res.ok) {
        throw new Error(`Failed to load vault items (${res.status})`)
      }
      const data = (await res.json()) as RecordingItem[]
      setRecordings(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching recordings'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // Load when vault drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchRecordings()
    } else {
      // Pause audio when drawer is closed
      if (audioRef.current) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }
  }, [isOpen])

  // Manage Audio element events
  const handleTogglePlay = (id: string, durationMs?: number) => {
    if (activePlayingId === id) {
      if (isPlaying) {
        audioRef.current?.pause()
        setIsPlaying(false)
      } else {
        audioRef.current
          ?.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false))
      }
    } else {
      // Switch track
      setActivePlayingId(id)
      setCurrentTime(0)
      setDuration(durationMs ? durationMs / 1000 : 0)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = `/api/recordings/${id}/audio`
        audioRef.current.load()
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false))
      }
    }
  }

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const toggleAccordion = (id: string) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60)
    const secs = Math.floor(totalSecs % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // Filtered list
  const filteredRecordings = recordings.filter((item) => {
    if (filterTab === 'solo' && item.recording_type !== 'solo') return false
    if (filterTab === 'merged' && item.recording_type !== 'merged') return false
    if (onlyThisBrowser && item.client_id !== currentClientId) return false
    return true
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-6">
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-screen max-w-md bg-[#09090b] border-l border-zinc-800 shadow-2xl flex flex-col text-zinc-100"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 bg-zinc-950/60 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400 border border-violet-500/25">
                    <Archive className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold tracking-tight text-zinc-50 flex items-center gap-2">
                      <span>Recording Vault</span>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                        {recordings.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Persistent SQLite audio takes & AI intelligence
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={fetchRecordings}
                    disabled={isLoading}
                    title="Refresh recordings"
                    aria-label="Refresh recordings"
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close vault"
                    aria-label="Close vault"
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs & Browser Owner Toggle */}
              <div className="border-b border-zinc-800/80 bg-zinc-950/40 p-3 space-y-2.5">
                {/* Segmented Filter Tabs */}
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`rounded-lg py-1.5 font-medium transition-all cursor-pointer text-center ${
                      filterTab === 'all'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All ({recordings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('solo')}
                    className={`rounded-lg py-1.5 font-medium transition-all cursor-pointer text-center ${
                      filterTab === 'solo'
                        ? 'bg-violet-600/20 text-violet-300 shadow-sm border border-violet-500/30 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Solo Tracks
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('merged')}
                    className={`rounded-lg py-1.5 font-medium transition-all cursor-pointer text-center ${
                      filterTab === 'merged'
                        ? 'bg-emerald-600/20 text-emerald-300 shadow-sm border border-emerald-500/30 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Multiplayer Mixes
                  </button>
                </div>

                {/* Only This Browser Toggle */}
                <div className="flex items-center justify-between px-1 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <User className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Only This Browser ({currentClientId.substring(0, 10)}...)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlyThisBrowser((prev) => !prev)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      onlyThisBrowser ? 'bg-violet-600' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        onlyThisBrowser ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Scrollable Recordings List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 [scrollbar-width:thin]">
                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                    {error}
                  </div>
                )}

                {isLoading && recordings.length === 0 ? (
                  <div className="space-y-3 pt-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3 animate-pulse"
                      >
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-32 bg-zinc-800 rounded" />
                          <div className="h-4 w-16 bg-zinc-800 rounded-full" />
                        </div>
                        <div className="h-8 bg-zinc-800/70 rounded-xl" />
                      </div>
                    ))}
                  </div>
                ) : filteredRecordings.length === 0 ? (
                  <div className="py-14 text-center space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
                      <Archive className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-300">No recordings found</h3>
                    <p className="text-xs text-zinc-400 max-w-[260px] mx-auto">
                      {onlyThisBrowser
                        ? 'No recordings associated with this browser client ID.'
                        : 'Record a solo track or multiplayer session to start building your studio vault.'}
                    </p>
                  </div>
                ) : (
                  filteredRecordings.map((item) => {
                    const isItemPlaying = activePlayingId === item.id && isPlaying
                    const isExpanded = Boolean(expandedAccordions[item.id])
                    const isOwner = item.client_id === currentClientId
                    const durationSecs = item.duration_ms
                      ? item.duration_ms / 1000
                      : duration || 0

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3 shadow-md hover:border-zinc-700/80 transition-all"
                      >
                        {/* Card Header: Title & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-zinc-100 tracking-tight leading-snug">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-zinc-500" />
                                {formatDate(item.inserted_at)}
                              </span>
                              <span>•</span>
                              <span>{formatSeconds(durationSecs)}</span>
                              {isOwner && (
                                <>
                                  <span>•</span>
                                  <span className="rounded bg-violet-500/10 px-1.5 py-0.2 text-[9px] font-bold text-violet-400">
                                    You
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                              item.recording_type === 'merged'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            }`}
                          >
                            {item.recording_type === 'merged' ? 'Merged Mix' : 'Solo'}
                          </span>
                        </div>

                        {/* Custom Play/Pause Audio Controller */}
                        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 p-2.5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleTogglePlay(item.id, item.duration_ms)}
                            aria-label={isItemPlaying ? 'Pause audio' : 'Play audio'}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow hover:bg-violet-500 transition-all cursor-pointer"
                          >
                            {isItemPlaying ? (
                              <Pause className="h-4 w-4 fill-current" />
                            ) : (
                              <Play className="h-4 w-4 fill-current translate-x-0.5" />
                            )}
                          </button>

                          {/* Seek bar when active */}
                          {activePlayingId === item.id ? (
                            <div className="flex-1 space-y-1">
                              <input
                                type="range"
                                min="0"
                                max={duration || durationSecs || 1}
                                step="0.05"
                                value={currentTime}
                                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-violet-500"
                              />
                              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                                <span>{formatSeconds(currentTime)}</span>
                                <span>{formatSeconds(duration || durationSecs)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-between text-xs text-zinc-400 px-1">
                              <span className="font-mono text-[11px]">Audio Stream</span>
                              <span className="font-mono text-[11px]">
                                {formatSeconds(durationSecs)}
                              </span>
                            </div>
                          )}

                          {/* Direct Download Button */}
                          <a
                            href={`/api/recordings/${item.id}/audio`}
                            download={`timbre-${item.id}.webm`}
                            title="Download audio file"
                            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>

                        {/* Expandable Accordion for AI Summary & Transcript */}
                        <div className="border-t border-zinc-800/60 pt-2">
                          <button
                            type="button"
                            onClick={() => toggleAccordion(item.id)}
                            className="flex w-full items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer py-1"
                          >
                            <span className="flex items-center gap-1.5 text-violet-400">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>AI Intelligence & Transcript</span>
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 pt-2 text-xs"
                              >
                                {/* AI Executive Summary */}
                                {item.summary ? (
                                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" />
                                        Executive Summary
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopyText(item.summary!, `sum-${item.id}`)
                                        }
                                        className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                      >
                                        {copiedKey === `sum-${item.id}` ? (
                                          <>
                                            <Check className="h-3 w-3 text-emerald-400" />
                                            <span className="text-emerald-400">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-3 w-3" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    <p className="text-zinc-300 leading-relaxed font-sans text-xs">
                                      {item.summary}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5 text-zinc-500 italic text-[11px]">
                                    No AI summary generated for this take.
                                  </div>
                                )}

                                {/* Full Transcript */}
                                {item.transcript ? (
                                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        Full Transcript
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopyText(item.transcript!, `tr-${item.id}`)
                                        }
                                        className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                      >
                                        {copiedKey === `tr-${item.id}` ? (
                                          <>
                                            <Check className="h-3 w-3 text-emerald-400" />
                                            <span className="text-emerald-400">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-3 w-3" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    <p className="text-zinc-400 leading-relaxed font-sans text-xs max-h-48 overflow-y-auto whitespace-pre-wrap pr-1 [scrollbar-width:thin]">
                                      {item.transcript}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5 text-zinc-500 italic text-[11px]">
                                    No transcript recorded for this take.
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Hidden Global Audio Element driving playback */}
              <audio
                ref={audioRef}
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime)
                  }
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDuration(audioRef.current.duration || 0)
                  }
                }}
                onEnded={() => {
                  setIsPlaying(false)
                  setCurrentTime(0)
                }}
                className="hidden"
              />
            </motion.aside>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default RecordingVault
