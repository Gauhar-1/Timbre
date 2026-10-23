import React, { useRef, useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

export interface AudioWaveformProps {
  stream: MediaStream | null
  isActive?: boolean
  label?: string
  sublabel?: string
  isLocal?: boolean
  className?: string
  defaultVolume?: number
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  stream,
  isActive = true,
  label,
  sublabel,
  isLocal = false,
  className,
  defaultVolume = 0.85,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Remote audio output controls (only applicable when !isLocal)
  const [volume, setVolume] = useState<number>(defaultVolume)
  const [isRemoteMuted, setIsRemoteMuted] = useState<boolean>(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false)

  // Manage remote audio playback and volume
  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl || !stream) return

    // Attach stream to the audio element to activate decoding in Chromium
    audioEl.srcObject = stream

    if (isLocal) {
      // Local microphone must remain strictly muted to prevent immediate feedback/echo
      audioEl.muted = true
    } else {
      // Remote peers must be audible to the user's speakers/headphones
      audioEl.muted = isRemoteMuted
      audioEl.volume = isRemoteMuted ? 0 : volume

      audioEl
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => {
          console.warn('[AudioWaveform] Autoplay blocked, waiting for user gesture:', err)
          setAutoplayBlocked(true)
        })
    }
  }, [stream, isLocal, isRemoteMuted, volume])

  // Automatically attempt playback on first user click if autoplay was blocked
  useEffect(() => {
    if (isLocal || !autoplayBlocked) return
    const handleGesture = () => {
      if (audioRef.current && !isLocal) {
        audioRef.current
          .play()
          .then(() => setAutoplayBlocked(false))
          .catch(() => {})
      }
    }
    window.addEventListener('click', handleGesture, { once: true })
    return () => window.removeEventListener('click', handleGesture)
  }, [isLocal, autoplayBlocked])

  // Update volume and mute state on slider or toggle change
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol)
    if (newVol > 0 && isRemoteMuted) {
      setIsRemoteMuted(false)
    }
    if (audioRef.current && !isLocal) {
      audioRef.current.volume = newVol
      audioRef.current.muted = newVol === 0
    }
  }

  const handleToggleMute = () => {
    setIsRemoteMuted((prev) => {
      const next = !prev
      if (audioRef.current && !isLocal) {
        audioRef.current.muted = next
        if (!next && audioRef.current.paused) {
          audioRef.current.play().catch(() => {})
        }
      }
      return next
    })
  }

  // Web Audio Analyser visualization loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // If stream is not active or null, draw an idle baseline
    if (!stream || !isActive) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const width = canvas.clientWidth || 300
        const height = canvas.clientHeight || 100
        canvas.width = width
        canvas.height = height

        ctx.clearRect(0, 0, width, height)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#27272a'
        ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
      }
      return
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioCtx = new AudioCtx()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    let sourceNode: MediaStreamAudioSourceNode | null = null
    try {
      sourceNode = audioCtx.createMediaStreamSource(stream)
      // Visualizer connects ONLY to AnalyserNode, NOT to audioCtx.destination
      sourceNode.connect(analyser)
    } catch (err) {
      console.warn('[AudioWaveform] Failed to connect stream to analyser:', err)
    }

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    let animationFrameId: number

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw)

      const cvs = canvasRef.current
      if (!cvs) return
      const ctx = cvs.getContext('2d')
      if (!ctx) return

      const width = cvs.clientWidth
      const height = cvs.clientHeight
      if (cvs.width !== width || cvs.height !== height) {
        cvs.width = width
        cvs.height = height
      }

      analyser.getByteTimeDomainData(dataArray)

      ctx.clearRect(0, 0, width, height)

      ctx.lineWidth = 3
      ctx.strokeStyle = '#8b5cf6'
      ctx.shadowBlur = 10
      ctx.shadowColor = '#8b5cf6'

      ctx.beginPath()
      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(width, height / 2)
      ctx.stroke()
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (sourceNode) {
        sourceNode.disconnect()
      }
      analyser.disconnect()
      audioCtx.close().catch(() => {})
      if (audioRef.current) {
        audioRef.current.srcObject = null
      }
    }
  }, [stream, isActive])

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-lg backdrop-blur-md transition-all hover:border-zinc-700/80 ${
        className || 'h-36 sm:h-40 w-full'
      }`}
    >
      {/* Top Header Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              stream && isActive
                ? isLocal
                  ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-pulse'
                  : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                : 'bg-zinc-600'
            }`}
          />
          <span className="text-xs font-semibold text-zinc-200">
            {label || (isLocal ? 'Local Microphone' : 'Remote Peer')}
          </span>
          {isLocal && (
            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-400 uppercase">
              You
            </span>
          )}
        </div>

        {/* Status / Autoplay Button or Sublabel */}
        <div className="flex items-center gap-2">
          {!isLocal && autoplayBlocked && (
            <button
              type="button"
              onClick={() => {
                audioRef.current
                  ?.play()
                  .then(() => setAutoplayBlocked(false))
                  .catch(() => {})
              }}
              className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm hover:bg-violet-500 transition-all cursor-pointer animate-pulse"
            >
              🔊 Click to Hear
            </button>
          )}

          {sublabel && (
            <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[130px]">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      {/* Responsive Canvas + Audio Element */}
      <div className="relative flex-1 w-full my-2 flex items-center justify-center min-h-[60px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {/* Local mic is strictly muted; remote peer audio is unmuted and audible */}
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          muted={isLocal ? true : isRemoteMuted}
          className="hidden"
        />
      </div>

      {/* Bottom Info & Audio Controls */}
      <div className="relative z-10 flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-900/60 pt-2">
        <span className="font-mono">FFT: 2048 • Time-Domain</span>

        {!isLocal ? (
          /* Interactive Speaker Volume Control for Remote Peers */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              title={isRemoteMuted ? 'Unmute peer voice' : 'Mute peer voice'}
              aria-label={isRemoteMuted ? 'Unmute peer voice' : 'Mute peer voice'}
              className="text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              {isRemoteMuted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-violet-400" />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isRemoteMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 bg-zinc-800 rounded cursor-pointer accent-violet-500"
              title="Remote peer output volume"
            />

            <span className="font-mono text-zinc-300 w-8 text-right">
              {isRemoteMuted ? 'Off' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        ) : (
          <span className="font-medium text-zinc-500">
            {stream && isActive ? 'Local Mic (Self-muted to prevent feedback)' : 'Idle'}
          </span>
        )}
      </div>
    </div>
  )
}

export default AudioWaveform
