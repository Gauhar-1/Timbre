defmodule TimbreWeb.RoomChannel do
  @moduledoc """
  Phoenix Channel handling real-time WebRTC mesh signaling.
  Exchanges SDP offers, answers, and ICE candidates between peers.
  """
  use TimbreWeb, :channel

  @impl true
  def join("room:" <> _room_id, _params, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_in("offer", payload, socket) do
    broadcast_from!(socket, "offer", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("answer", payload, socket) do
    broadcast_from!(socket, "answer", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("ice_candidate", payload, socket) do
    broadcast_from!(socket, "ice_candidate", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("peer_joined", payload, socket) do
    broadcast_from!(socket, "peer_joined", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("peer_left", payload, socket) do
    broadcast_from!(socket, "peer_left", payload)
    {:noreply, socket}
  end
end
