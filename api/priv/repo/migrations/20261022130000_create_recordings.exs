defmodule Timbre.Repo.Migrations.CreateRecordings do
  use Ecto.Migration

  def change do
    create table(:recordings, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :title, :string, null: false
      add :audio_blob, :binary, null: false
      add :content_type, :string, null: false
      add :duration_ms, :integer
      add :transcript, :text
      add :summary, :text

      timestamps(type: :utc_datetime)
    end
  end
end
