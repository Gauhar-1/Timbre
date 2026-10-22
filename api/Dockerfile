FROM elixir:1.18-alpine

# Install build dependencies for compiling C/NIFs (ecto_sqlite3)
RUN apk add --no-cache build-base git sqlite sqlite-dev inotify-tools

WORKDIR /app

# Install Hex and Rebar package managers
RUN mix local.hex --force && \
    mix local.rebar --force

EXPOSE 4010

# Automatically fetch deps, run migrations, and launch Phoenix
CMD ["sh", "-c", "mix deps.get && mix ecto.create --quiet && mix ecto.migrate && mix phx.server"]
