defmodule Timbre.AI.HTTPClient.Default do
  @moduledoc """
  Production HTTP client implementation using Erlang's built-in :httpc.
  """
  @behaviour Timbre.AI.HTTPClient

  @impl true
  def post(url, headers, body, opts) do
    timeout = Keyword.get(opts, :timeout, 15_000)
    charlist_url = String.to_charlist(url)

    charlist_headers =
      Enum.map(headers, fn {k, v} ->
        {String.to_charlist(to_string(k)), String.to_charlist(to_string(v))}
      end)

    content_type =
      Enum.find_value(headers, "application/json", fn {k, v} ->
        if String.downcase(to_string(k)) == "content-type", do: to_string(v)
      end)
      |> String.to_charlist()

    http_opts = [timeout: timeout, connect_timeout: timeout]
    req_opts = [body_format: :binary]

    case :httpc.request(
           :post,
           {charlist_url, charlist_headers, content_type, body},
           http_opts,
           req_opts
         ) do
      {:ok, {{_http_version, status, _reason_phrase}, _resp_headers, resp_body}} ->
        {:ok, %{status: status, body: resp_body}}

      {:error, :timeout} ->
        {:error, :timeout}

      {:error, :connect_timeout} ->
        {:error, :timeout}

      {:error, {:failed_connect, _}} ->
        {:error, :timeout}

      {:error, reason} ->
        {:error, reason}
    end
  end
end

