import React, { useRef, useEffect } from 'react'

export interface AudioWaveformProps {
  stream: MediaStream | null
  isActive?: boolean
  label?: string
  sublabel?: string
  isLocal?: boolean
  className?: string
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  stream,
  isActive = true,
  label,
  sublabel,
  isLocal = false,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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

    // Step 2: Web Audio Hook & Routing
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
      // Crucial Routing: Do NOT connect analyser to audioCtx.destination to prevent feedback loops
      sourceNode.connect(analyser)
    } catch (err) {
      console.warn('[AudioWaveform] Failed to connect stream to analyser:', err)
    }

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    let animationFrameId: number

    // Step 3: requestAnimationFrame Loop
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

      // Clear the canvas context on every frame
      ctx.clearRect(0, 0, width, height)

      // Style the stroke: lineWidth = 3, strokeStyle = '#8b5cf6' with subtle glow
      ctx.lineWidth = 3
      ctx.strokeStyle = '#8b5cf6'
      ctx.shadowBlur = 10
      ctx.shadowColor = '#8b5cf6'

      // Draw the waveform using ctx.beginPath(), ctx.lineTo(), and ctx.stroke()
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

    // Proper cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      if (sourceNode) {
        sourceNode.disconnect()
      }
      analyser.disconnect()
      audioCtx.close().catch(() => {})
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

        {sublabel && (
          <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[140px]">
            {sublabel}
          </span>
        )}
      </div>

      {/* Step 1: Responsive Canvas */}
      <div className="relative flex-1 w-full my-2 flex items-center justify-center min-h-[60px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Bottom info pill */}
      <div className="relative z-10 flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-900/60 pt-2">
        <span className="font-mono">FFT: 2048 • Time-Domain</span>
        <span className="font-medium text-violet-400/90">
          {stream && isActive ? 'Signal Live' : 'Idle'}
        </span>
      </div>
    </div>
  )
}

export default AudioWaveform
