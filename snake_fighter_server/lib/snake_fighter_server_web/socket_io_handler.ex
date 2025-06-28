defmodule SnakeFighterServerWeb.SocketIOHandler do
  @moduledoc """
  Handles Socket.IO session management and game event routing
  """
  
  use GenServer
  
  alias SnakeFighterServer.{SocketIO, GameRoom}
  
  require Logger
  
  # Client API
  
  def start_link(_) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end
  
  @doc """
  Registers a new Socket.IO session
  """
  def register_session(session_id, socket) do
    GenServer.call(__MODULE__, {:register_session, session_id, socket})
  end
  
  @doc """
  Gets a Socket.IO session
  """
  def get_session(session_id) do
    GenServer.call(__MODULE__, {:get_session, session_id})
  end
  
  @doc """
  Updates a Socket.IO session
  """
  def update_session(session_id, socket) do
    GenServer.call(__MODULE__, {:update_session, session_id, socket})
  end
  
  @doc """
  Removes a Socket.IO session
  """
  def remove_session(session_id) do
    GenServer.call(__MODULE__, {:remove_session, session_id})
  end
  
  @doc """
  Gets pending messages for a session (polling transport)
  """
  def get_pending_messages(session_id) do
    GenServer.call(__MODULE__, {:get_pending_messages, session_id})
  end
  
  @doc """
  Handles an incoming Socket.IO packet
  """
  def handle_socket_packet(session_id, packet) do
    GenServer.cast(__MODULE__, {:handle_packet, session_id, packet})
  end
  
  @doc """
  Sends a packet to a specific session
  """
  def send_to_session(session_id, packet) do
    GenServer.cast(__MODULE__, {:send_packet, session_id, packet})
  end
  
  @doc """
  Broadcasts a packet to all sessions in a room
  """
  def broadcast_to_room(room, packet, exclude_session \\ nil) do
    GenServer.cast(__MODULE__, {:broadcast_room, room, packet, exclude_session})
  end
  
  # Server callbacks
  
  @impl true
  def init(_) do
    # Sessions: %{session_id => socket}
    # User data: %{session_id => %{name: string, room: string}}
    # Rooms: %{room_id => GameRoom.t()}
    # Pending messages: %{session_id => [packet]}
    # WebSocket processes: %{session_id => pid}
    
    state = %{
      sessions: %{},
      users: %{},
      rooms: %{},
      pending_messages: %{},
      websocket_processes: %{}
    }
    
    {:ok, state}
  end
  
  @impl true
  def handle_call({:register_session, session_id, socket}, _from, state) do
    new_sessions = Map.put(state.sessions, session_id, socket)
    new_pending = Map.put(state.pending_messages, session_id, [])
    
    new_state = %{state | 
      sessions: new_sessions,
      pending_messages: new_pending
    }
    
    {:reply, :ok, new_state}
  end
  
  @impl true
  def handle_call({:get_session, session_id}, _from, state) do
    session = Map.get(state.sessions, session_id)
    {:reply, session, state}
  end
  
  @impl true
  def handle_call({:update_session, session_id, socket}, _from, state) do
    new_sessions = Map.put(state.sessions, session_id, socket)
    new_state = %{state | sessions: new_sessions}
    {:reply, :ok, new_state}
  end
  
  @impl true
  def handle_call({:remove_session, session_id}, _from, state) do
    # Handle user leaving room if they were in one
    case Map.get(state.users, session_id) do
      %{room: room_id} when room_id != nil ->
        handle_leave_room(session_id, room_id, state)
      _ ->
        state
    end
    
    new_state = %{state |
      sessions: Map.delete(state.sessions, session_id),
      users: Map.delete(state.users, session_id),
      pending_messages: Map.delete(state.pending_messages, session_id),
      websocket_processes: Map.delete(state.websocket_processes, session_id)
    }
    
    {:reply, :ok, new_state}
  end
  
  @impl true
  def handle_call({:get_pending_messages, session_id}, _from, state) do
    messages = Map.get(state.pending_messages, session_id, [])
    # Clear pending messages after retrieving them
    new_pending = Map.put(state.pending_messages, session_id, [])
    new_state = %{state | pending_messages: new_pending}
    
    {:reply, Enum.reverse(messages), new_state}
  end
  
  @impl true
  def handle_cast({:handle_packet, session_id, packet}, state) do
    new_state = handle_socket_io_packet(session_id, packet, state)
    {:noreply, new_state}
  end
  
  @impl true
  def handle_cast({:send_packet, session_id, packet}, state) do
    new_state = send_packet_to_session(session_id, packet, state)
    {:noreply, new_state}
  end
  
  @impl true
  def handle_cast({:broadcast_room, room, packet, exclude_session}, state) do
    new_state = broadcast_packet_to_room(room, packet, exclude_session, state)
    {:noreply, new_state}
  end
  
  # Private functions
  
  defp handle_socket_io_packet(session_id, packet, state) do
    socket_types = SocketIO.packet_types()
    
    case packet.type do
      type when type == socket_types.event ->
        handle_event_packet(session_id, packet, state)
      
      type when type == socket_types.disconnect ->
        # Handle disconnect
        state
      
      _ ->
        Logger.debug("Unhandled Socket.IO packet type: #{packet.type}")
        state
    end
  end
  
  defp handle_event_packet(session_id, packet, state) do
    case packet.data do
      [event_name | event_args] ->
        handle_game_event(session_id, event_name, event_args, state)
      
      _ ->
        Logger.warning("Invalid event packet format")
        state
    end
  end
  
  defp handle_game_event(session_id, "create-room", [player_name], state) do
    room_id = generate_room_id()
    
    # Create new game room
    game_room = GameRoom.new(room_id, session_id, player_name)
    
    # Update user data
    user_data = %{name: player_name, room: room_id}
    new_users = Map.put(state.users, session_id, user_data)
    new_rooms = Map.put(state.rooms, room_id, game_room)
    
    # Send response
    response = SocketIO.emit_event("room-created", %{roomId: room_id, players: game_room.players})
    send_packet_to_session(session_id, response, state)
    
    %{state | users: new_users, rooms: new_rooms}
  end
  
  defp handle_game_event(session_id, "join-room", [room_id, player_name], state) do
    case Map.get(state.rooms, room_id) do
      nil ->
        # Room not found
        error_response = SocketIO.emit_event("error", %{message: "Room not found"})
        send_packet_to_session(session_id, error_response, state)
        state
      
      game_room ->
        case GameRoom.add_player(game_room, session_id, player_name) do
          {:ok, updated_room} ->
            # Update user data and room
            user_data = %{name: player_name, room: room_id}
            new_users = Map.put(state.users, session_id, user_data)
            new_rooms = Map.put(state.rooms, room_id, updated_room)
            
            # Notify all players in room
            join_response = SocketIO.emit_event("room-joined", %{roomId: room_id, players: updated_room.players})
            player_joined_response = SocketIO.emit_event("player-joined", %{player: %{id: session_id, name: player_name, color: updated_room.players[session_id].color}})
            
            send_packet_to_session(session_id, join_response, state)
            broadcast_packet_to_room(room_id, player_joined_response, session_id, %{state | users: new_users, rooms: new_rooms})
            
            %{state | users: new_users, rooms: new_rooms}
          
          {:error, reason} ->
            error_response = SocketIO.emit_event("error", %{message: reason})
            send_packet_to_session(session_id, error_response, state)
            state
        end
    end
  end
  
  defp handle_game_event(session_id, "start-game", [], state) do
    case get_user_room(session_id, state) do
      nil ->
        state
      
      room_id ->
        case Map.get(state.rooms, room_id) do
          nil -> state
          game_room ->
            case GameRoom.start_game(game_room, session_id) do
              {:ok, updated_room} ->
                new_rooms = Map.put(state.rooms, room_id, updated_room)
                
                # Notify all players
                start_response = SocketIO.emit_event("countdown-start", %{})
                new_state = %{state | rooms: new_rooms}
                broadcast_packet_to_room(room_id, start_response, nil, new_state)
                
                # Schedule countdown
                schedule_countdown(room_id, 3)
                
                new_state
              
              {:error, _reason} ->
                state
            end
        end
    end
  end
  
  defp handle_game_event(session_id, "player-direction", [direction], state) do
    case get_user_room(session_id, state) do
      nil -> state
      room_id ->
        case Map.get(state.rooms, room_id) do
          nil -> state
          game_room ->
            case GameRoom.update_player_direction(game_room, session_id, direction) do
              {:ok, updated_room} ->
                %{state | rooms: Map.put(state.rooms, room_id, updated_room)}
              
              {:error, _} ->
                state
            end
        end
    end
  end
  
  defp handle_game_event(session_id, "place-obstacle", [position], state) do
    case get_user_room(session_id, state) do
      nil -> state
      room_id ->
        case Map.get(state.rooms, room_id) do
          nil -> state
          game_room ->
            case GameRoom.place_obstacle(game_room, session_id, position) do
              {:ok, updated_room} ->
                %{state | rooms: Map.put(state.rooms, room_id, updated_room)}
              
              {:error, _} ->
                state
            end
        end
    end
  end
  
  defp handle_game_event(session_id, "leave-room", [], state) do
    case get_user_room(session_id, state) do
      nil -> state
      room_id -> handle_leave_room(session_id, room_id, state)
    end
  end
  
  defp handle_game_event(_session_id, event_name, _args, state) do
    Logger.debug("Unhandled game event: #{event_name}")
    state
  end
  
  defp handle_leave_room(session_id, room_id, state) do
    case Map.get(state.rooms, room_id) do
      nil -> state
      game_room ->
        case GameRoom.remove_player(game_room, session_id) do
          {:ok, updated_room} ->
            new_rooms = if Enum.empty?(updated_room.players) do
              Map.delete(state.rooms, room_id)
            else
              Map.put(state.rooms, room_id, updated_room)
            end
            
            # Notify remaining players
            if not Enum.empty?(updated_room.players) do
              user_data = Map.get(state.users, session_id, %{})
              left_response = SocketIO.emit_event("player-left", %{playerId: session_id, playerName: user_data[:name]})
              broadcast_packet_to_room(room_id, left_response, session_id, state)
            end
            
            %{state | rooms: new_rooms}
          
          {:error, _} ->
            state
        end
    end
  end
  
  defp send_packet_to_session(session_id, packet, state) do
    socket = Map.get(state.sessions, session_id)
    
    if socket && socket.engine_session.transport == "websocket" do
      # Send directly to WebSocket process
      case Map.get(state.websocket_processes, session_id) do
        nil -> state
        pid when is_pid(pid) ->
          send(pid, {:send_packet, packet})
          state
      end
    else
      # Add to pending messages for polling transport
      current_messages = Map.get(state.pending_messages, session_id, [])
      new_messages = [packet | current_messages]
      new_pending = Map.put(state.pending_messages, session_id, new_messages)
      
      %{state | pending_messages: new_pending}
    end
  end
  
  defp broadcast_packet_to_room(room_id, packet, exclude_session, state) do
    case Map.get(state.rooms, room_id) do
      nil -> state
      game_room ->
        session_ids = Map.keys(game_room.players)
        
        Enum.reduce(session_ids, state, fn session_id, acc_state ->
          if session_id != exclude_session do
            send_packet_to_session(session_id, packet, acc_state)
          else
            acc_state
          end
        end)
    end
  end
  
  defp get_user_room(session_id, state) do
    case Map.get(state.users, session_id) do
      %{room: room_id} -> room_id
      _ -> nil
    end
  end
  
  defp generate_room_id do
    :crypto.strong_rand_bytes(4)
    |> Base.encode16(case: :lower)
  end
  
  defp schedule_countdown(room_id, count) when count > 0 do
    Process.send_after(self(), {:countdown_tick, room_id, count}, 1000)
  end
  
  defp schedule_countdown(room_id, 0) do
    Process.send_after(self(), {:start_game_loop, room_id}, 100)
  end
  
  @impl true
  def handle_info({:countdown_tick, room_id, count}, state) do
    # Send countdown tick to all players in room
    tick_response = SocketIO.emit_event("countdown-tick", %{count: count})
    new_state = broadcast_packet_to_room(room_id, tick_response, nil, state)
    
    # Schedule next tick or game start
    schedule_countdown(room_id, count - 1)
    
    {:noreply, new_state}
  end
  
  @impl true
  def handle_info({:start_game_loop, room_id}, state) do
    case Map.get(state.rooms, room_id) do
      nil ->
        {:noreply, state}
      
      game_room ->
        # Start the actual game
        updated_room = %{game_room | state: :playing}
        start_response = SocketIO.emit_event("game-start", %{gameState: GameRoom.get_game_state(updated_room)})
        
        new_rooms = Map.put(state.rooms, room_id, updated_room)
        new_state = %{state | rooms: new_rooms}
        
        broadcast_packet_to_room(room_id, start_response, nil, new_state)
        
        # Schedule first game tick
        Process.send_after(self(), {:game_tick, room_id}, 150)
        
        {:noreply, new_state}
    end
  end
  
  @impl true
  def handle_info({:game_tick, room_id}, state) do
    case Map.get(state.rooms, room_id) do
      nil ->
        {:noreply, state}
      
      %{state: :playing} = game_room ->
        case GameRoom.tick(game_room) do
          {:ok, updated_room} ->
            new_rooms = Map.put(state.rooms, room_id, updated_room)
            new_state = %{state | rooms: new_rooms}
            
            # Send game update
            update_response = SocketIO.emit_event("game-update", %{gameState: GameRoom.get_game_state(updated_room)})
            broadcast_packet_to_room(room_id, update_response, nil, new_state)
            
            # Schedule next tick if game is still playing
            if updated_room.state == :playing do
              Process.send_after(self(), {:game_tick, room_id}, 150)
            else
              # Game ended
              end_response = SocketIO.emit_event("game-end", %{
                winner: updated_room.winner,
                finalState: GameRoom.get_game_state(updated_room)
              })
              broadcast_packet_to_room(room_id, end_response, nil, new_state)
            end
            
            {:noreply, new_state}
          
          {:error, _} ->
            {:noreply, state}
        end
      
      _ ->
        {:noreply, state}
    end
  end
  
  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end
end