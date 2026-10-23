# Multi-stage production build for Timbre Phoenix API (MIX_ENV=prod)
FROM elixir:1.18-alpine AS builder

# Install build dependencies for compiling C/NIFs (ecto_sqlite3 / exqlite)
RUN apk add --no-cache build-base git sqlite sqlite-dev inotify-tools

WORKDIR /app

# Install Hex and Rebar
RUN mix local.hex --force && \
    mix local.rebar --force

ENV MIX_ENV=prod

# Install and compile mix dependencies in prod
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

# Copy application configuration and source code
COPY config config
COPY lib lib
COPY priv priv

# Compile app and generate release bundle in MIX_ENV=prod
RUN mix compile
RUN mix release

# Production runner stage
FROM alpine:3.23.5 AS runner

RUN apk add --no-cache openssl libgcc libstdc++ ncurses-libs

WORKDIR /app

ENV MIX_ENV=prod
ENV PORT=4010
ENV PHX_SERVER=true

COPY --from=builder /app/_build/prod/rel/timbre ./

EXPOSE 4010

CMD ["bin/timbre", "start"]
