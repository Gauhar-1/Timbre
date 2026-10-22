import { useState, useEffect, useRef, useCallback } from 'react'
import { Socket, Channel } from 'phoenix'

export interface UseWebRTCMixerReturn {
  localPeerId: string
  connectedPeers: string[]
  remoteStreams: MediaStream[]
  isRoomConnected: boolean
  isRecordingMixed: boolean
  recordingTime: number
  mixedAudioBlob: Blob | null
  mixedAudioUrl: string | null
  error: string | null
  startMixedRecording: () => void
  stopMixedRecording: () => void
  resetMixedRecording: () => void
}

interface PeerConnectionData {
  pc: RTCPeerConnection
  remoteStream?: MediaStream
  sourceNode?: MediaStreamAudioSourceNode
  iceCandidateQueue: RTCIceCandidateInit[]
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useWebRTCMixer(roomId = 'room:lobby'): UseWebRTCMixerReturn {
  const [localPeerId] = useState<string>(
    () => `peer-${Math.random().toString(36).substring(2, 8)}`
  )
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([])
  const [isRoomConnected, setIsRoomConnected] = useState(false)
  const [isRecordingMixed, setIsRecordingMixed] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mixedAudioBlob, setMixedAudioBlob] = useState<Blob | null>(null)
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Web Audio Context & Mixer destination
  const audioContextRef = useRef<AudioContext | null>(null)
  const mixerDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // WebRTC mesh and Phoenix Channel refs
  const socketRef = useRef<Socket | null>(null)
  const channelRef = useRef<Channel | null>(null)
  const peersRef = useRef<Map<string, PeerConnectionData>>(new Map())

