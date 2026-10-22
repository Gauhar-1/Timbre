import { useEffect, useState } from 'react'
import init, { rms_level } from 'timbre_kit'
import { RecorderUI } from './components/RecorderUI'
import { MultiplayerStudio } from './components/MultiplayerStudio'

type StudioMode = 'solo' | 'multiplayer'

export default function App() {
  const [wasmOk, setWasmOk] = useState(false)
  const [apiOk, setApiOk] = useState(false)
  const [mode, setMode] = useState<StudioMode>('solo')

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

  const Dot = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-mute">
      <span
        className={`h-2 w-2 rounded-full transition-colors ${
          ok ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-400'
        }`}
      />
      <span className={ok ? 'text-ink font-medium' : 'text-mute'}>{label}</span>
      {!ok && label === 'API' && (
        <span className="text-[10px] text-amber-500 font-mono">(run docker)</span>
      )}
    </span>
  )

  return (
    <div className="min-h-screen bg-canvas text-body">
      {/* Top navigation / status header */}
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-ink text-lg">timbre</span>
            <span className="rounded-md border border-hairline px-2 py-0.5 text-[10px] font-medium text-mute uppercase tracking-wider">
              Studio
            </span>
          </div>

          <div className="flex items-center gap-5">
            <Dot ok={wasmOk} label="Rust WASM" />
            <Dot ok={apiOk} label="Phoenix API" />
          </div>
        </div>
      </header>

      {/* Main recording studio container */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Prominent Mode Switcher Banner */}
        <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="inline-flex rounded-xl border border-hairline bg-canvas-soft/80 p-1.5 shadow-sm">
            <button
              type="button"
              id="tab-solo-recorder"
              onClick={() => setMode('solo')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                mode === 'solo'
                  ? 'bg-canvas text-ink shadow-sm ring-1 ring-hairline'
                  : 'text-mute hover:text-ink'
              }`}
            >
              <span className="text-base">🎙️</span>
              <span>Solo Recorder & DSP</span>
            </button>

            <button
              type="button"
              id="tab-multiplayer-mixer"
              onClick={() => setMode('multiplayer')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                mode === 'multiplayer'
                  ? 'bg-canvas text-link shadow-sm ring-1 ring-link/20'
                  : 'text-mute hover:text-ink'
              }`}
            >
              <span className="text-base">🎧</span>
              <span>Audio Mixture & Multiplayer</span>
              <span className="rounded bg-link/10 px-1.5 py-0.5 text-[9px] font-bold text-link uppercase tracking-wider">
                Part 3
              </span>
            </button>
          </div>
        </div>

        {/* Studio Content */}
        {mode === 'solo' ? <RecorderUI /> : <MultiplayerStudio />}
      </main>
    </div>
  )
}
