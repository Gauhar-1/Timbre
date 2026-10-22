import { useEffect, useState } from 'react'
import init, { rms_level } from 'timbre_kit'
import { RecorderUI } from './components/RecorderUI'

export default function App() {
  const [wasmOk, setWasmOk] = useState(false)
  const [apiOk, setApiOk] = useState(false)

  // Boot WASM and confirm it runs (RMS of a full-scale signal ≈ 1).
  useEffect(() => {
    init()
      .then(() => setWasmOk(rms_level(new Float32Array([1, -1, 1, -1])) > 0.99))
      .catch(() => setWasmOk(false))
  }, [])

  // Reach the Phoenix API through the dev proxy.
  useEffect(() => {
    fetch('/api/hello')
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false))
  }, [])

  const Dot = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-mute">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-link' : 'bg-hairline-strong'}`} />
      {label}
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
          <div className="flex items-center gap-4">
            <Dot ok={wasmOk} label="WASM" />
            <Dot ok={apiOk} label="API" />
          </div>
        </div>
      </header>

      {/* Main recording studio container */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <RecorderUI />
      </main>
    </div>
  )
}
