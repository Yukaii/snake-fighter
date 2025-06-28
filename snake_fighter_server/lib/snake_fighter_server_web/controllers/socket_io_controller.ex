defmodule SnakeFighterServerWeb.SocketIOController do
  use SnakeFighterServerWeb, :controller
  
  alias SnakeFighterServer.{SocketIO, EngineIO}
  alias SnakeFighterServerWeb.SocketIOHandler
  
  require Logger
  
  @doc """
  Handles Engine.IO polling transport requests
  """
  def polling(conn, params) do
    case Map.get(params, "sid") do
      nil ->
        # New connection handshake
        handle_new_connection(conn, params)
      
      session_id ->
        # Existing connection
        handle_existing_connection(conn, session_id, params)
    end
  end
  
  defp handle_new_connection(conn, params) do
    transport = Map.get(params, "transport", "polling")
    
    # Create new Socket.IO connection
    socket = SocketIO.new_connection(transport)
    
    # Store session in registry
    SocketIOHandler.register_session(socket.engine_session.session_id, socket)
    
    # Generate handshake response
    {response_packets, updated_socket} = SocketIO.handshake(socket)
    
    # Update stored session
    SocketIOHandler.update_session(socket.engine_session.session_id, updated_socket)
    
    # Send response
    response_body = Enum.join(response_packets, "\n")
    
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-credentials", "true")
    |> put_resp_header("access-control-allow-methods", "GET,HEAD,PUT,PATCH,POST,DELETE")
    |> put_resp_header("access-control-allow-headers", "content-type")
    |> put_resp_content_type("text/plain")
    |> send_resp(200, response_body)
  end
  
  defp handle_existing_connection(conn, session_id, params) do
    case SocketIOHandler.get_session(session_id) do
      nil ->
        # Session not found
        conn
        |> put_resp_header("access-control-allow-origin", "*")
        |> send_resp(400, "Session not found")
      
      socket ->
        case conn.method do
          "GET" ->
            handle_polling_get(conn, socket, params)
          
          "POST" ->
            handle_polling_post(conn, socket, params)
          
          _ ->
            send_resp(conn, 405, "Method not allowed")
        end
    end
  end
  
  defp handle_polling_get(conn, socket, _params) do
    # Check for pending messages
    messages = SocketIOHandler.get_pending_messages(socket.engine_session.session_id)
    
    # Check if ping is needed
    {ping_packet, updated_socket} = if SocketIO.needs_ping?(socket) do
      SocketIO.handle_ping(socket)
    else
      {nil, socket}
    end
    
    # Update session if changed
    if updated_socket != socket do
      SocketIOHandler.update_session(socket.engine_session.session_id, updated_socket)
    end
    
    # Prepare response
    response_packets = case ping_packet do
      nil -> messages
      ping -> [ping | messages]
    end
    
    response_body = Enum.join(response_packets, "\n")
    
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-credentials", "true")
    |> put_resp_content_type("text/plain")
    |> send_resp(200, response_body)
  end
  
  defp handle_polling_post(conn, socket, _params) do
    # Read request body
    {:ok, body, conn} = Plug.Conn.read_body(conn)
    
    # Parse and handle incoming packets
    packets = String.split(body, "\n", trim: true)
    
    Enum.each(packets, fn packet ->
      handle_incoming_packet(socket.engine_session.session_id, packet)
    end)
    
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-credentials", "true")
    |> send_resp(200, "ok")
  end
  
  defp handle_incoming_packet(session_id, packet) do
    case EngineIO.decode_packet(packet) do
      {:ok, engine_type, engine_data} ->
        handle_engine_packet(session_id, engine_type, engine_data)
      
      {:error, reason} ->
        Logger.warning("Failed to decode Engine.IO packet: #{inspect(reason)}")
    end
  end
  
  defp handle_engine_packet(session_id, engine_type, engine_data) do
    engine_types = EngineIO.packet_types()
    
    case engine_type do
      type when type == engine_types.ping ->
        # Handle ping - pong will be sent in next polling request
        :ok
      
      type when type == engine_types.message ->
        # Handle Socket.IO message
        handle_socket_message(session_id, engine_data)
      
      type when type == engine_types.close ->
        # Handle connection close
        SocketIOHandler.remove_session(session_id)
      
      _ ->
        Logger.debug("Unhandled Engine.IO packet type: #{engine_type}")
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
  
  @doc """
  Handles CORS preflight requests
  """
  def options(conn, _params) do
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-credentials", "true")
    |> put_resp_header("access-control-allow-methods", "GET,HEAD,PUT,PATCH,POST,DELETE")
    |> put_resp_header("access-control-allow-headers", "content-type")
    |> send_resp(200, "")
  end
end