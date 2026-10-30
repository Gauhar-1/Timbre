import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MasteringBay } from '../components/mastering/MasteringBay'
import * as aiService from '../services/ai'

// Mock services
vi.mock('../services/ai', () => ({
  transcribeAudio: vi.fn(),
  generateTitleAndSummary: vi.fn(),
  saveRecordingToDatabase: vi.fn(),
  getGroqApiKey: vi.fn(),
  setGroqApiKey: vi.fn(),
}))

vi.mock('../services/dsp', () => ({
  processAudio: vi.fn(),
}))

describe('MasteringBay AI State Machine & Sequential Pipeline', () => {
  const dummyBlob = new Blob(['dummy audio content'], { type: 'audio/webm' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(aiService.getGroqApiKey).mockReturnValue('gsk_test_api_key_valid')
    vi.mocked(aiService.transcribeAudio).mockResolvedValue(
      'Hello team, this is our test transcript from Groq Whisper.'
    )
    vi.mocked(aiService.generateTitleAndSummary).mockResolvedValue({
      title: 'AI Produced Take',
      summary: 'The participants discussed automated WebRTC mixing.',
    })
    vi.mocked(aiService.saveRecordingToDatabase).mockResolvedValue({
      id: 'rec-test-uuid-1234',
      title: 'AI Produced Take',
    })
  })

  it('asserts "Summarize" button is disabled until "Transcribe" completes', async () => {
    render(
      <MasteringBay
        isOpen={true}
        onClose={vi.fn()}
        audioBlob={dummyBlob}
        recordingType="solo"
        durationMs={3000}
      />
    )

    const transcribeBtn = screen.getByTestId('btn-transcribe-groq')
    const summarizeBtn = screen.getByTestId('btn-summarize-llama')
    const saveBtn = screen.getByTestId('btn-save-vault')

    // 1. Initial State:
    // Transcribe is enabled (key is configured)
    expect(transcribeBtn).not.toBeDisabled()
    // Summarize MUST be disabled because transcriptText is empty
    expect(summarizeBtn).toBeDisabled()
    // Save to Vault is enabled
    expect(saveBtn).not.toBeDisabled()

    // 2. Trigger Transcription
    fireEvent.click(transcribeBtn)

    // Wait for transcription to complete
    await waitFor(() => {
      expect(screen.getByText(/Hello team, this is our test transcript from Groq Whisper./i)).toBeInTheDocument()
    })

    // 3. Post-Transcription State:
    // Summarize button must now become ENABLED
    expect(summarizeBtn).not.toBeDisabled()
    // Transcribe button must be disabled since transcriptText already exists
    expect(transcribeBtn).toBeDisabled()

    // 4. Trigger Summarization
    fireEvent.click(summarizeBtn)

    // Wait for summary to complete
    await waitFor(() => {
      expect(screen.getByText(/The participants discussed automated WebRTC mixing./i)).toBeInTheDocument()
    })

    // Summarize button must now be disabled since summaryText already exists
    expect(summarizeBtn).toBeDisabled()

    // 5. Trigger Save to Vault
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(aiService.saveRecordingToDatabase).toHaveBeenCalledTimes(1)
    })

    // Assert that the Save button becomes disabled ("Saved to Vault") preventing duplicates
    await waitFor(() => {
      expect(saveBtn).toBeDisabled()
    })
  })

  it('keeps "Transcribe" disabled if no Groq API key is configured', () => {
    vi.mocked(aiService.getGroqApiKey).mockReturnValue('')

    render(
      <MasteringBay
        isOpen={true}
        onClose={vi.fn()}
        audioBlob={dummyBlob}
        recordingType="solo"
        durationMs={3000}
      />
    )

    const transcribeBtn = screen.getByTestId('btn-transcribe-groq')
    expect(transcribeBtn).toBeDisabled()
  })

  it('explicitly clears loading state and displays error toast when transcription returns a 5xx error', async () => {
    vi.mocked(aiService.transcribeAudio).mockRejectedValueOnce(
      new Error('AI generation failed: External AI API gateway error (502). Please try again.')
    )

    render(
      <MasteringBay
        isOpen={true}
        onClose={vi.fn()}
        audioBlob={dummyBlob}
        recordingType="solo"
        durationMs={3000}
      />
    )

    const transcribeBtn = screen.getByTestId('btn-transcribe-groq')
    expect(transcribeBtn).not.toBeDisabled()

    // Trigger transcription
    fireEvent.click(transcribeBtn)

    // Assert: error toast notification is displayed
    await waitFor(() => {
      const toast = screen.getByTestId('ai-toast-notification')
      expect(toast).toBeInTheDocument()
      expect(toast).toHaveTextContent(/AI generation failed: External AI API gateway error \(502\)/i)
    })

    // Assert: loading state is explicitly cleared (button is no longer loading / disabled by isTranscribing)
    expect(transcribeBtn).not.toBeDisabled()
    expect(screen.queryByText(/Transcribing Audio/i)).not.toBeInTheDocument()
  })

  it('explicitly clears loading state and displays error toast when summarization returns a 5xx error', async () => {
    vi.mocked(aiService.generateTitleAndSummary).mockRejectedValueOnce(
      new Error('AI generation failed: External AI API gateway error (502). Please try again.')
    )

    render(
      <MasteringBay
        isOpen={true}
        onClose={vi.fn()}
        audioBlob={dummyBlob}
        recordingType="solo"
        durationMs={3000}
      />
    )

    // 1. Complete transcription first
    const transcribeBtn = screen.getByTestId('btn-transcribe-groq')
    fireEvent.click(transcribeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Hello team, this is our test transcript from Groq Whisper./i)).toBeInTheDocument()
    })

    const summarizeBtn = screen.getByTestId('btn-summarize-llama')
    expect(summarizeBtn).not.toBeDisabled()

    // 2. Trigger summarization which fails with 502
    fireEvent.click(summarizeBtn)

    // Assert: error toast notification is displayed
    await waitFor(() => {
      const toast = screen.getByTestId('ai-toast-notification')
      expect(toast).toBeInTheDocument()
      expect(toast).toHaveTextContent(/AI generation failed: External AI API gateway error \(502\)/i)
    })

    // Assert: loading state is explicitly cleared
    expect(summarizeBtn).not.toBeDisabled()
    expect(screen.queryByText(/Summarizing/i)).not.toBeInTheDocument()
  })
})
