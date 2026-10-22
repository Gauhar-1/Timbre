defmodule TimbreWeb.RecordingControllerTest do
  use TimbreWeb.ConnCase

  alias Timbre.Recordings

  @sample_binary <<26, 69, 223, 163, 1, 0, 0, 0, 1, 2, 3, 4>>

  defp fixture(:recording) do
    {:ok, recording} =
      Recordings.create_recording(%{
        title: "Test Voice Note",
        audio_blob: @sample_binary,
        content_type: "audio/webm",
        duration_ms: 3500
      })

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
      assert first["content_type"] == "audio/webm"
      assert first["duration_ms"] == 3500
      refute Map.has_key?(first, "audio_blob")
    end
  end

  describe "create" do
    test "creates recording from multipart upload", %{conn: conn} do
      tmp_path = Path.join(System.tmp_dir!(), "test_recording_#{System.unique_integer([:positive])}.webm")
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
          "duration_ms" => "4200"
        })

      assert %{"id" => id, "title" => "My First Take", "content_type" => "audio/webm", "duration_ms" => 4200} =
               json_response(conn, 201)

      saved = Recordings.get_recording(id)
      assert saved.audio_blob == @sample_binary
    end

    test "returns 400 when audio file is missing", %{conn: conn} do
      conn = post(conn, ~p"/api/recordings", %{"title" => "Empty"})
      assert json_response(conn, 400)["error"]
    end
  end

  describe "show" do
    test "serves raw audio binary directly with content-type header", %{conn: conn} do
      recording = fixture(:recording)

      conn = get(conn, ~p"/api/recordings/#{recording.id}/audio")
      assert response(conn, 200) == @sample_binary
      assert get_resp_header(conn, "content-type") == ["audio/webm"]
    end

    test "returns 404 when recording does not exist", %{conn: conn} do
      fake_id = "00000000-0000-0000-0000-000000000000"
      conn = get(conn, ~p"/api/recordings/#{fake_id}/audio")
      assert json_response(conn, 404)["error"] == "Recording not found"
    end
  end
end
