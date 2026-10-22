defmodule TimbreWeb.RecordingController do
  use TimbreWeb, :controller

  alias Timbre.Recordings
  alias Timbre.Recordings.Recording

  @doc """
  Lists all saved recordings.
  Omits audio_blob from the payload to conserve bandwidth.
  """
  def index(conn, _params) do
    recordings = Recordings.list_recordings()
    json(conn, Enum.map(recordings, &recording_json/1))
  end

  @doc """
  Handles multipart/form-data upload.
  Reads binary data from the uploaded file (via Plug.Upload), extracts the
  content type, and saves the recording via the context.
  """
  def create(conn, params) do
    upload =
      params["audio"] ||
      params["file"] ||
      params["recording"] ||
      params["audio_file"] ||
      params["audio_blob"]

    cond do
      match?(%Plug.Upload{}, upload) ->
        case File.read(upload.path) do
          {:ok, binary} ->
            content_type = params["content_type"] || upload.content_type || "audio/webm"
            title = params["title"] || upload.filename || "Untitled Recording"

            attrs = %{
              "title" => title,
              "audio_blob" => binary,
              "content_type" => content_type,
              "duration_ms" => parse_duration(params["duration_ms"]),
              "transcript" => params["transcript"],
              "summary" => params["summary"]
            }

            save_recording(conn, attrs)

          {:error, reason} ->
            conn
            |> put_status(:bad_request)
            |> json(%{error: "Failed to read uploaded file: #{inspect(reason)}"})
        end

      is_binary(params["audio_blob"]) ->
        content_type = params["content_type"] || "audio/webm"
        title = params["title"] || "Untitled Recording"

        attrs = %{
          "title" => title,
          "audio_blob" => params["audio_blob"],
          "content_type" => content_type,
          "duration_ms" => parse_duration(params["duration_ms"]),
          "transcript" => params["transcript"],
          "summary" => params["summary"]
        }

        save_recording(conn, attrs)

      true ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "No audio file provided in upload. Expected 'audio' or 'file' form field."})
    end
  end

  @doc """
  Serves the raw audio binary directly back to the client with the correct content-type header.
  """
  def show(conn, %{"id" => id}) do
    case Ecto.UUID.cast(id) do
      {:ok, valid_id} ->
        case Recordings.get_recording(valid_id) do
          %Recording{} = recording ->
            content_type = recording.content_type || "audio/webm"

            conn
            |> put_resp_header("content-type", content_type)
            |> send_resp(200, recording.audio_blob)

          nil ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "Recording not found"})
        end

      :error ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Recording not found"})
    end
  end

  defp save_recording(conn, attrs) do
    case Recordings.create_recording(attrs) do
      {:ok, %Recording{} = recording} ->
        conn
        |> put_status(:created)
        |> json(recording_json(recording))

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  defp recording_json(%Recording{} = recording) do
    %{
      id: recording.id,
      title: recording.title,
      content_type: recording.content_type,
      duration_ms: recording.duration_ms,
      transcript: recording.transcript,
      summary: recording.summary,
      inserted_at: recording.inserted_at,
      updated_at: recording.updated_at
    }
  end

  defp parse_duration(nil), do: nil
  defp parse_duration(val) when is_integer(val), do: val
  defp parse_duration(val) when is_binary(val) do
    case Integer.parse(val) do
      {int, _} -> int
      :error -> nil
    end
  end
  defp parse_duration(_), do: nil

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
