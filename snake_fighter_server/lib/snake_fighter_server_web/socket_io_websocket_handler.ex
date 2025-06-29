defmodule SnakeFighterServerWeb.SocketIOWebSocketHandler do
  @moduledoc """
  WebSocket handler for Socket.IO connections implementing WebSock behavior
  """

  @behaviour WebSock

  alias SnakeFighterServer.{SocketIO, EngineIO}
  alias SnakeFighterServerWeb.SocketIOHandler

  require Logger

  def init(state) do
    try do
      # Check if this is an upgrade from polling by looking at existing session state
      existing_session = SocketIOHandler.get_session(state.session_id)
      
      case existing_session do
        nil ->
          # New WebSocket-only connection (no existing session)
          {response_packets, updated_socket} = SocketIO.handshake(state.socket)

          # Update session
          SocketIOHandler.update_session(state.session_id, updated_socket)

          # Send handshake packets
          responses = Enum.map(response_packets, fn packet -> {:text, packet} end)

          # Schedule ping timer
          ping_timer = schedule_ping(updated_socket.engine_session.ping_interval)

          updated_state = Map.merge(state, %{socket: updated_socket, ping_timer: ping_timer})

          {:push, responses, updated_state}

        existing_socket ->
          # Upgrading from existing polling transport - wait for probe
          # Register WebSocket process for this session
          SocketIOHandler.register_websocket_process(state.session_id, self())

          # Schedule ping timer
          ping_timer = schedule_ping(existing_socket.engine_session.ping_interval)

          # Use existing socket and set upgrade state
          updated_state = Map.merge(state, %{
            socket: existing_socket,
            ping_timer: ping_timer, 
            upgrade_state: :waiting_probe
          })

          {:ok, updated_state}
      end
    rescue
      error ->
        Logger.error("Error in WebSocket handler init for session #{state.session_id}: #{inspect(error)}")
        {:stop, :error}
    end
  end

  def handle_in({text, [opcode: :text]}, state) do
    handle_incoming_packet(state.session_id, text, state)
  end

  def handle_in({_binary, [opcode: :binary]}, state) do
    # Handle binary data if needed
    {:ok, state}
  end

  def handle_in(_frame, state) do
    {:ok, state}
  end

  def handle_info({:send_packet, packet}, state) do
    Logger.debug("WebSocket sending packet for session #{state.session_id}: #{inspect(packet)}")
    {:push, {:text, packet}, state}
  end

  def handle_info(:ping, state) do
    ping_packet = EngineIO.encode_packet(EngineIO.packet_types().ping)

    # Reschedule ping
    ping_timer = schedule_ping(state.socket.engine_session.ping_interval)

    updated_state = Map.put(state, :ping_timer, ping_timer)

    {:push, {:text, ping_packet}, updated_state}
  end

  def handle_info(_info, state) do
    {:ok, state}
  end

  def terminate(reason, state) do
    Logger.debug("WebSocket terminating for session #{state.session_id}, reason: #{inspect(reason)}")

    # Cancel ping timer
    if state.ping_timer do
      Process.cancel_timer(state.ping_timer)
    end

    # Only remove session if the termination reason indicates it was intentional
    # Don't remove sessions for failed upgrades or remote disconnections during upgrades
    case reason do
      :normal ->
        # Normal shutdown, safe to remove
        Logger.debug("Normal WebSocket termination, removing session #{state.session_id}")
        SocketIOHandler.remove_session(state.session_id)

      {:close, _code} ->
        # Client sent close frame, safe to remove
        Logger.debug("WebSocket closed by client, removing session #{state.session_id}")
        SocketIOHandler.remove_session(state.session_id)

      _ ->
        # Other reasons (like :remote, upgrade failures, etc.) - don't remove session
        Logger.debug("WebSocket termination reason #{inspect(reason)} - keeping session #{state.session_id} alive")
    end

    :ok
  end

  defp handle_incoming_packet(session_id, packet, state) do
    case EngineIO.decode_packet(packet) do
      {:ok, engine_type, engine_data} ->
        handle_engine_packet(session_id, engine_type, engine_data, state)

      {:error, reason} ->
        Logger.warning("Failed to decode Engine.IO packet: #{inspect(reason)}")
        {:ok, state}
    end
  end

  defp handle_engine_packet(session_id, engine_type, engine_data, state) do
    engine_types = EngineIO.packet_types()

    case engine_type do
      type when type == engine_types.ping ->
        # Handle ping with probe for upgrade process
        if engine_data == "probe" and Map.get(state, :upgrade_state) == :waiting_probe do
          # Send pong probe response
          pong_probe = EngineIO.encode_packet(engine_types.pong, "probe")
          updated_state = Map.put(state, :upgrade_state, :probe_sent)
          {:push, {:text, pong_probe}, updated_state}
        else
          # Regular ping, send pong
          pong_packet = EngineIO.encode_packet(engine_types.pong, engine_data)
          {:push, {:text, pong_packet}, state}
        end

      type when type == engine_types.pong ->
        # Handle pong response
        case SocketIOHandler.get_session(session_id) do
          nil -> {:ok, state}
          socket ->
            updated_engine = %{socket.engine_session | last_ping: DateTime.utc_now()}
            updated_socket = %{socket | engine_session: updated_engine}
            SocketIOHandler.update_session(session_id, updated_socket)
            {:ok, state}
        end

      type when type == engine_types.upgrade ->
        # Complete the upgrade process
        if Map.get(state, :upgrade_state) == :probe_sent do
          # Send noop to any pending polling requests
          SocketIOHandler.send_noop_to_polling(session_id)

          # Now upgrade the transport in the session
          case SocketIOHandler.get_session(session_id) do
            nil -> 
              Logger.warning("Session not found during upgrade completion: #{session_id}")
              {:ok, state}
            socket ->
              upgraded_engine = EngineIO.upgrade_transport(socket.engine_session)
              upgraded_socket = %{socket | engine_session: upgraded_engine}
              SocketIOHandler.update_session(session_id, upgraded_socket)
              
              # Update local state
              updated_state = %{state | socket: upgraded_socket}
              updated_state = Map.delete(updated_state, :upgrade_state)
              
              Logger.info("WebSocket upgrade completed for session: #{session_id}")
              {:ok, updated_state}
          end
        else
          Logger.warning("WebSocket upgrade received in incorrect state")
          {:ok, state}
        end

      type when type == engine_types.message ->
        # Handle Socket.IO message
        handle_socket_message(session_id, engine_data)
        {:ok, state}

      type when type == engine_types.close ->
        # Handle connection close
        SocketIOHandler.remove_session(session_id)
        {:ok, state}

      _ ->
        Logger.debug("Unhandled Engine.IO packet type: #{engine_type}")
        {:ok, state}
    end
  end

  defp handle_socket_message(session_id, message_data) do
    case SocketIO.decode_packet(EngineIO.encode_packet(EngineIO.packet_types().message, message_data)) do
      {:ok, socket_packet} ->
        SocketIOHandler.handle_socket_packet(session_id, socket_packet)

      {:error, reason} ->
        Logger.warning("Failed to decode Socket.IO packet: #{inspect(reason)}")
    end
  end

  defp schedule_ping(interval) do
    Process.send_after(self(), :ping, interval)
  end
end
