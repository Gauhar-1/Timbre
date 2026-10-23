import { useEffect, useState, useCallback } from 'react'
import init, { rms_level } from 'timbre_kit'
import { Archive } from 'lucide-react'
import { StudioLayout } from './components/layout/StudioLayout'
import { FloatingDock, DspEffectType } from './components/layout/FloatingDock'
import { RecorderUI } from './components/RecorderUI'
import { MultiplayerStudio } from './components/MultiplayerStudio'
import { MasteringModalOrDrawer } from './components/mastering/MasteringModalOrDrawer'
import { RecordingVault } from './components/vault/RecordingVault'
import { getClientId, getUrlRoomId, setUrlRoomId } from './services/client'

type StudioMode = 'solo' | 'multiplayer'

interface MasteringSession {
  blob: Blob
  recordingType: 'solo' | 'merged'
  durationMs: number
  roomId?: string
}

export default function App() {
  const [wasmOk, setWasmOk] = useState(false)
  const [apiOk, setApiOk] = useState(false)
  const [mode, setMode] = useState<StudioMode>('solo')
  const [roomId, setRoomId] = useState<string>('lobby')

  // Dock & Recording states
  const [isMuted, setIsMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [activeEffect, setActiveEffect] = useState<DspEffectType | null>(null)

  // Mastering Bay & Vault Modals
  const [isMasteringOpen, setIsMasteringOpen] = useState(false)
  const [masteringSession, setMasteringSession] = useState<MasteringSession | null>(null)
  const [isVaultOpen, setIsVaultOpen] = useState(false)
  const [vaultCount, setVaultCount] = useState<number | null>(null)

  // Boot WASM and verify client UUID
  useEffect(() => {
    getClientId() // ensures UUID exists in localStorage['timbre_client_id']
    init()
      .then(() => setWasmOk(rms_level(new Float32Array([1, -1, 1, -1])) > 0.99))
      .catch(() => setWasmOk(false))
  }, [])

  // Check URL query parameters for ?room=<id>
  useEffect(() => {
    const urlRoom = getUrlRoomId()
    if (urlRoom) {
      setRoomId(urlRoom)
      setMode('multiplayer')
    }
  }, [])

  // Keep URL updated when mode changes
  const handleModeChange = (newMode: StudioMode) => {
    setMode(newMode)
    if (newMode === 'multiplayer') {
      setUrlRoomId(roomId)
    } else {
      setUrlRoomId(null)
    }
  }

  // Reach the Phoenix API through dev proxy and poll recording count
  useEffect(() => {
    const checkApi = () => {
      fetch('/api/hello')
        .then((r) => setApiOk(r.ok))
        .catch(() => setApiOk(false))

      fetch('/api/recordings')
        .then((r) => (r.ok ? r.json() : []))
        .then((data: unknown[]) => setVaultCount(data.length))
        .catch(() => {})
    }
    checkApi()
    const interval = setInterval(checkApi, 4000)
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

  // Trigger Mastering Modal automatically upon recording completion
  const handleSoloRecordingFinished = useCallback((blob: Blob, durationMs: number) => {
    setMasteringSession({
      blob,
      recordingType: 'solo',
      durationMs,
    })
    setIsMasteringOpen(true)
  }, [])

  const handleMultiRecordingFinished = useCallback(
    (blob: Blob, durationMs: number, activeRoom: string) => {
      setMasteringSession({
        blob,
        recordingType: 'merged',
        durationMs,
        roomId: activeRoom,
      })
      setIsMasteringOpen(true)
    },
    []
  )

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

  // Sleek segmented pill mode switcher (Solo Recorder vs Multiplayer Room)
  const modeSwitcher = (
    <div className="inline-flex rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-1 shadow-sm backdrop-blur-md">
      <button
        type="button"
        id="tab-solo-recorder"
        onClick={() => handleModeChange('solo')}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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
        onClick={() => handleModeChange('multiplayer')}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
          mode === 'multiplayer'
            ? 'bg-zinc-800 text-violet-300 shadow-sm ring-1 ring-violet-500/40'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <span>🎧</span>
        <span className="hidden xs:inline">Multiplayer Live Mixer</span>
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

          {/* Categorized Recording Vault Trigger Button */}
          <button
            type="button"
            id="nav-vault-button"
            onClick={() => setIsVaultOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer shadow-sm hover:border-zinc-700"
          >
            <Archive className="h-3.5 w-3.5 text-violet-400" />
            <span className="hidden sm:inline">Vault</span>
            {vaultCount !== null && (
              <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.2 text-[10px] font-mono text-violet-300 font-bold">
                {vaultCount}
              </span>
            )}
          </button>
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
        {mode === 'solo' ? (
          <RecorderUI
            onRecordingFinished={handleSoloRecordingFinished}
            onOpenMastering={(blob, durationMs) => {
              setMasteringSession({ blob, recordingType: 'solo', durationMs })
              setIsMasteringOpen(true)
            }}
          />
        ) : (
          <MultiplayerStudio
            roomId={roomId}
            onRecordingFinished={handleMultiRecordingFinished}
            onOpenMastering={(blob, durationMs, rId) => {
              setMasteringSession({
                blob,
                recordingType: 'merged',
                durationMs,
                roomId: rId,
              })
              setIsMasteringOpen(true)
            }}
          />
        )}
      </div>

      {/* Unified Post-Recording Mastering & AI Bay Modal */}
      <MasteringModalOrDrawer
        isOpen={isMasteringOpen}
        onClose={() => setIsMasteringOpen(false)}
        audioBlob={masteringSession?.blob || null}
        recordingType={masteringSession?.recordingType || 'solo'}
        durationMs={masteringSession?.durationMs || 0}
        roomId={masteringSession?.roomId}
        onOpenVault={() => {
          setIsMasteringOpen(false)
          setIsVaultOpen(true)
        }}
        onSavedSuccess={() => {
          // Increment or refresh recordings count
          setVaultCount((prev) => (prev !== null ? prev + 1 : 1))
        }}
      />

      {/* Categorized Recording Vault Drawer */}
      <RecordingVault
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
      />
    </StudioLayout>
  )
}
