import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Check } from 'lucide-react'
import { getGroqApiKey, setGroqApiKey } from '../../services/ai'

export interface GroqApiKeyInputProps {
  className?: string
  onKeyChange?: (key: string) => void
}

export const GroqApiKeyInput: React.FC<GroqApiKeyInputProps> = ({
  className = '',
  onKeyChange,
}) => {
  const [groqKey, setGroqKey] = useState<string>(() => getGroqApiKey())
  const [isOpen, setIsOpen] = useState(false)
  const [tempKey, setTempKey] = useState<string>(() => getGroqApiKey())
  const [showSavedFeedback, setShowSavedFeedback] = useState(false)

  // Sync with global storage changes or external updates
  useEffect(() => {
    const syncKey = () => {
      const current = getGroqApiKey()
      setGroqKey(current)
      setTempKey(current)
    }

    window.addEventListener('groq_key_changed', syncKey)
    window.addEventListener('storage', syncKey)
    return () => {
      window.removeEventListener('groq_key_changed', syncKey)
      window.removeEventListener('storage', syncKey)
    }
  }, [])

  const handleSave = (val: string) => {
    const trimmed = val.trim()
    setGroqKey(trimmed)
    setGroqApiKey(trimmed)
    onKeyChange?.(trimmed)
    setIsOpen(false)
    setShowSavedFeedback(true)
    setTimeout(() => setShowSavedFeedback(false), 2000)
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="status-pill"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            type="button"
            id="groq-pill-trigger"
            onClick={() => {
              setTempKey(groqKey)
              setIsOpen(true)
            }}
            title={groqKey ? 'Groq API Key Configured (Click to edit)' : 'Configure Groq API Key for Whisper/Llama'}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm border ${
              showSavedFeedback
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                : groqKey
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/30 hover:bg-violet-500/25 hover:border-violet-500/50'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/80 hover:text-white'
            }`}
          >
            {showSavedFeedback ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            )}
            <span className="truncate max-w-[140px] sm:max-w-none">
              {showSavedFeedback
                ? 'Saved!'
                : groqKey
                  ? 'Groq Key Active'
                  : 'Configure Groq'}
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="input-form"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="flex items-center gap-1.5 overflow-hidden rounded-xl border border-violet-500/40 bg-zinc-900/95 px-2.5 py-1 shadow-2xl backdrop-blur-xl"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <input
              type="password"
              placeholder="gsk_..."
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave(tempKey)
                } else if (e.key === 'Escape') {
                  setIsOpen(false)
                }
              }}
              id="groq-key-input"
              className="bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none w-36 sm:w-48 font-mono"
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleSave(tempKey)}
              className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500 transition-colors shadow cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GroqApiKeyInput
