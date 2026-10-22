import React from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

export const RecorderUI: React.FC = () => {
  const {
    startRecording,
    stopRecording,
    isRecording,
    audioBlob,
    audioUrl,
    recordingTime,
    error,
    resetRecording,
  } = useAudioRecorder()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-canvas-soft/80 p-8 shadow-sm backdrop-blur transition-all">
        {/* Subtle accent gradient glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
            isRecording ? 'bg-red-500/15 opacity-100' : 'bg-link/10 opacity-60'
          }`}
        />

        {/* Header section */}
        <div className="relative flex flex-col items-center text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-mute">
            Audio Studio
          </span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Voice Recorder
          </h2>
          <p className="mt-1.5 text-sm text-mute">
            Capture crystal-clear microphone audio directly in your browser.
          </p>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-500">
            {error}
          </div>
        )}

        {/* Central Record / Stop Interactive Area */}
        <div className="relative my-8 flex flex-col items-center justify-center">
          {/* Pulsing ring animation while recording */}
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <span className="absolute inline-flex h-28 w-28 animate-ping rounded-full bg-red-500/30 opacity-75" />
            )}

            {/* Large Record / Stop Toggle Button */}
            <button
              type="button"
              id="record-toggle-button"
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              className={`group relative z-10 flex h-24 w-24 items-center justify-center rounded-full border shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 ${
                isRecording
                  ? 'border-red-500/40 bg-red-600 text-white shadow-red-500/30 hover:bg-red-700 focus:ring-red-500/30 active:scale-95'
                  : 'border-hairline bg-ink text-canvas hover:scale-105 hover:bg-ink/90 focus:ring-link/30 active:scale-95'
              }`}
            >
              {isRecording ? (
                // Stop square icon
                <div className="h-7 w-7 rounded-md bg-white transition-transform group-hover:scale-95" />
              ) : (
                // Record red circular icon
                <div className="h-7 w-7 rounded-full bg-red-500 transition-transform group-hover:scale-110" />
              )}
            </button>
          </div>

          {/* Status Label & Timer */}
          <div className="mt-5 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isRecording ? 'animate-pulse bg-red-500' : 'bg-mute/60'
                }`}
              />
              <span className="text-sm font-semibold tracking-wide text-ink">
                {isRecording ? 'Recording Live...' : audioUrl ? 'Recording Ready' : 'Ready to Record'}
              </span>
            </div>

            {isRecording ? (
              <span className="font-mono text-2xl font-bold tracking-tight text-red-500">
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-xs text-mute">
                {audioUrl ? 'Review playback below or record a new take' : 'Click the button above to begin'}
              </span>
            )}
          </div>
        </div>

        {/* Playback & Audio Details Section */}
        {audioUrl && (
          <div className="relative mt-6 rounded-xl border border-hairline bg-canvas p-5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-ink">Audio Playback</span>
              {audioBlob && (
                <div className="flex items-center gap-2 text-[11px] text-mute font-mono">
                  <span>{formatBytes(audioBlob.size)}</span>
                  <span>•</span>
                  <span>{audioBlob.type || 'audio/webm'}</span>
                </div>
              )}
            </div>

            {/* Native HTML audio element as required */}
            <audio
              src={audioUrl}
              controls
              className="mt-4 w-full rounded-lg outline-none"
            />

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-hairline">
              <span className="text-xs text-mute">Satisfied with this take?</span>
              <button
                type="button"
                onClick={resetRecording}
                className="text-xs font-medium text-mute hover:text-ink transition-colors cursor-pointer"
              >
                Clear Recording
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecorderUI
