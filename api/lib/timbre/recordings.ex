defmodule Timbre.Recordings do
  @moduledoc """
  The Recordings context. Manages audio recording persistence and retrieval.
  Enforces strict tenant isolation on all get, update, and delete operations
  to eliminate Insecure Direct Object References (IDOR).
  """

  import Ecto.Query, warn: false
  alias Timbre.Repo
  alias Timbre.Recordings.Recording

  @doc """
  Returns the list of recordings with optional query filtering by recording_type and client_id.
  Omits the audio_blob field to conserve database I/O, memory, and network bandwidth.
  Ordered by inserted_at: :desc.
  """
  def list_recordings(filters \\ %{}) do
    Recording
    |> order_by([r], desc: r.inserted_at)
    |> select(
      [r],
      struct(r, [
        :id,
        :title,
        :recording_type,
        :client_id,
        :room_id,
        :content_type,
        :duration_ms,
        :transcript,
        :summary,
        :inserted_at,
        :updated_at
      ])
    )
    |> filter_by_type(filters["recording_type"] || filters[:recording_type])
    |> filter_by_client(filters["client_id"] || filters[:client_id])
    |> Repo.all()
  end

  defp filter_by_type(query, nil), do: query
  defp filter_by_type(query, ""), do: query
  defp filter_by_type(query, type), do: where(query, [r], r.recording_type == ^type)

  defp filter_by_client(query, nil), do: query
  defp filter_by_client(query, ""), do: query
  defp filter_by_client(query, client_id), do: where(query, [r], r.client_id == ^client_id)

  @doc """
  Gets a single recording by id and client_id.
  Strictly enforces tenant ownership: never queries by id alone.
  Returns nil if client_id is nil, empty, or if no matching recording belongs to client_id.
  """
  def get_recording(_id, client_id) when client_id in [nil, ""], do: nil

  def get_recording(id, client_id) do
    Repo.get_by(Recording, id: id, client_id: client_id)
  end

  @doc """
  Gets a single recording by id and client_id, raising Ecto.NoResultsError if not found.
  """
  def get_recording!(id, client_id) when is_binary(client_id) and client_id != "" do
    Repo.get_by!(Recording, id: id, client_id: client_id)
  end

  def get_recording!(_id, _client_id) do
    raise Ecto.NoResultsError, queryable: Recording
  end

  @doc """
  Creates a recording.
  """
  def create_recording(attrs \\ %{}) do
    %Recording{}
    |> Recording.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a recording enforcing tenant isolation.
  """
  def update_recording(%Recording{client_id: client_id} = recording, attrs)
      when is_binary(client_id) and client_id != "" do
    recording
    |> Recording.changeset(attrs)
    |> Repo.update()
  end

  def update_recording(id, client_id, attrs) do
    case get_recording(id, client_id) do
      nil -> {:error, :not_found}
      %Recording{} = recording -> update_recording(recording, attrs)
    end
  end

  @doc """
  Deletes a recording by id and client_id, enforcing ownership.
  """
  def delete_recording(id, client_id) when is_binary(id) do
    case get_recording(id, client_id) do
      nil -> {:error, :not_found}
      %Recording{} = recording -> Repo.delete(recording)
    end
  end

  def delete_recording(%Recording{client_id: client_id} = recording, expected_client_id) do
    if client_id == expected_client_id and is_binary(expected_client_id) and
         expected_client_id != "" do
      Repo.delete(recording)
    else
      {:error, :not_found}
    end
  end

  def delete_recording(%Recording{} = recording) do
    Repo.delete(recording)
  end
end
