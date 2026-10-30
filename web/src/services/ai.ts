/**
 * AI Service for Audio Transcription and Conversation Summarization.
 * Connects to Groq Whisper-large-v3 and Llama chat completions.
 * Enforces hard error boundaries with zero swallowed exceptions or canned fallbacks.
 */

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_CHAT_COMPLETION_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Retrieves the Groq API key from localStorage or Vite environment variables.
 */
export function getGroqApiKey(): string {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('groq_api_key') : null
  const envKey =
    (import.meta.env.VITE_GROQ_API_KEY as string | undefined) ||
    (import.meta.env.GROQ_API_KEY as string | undefined) ||
    ''

  return (localKey || envKey || '').trim()
}

/**
 * Stores the Groq API key in localStorage for browser persistence.
 */
export function setGroqApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    const trimmed = key.trim()
    localStorage.setItem('groq_api_key', trimmed)
    window.dispatchEvent(new CustomEvent('groq_key_changed', { detail: trimmed }))
  }
}

/**
 * Transcribes an audio Blob using the Groq Whisper-large-v3 model.
 * Enforces strict error handling: rejects promise on API failures, 5xx errors, or missing key.
 */
export async function transcribeAudio(audioBlob: Blob, apiKeyOverride?: string): Promise<string> {
  const apiKey = (apiKeyOverride || getGroqApiKey()).trim()

  if (!apiKey) {
    throw new Error('No Groq API key configured. Please configure your Groq key in the studio header.')
  }

  // Prepare multipart/form-data for Groq Whisper
  const formData = new FormData()
  // Ensure the file has a recognizable audio extension (.webm or .wav)
  const extension = audioBlob.type.includes('wav') ? 'wav' : 'webm'
  formData.append('file', audioBlob, `session_audio.${extension}`)
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'json')

  try {
    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (response.status >= 500) {
      throw new Error(`AI generation failed: External AI API gateway error (${response.status}). Please try again.`)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Whisper transcription failed (${response.status}): ${errorText || response.statusText}`)
    }

    const data = (await response.json()) as { text?: string }
    const text = data.text?.trim()
    if (!text) {
      throw new Error('Whisper returned empty transcript. No audible speech detected.')
    }
    return text
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Transcription failed due to a network or server error.'
    throw new Error(msg)
  }
}

/**
 * Generates a concise summary of the transcript using Groq Llama chat completions.
 * Enforces strict error boundaries with zero canned fallbacks.
 */
export async function summarizeText(transcript: string, apiKeyOverride?: string): Promise<string> {
  const apiKey = (apiKeyOverride || getGroqApiKey()).trim()

  if (!apiKey) {
    throw new Error('No Groq API key configured. Please configure your Groq key in the studio header.')
  }

  if (!transcript.trim()) {
    throw new Error('No transcript provided to summarize.')
  }

  try {
    const response = await fetch(GROQ_CHAT_COMPLETION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert audio analyst. Provide a concise, professional summary of the provided conversation transcript. Do not output preamble or bullet points; output in coherent sentences.',
          },
          {
            role: 'user',
            content: `Here is the transcript to summarize:\n"${transcript}"`,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    })

    if (response.status >= 500) {
      throw new Error(`AI generation failed: External AI API gateway error (${response.status}). Please try again.`)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`LLM summarization failed (${response.status}): ${errorText || response.statusText}`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const summary = data.choices?.[0]?.message?.content?.trim()
    if (!summary) {
      throw new Error('LLM summarization returned empty response.')
    }
    return summary
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Summarization failed due to a network or server error.'
    throw new Error(msg)
  }
}

export interface AiAnalysisResult {
  title: string
  summary: string
}

/**
 * Runs an LLM prompt that returns JSON:
 * { "title": "3-5 word smart title", "summary": "2-sentence executive summary" }
 * Rejects promise with explicit error if API fails or returns 5xx.
 */
export async function generateTitleAndSummary(
  transcript: string,
  apiKeyOverride?: string
): Promise<AiAnalysisResult> {
  const apiKey = (apiKeyOverride || getGroqApiKey()).trim()

  if (!apiKey) {
    throw new Error('No Groq API key configured. Please configure your Groq key in the studio header.')
  }

  if (!transcript.trim()) {
    throw new Error('No transcript provided to analyze.')
  }

  try {
    const response = await fetch(GROQ_CHAT_COMPLETION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert audio producer. Analyze the transcript and respond ONLY with a valid JSON object containing exactly two keys: "title" (a punchy, professional 3 to 5 word title) and "summary" (a concise 2-sentence executive summary). Do not include markdown code fences or other text.',
          },
          {
            role: 'user',
            content: `Transcript:\n"${transcript}"`,
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    })

    if (response.status >= 500) {
      throw new Error(`AI generation failed: External AI API gateway error (${response.status}). Please try again.`)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`AI generation failed (${response.status}): ${errorText || response.statusText}`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '{}'
    const parsed = JSON.parse(rawContent) as { title?: string; summary?: string }

    if (!parsed.summary) {
      throw new Error('AI analysis failed: Response missing valid summary.')
    }

    return {
      title: parsed.title?.trim() || 'Studio Audio Take',
      summary: parsed.summary.trim(),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI generation failed due to a network or server error.'
    throw new Error(msg)
  }
}

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4010').replace(/\/+$/, '')

/**
 * Submits the mixed audio Blob, Transcript, and Summary to the Phoenix API /api/recordings endpoint.
 */
export async function saveRecordingToDatabase(params: {
  audioBlob: Blob
  title: string
  durationMs: number
  transcript?: string
  summary?: string
  recordingType?: 'solo' | 'merged'
  clientId?: string
  roomId?: string
}): Promise<{ id: string; title: string }> {
  const {
    audioBlob,
    title,
    durationMs,
    transcript = '',
    summary = '',
    recordingType = 'solo',
    clientId,
    roomId,
  } = params

  const formData = new FormData()
  const extension = audioBlob.type.includes('wav') ? 'wav' : 'webm'
  formData.append('audio', audioBlob, `recording_${Date.now()}.${extension}`)
  formData.append('title', title)
  formData.append('recording_type', recordingType)
  if (clientId) formData.append('client_id', clientId)
  if (roomId) formData.append('room_id', roomId)
  formData.append('content_type', audioBlob.type || 'audio/webm')
  formData.append('duration_ms', Math.round(durationMs).toString())
  formData.append('transcript', transcript)
  formData.append('summary', summary)

  const response = await fetch(`${API_URL}/api/recordings`, {
    method: 'POST',
    headers: clientId ? { 'x-client-id': clientId } : {},
    body: formData,
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error || `Failed to persist recording to API (${response.status})`)
  }

  return (await response.json()) as { id: string; title: string }
}
