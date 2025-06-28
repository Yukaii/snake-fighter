defmodule SnakeFighterServerWeb.SocketIOWebSocket do
  @moduledoc """
  WebSocket transport handler for Socket.IO connections
  """
  
  import Plug.Conn
  
  alias SnakeFighterServer.{SocketIO, EngineIO}
  alias SnakeFighterServerWeb.SocketIOHandler
  
  require Logger
  
  def init(opts), do: opts
  
  def call(conn, _opts) do
    case get_req_header(conn, "upgrade") do
      ["websocket"] ->
        # Handle WebSocket upgrade
        handle_websocket_upgrade(conn)
      _ ->
        # Not a WebSocket request, delegate to polling controller
        SnakeFighterServerWeb.SocketIOController.polling(conn, conn.query_params)
    end
  end
  
  defp handle_websocket_upgrade(conn) do
    # Extract query parameters
    query_params = conn.query_params
    session_id = Map.get(query_params, "sid")
    transport = Map.get(query_params, "transport", "websocket")
    
    case session_id do
      nil ->
        # New WebSocket connection
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
        case SocketIOHandler.get_session(session_id) do
          nil ->
            conn
            |> put_resp_content_type("text/plain")
            |> send_resp(400, "Session not found")
            |> halt()
          
          socket ->
            # Upgrade transport
            upgraded_engine = EngineIO.upgrade_transport(socket.engine_session)
            upgraded_socket = %{socket | engine_session: upgraded_engine}
            
            # Update session
            SocketIOHandler.update_session(session_id, upgraded_socket)
            
            # Upgrade to WebSocket
            WebSockAdapter.upgrade(conn, SnakeFighterServerWeb.SocketIOWebSocketHandler, %{
              session_id: session_id,
              socket: upgraded_socket,
              ping_timer: nil
            }, timeout: 60_000)
        end
    end
  end
end