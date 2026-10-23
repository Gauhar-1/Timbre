import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Disc, Square, Sliders, Sparkles, Volume2, Shield } from 'lucide-react'
import { cn } from '../../lib/utils'

export type DspEffectType = 'normalize' | 'echo' | 'anonymize'

export interface FloatingDockProps {
  isRecording: boolean
  onRecordToggle: () => void
  isMuted?: boolean
  onMuteToggle?: () => void
  activeEffect?: DspEffectType | null
  onApplyEffect?: (effect: DspEffectType) => void
  isEffectsOpen?: boolean
  onToggleEffectsMenu?: () => void
  recordingTime?: number
  isProcessing?: boolean
  className?: string
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  isRecording,
  onRecordToggle,
  isMuted = false,
  onMuteToggle,
  activeEffect = null,
  onApplyEffect,
  isEffectsOpen: controlledEffectsOpen,
  onToggleEffectsMenu,
  recordingTime = 0,
  isProcessing = false,
  className,
}) => {
  const [internalEffectsOpen, setInternalEffectsOpen] = useState(false)
  const isMenuOpen = controlledEffectsOpen !== undefined ? controlledEffectsOpen : internalEffectsOpen

  const handleEffectsToggle = () => {
    if (onToggleEffectsMenu) {
      onToggleEffectsMenu()
    } else {
      setInternalEffectsOpen((prev) => !prev)
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed z-50 bottom-0 left-0 right-0 flex justify-center pointer-events-none px-0 sm:px-4 sm:bottom-6">
      {/* DSP Effects Popover Menu floating directly above the dock */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute bottom-24 sm:bottom-28 z-50 w-72 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span>DSP Effects</span>
              </div>
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                Rust WASM
              </span>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                id="dock-effect-normalize"
                disabled={isProcessing}
                onClick={() => {
                  onApplyEffect?.('normalize')
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer',
                  activeEffect === 'normalize'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-violet-400" />
                  <span className="font-medium">Normalize</span>
                </div>
                <span className="text-[10px] text-zinc-400">Peak 0.95</span>
              </button>

              <button
                type="button"
                id="dock-effect-echo"
                disabled={isProcessing}
                onClick={() => {
                  onApplyEffect?.('echo')
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer',
                  activeEffect === 'echo'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="font-medium">Echo Delay</span>
                </div>
                <span className="text-[10px] text-zinc-400">240ms loop</span>
              </button>

              <button
                type="button"
                id="dock-effect-anonymize"
                disabled={isProcessing}
                onClick={() => {
                  onApplyEffect?.('anonymize')
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer',
                  activeEffect === 'anonymize'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-violet-400" />
                  <span className="font-medium">Anonymize</span>
                </div>
                <span className="text-[10px] text-zinc-400">Scramble</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Pill Dock */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className={cn(
          'pointer-events-auto relative flex items-center justify-center gap-6 sm:gap-8',
          // Desktop: Floating Pill
          'sm:rounded-full sm:border sm:border-zinc-800 sm:px-6 sm:py-4 sm:shadow-2xl',
          // Mobile: Full width snapping to bottom with rounded-t-3xl and rounded-b-none
          'w-full max-w-none rounded-t-3xl rounded-b-none border-t border-zinc-800 px-6 py-4 shadow-2xl sm:w-auto sm:max-w-md',
          // Background & Glassmorphism
          'bg-zinc-900/80 backdrop-blur-xl',
          className
        )}
      >
        {/* Button 1: Mute / Unmute */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          type="button"
          id="dock-btn-mute"
          onClick={onMuteToggle}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={cn(
            'group relative flex h-12 w-12 items-center justify-center rounded-full transition-all cursor-pointer',
            isMuted
              ? 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
              : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:text-white'
          )}
        >
          {isMuted ? (
            <MicOff className="h-5 w-5 transition-transform group-hover:scale-105" />
          ) : (
            <Mic className="h-5 w-5 transition-transform group-hover:scale-105" />
          )}
        </motion.button>

        {/* Button 2: Prominent Primary Record Button */}
        <div className="relative flex items-center justify-center">
          {/* Subtle live indicator rings when recording */}
          {isRecording && (
            <span className="absolute -inset-1 rounded-full bg-red-500/30 animate-ping opacity-60" />
          )}

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            id="dock-btn-record"
            onClick={onRecordToggle}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
            className={cn(
              'group relative z-10 flex h-16 w-16 items-center justify-center rounded-full transition-all cursor-pointer border-2',
              isRecording
                ? 'bg-red-600 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse'
                : 'bg-violet-600 hover:bg-violet-500 text-white border-violet-400/60 shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:shadow-[0_0_25px_rgba(139,92,246,0.8)]'
            )}
          >
            {isRecording ? (
              <Square className="h-6 w-6 fill-current transition-transform group-hover:scale-95" />
            ) : (
              <Disc className="h-7 w-7 transition-transform group-hover:scale-110" />
            )}
          </motion.button>

          {/* Floating live recording timer badge */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -top-7 rounded-full bg-red-600/90 px-2 py-0.5 font-mono text-[10px] font-bold tracking-tight text-white shadow-md"
            >
              {formatTimer(recordingTime)}
            </motion.div>
          )}
        </div>

        {/* Button 3: DSP Effects Menu Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          type="button"
          id="dock-btn-effects"
          onClick={handleEffectsToggle}
          title="Toggle DSP Effects Menu"
          aria-label="Toggle DSP Effects Menu"
          className={cn(
            'group relative flex h-12 w-12 items-center justify-center rounded-full transition-all cursor-pointer',
            isMenuOpen
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
              : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:text-white'
          )}
        >
          <Sliders className="h-5 w-5 transition-transform group-hover:scale-105" />
          {activeEffect && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-violet-500 ring-2 ring-zinc-900" />
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}

export default FloatingDock
