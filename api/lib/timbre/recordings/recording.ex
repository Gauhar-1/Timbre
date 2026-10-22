defmodule Timbre.Recordings.Recording do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @derive {Jason.Encoder, except: [:audio_blob]}
  schema "recordings" do
    field :title, :string
    field :audio_blob, :binary
    field :content_type, :string
    field :duration_ms, :integer
    field :transcript, :string
    field :summary, :string

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(recording, attrs) do
    recording
    |> cast(attrs, [:title, :audio_blob, :content_type, :duration_ms, :transcript, :summary])
    |> validate_required([:title, :audio_blob, :content_type])
  end
end
