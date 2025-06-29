defmodule SnakeFighterServerWeb.SocketIOController do
  use SnakeFighterServerWeb, :controller

  alias SnakeFighterServer.{SocketIO, EngineIO}
  alias SnakeFighterServerWeb.SocketIOHandler

  require Logger

  @doc """
  Handles Engine.IO polling transport requests and WebSocket upgrades
  """
  def polling(conn, params) do
    # Check if this is a WebSocket upgrade request (GET with Upgrade header)
    websocket_upgrade = get_req_header(conn, "upgrade") |> List.first()
    transport = Map.get(params, "transport")
    
    cond do
      # WebSocket upgrade request (GET with Upgrade: websocket header)
      conn.method == "GET" and websocket_upgrade == "websocket" ->
        handle_websocket_upgrade(conn, params)
      
      # WebSocket transport polling (used during upgrade process)
      transport == "websocket" ->
        # This is actually a polling request with websocket transport param
        # which happens during the upgrade process
        case Map.get(params, "sid") do
          nil ->
            handle_new_connection(conn, params)
          session_id ->
            handle_existing_connection(conn, session_id, params)
        end
      
      # Regular HTTP polling request
      true ->
        case Map.get(params, "sid") do
          nil ->
            # New connection handshake
            handle_new_connection(conn, params)

          session_id ->
            # Existing connection
            handle_existing_connection(conn, session_id, params)
        end
    end
  end

  defp handle_new_connection(conn, params) do
    # Validate required parameters
    with {:ok, transport} <- validate_transport(params),
         {:ok, eio_version} <- validate_eio_version(params) do
      
      # Create new Socket.IO connection
      socket = SocketIO.new_connection(transport)

      # Store session in registry
      SocketIOHandler.register_session(socket.engine_session.session_id, socket)

      # Generate Engine.IO handshake response only (no Socket.IO connect)
      {response_packets, updated_socket} = SocketIO.handshake(socket)

      # Update stored session
      SocketIOHandler.update_session(socket.engine_session.session_id, updated_socket)

      # Send response
      response_body = Enum.join(response_packets, "")

      conn
      |> put_resp_header("access-control-allow-origin", "*")
      |> put_resp_header("access-control-allow-credentials", "true")
      |> put_resp_header("access-control-allow-methods", "GET,HEAD,PUT,PATCH,POST,DELETE")
      |> put_resp_header("access-control-allow-headers", "content-type")
      |> put_resp_content_type("text/plain")
      |> send_resp(200, response_body)
    else
      {:error, reason} ->
        Logger.warning("Invalid handshake parameters: #{reason}")
        conn
        |> put_resp_header("access-control-allow-origin", "*")
        |> send_resp(400, reason)
    end
  end

  defp handle_existing_connection(conn, session_id, params) do
    Logger.debug("Looking up session: #{session_id}")
    case SocketIOHandler.get_session(session_id) do
      nil ->
        # Session not found
        Logger.warning("Session not found: #{session_id}")
        conn
        |> put_resp_header("access-control-allow-origin", "*")
        |> send_resp(400, "Session not found")

      socket ->
        Logger.debug("Found session #{session_id}, method: #{conn.method}")
        case conn.method do
          "GET" ->
            handle_polling_get(conn, socket, params)

          "POST" ->
            handle_polling_post(conn, socket, params)

          _ ->
            Logger.warning("Unsupported method: #{conn.method}")
            conn
            |> put_resp_header("access-control-allow-origin", "*")
            |> send_resp(405, "Method not allowed")
        end
    end
  end

  defp handle_polling_get(conn, socket, _params) do
    # Check for pending messages
    messages = SocketIOHandler.get_pending_messages(socket.engine_session.session_id)

    # DON'T send Socket.IO connect packet automatically - wait for client to send CONNECT first
    # This is required by Socket.IO v5 protocol

    # Check if ping is needed
    {ping_packet, updated_socket} =
      if SocketIO.needs_ping?(socket) do
        SocketIO.handle_ping(socket)
      else
        {nil, socket}
      end

    # Update session if changed
    if updated_socket != socket do
      SocketIOHandler.update_session(socket.engine_session.session_id, updated_socket)
    end

    # Prepare response using proper Engine.IO payload encoding
    all_packets = messages ++ if ping_packet, do: [ping_packet], else: []
    response_body = if length(all_packets) > 1 do
      EngineIO.encode_payload(all_packets)
    else
      Enum.join(all_packets, "")
    end

    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-credentials", "true")
    |> put_resp_content_type("text/plain")
    |> send_resp(200, response_body)
  end

  defp handle_polling_post(conn, socket, _params) do
    Logger.debug("Starting POST request handling for session: #{socket.engine_session.session_id}")
    # Read request body
    case Plug.Conn.read_body(conn) do
      {:ok, body, conn} ->
        Logger.debug("POST body received: #{inspect(body)}")

        # Handle empty body
        if body == "" do
          conn
          |> put_resp_header("access-control-allow-origin", "*")
          |> put_resp_header("access-control-allow-credentials", "true")
          |> send_resp(200, "ok")
        else
          # Handle incoming packet(s)
          try do
            handle_incoming_packet(socket.engine_session.session_id, body)

            conn
            |> put_resp_header("access-control-allow-origin", "*")
            |> put_resp_header("access-control-allow-credentials", "true")
            |> send_resp(200, "ok")
          rescue
            error ->
              Logger.error("Error handling incoming packet: #{inspect(error)}")

              conn
              |> put_resp_header("access-control-allow-origin", "*")
              |> send_resp(400, "Bad Request")
          end
        end

      {:error, reason} ->
        Logger.error("Failed to read request body: #{inspect(reason)}")

        conn
        |> put_resp_header("access-control-allow-origin", "*")
        |> send_resp(400, "Bad Request")
    end
  end

  defp handle_incoming_packet(session_id, packet) do
    Logger.debug("Processing incoming packet for session #{session_id}: #{inspect(packet)}")

    # Use the improved payload decoding from EngineIO
    case EngineIO.decode_payload(packet) do
      {:ok, decoded_packets} ->
        Logger.debug("Decoded packets: #{inspect(decoded_packets)}")
        Enum.each(decoded_packets, fn {engine_type, engine_data} ->
          handle_engine_packet(session_id, engine_type, engine_data)
        end)

      {:error, reason} ->
        Logger.error("Failed to decode Engine.IO payload: #{inspect(reason)} - packet: #{inspect(packet)}")
        # Re-raise the error so the caller can handle it
        raise "Packet decode error: #{inspect(reason)}"
    end
  end

  defp handle_engine_packet(session_id, engine_type, engine_data) do
    engine_types = EngineIO.packet_types()

    case engine_type do
      type when type == engine_types.ping ->
        # Handle ping - send pong response and update session
        case SocketIOHandler.get_session(session_id) do
          nil -> :ok
          socket ->
            {pong_packet, updated_socket} = SocketIO.handle_ping(socket)
            SocketIOHandler.update_session(session_id, updated_socket)
            SocketIOHandler.send_to_session(session_id, pong_packet)
        end

      type when type == engine_types.message ->
        # Handle Socket.IO message
        handle_socket_message(session_id, engine_data)

      type when type == engine_types.close ->
        # Handle connection close
        Logger.debug("Received close packet for session: #{session_id}")
        SocketIOHandler.remove_session(session_id)

      _ ->
        Logger.debug("Unhandled Engine.IO packet type: #{engine_type}")
    end
  end

  defp handle_socket_message(session_id, message_data) do
    case SocketIO.decode_packet(
           EngineIO.encode_packet(EngineIO.packet_types().message, message_data)
         ) do
      {:ok, socket_packet} ->
        SocketIOHandler.handle_socket_packet(session_id, socket_packet)

      {:error, reason} ->
        Logger.warning("Failed to decode Socket.IO packet: #{inspect(reason)}")
    end
  end

  defp handle_websocket_upgrade(conn, params) do
    # Extract query parameters
    session_id = Map.get(params, "sid")
    transport = Map.get(params, "transport", "websocket")

    Logger.debug("WebSocket upgrade request - sid: #{inspect(session_id)}, transport: #{transport}")

    case session_id do
      nil ->
        # New WebSocket connection
        Logger.debug("Creating new WebSocket connection")
        socket = SocketIO.new_connection(transport)

        # Register session
        SocketIOHandler.register_session(socket.engine_session.session_id, socket)

        # Upgrade to WebSocket
        WebSockAdapter.upgrade(conn, SnakeFighterServerWeb.SocketIOWebSocketHandler, %{
          session_id: socket.engine_session.session_id,
          socket: socket,
          ping_timer: nil
        }, timeout: 60_000)

      session_id ->
        # Upgrade existing polling connection to WebSocket
        Logger.debug("Upgrading existing session #{session_id} to WebSocket")
        case SocketIOHandler.get_session(session_id) do
          nil ->
            Logger.warning("Cannot upgrade - session not found: #{session_id}")
            conn
            |> put_resp_header("access-control-allow-origin", "*")
            |> put_resp_content_type("text/plain")
            |> send_resp(400, "Session not found")

          socket ->
            Logger.debug("Found session for upgrade: #{session_id}")
            # DON'T upgrade transport yet - wait for Engine.IO upgrade sequence to complete
            # The WebSocket handler will handle the upgrade process
            
            # Upgrade to WebSocket - keep current transport state
            WebSockAdapter.upgrade(conn, SnakeFighterServerWeb.SocketIOWebSocketHandler, %{
              session_id: session_id,
              socket: socket,
              ping_timer: nil
            }, timeout: 60_000)
        end
    end
  rescue
    error ->
      Logger.error("Error in WebSocket upgrade: #{inspect(error)}")

      conn
      |> put_resp_header("access-control-allow-origin", "*")
      |> put_resp_content_type("text/plain")
      |> send_resp(500, "Internal Server Error")
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

  # Private helper functions for parameter validation
  
  defp validate_transport(params) do
    case Map.get(params, "transport") do
      transport when transport in ["polling", "websocket"] -> {:ok, transport}
      nil -> {:error, "Missing transport parameter"}
      invalid -> {:error, "Invalid transport: #{invalid}"}
    end
  end
  
  defp validate_eio_version(params) do
    case Map.get(params, "EIO") do
      "4" -> {:ok, 4}
      nil -> {:error, "Missing EIO parameter"}
      invalid -> {:error, "Unsupported EIO version: #{invalid}"}
    end
  end
end
