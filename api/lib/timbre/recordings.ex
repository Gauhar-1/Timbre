defmodule Timbre.Recordings do
  @moduledoc """
  The Recordings context. Manages audio recording persistence and retrieval.
  """

  import Ecto.Query, warn: false
  alias Timbre.Repo
  alias Timbre.Recordings.Recording

  @doc """
  Returns the list of recordings.
  Omits the audio_blob field to conserve database I/O, memory, and network bandwidth.
  """
  def list_recordings do
    from(r in Recording,
      order_by: [desc: r.inserted_at],
      select: struct(r, [:id, :title, :content_type, :duration_ms, :transcript, :summary, :inserted_at, :updated_at])
    )
    |> Repo.all()
  end

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
