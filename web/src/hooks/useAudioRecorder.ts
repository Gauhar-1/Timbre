import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>
  stopRecording: () => void
  isRecording: boolean
  audioBlob: Blob | null
  audioUrl: string | null
  audioChunks: Blob[]
  recordingTime: number
  error: string | null
  resetRecording: () => void
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  // Revoke object URL on unmount or when URL changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [audioUrl])

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      // Clean up previous recording resources
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
      }
      setAudioBlob(null)
      setAudioChunks([])
      chunksRef.current = []
      setRecordingTime(0)

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Select supported audio MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/ogg')
              ? 'audio/ogg'
              : ''

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
          setAudioChunks((prev) => [...prev, event.data])
        }
      }

      recorder.onstop = () => {
        const finalType = recorder.mimeType || 'audio/webm'
        const combinedBlob = new Blob(chunksRef.current, { type: finalType })
        setAudioBlob(combinedBlob)

        const url = URL.createObjectURL(combinedBlob)
        setAudioUrl(url)
        setIsRecording(false)

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      // Start recording without timeslice so Chrome outputs a fully valid, unfragmented WebM container
      recorder.start()
      setIsRecording(true)

      // Recording duration timer
      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000))
      }, 500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone'
      setError(message)
      setIsRecording(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [audioUrl])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioBlob(null)
    setAudioChunks([])
    chunksRef.current = []
    setRecordingTime(0)
    setError(null)
  }, [audioUrl, isRecording, stopRecording])

  return {
    startRecording,
    stopRecording,
    isRecording,
    audioBlob,
    audioUrl,
    audioChunks,
    recordingTime,
    error,
    resetRecording,
  }
}
