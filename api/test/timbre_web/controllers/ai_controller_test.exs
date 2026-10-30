defmodule TimbreWeb.AIControllerTest do
  use TimbreWeb.ConnCase

  alias Timbre.AI.HTTPClient.Mock

  setup do
    Mock.clear()
    on_exit(fn -> Mock.clear() end)
    :ok
  end

  describe "POST /api/ai/transcribe" do
    test "external API timeout results in a 502 Bad Gateway response and does not flag task as complete",
         %{conn: conn} do
      # Configure mock to simulate external API timeout
      Mock.set_response({:error, :timeout})

      conn =
        conn
        |> put_req_header("x-groq-key", "gsk_test_api_key_123")
        |> post(~p"/api/ai/transcribe", %{
          "audio" => <<0, 1, 2, 3, 4, 5>>,
          "content_type" => "audio/webm"
        })

      assert conn.status == 502
      response = json_response(conn, 502)

      # Assert explicitly: returns 502 Bad Gateway
      assert response["error"] =~ "External AI gateway error"
      # Crucial: prove that timeout does NOT flag task as complete!
      assert response["status"] != "completed"
      assert response["status"] == "failed"
    end

    test "external API 5xx failure results in a 502 Bad Gateway response and does not flag task as complete",
         %{conn: conn} do
      Mock.set_response({:ok, %{status: 503, body: ~s({"error": "Service Unavailable"})}})

      conn =
        conn
        |> put_req_header("x-groq-key", "gsk_test_api_key_123")
        |> post(~p"/api/ai/transcribe", %{
          "audio" => <<0, 1, 2, 3, 4, 5>>
        })

      assert conn.status == 502
      response = json_response(conn, 502)
      assert response["status"] != "completed"
      assert response["status"] == "failed"
    end

    test "successful transcription returns 200 with completed status and transcript text", %{
      conn: conn
    } do
      Mock.set_response(
        {:ok,
         %{
           status: 200,
           body: Jason.encode!(%{"text" => "Welcome to the multiplayer studio session."})
         }}
      )

      conn =
        conn
        |> put_req_header("x-groq-key", "gsk_test_api_key_123")
        |> post(~p"/api/ai/transcribe", %{
          "audio" => <<0, 1, 2, 3, 4, 5>>
        })

      assert conn.status == 200
      response = json_response(conn, 200)
      assert response["status"] == "completed"
      assert response["transcript"] == "Welcome to the multiplayer studio session."
    end
  end

  describe "POST /api/ai/summarize" do
    test "external API timeout results in a 502 Bad Gateway response and does not flag task as complete",
         %{conn: conn} do
      Mock.set_response({:error, :timeout})

      conn =
        conn
        |> put_req_header("x-groq-key", "gsk_test_api_key_123")
        |> post(~p"/api/ai/summarize", %{
          "transcript" => "Audio session with multiple participants discussing DSP filters."
        })

      assert conn.status == 502
      response = json_response(conn, 502)
      assert response["error"] =~ "External AI gateway error"
      assert response["status"] != "completed"
      assert response["status"] == "failed"
    end

    test "successful summarization returns 200 with completed status", %{conn: conn} do
      Mock.set_response(
        {:ok,
         %{
           status: 200,
           body:
             Jason.encode!(%{
               "choices" => [
                 %{"message" => %{"content" => "Participants discussed DSP audio filters."}}
               ]
             })
         }}
      )

      conn =
        conn
        |> put_req_header("x-groq-key", "gsk_test_api_key_123")
        |> post(~p"/api/ai/summarize", %{
          "transcript" => "Audio session with multiple participants discussing DSP filters."
        })

      assert conn.status == 200
      response = json_response(conn, 200)
      assert response["status"] == "completed"
      assert response["summary"] == "Participants discussed DSP audio filters."
    end
  end
end

