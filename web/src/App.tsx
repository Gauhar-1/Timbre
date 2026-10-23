import { useEffect, useState } from 'react'
import init, { rms_level } from 'timbre_kit'
import { StudioLayout } from './components/layout/StudioLayout'
import { FloatingDock, DspEffectType } from './components/layout/FloatingDock'
import { RecorderUI } from './components/RecorderUI'
import { MultiplayerStudio } from './components/MultiplayerStudio'

type StudioMode = 'solo' | 'multiplayer'

export default function App() {
  const [wasmOk, setWasmOk] = useState(false)
  const [apiOk, setApiOk] = useState(false)
  const [mode, setMode] = useState<StudioMode>('solo')
  const [isMuted, setIsMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [activeEffect, setActiveEffect] = useState<DspEffectType | null>(null)

  // Boot WASM and confirm it runs (RMS of a full-scale signal ≈ 1).
  useEffect(() => {
    init()
      .then(() => setWasmOk(rms_level(new Float32Array([1, -1, 1, -1])) > 0.99))
      .catch(() => setWasmOk(false))
  }, [])

  // Reach the Phoenix API through the dev proxy.
  useEffect(() => {
    const checkApi = () => {
      fetch('/api/hello')
        .then((r) => setApiOk(r.ok))
        .catch(() => setApiOk(false))
    }
    checkApi()
    const interval = setInterval(checkApi, 3000)
    return () => clearInterval(interval)
  }, [])

  // Observe active recording status from mounted components
  useEffect(() => {
    const checkState = () => {
      const soloBtn = document.getElementById('record-toggle-button')
      const multiBtn = document.getElementById('record-mixed-toggle-button')
      const isSoloRec = soloBtn?.getAttribute('aria-label') === 'Stop recording'
      const isMultiRec = multiBtn?.getAttribute('aria-label') === 'Stop recording mixed session'
      setIsRecording(Boolean(isSoloRec || isMultiRec))
    }
    const interval = setInterval(checkState, 200)
    return () => clearInterval(interval)
  }, [mode])

  // Track recording timer
  useEffect(() => {
    let timer: number | null = null
    if (isRecording) {
      const start = Date.now()
      timer = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - start) / 1000))
      }, 500)
    } else {
      setRecordingTime(0)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isRecording])

  const handleRecordToggle = () => {
    if (mode === 'solo') {
      const btn = document.getElementById('record-toggle-button')
      btn?.click()
    } else {
      const btn = document.getElementById('record-mixed-toggle-button')
      btn?.click()
    }
  }

  const handleApplyEffect = (effect: DspEffectType) => {
    setActiveEffect(effect)
    const btn = document.getElementById(`btn-effect-${effect}`)
    btn?.click()
  }

  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev)
  }

  const Dot = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span
        className={`h-2 w-2 rounded-full transition-colors ${
          ok ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-400'
        }`}
      />
      <span className={ok ? 'text-zinc-200 font-medium' : 'text-zinc-500'}>{label}</span>
      {!ok && label === 'Phoenix API' && (
        <span className="text-[10px] text-amber-400 font-mono">(run docker)</span>
      )}
    </span>
  )

  const modeSwitcher = (
    <div className="inline-flex rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-1 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        id="tab-solo-recorder"
        onClick={() => setMode('solo')}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
          mode === 'solo'
            ? 'bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-zinc-700/60'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <span>🎙️</span>
        <span className="hidden xs:inline">Solo Studio</span>
      </button>

      <button
        type="button"
        id="tab-multiplayer-mixer"
        onClick={() => setMode('multiplayer')}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
          mode === 'multiplayer'
            ? 'bg-zinc-800 text-violet-300 shadow-sm ring-1 ring-violet-500/30'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <span>🎧</span>
        <span className="hidden xs:inline">Multiplayer Mixer</span>
        <span className="rounded bg-violet-500/10 px-1 py-0.2 text-[9px] font-bold text-violet-400 uppercase">
          Part 3
        </span>
      </button>
    </div>
  )

  return (
    <StudioLayout
      title="timbre"
      isConnected={wasmOk}
      connectedLabel={wasmOk ? 'WASM Ready' : 'Initializing'}
      navActions={modeSwitcher}
      statusExtras={
        <div className="flex items-center gap-3">
          <Dot ok={wasmOk} label="Rust WASM" />
          <Dot ok={apiOk} label="Phoenix API" />
        </div>
      }
      dock={
        <FloatingDock
          isRecording={isRecording}
          onRecordToggle={handleRecordToggle}
          isMuted={isMuted}
          onMuteToggle={handleMuteToggle}
          activeEffect={activeEffect}
          onApplyEffect={handleApplyEffect}
          recordingTime={recordingTime}
        />
      }
    >
      {/* Studio Content centered within the Center Stage */}
      <div className="w-full flex flex-col items-center justify-center">
        {mode === 'solo' ? <RecorderUI /> : <MultiplayerStudio />}
      </div>
    </StudioLayout>
  )
}
