defmodule Timbre.AI.HTTPClient do
  @moduledoc """
  Behaviour for HTTP client requests to external AI APIs (e.g., Groq).
  Enables clean mocking in ExUnit tests using Mox or mock clients.
  """

  @callback post(
              url :: String.t(),
              headers :: [{String.t(), String.t()}],
              body :: binary(),
              opts :: keyword()
            ) ::
              {:ok, %{status: pos_integer(), body: binary()}}
              | {:error, term()}
end

