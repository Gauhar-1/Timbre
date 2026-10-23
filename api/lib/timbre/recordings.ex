defmodule Timbre.Recordings do
  @moduledoc """
  The Recordings context. Manages audio recording persistence and retrieval.
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
  Gets a single recording by id.
  """
  def get_recording(id), do: Repo.get(Recording, id)

  @doc """
  Gets a single recording by id, raising Ecto.NoResultsError if not found.
  """
  def get_recording!(id), do: Repo.get!(Recording, id)

  @doc """
  Creates a recording.
  """
  def create_recording(attrs \\ %{}) do
    %Recording{}
    |> Recording.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Deletes a recording.
  """
  def delete_recording(%Recording{} = recording) do
    Repo.delete(recording)
  end
end
