import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Clock,
} from 'lucide-react'
import { getClientId } from '../../services/client'
import { CustomAudioPlayer } from '../ui/CustomAudioPlayer'

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
  className?: string
  refreshTrigger?: number
  onCountChange?: (count: number) => void
  onSelectRecording?: (item: RecordingItem) => void
  isMobileDrawer?: boolean
  isOpen?: boolean
  onClose?: () => void
}

type FilterTab = 'all' | 'solo' | 'merged'

export const RecordingVault: React.FC<RecordingVaultProps> = ({
  className = '',
  refreshTrigger = 0,
  onCountChange,
  isMobileDrawer = false,
  isOpen = true,
  onClose,
}) => {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const currentClientId = typeof window !== 'undefined' ? localStorage.getItem('timbre_client_id') || getClientId() : ''

  // Accordion open states
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({})

  // Copy toast state
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Fetch recordings with client_id isolation
  const fetchRecordings = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const clientId = typeof window !== 'undefined'
        ? localStorage.getItem('timbre_client_id') || getClientId()
        : ''

      const url = `/api/recordings?client_id=${encodeURIComponent(clientId)}`

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to load vault items (${res.status})`)
      }
      const data = (await res.json()) as RecordingItem[]
      setRecordings(data)
      onCountChange?.(data.length)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching recordings'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial load and on refreshTrigger update
  useEffect(() => {
    fetchRecordings()
  }, [refreshTrigger])

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
      console.error('Failed to copy text:', err)
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
    return true
  })

  const vaultContent = (
    <div className={`flex flex-col h-full w-full bg-[#09090b] text-zinc-100 select-none overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-950/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400 border border-violet-500/25">
            <Archive className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-zinc-50 flex items-center gap-1.5">
              <span>Vault History</span>
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-400">
                {recordings.length}
              </span>
            </h2>
            <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[160px]" title={currentClientId}>
              ID: {currentClientId.substring(0, 10)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fetchRecordings}
            disabled={isLoading}
            title="Refresh history"
            aria-label="Refresh history"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isMobileDrawer && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer md:hidden"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/40 p-2.5 shrink-0">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`rounded-lg py-1 font-medium transition-all cursor-pointer text-center ${
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
            className={`rounded-lg py-1 font-medium transition-all cursor-pointer text-center ${
              filterTab === 'solo'
                ? 'bg-violet-600/20 text-violet-300 shadow-sm border border-violet-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Solo
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('merged')}
            className={`rounded-lg py-1 font-medium transition-all cursor-pointer text-center ${
              filterTab === 'merged'
                ? 'bg-emerald-600/20 text-emerald-300 shadow-sm border border-emerald-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mixes
          </button>
        </div>
      </div>

      {/* Scrollable Recordings Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 [scrollbar-width:thin]">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-400">
            {error}
          </div>
        )}

        {isLoading && recordings.length === 0 ? (
          <div className="space-y-2.5 pt-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-2 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="h-3 w-28 bg-zinc-800 rounded" />
                  <div className="h-3 w-12 bg-zinc-800 rounded-full" />
                </div>
                <div className="h-7 bg-zinc-800/70 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="py-12 text-center space-y-2 px-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500">
              <Archive className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-300">No isolated takes</h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Takes recorded in this browser session are persisted here.
            </p>
          </div>
        ) : (
          filteredRecordings.map((item) => {
            const isExpanded = Boolean(expandedAccordions[item.id])
            const durationSecs = item.duration_ms ? item.duration_ms / 1000 : 0

            return (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3 space-y-2.5 shadow hover:border-zinc-700/80 transition-all"
              >
                {/* Header: Title & Badge */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-100 tracking-tight leading-snug truncate" title={item.title}>
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 text-zinc-500" />
                        {formatDate(item.inserted_at)}
                      </span>
                      <span>•</span>
                      <span>{formatSeconds(durationSecs)}</span>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider border ${
                      item.recording_type === 'merged'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                    }`}
                  >
                    {item.recording_type === 'merged' ? 'Mix' : 'Solo'}
                  </span>
                </div>

                {/* Custom Audio Player with streaming and seek */}
                <CustomAudioPlayer
                  src={`/api/recordings/${item.id}/audio`}
                  showVolume={false}
                  showReset={false}
                  className="px-2.5 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-xs"
                />

                {/* Actions & Accordion Toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-850 text-[10px]">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(item.id)}
                    className="flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>AI Details</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  <a
                    href={`/api/recordings/${item.id}/audio`}
                    download={`timbre-${item.id}.webm`}
                    title="Download audio file"
                    className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    <span>Save</span>
                  </a>
                </div>

                {/* Expandable Accordion */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 pt-1 text-[11px]"
                    >
                      {item.summary && (
                        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-bold text-violet-400 uppercase tracking-wider">
                            <span>Summary</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(item.summary!, `sum-${item.id}`)}
                              className="text-zinc-400 hover:text-zinc-200 cursor-pointer flex items-center gap-0.5"
                            >
                              {copiedKey === `sum-${item.id}` ? (
                                <Check className="h-2.5 w-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-2.5 w-2.5" />
                              )}
                              <span>{copiedKey === `sum-${item.id}` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="text-zinc-300 text-[10px] leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                      )}

                      {item.transcript && (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                            <span>Transcript</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(item.transcript!, `tr-${item.id}`)}
                              className="text-zinc-400 hover:text-zinc-200 cursor-pointer flex items-center gap-0.5"
                            >
                              {copiedKey === `tr-${item.id}` ? (
                                <Check className="h-2.5 w-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-2.5 w-2.5" />
                              )}
                              <span>{copiedKey === `tr-${item.id}` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="text-zinc-400 text-[10px] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap [scrollbar-width:thin]">
                            {item.transcript}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  if (isMobileDrawer) {
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            />
            <div className="fixed inset-y-0 left-0 max-w-full flex z-50">
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-80 max-w-xs shadow-2xl h-full relative z-50"
              >
                {vaultContent}
              </motion.aside>
            </div>
          </div>
        )}
      </AnimatePresence>
    )
  }

  return vaultContent
}

export default RecordingVault
