defmodule TimbreWeb.RecordingControllerTest do
  use TimbreWeb.ConnCase

  alias Timbre.Recordings

  @sample_binary <<26, 69, 223, 163, 1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8>>

  defp fixture(:recording, attrs \\ %{}) do
    default_attrs = %{
      title: "Test Voice Note",
      recording_type: "solo",
      client_id: "user-123",
      room_id: "room:lobby",
      audio_blob: @sample_binary,
      content_type: "audio/webm",
      duration_ms: 3500,
      transcript: "Hello world",
      summary: "A test recording."
    }

    {:ok, recording} = Recordings.create_recording(Map.merge(default_attrs, attrs))
    recording
  end

  describe "index" do
    test "lists all recordings without audio_blob", %{conn: conn} do
      recording = fixture(:recording)

      conn = get(conn, ~p"/api/recordings")
      assert json = json_response(conn, 200)
      assert is_list(json)
      assert length(json) == 1

      [first] = json
      assert first["id"] == recording.id
      assert first["title"] == "Test Voice Note"
      assert first["recording_type"] == "solo"
      assert first["client_id"] == "user-123"
      assert first["room_id"] == "room:lobby"
      assert first["content_type"] == "audio/webm"
      assert first["duration_ms"] == 3500
      refute Map.has_key?(first, "audio_blob")
    end

    test "filters recordings by recording_type and client_id", %{conn: conn} do
      _solo1 = fixture(:recording, %{title: "Solo 1", recording_type: "solo", client_id: "alice"})
      _solo2 = fixture(:recording, %{title: "Solo 2", recording_type: "solo", client_id: "bob"})

      _merged =
        fixture(:recording, %{title: "Merged 1", recording_type: "merged", client_id: "alice"})

      # Filter by recording_type
      conn_merged = get(conn, ~p"/api/recordings?recording_type=merged")
      json_merged = json_response(conn_merged, 200)
      assert length(json_merged) == 1
      assert hd(json_merged)["title"] == "Merged 1"

      # Filter by client_id
      conn_bob = get(conn, ~p"/api/recordings?client_id=bob")
      json_bob = json_response(conn_bob, 200)
      assert length(json_bob) == 1
      assert hd(json_bob)["title"] == "Solo 2"

      # Combined filter
      conn_alice_solo = get(conn, ~p"/api/recordings?client_id=alice&recording_type=solo")
      json_alice_solo = json_response(conn_alice_solo, 200)
      assert length(json_alice_solo) == 1
      assert hd(json_alice_solo)["title"] == "Solo 1"
    end
  end

  describe "create" do
    test "creates recording from multipart upload with metadata", %{conn: conn} do
      tmp_path =
        Path.join(System.tmp_dir!(), "test_recording_#{System.unique_integer([:positive])}.webm")

      File.write!(tmp_path, @sample_binary)
      on_exit(fn -> File.rm(tmp_path) end)

      upload = %Plug.Upload{
        path: tmp_path,
        filename: "my_mic_audio.webm",
        content_type: "audio/webm"
      }

      conn =
        post(conn, ~p"/api/recordings", %{
          "audio" => upload,
          "title" => "My First Take",
          "recording_type" => "merged",
          "client_id" => "peer-test-1",
          "room_id" => "room:studio",
          "duration_ms" => "4200",
          "transcript" => "Testing live audio",
          "summary" => "Short summary"
        })

      assert %{
               "id" => id,
               "title" => "My First Take",
               "recording_type" => "merged",
               "client_id" => "peer-test-1",
               "room_id" => "room:studio",
               "content_type" => "audio/webm",
               "duration_ms" => 4200
             } = json_response(conn, 201)

      saved = Recordings.get_recording(id, "peer-test-1")
      assert saved.audio_blob == @sample_binary
      assert saved.recording_type == "merged"
    end

    test "returns 400 when audio file is missing", %{conn: conn} do
      conn = post(conn, ~p"/api/recordings", %{"title" => "Empty"})
      assert json_response(conn, 400)["error"]
    end
  end

  describe "show (audio streaming)" do
    test "serves raw audio binary with Accept-Ranges and Content-Type headers", %{conn: conn} do
      recording = fixture(:recording)

      conn =
        conn
        |> put_req_header("x-client-id", recording.client_id)
        |> get(~p"/api/recordings/#{recording.id}/audio")

      assert response(conn, 200) == @sample_binary
      assert get_resp_header(conn, "content-type") == ["audio/webm"]
      assert get_resp_header(conn, "accept-ranges") == ["bytes"]
      assert get_resp_header(conn, "content-length") == [to_string(byte_size(@sample_binary))]
    end

    test "supports HTTP Range byte slicing (206 Partial Content) for audio seeking", %{conn: conn} do
      recording = fixture(:recording)

      conn =
        conn
        |> put_req_header("x-client-id", recording.client_id)
        |> put_req_header("range", "bytes=0-3")
        |> get(~p"/api/recordings/#{recording.id}/audio")

      assert response(conn, 206) == binary_part(@sample_binary, 0, 4)
      assert get_resp_header(conn, "content-range") == ["bytes 0-3/#{byte_size(@sample_binary)}"]
      assert get_resp_header(conn, "accept-ranges") == ["bytes"]
    end

    test "returns 404 when recording does not exist", %{conn: conn} do
      fake_id = "00000000-0000-0000-0000-000000000000"
      conn = get(conn, ~p"/api/recordings/#{fake_id}/audio?client_id=user-123")
      assert json_response(conn, 404)["error"] == "Recording not found"
    end

    test "regression (IDOR): returns 404 Not Found when User A attempts to GET User B's recording",
         %{
           conn: conn
         } do
      user_b_recording =
        fixture(:recording, %{client_id: "user_b", title: "User B Confidential Recording"})

      # 1. User A attempts to GET User B's recording using User A's client_id header
      conn_user_a_header =
        conn
        |> put_req_header("x-client-id", "user_a")
        |> get(~p"/api/recordings/#{user_b_recording.id}/audio")

      assert response(conn_user_a_header, 404)
      assert json_response(conn_user_a_header, 404)["error"] == "Recording not found"

      # 2. User A attempts to GET User B's recording using User A's client_id query param
      conn_user_a_param =
        get(conn, ~p"/api/recordings/#{user_b_recording.id}/audio?client_id=user_a")

      assert response(conn_user_a_param, 404)
      assert json_response(conn_user_a_param, 404)["error"] == "Recording not found"

      # 3. Unauthenticated request without client_id header or param also returns 404
      conn_anon = get(conn, ~p"/api/recordings/#{user_b_recording.id}/audio")
      assert response(conn_anon, 404)
      assert json_response(conn_anon, 404)["error"] == "Recording not found"

      # 4. User B can legitimately access their own recording
      conn_user_b =
        conn
        |> put_req_header("x-client-id", "user_b")
        |> get(~p"/api/recordings/#{user_b_recording.id}/audio")

      assert response(conn_user_b, 200) == @sample_binary
    end
  end
end
