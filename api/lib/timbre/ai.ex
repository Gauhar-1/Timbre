defmodule Timbre.AI do
  @moduledoc """
  AI Pipeline for audio transcription and summarization via external APIs (Groq Whisper & Llama).
  Enforces hard error boundaries: external API failures or timeouts explicitly return
  `{:error, :bad_gateway}` using strict pattern matching (`case`/`with`).
  No swallowed exceptions and no hardcoded or canned fallback values.
  """

  @groq_transcribe_url "https://api.groq.com/openai/v1/audio/transcriptions"
  @groq_chat_url "https://api.groq.com/openai/v1/chat/completions"

  defp http_client do
    Application.get_env(:timbre, :ai_http_client, Timbre.AI.HTTPClient.Default)
  end

  defp get_api_key(opts) do
    Keyword.get(opts, :api_key) ||
      System.get_env("GROQ_API_KEY") ||
      Application.get_env(:timbre, :groq_api_key)
  end

  @doc """
  Transcribes audio using Groq Whisper model.
  Returns `{:ok, transcript}` on success, or `{:error, :bad_gateway}` on external API timeout or failure.
  """
  def transcribe(audio_binary, opts \\ []) when is_binary(audio_binary) do
    api_key = get_api_key(opts)

    with {:key, key} when is_binary(key) and key != "" <- {:key, api_key},
         headers = [
           {"authorization", "Bearer #{key}"},
           {"content-type", Keyword.get(opts, :content_type, "application/json")}
         ],
         body = Keyword.get(opts, :body, audio_binary),
         timeout = Keyword.get(opts, :timeout, 10_000),
         req_result = http_client().post(@groq_transcribe_url, headers, body, timeout: timeout) do
      case req_result do
        {:ok, %{status: 200, body: resp_body}} ->
          case Jason.decode(resp_body) do
            {:ok, %{"text" => text}} when is_binary(text) ->
              {:ok, String.trim(text)}

            _ ->
              {:error, :bad_gateway}
          end

        {:ok, %{status: _non_200_status}} ->
          {:error, :bad_gateway}

        {:error, :timeout} ->
          {:error, :bad_gateway}

        {:error, :connect_timeout} ->
          {:error, :bad_gateway}

        {:error, _network_failure} ->
          {:error, :bad_gateway}
      end
    else
      {:key, _missing} ->
        {:error, :missing_api_key}

      _ ->
        {:error, :bad_gateway}
    end
  end

  @doc """
  Summarizes transcript text using Groq chat completion model.
  Returns `{:ok, summary}` on success, or `{:error, :bad_gateway}` on external API timeout or failure.
  """
  def summarize(transcript, opts \\ []) when is_binary(transcript) do
    api_key = get_api_key(opts)

    with {:key, key} when is_binary(key) and key != "" <- {:key, api_key},
         headers = [
           {"authorization", "Bearer #{key}"},
           {"content-type", "application/json"}
         ],
         payload = %{
           model: "llama-3.3-70b-versatile",
           messages: [
             %{
               role: "system",
               content:
                 "You are an expert audio analyst. Provide a concise, professional summary of the audio transcript."
             },
             %{
               role: "user",
               content: transcript
             }
           ],
           temperature: 0.5,
           max_tokens: 500
         },
         {:ok, body} <- Jason.encode(payload),
         timeout = Keyword.get(opts, :timeout, 10_000),
         req_result = http_client().post(@groq_chat_url, headers, body, timeout: timeout) do
      case req_result do
        {:ok, %{status: 200, body: resp_body}} ->
          case Jason.decode(resp_body) do
            {:ok, %{"choices" => [%{"message" => %{"content" => content}} | _]}}
            when is_binary(content) ->
              {:ok, String.trim(content)}

            _ ->
              {:error, :bad_gateway}
          end

        {:ok, %{status: _non_200_status}} ->
          {:error, :bad_gateway}

        {:error, :timeout} ->
          {:error, :bad_gateway}

        {:error, :connect_timeout} ->
          {:error, :bad_gateway}

        {:error, _network_failure} ->
          {:error, :bad_gateway}
      end
    else
      {:key, _missing} ->
        {:error, :missing_api_key}

      _ ->
        {:error, :bad_gateway}
    end
  end
end

