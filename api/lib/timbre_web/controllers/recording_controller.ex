defmodule TimbreWeb.RecordingController do
  use TimbreWeb, :controller

  alias Timbre.Recordings
  alias Timbre.Recordings.Recording

  @doc """
  Lists all saved recordings with optional query filtering by recording_type and client_id.
  Omits audio_blob from the payload to conserve database I/O, memory, and bandwidth.
  """
  def index(conn, params) do
    recordings = Recordings.list_recordings(params)
    json(conn, Enum.map(recordings, &recording_json/1))
  end

  @doc """
  Handles multipart/form-data upload.
  Reads binary data from the uploaded file (via Plug.Upload or raw binary), extracts the
  content type and metadata, and persists the recording via the context.
  """
  def create(conn, params) do
    upload =
      params["audio"] ||
        params["file"] ||
        params["recording"] ||
        params["audio_file"] ||
        params["audio_blob"]

    base_attrs = %{
      "title" => params["title"],
      "recording_type" => params["recording_type"] || "solo",
      "client_id" => params["client_id"],
      "room_id" => params["room_id"],
      "content_type" => params["content_type"],
      "duration_ms" => parse_duration(params["duration_ms"]),
      "transcript" => params["transcript"],
      "summary" => params["summary"]
    }

    cond do
      match?(%Plug.Upload{}, upload) ->
        case File.read(upload.path) do
          {:ok, binary} ->
            content_type = base_attrs["content_type"] || upload.content_type || "audio/webm"
            title = base_attrs["title"] || upload.filename || "Untitled Recording"

            attrs =
              Map.merge(base_attrs, %{
                "title" => title,
                "audio_blob" => binary,
                "content_type" => content_type
              })

            save_recording(conn, attrs)

          {:error, reason} ->
            conn
            |> put_status(:bad_request)
            |> json(%{error: "Failed to read uploaded file: #{inspect(reason)}"})
        end

      is_binary(params["audio_blob"]) ->
        content_type = base_attrs["content_type"] || "audio/webm"
        title = base_attrs["title"] || "Untitled Recording"

        attrs =
          Map.merge(base_attrs, %{
            "title" => title,
            "audio_blob" => params["audio_blob"],
            "content_type" => content_type
          })

        save_recording(conn, attrs)

      true ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          error: "No audio file provided in upload. Expected 'audio' or 'file' form field."
        })
    end
  end

  @doc """
  Streams the raw audio binary with Content-Type and Accept-Ranges headers,
  enabling smooth seeking in HTML5 <audio> elements.
  """
  def show(conn, %{"id" => id}) do
    case Ecto.UUID.cast(id) do
      {:ok, valid_id} ->
        case Recordings.get_recording(valid_id) do
          %Recording{} = recording ->
            serve_audio(conn, recording)

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

  defp serve_audio(conn, %Recording{audio_blob: audio_blob, content_type: content_type}) do
    total_size = byte_size(audio_blob)
    content_type = content_type || "audio/webm"

    case get_req_header(conn, "range") do
      [range_str] ->
        case parse_range(range_str, total_size) do
          {:ok, start_offset, end_offset} ->
            length = end_offset - start_offset + 1
            chunk = binary_part(audio_blob, start_offset, length)

            conn
            |> put_resp_header("content-type", content_type)
            |> put_resp_header("accept-ranges", "bytes")
            |> put_resp_header(
              "content-range",
              "bytes #{start_offset}-#{end_offset}/#{total_size}"
            )
            |> put_resp_header("content-length", to_string(length))
            |> send_resp(206, chunk)

          :invalid_range ->
            conn
            |> put_resp_header("content-range", "bytes */#{total_size}")
            |> send_resp(416, "")
        end

      _ ->
        conn
        |> put_resp_header("content-type", content_type)
        |> put_resp_header("accept-ranges", "bytes")
        |> put_resp_header("content-length", to_string(total_size))
        |> send_resp(200, audio_blob)
    end
  end

  defp parse_range("bytes=" <> range_spec, total_size) do
    case String.split(range_spec, "-", parts: 2) do
      [start_str, ""] ->
        case Integer.parse(start_str) do
          {start_offset, ""} when start_offset < total_size ->
            {:ok, start_offset, total_size - 1}

          _ ->
            :invalid_range
        end

      [start_str, end_str] ->
        with {start_offset, ""} <- Integer.parse(start_str),
             {end_offset, ""} <- Integer.parse(end_str),
             true <- start_offset <= end_offset,
             true <- start_offset < total_size do
          bounded_end = min(end_offset, total_size - 1)
          {:ok, start_offset, bounded_end}
        else
          _ -> :invalid_range
        end

      _ ->
        :invalid_range
    end
  end

  defp parse_range(_, _), do: :invalid_range

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
      recording_type: recording.recording_type,
      client_id: recording.client_id,
      room_id: recording.room_id,
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
