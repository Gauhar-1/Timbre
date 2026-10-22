defmodule Timbre.RecordingsTest do
  use Timbre.DataCase

  alias Timbre.Recordings
  alias Timbre.Recordings.Recording

  describe "recordings" do
    @valid_attrs %{
      title: "Sample Voice Note",
      audio_blob: <<0, 1, 2, 3, 4, 5>>,
      content_type: "audio/webm",
      duration_ms: 12000,
      transcript: "Hello world",
      summary: "A greeting"
    }
    @invalid_attrs %{title: nil, audio_blob: nil, content_type: nil}

    test "list_recordings/0 returns all recordings and omits audio_blob" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)
      recordings = Recordings.list_recordings()

      assert length(recordings) == 1
      first = hd(recordings)
      assert first.id == recording.id
      assert first.title == "Sample Voice Note"
      assert first.content_type == "audio/webm"
      assert first.duration_ms == 12000
      assert first.audio_blob == nil
    end

    test "get_recording/1 returns the recording with audio_blob loaded" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)
      found = Recordings.get_recording(recording.id)

      assert found.id == recording.id
      assert found.audio_blob == <<0, 1, 2, 3, 4, 5>>
    end

    test "create_recording/1 with valid data creates a recording" do
      assert {:ok, %Recording{} = recording} = Recordings.create_recording(@valid_attrs)
      assert recording.title == "Sample Voice Note"
      assert recording.content_type == "audio/webm"
      assert recording.audio_blob == <<0, 1, 2, 3, 4, 5>>
      assert recording.duration_ms == 12000
      assert recording.transcript == "Hello world"
      assert recording.summary == "A greeting"
    end

    test "create_recording/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Recordings.create_recording(@invalid_attrs)
    end

    test "delete_recording/1 deletes the recording" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)
      assert {:ok, %Recording{}} = Recordings.delete_recording(recording)
      assert Recordings.get_recording(recording.id) == nil
    end
  end
end