  // MediaRecorder for the mixed destination stream
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mixedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)

  // Initialize master AudioContext and mixer destination node
  const getOrCreateMixer = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const dest = ctx.createMediaStreamDestination()
      audioContextRef.current = ctx
      mixerDestinationRef.current = dest
    }
    return {
      audioCtx: audioContextRef.current,
      mixerDest: mixerDestinationRef.current!,
    }
  }, [])

  // Create an RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback(
    (remotePeerId: string, channel: Channel, localStream: MediaStream): RTCPeerConnection => {
      const existing = peersRef.current.get(remotePeerId)
      if (existing) {
        existing.pc.close()
        peersRef.current.delete(remotePeerId)
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      const { audioCtx, mixerDest } = getOrCreateMixer()

      // Step 1: Add all local tracks immediately so audio is actively sent out
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })

      // Send local ICE candidates to the remote peer via Phoenix channel
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.push('ice_candidate', {
            from: localPeerId,
            to: remotePeerId,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          })
        }
      }

      // Step 2: Implement ontrack event listener, capture event.streams[0], add to state, log to console
      pc.ontrack = (event) => {
        console.log('Remote track received!', event.streams[0])
        const stream = event.streams[0] || new MediaStream([event.track])

        // Add to React remoteStreams array state
        setRemoteStreams((prev) => {
          if (prev.some((s) => s.id === stream.id)) return prev
          return [...prev, stream]
        })

        // Route into master AudioContext mixer destination for combined recording
        try {
          const remoteSource = audioCtx.createMediaStreamSource(stream)
          remoteSource.connect(mixerDest)

          const peerData = peersRef.current.get(remotePeerId)
          if (peerData) {
            peerData.remoteStream = stream
            peerData.sourceNode = remoteSource
          }
        } catch (e) {
          console.error('Error connecting remote stream to mixer destination:', e)
        }
      }

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          const peerData = peersRef.current.get(remotePeerId)
          if (peerData?.remoteStream) {
            const streamId = peerData.remoteStream.id
            setRemoteStreams((prev) => prev.filter((s) => s.id !== streamId))
          }
          peersRef.current.delete(remotePeerId)
          setConnectedPeers(Array.from(peersRef.current.keys()))
        }
      }

      peersRef.current.set(remotePeerId, {
        pc,
        iceCandidateQueue: [],
      })
      setConnectedPeers(Array.from(peersRef.current.keys()))

      return pc
    },
    [getOrCreateMixer, localPeerId]
  )

  // Establish Phoenix Channel & WebRTC Mesh
  useEffect(() => {
    let isCancelled = false

    const setupSession = async () => {
      try {
        setError(null)

        // 1. Capture local microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream

        // 2. Setup master AudioContext mixer
        const { audioCtx, mixerDest } = getOrCreateMixer()
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        // 3. Connect local microphone to master mixer destination
        const localSource = audioCtx.createMediaStreamSource(stream)
        localSource.connect(mixerDest)
        localSourceNodeRef.current = localSource

        // 4. Connect Phoenix Socket via proxy (/socket)
        const socket = new Socket('/socket', {
          params: { peerId: localPeerId },
        })
        socket.connect()
        socketRef.current = socket

        // 5. Join Room Channel
        const channel = socket.channel(roomId, { peerId: localPeerId })
        channelRef.current = channel

        // Listen for new peer announcements
        channel.on('peer_joined', async ({ peerId: remotePeerId }) => {
          if (remotePeerId === localPeerId) return

          // Initiator role: create offer to newcomer
          const pc = createPeerConnection(remotePeerId, channel, stream)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)

          channel.push('offer', {
            from: localPeerId,
            to: remotePeerId,
            sdp: offer,
          })
        })

        // Listen for WebRTC Offer
        channel.on('offer', async ({ from: remotePeerId, to: targetPeerId, sdp }) => {
          if (targetPeerId !== localPeerId) return

          const pc = createPeerConnection(remotePeerId, channel, stream)
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))

          // Flush queued candidates
          const peerData = peersRef.current.get(remotePeerId)
          if (peerData) {
            while (peerData.iceCandidateQueue.length > 0) {
              const candidate = peerData.iceCandidateQueue.shift()
              if (candidate) {
                try {
                  await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (e) {
                  console.warn('ICE candidate flush failed:', e)
                }
              }
            }
          }

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          channel.push('answer', {
            from: localPeerId,
            to: remotePeerId,
            sdp: answer,
          })
        })

        // Listen for WebRTC Answer
        channel.on('answer', async ({ from: remotePeerId, to: targetPeerId, sdp }) => {
          if (targetPeerId !== localPeerId) return

          const peerData = peersRef.current.get(remotePeerId)
          if (peerData?.pc) {
            await peerData.pc.setRemoteDescription(new RTCSessionDescription(sdp))

            // Flush queued candidates
            while (peerData.iceCandidateQueue.length > 0) {
              const candidate = peerData.iceCandidateQueue.shift()
              if (candidate) {
                try {
                  await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (e) {
                  console.warn('ICE candidate flush failed:', e)
                }
              }
            }
          }
        })

        // Listen for ICE Candidate
        channel.on('ice_candidate', async ({ from: remotePeerId, to: targetPeerId, candidate }) => {
          if (targetPeerId !== localPeerId) return

          const peerData = peersRef.current.get(remotePeerId)
          if (peerData?.pc) {
            if (!peerData.pc.remoteDescription) {
              peerData.iceCandidateQueue.push(candidate)
            } else {
              try {
                await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate))
              } catch (err) {
                console.warn('ICE candidate addition failed:', err)
              }
            }
          }
        })

        // Listen for peer departures
        channel.on('peer_left', ({ peerId: remotePeerId }) => {
          const peerData = peersRef.current.get(remotePeerId)
          if (peerData) {
            if (peerData.remoteStream) {
              const streamId = peerData.remoteStream.id
              setRemoteStreams((prev) => prev.filter((s) => s.id !== streamId))
            }
            peerData.pc.close()
            peersRef.current.delete(remotePeerId)
            setConnectedPeers(Array.from(peersRef.current.keys()))
          }
        })

        channel
          .join()
          .receive('ok', () => {
            setIsRoomConnected(true)
            // Announce presence so existing peers initiate offers
            channel.push('peer_joined', { peerId: localPeerId })
          })
          .receive('error', (resp) => {
            console.error('Channel join failed:', resp)
            setError('Failed to connect to signaling server')
          })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Microphone or room error'
        setError(msg)
      }
    }

    setupSession()

    return () => {
      isCancelled = true

      // Clean up Phoenix channel and socket
      if (channelRef.current) {
        channelRef.current.push('peer_left', { peerId: localPeerId })
        channelRef.current.leave()
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }

      // Close all RTCPeerConnections
      peersRef.current.forEach(({ pc }) => pc.close())
      peersRef.current.clear()

      // Stop local microphone tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      // Close master AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [createPeerConnection, getOrCreateMixer, localPeerId, roomId])

  // Start recording the fully mixed session from the MediaStreamAudioDestinationNode
  const startMixedRecording = useCallback(() => {
    const mixerDest = mixerDestinationRef.current
    if (!mixerDest) return

    if (mixedAudioUrl) {
      URL.revokeObjectURL(mixedAudioUrl)
      setMixedAudioUrl(null)
    }
    setMixedAudioBlob(null)
    mixedChunksRef.current = []
    setRecordingTime(0)

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

    const recorder = new MediaRecorder(mixerDest.stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        mixedChunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      const type = recorder.mimeType || 'audio/webm'
      const combinedBlob = new Blob(mixedChunksRef.current, { type })
      setMixedAudioBlob(combinedBlob)
      const url = URL.createObjectURL(combinedBlob)
      setMixedAudioUrl(url)
      setIsRecordingMixed(false)

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }

    // Continuous recording to ensure valid headers across all browsers
    recorder.start()
    setIsRecordingMixed(true)

    const start = Date.now()
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - start) / 1000))
    }, 500)
  }, [mixedAudioUrl])

  // Stop recording the mixed session
  const stopMixedRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }, [])

  // Clear mixed recording state
  const resetMixedRecording = useCallback(() => {
    if (isRecordingMixed) {
      stopMixedRecording()
    }
    if (mixedAudioUrl) {
      URL.revokeObjectURL(mixedAudioUrl)
      setMixedAudioUrl(null)
    }
    setMixedAudioBlob(null)
    mixedChunksRef.current = []
    setRecordingTime(0)
  }, [isRecordingMixed, mixedAudioUrl, stopMixedRecording])

  return {
    localPeerId,
    connectedPeers,
    remoteStreams,
    isRoomConnected,
    isRecordingMixed,
    recordingTime,
    mixedAudioBlob,
    mixedAudioUrl,
    error,
    startMixedRecording,
    stopMixedRecording,
    resetMixedRecording,
  }
}
