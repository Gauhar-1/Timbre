defmodule Timbre.AI.HTTPClient.Mock do
  @moduledoc """
  Mock HTTP Client for ExUnit tests, simulating timeouts and gateway failures.
  """
  @behaviour Timbre.AI.HTTPClient

  @impl true
  def post(_url, _headers, _body, _opts) do
    case Process.get(:mock_ai_http_response) do
      nil -> {:error, :timeout}
      response -> response
    end
  end

  def set_response(response) do
    Process.put(:mock_ai_http_response, response)
  end

  def clear do
    Process.delete(:mock_ai_http_response)
  end
end

