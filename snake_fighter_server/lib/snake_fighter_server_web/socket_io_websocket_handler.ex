defmodule SnakeFighterServerWeb.SocketIOWebSocketHandler do
  @moduledoc """
  WebSocket handler for Socket.IO connections implementing WebSock behavior
  """
  
  @behaviour WebSock
  
  alias SnakeFighterServer.{SocketIO, EngineIO}
  alias SnakeFighterServerWeb.SocketIOHandler
  
  require Logger
  
  def init(state) do
    # Send handshake for new connections
    case state.socket.connected do
      false ->
        {response_packets, updated_socket} = SocketIO.handshake(state.socket)
        
        # Update session
        SocketIOHandler.update_session(state.session_id, updated_socket)
        
        # Send handshake packets
        responses = Enum.map(response_packets, fn packet -> {:text, packet} end)
        
        # Schedule ping timer
        ping_timer = schedule_ping(updated_socket.engine_session.ping_interval)
        
        updated_state = %{state | socket: updated_socket, ping_timer: ping_timer}
        
        {:push, responses, updated_state}
      
      true ->
        # Already connected (upgraded from polling)
        # Send upgrade confirmation
        upgrade_packet = EngineIO.encode_packet(EngineIO.packet_types().upgrade)
        
        # Schedule ping timer
        ping_timer = schedule_ping(state.socket.engine_session.ping_interval)
        
        updated_state = %{state | ping_timer: ping_timer}
        
        {:push, {:text, upgrade_packet}, updated_state}
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
    {:push, {:text, packet}, state}
  end
  
  def handle_info(:ping, state) do
    ping_packet = EngineIO.encode_packet(EngineIO.packet_types().ping)
    
    # Reschedule ping
    ping_timer = schedule_ping(state.socket.engine_session.ping_interval)
    
    updated_state = %{state | ping_timer: ping_timer}
    
    {:push, {:text, ping_packet}, updated_state}
  end
  
  def handle_info(_info, state) do
    {:ok, state}
  end
  
  def terminate(_reason, state) do
    # Cancel ping timer
    if state.ping_timer do
      Process.cancel_timer(state.ping_timer)
    end
    
    # Clean up session
    SocketIOHandler.remove_session(state.session_id)
    
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