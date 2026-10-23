defmodule Timbre.Repo.Migrations.AddFieldsToRecordings do
  use Ecto.Migration

  def change do
    alter table(:recordings) do
      add :recording_type, :string, default: "solo", null: false
      add :client_id, :string
      add :room_id, :string
    end

    create index(:recordings, [:recording_type])
    create index(:recordings, [:client_id])
  end
end
