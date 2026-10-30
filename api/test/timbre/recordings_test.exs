defmodule Timbre.RecordingsTest do
  use Timbre.DataCase

  alias Timbre.Recordings
  alias Timbre.Recordings.Recording

  describe "recordings" do
    @valid_attrs %{
      title: "Sample Voice Note",
      client_id: "user_a",
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

    test "get_recording/2 returns the recording when client_id matches" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)
      found = Recordings.get_recording(recording.id, "user_a")

      assert found.id == recording.id
      assert found.audio_blob == <<0, 1, 2, 3, 4, 5>>
    end

    test "get_recording/2 returns nil when client_id does not match (tenant isolation)" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)
      assert Recordings.get_recording(recording.id, "user_b") == nil
      assert Recordings.get_recording(recording.id, nil) == nil
      assert Recordings.get_recording(recording.id, "") == nil
    end

    test "get_recording!/2 raises Ecto.NoResultsError on client_id mismatch" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)

      assert_raise Ecto.NoResultsError, fn ->
        Recordings.get_recording!(recording.id, "user_b")
      end

      assert_raise Ecto.NoResultsError, fn ->
        Recordings.get_recording!(recording.id, nil)
      end
    end

    test "create_recording/1 with valid data creates a recording" do
      assert {:ok, %Recording{} = recording} = Recordings.create_recording(@valid_attrs)
      assert recording.title == "Sample Voice Note"
      assert recording.client_id == "user_a"
      assert recording.content_type == "audio/webm"
      assert recording.audio_blob == <<0, 1, 2, 3, 4, 5>>
      assert recording.duration_ms == 12000
      assert recording.transcript == "Hello world"
      assert recording.summary == "A greeting"
    end

    test "create_recording/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Recordings.create_recording(@invalid_attrs)
    end

    test "update_recording/3 updates the recording for matching client_id" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)

      assert {:ok, updated} =
               Recordings.update_recording(recording.id, "user_a", %{title: "New Title"})

      assert updated.title == "New Title"

      # Fails for mismatched client_id
      assert Recordings.update_recording(recording.id, "user_b", %{title: "Hacked Title"}) ==
               {:error, :not_found}
    end

    test "delete_recording/2 deletes the recording for matching client_id" do
      {:ok, recording} = Recordings.create_recording(@valid_attrs)

      # Attempt delete with wrong client_id returns {:error, :not_found}
      assert Recordings.delete_recording(recording.id, "user_b") == {:error, :not_found}
      assert Recordings.get_recording(recording.id, "user_a") != nil

      # Delete with correct client_id succeeds
      assert {:ok, %Recording{}} = Recordings.delete_recording(recording.id, "user_a")
      assert Recordings.get_recording(recording.id, "user_a") == nil
    end
  end
end
