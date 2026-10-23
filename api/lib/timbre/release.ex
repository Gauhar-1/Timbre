defmodule Timbre.Release do
  @moduledoc """
  Used for executing DB release tasks when run with `bin/timbre eval`
  or via a migration script in a standalone release container.
  """
  @app :timbre

  def migrate do
    load_app()

    for repo <- repos() do
      # Ensure parent directory of SQLite database file exists
      db_file = repo.config()[:database]

      if db_file && is_binary(db_file) do
        db_file |> Path.dirname() |> File.mkdir_p()
      end

      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    Application.load(@app)
  end
end
