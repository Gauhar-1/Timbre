defmodule TimbreWeb.Router do
  use TimbreWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  # Ops probes — unauthenticated, no `:accepts` plug so bare LB/k8s probes work.
  scope "/", TimbreWeb do
    get "/healthz", HealthController, :live
    get "/readyz", HealthController, :ready
  end

  scope "/api", TimbreWeb do
    pipe_through :api

    get "/hello", HelloController, :show

    get "/recordings", RecordingController, :index
    post "/recordings", RecordingController, :create
    get "/recordings/:id/audio", RecordingController, :show
    delete "/recordings/:id", RecordingController, :delete

    post "/ai/transcribe", AIController, :transcribe
    post "/ai/summarize", AIController, :summarize
  end
end
