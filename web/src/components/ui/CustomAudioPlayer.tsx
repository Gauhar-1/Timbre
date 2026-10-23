import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react'

export interface CustomAudioPlayerProps {
  src?: string | null
  blob?: Blob | null
  className?: string
  autoPlay?: boolean
  showVolume?: boolean
  showReset?: boolean
  onEnded?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  blob,
  className = '',
  autoPlay = false,
  showVolume = false,
  showReset = true,
  onEnded,
  onTimeUpdate,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [internalUrl, setInternalUrl] = useState<string | null>(null)

  // Manage Blob URL generation and cleanup
  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      setInternalUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    } else {
      setInternalUrl(null)
    }
  }, [blob])

  const audioSrc = internalUrl || src || undefined

  // Auto-play support on source change if specified
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    if (audioRef.current && audioSrc && autoPlay) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }, [audioSrc, autoPlay])

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00'
    const mins = Math.floor(secs / 60)
    const rem = Math.floor(secs % 60)
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  const togglePlayPause = () => {
    if (!audioRef.current || !audioSrc) return
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

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (!isSeeking) {
      setIsSeeking(true)
    }
  }

  const handleSeekCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const newTime = parseFloat((e.target as HTMLInputElement).value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
    setIsSeeking(false)
  }

  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
    }
  }

  const handleVolumeToggle = () => {
    if (!audioRef.current) return
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    audioRef.current.muted = nextMuted
  }

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || isSeeking) return
    const cur = audioRef.current.currentTime
    const dur = audioRef.current.duration || duration || 0
    setCurrentTime(cur)
    if (dur && dur !== duration) {
      setDuration(dur)
    }
    onTimeUpdate?.(cur, dur)
  }, [duration, isSeeking, onTimeUpdate])

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration
      if (!isNaN(dur) && isFinite(dur)) {
        setDuration(dur)
      }
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
    onEnded?.()
  }

  // Calculate seek percentage for custom gradient slider track
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-inner backdrop-blur-md ${className}`}
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
        preload="metadata"
      />

      {/* Play / Pause Primary Button */}
      <button
        type="button"
        onClick={togglePlayPause}
        disabled={!audioSrc}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current transition-transform group-hover:scale-95" />
        ) : (
          <Play className="h-4 w-4 fill-current translate-x-0.5 transition-transform group-hover:scale-105" />
        )}
      </button>

      {/* Waveform Scrubber / Range Slider */}
      <div className="flex-1 flex flex-col justify-center space-y-1">
        <div className="relative flex items-center w-full">
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            value={currentTime}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
            disabled={!audioSrc}
            className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-violet-500 hover:accent-violet-400 focus:outline-none transition-all disabled:opacity-40"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${progressPercent}%, #27272a ${progressPercent}%, #27272a 100%)`,
            }}
          />
        </div>

        {/* Current Time / Total Duration Display */}
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none">
          <span className="text-zinc-300 font-semibold">{formatTime(currentTime)}</span>
          <span className="text-zinc-500">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Auxiliary Controls */}
      <div className="flex items-center gap-1.5 pl-1 border-l border-zinc-800/80">
        {showReset && (
          <button
            type="button"
            onClick={handleReset}
            disabled={!audioSrc || currentTime === 0}
            title="Reset to beginning"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        {showVolume && (
          <button
            type="button"
            onClick={handleVolumeToggle}
            disabled={!audioSrc}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30 cursor-pointer"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-violet-400" />}
          </button>
        )}
      </div>
    </div>
  )
}

export default CustomAudioPlayer
