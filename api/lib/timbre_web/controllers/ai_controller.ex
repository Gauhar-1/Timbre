defmodule TimbreWeb.AIController do
  use TimbreWeb, :controller

  alias Timbre.AI

  @doc """
  Transcribes audio using Groq Whisper.
  If Groq times out or fails, returns 502 Bad Gateway with status "failed".
  """
  def transcribe(conn, params) do
    opts = get_ai_opts(conn, params)
    audio = params["audio"] || params["audio_blob"] || ""

    case AI.transcribe(audio, opts) do
      {:ok, transcript} ->
        conn
        |> put_status(:ok)
        |> json(%{transcript: transcript, status: "completed"})

      {:error, :missing_api_key} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Missing Groq API key", status: "failed"})

      {:error, :bad_gateway} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{
          error: "External AI gateway error: request timed out or failed",
          status: "failed"
        })
    end
  end

  @doc """
  Summarizes transcript using Groq Llama/chat completions.
  If Groq times out or fails, returns 502 Bad Gateway with status "failed".
  """
  def summarize(conn, params) do
    opts = get_ai_opts(conn, params)
    transcript = params["transcript"] || ""

    case AI.summarize(transcript, opts) do
      {:ok, summary} ->
        conn
        |> put_status(:ok)
        |> json(%{summary: summary, status: "completed"})

      {:error, :missing_api_key} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Missing Groq API key", status: "failed"})

      {:error, :bad_gateway} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{
          error: "External AI gateway error: request timed out or failed",
          status: "failed"
        })
    end
  end

  defp get_ai_opts(conn, params) do
    api_key =
      get_req_header(conn, "x-groq-key")
      |> List.first()
      |> Kernel.||(params["api_key"])

    if api_key, do: [api_key: api_key], else: []
  end
end
