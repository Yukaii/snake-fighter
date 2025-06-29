defmodule SnakeFighterServer.GameRoom do
  @moduledoc """
  Game room logic for Snake Fighter game
  """
  
  # Game configuration
  @canvas_width 640
  @canvas_height 480
  @grid_size 20
  @max_snake_length 15
  @max_seeds 5
  @seed_spawn_interval 4000
  @obstacle_placement_cooldown 15000
  
  # Player colors
  @player_colors [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD"
  ]
  
  defstruct [
    :id,
    :host_id,
    :state,
    :players,
    :seeds,
    :obstacles,
    :winner,
    :last_seed_spawn,
    :game_start_time
  ]
  
  @type player :: %{
    id: String.t(),
    name: String.t(),
    color: String.t(),
    snake: [%{x: integer(), y: integer()}],
    alive: boolean(),
    score: integer(),
    direction: %{x: integer(), y: integer()},
    canPlaceObstacle: boolean(),
    lastObstacleTime: DateTime.t() | nil
  }
  
  @type t :: %__MODULE__{
    id: String.t(),
    host_id: String.t(),
    state: :waiting | :countdown | :playing | :finished,
    players: %{String.t() => player()},
    seeds: [%{x: integer(), y: integer()}],
    obstacles: [%{x: integer(), y: integer()}],
    winner: String.t() | nil,
    last_seed_spawn: DateTime.t() | nil,
    game_start_time: DateTime.t() | nil
  }
  
  @doc """
  Creates a new game room
  """
  def new(room_id, host_id, host_name) do
    host_player = create_player(host_id, host_name, 0)
    
    %__MODULE__{
      id: room_id,
      host_id: host_id,
      state: :waiting,
      players: %{host_id => host_player},
      seeds: [],
      obstacles: [],
      winner: nil,
      last_seed_spawn: nil,
      game_start_time: nil
    }
  end
  
  @doc """
  Adds a player to the room
  """
  def add_player(%__MODULE__{} = room, player_id, player_name) do
    if Map.has_key?(room.players, player_id) do
      {:error, "Player already in room"}
    else
      if map_size(room.players) >= 8 do
        {:error, "Room is full"}
      else
        color_index = map_size(room.players)
        player = create_player(player_id, player_name, color_index)
        
        updated_players = Map.put(room.players, player_id, player)
        updated_room = %{room | players: updated_players}
        
        {:ok, updated_room}
      end
    end
  end
  
  @doc """
  Removes a player from the room
  """
  def remove_player(%__MODULE__{} = room, player_id) do
    if Map.has_key?(room.players, player_id) do
      updated_players = Map.delete(room.players, player_id)
      
      # If host left, assign new host
      new_host_id = if room.host_id == player_id and not Enum.empty?(updated_players) do
        updated_players |> Map.keys() |> List.first()
      else
        room.host_id
      end
      
      updated_room = %{room | players: updated_players, host_id: new_host_id}
      {:ok, updated_room}
    else
      {:error, "Player not in room"}
    end
  end
  
  @doc """
  Starts the game (only host can start)
  """
  def start_game(%__MODULE__{} = room, player_id) do
    if player_id == room.host_id and room.state == :waiting and map_size(room.players) >= 1 do
      # Initialize game state
      initialized_room = initialize_game_state(room)
      updated_room = %{initialized_room | state: :countdown, game_start_time: DateTime.utc_now()}
      
      {:ok, updated_room}
    else
      {:error, "Cannot start game"}
    end
  end
  
  @doc """
  Updates player direction
  """
  def update_player_direction(%__MODULE__{} = room, player_id, direction) do
    case Map.get(room.players, player_id) do
      nil ->
        {:error, "Player not found"}
      
      player ->
        if player.alive and room.state == :playing do
          # Validate direction (can't reverse)
          new_dir = %{x: direction["x"] || direction[:x], y: direction["y"] || direction[:y]}
          
          current_dir = player.direction
          opposite_dir = %{x: -current_dir.x, y: -current_dir.y}
          
          if new_dir != opposite_dir do
            updated_player = %{player | direction: new_dir}
            updated_players = Map.put(room.players, player_id, updated_player)
            updated_room = %{room | players: updated_players}
            
            {:ok, updated_room}
          else
            {:ok, room}  # Ignore invalid direction
          end
        else
          {:ok, room}  # Ignore if player is dead or game not playing
        end
    end
  end
  
  @doc """
  Places an obstacle
  """
  def place_obstacle(%__MODULE__{} = room, player_id, position) do
    case Map.get(room.players, player_id) do
      nil ->
        {:error, "Player not found"}
      
      player ->
        if player.alive and player.canPlaceObstacle and room.state == :playing do
          pos = %{x: position["x"] || position[:x], y: position["y"] || position[:y]}
          
          # Check if position is valid
          if is_valid_obstacle_position(pos, room) do
            updated_obstacles = [pos | room.obstacles]
            
            # Update player cooldown
            updated_player = %{player | 
              canPlaceObstacle: false,
              lastObstacleTime: DateTime.utc_now()
            }
            updated_players = Map.put(room.players, player_id, updated_player)
            
            updated_room = %{room | 
              obstacles: updated_obstacles,
              players: updated_players
            }
            
            {:ok, updated_room}
          else
            {:error, "Invalid obstacle position"}
          end
        else
          {:error, "Cannot place obstacle"}
        end
    end
  end
  
  @doc """
  Game tick - updates game state
  """
  def tick(%__MODULE__{state: :playing} = room) do
    room
    |> move_snakes()
    |> check_collisions()
    |> spawn_seeds()
    |> update_obstacle_cooldowns()
    |> check_game_end()
    |> wrap_result()
  end
  
  def tick(%__MODULE__{} = room), do: {:ok, room}
  
  @doc """
  Gets the current game state for sending to clients
  """
  def get_game_state(%__MODULE__{} = room) do
    %{
      roomId: room.id,
      state: room.state,
      players: format_players(room.players),
      seeds: room.seeds,
      obstacles: room.obstacles,
      winner: room.winner
    }
  end
  
  # Private functions
  
  defp create_player(id, name, color_index) do
    color = Enum.at(@player_colors, color_index, "#FFFFFF")
    
    # Starting position based on player index
    start_positions = [
      %{x: 3, y: 3},   # Top-left
      %{x: 29, y: 3},  # Top-right  
      %{x: 3, y: 21},  # Bottom-left
      %{x: 29, y: 21}, # Bottom-right
      %{x: 16, y: 3},  # Top-center
      %{x: 16, y: 21}, # Bottom-center
      %{x: 3, y: 12},  # Left-center
      %{x: 29, y: 12}  # Right-center
    ]
    
    start_pos = Enum.at(start_positions, color_index, %{x: 10, y: 10})
    
    %{
      id: id,
      name: name,
      color: color,
      snake: [start_pos],
      alive: true,
      score: 0,
      direction: %{x: 1, y: 0},
      canPlaceObstacle: true,
      lastObstacleTime: nil
    }
  end
  
  defp initialize_game_state(%__MODULE__{} = room) do
    # Reset all players
    updated_players = 
      room.players
      |> Enum.map(fn {id, player} ->
        color_index = Enum.find_index(Map.keys(room.players), &(&1 == id))
        reset_player = create_player(id, player.name, color_index)
        {id, reset_player}
      end)
      |> Enum.into(%{})
    
    # Spawn initial seeds
    initial_seeds = spawn_initial_seeds(room)
    
    %{room | 
      players: updated_players,
      seeds: initial_seeds,
      obstacles: [],
      winner: nil,
      last_seed_spawn: DateTime.utc_now()
    }
  end
  
  defp spawn_initial_seeds(%__MODULE__{} = room) do
    grid_width = div(@canvas_width, @grid_size)
    grid_height = div(@canvas_height, @grid_size)
    
    occupied_positions = 
      room.players
      |> Map.values()
      |> Enum.flat_map(& &1.snake)
      |> MapSet.new()
    
    1..@max_seeds
    |> Enum.reduce([], fn _, acc ->
      case find_random_empty_position(grid_width, grid_height, occupied_positions) do
        nil -> acc
        pos -> [pos | acc]
      end
    end)
  end
  
  defp move_snakes(%__MODULE__{} = room) do
    updated_players = 
      room.players
      |> Enum.map(fn {id, player} ->
        if player.alive do
          new_head = %{
            x: player.snake |> List.first() |> Map.get(:x) |> Kernel.+(player.direction.x),
            y: player.snake |> List.first() |> Map.get(:y) |> Kernel.+(player.direction.y)
          }
          
          new_snake = [new_head | player.snake]
          
          # Limit snake length
          new_snake = if length(new_snake) > @max_snake_length do
            new_snake |> Enum.take(@max_snake_length)
          else
            new_snake
          end
          
          updated_player = %{player | snake: new_snake}
          {id, updated_player}
        else
          {id, player}
        end
      end)
      |> Enum.into(%{})
    
    %{room | players: updated_players}
  end
  
  defp check_collisions(%__MODULE__{} = room) do
    grid_width = div(@canvas_width, @grid_size)
    grid_height = div(@canvas_height, @grid_size)
    
    # Check each alive player for collisions
    updated_players = 
      room.players
      |> Enum.map(fn {id, player} ->
        if player.alive do
          head = List.first(player.snake)
          
          # Check wall collision
          wall_collision = head.x < 0 or head.x >= grid_width or head.y < 0 or head.y >= grid_height
          
          # Check self collision
          self_collision = head in Enum.drop(player.snake, 1)
          
          # Check collision with other snakes
          other_snakes = 
            room.players
            |> Map.values()
            |> Enum.filter(&(&1.id != id and &1.alive))
            |> Enum.flat_map(& &1.snake)
          
          snake_collision = head in other_snakes
          
          # Check obstacle collision
          obstacle_collision = head in room.obstacles
          
          # Check seed consumption
          {consumed_seed, updated_seeds, score_increase} = check_seed_consumption(head, room.seeds)
          
          if wall_collision or self_collision or snake_collision or obstacle_collision do
            # Player dies, convert snake to obstacles
            dead_player = %{player | alive: false}
            {id, dead_player}
          else
            # Update score and snake length if seed consumed
            updated_player = if consumed_seed do
              %{player | 
                score: player.score + score_increase,
                snake: player.snake ++ [List.last(player.snake)]  # Grow snake
              }
            else
              # Remove tail if no seed consumed
              %{player | snake: Enum.drop(player.snake, -1)}
            end
            
            {id, updated_player}
          end
        else
          {id, player}
        end
      end)
      |> Enum.into(%{})
    
    # Update seeds
    updated_seeds = 
      room.players
      |> Map.values()
      |> Enum.filter(& &1.alive)
      |> Enum.reduce(room.seeds, fn player, seeds ->
        head = List.first(player.snake)
        Enum.reject(seeds, &(&1 == head))
      end)
    
    # Add dead snakes to obstacles
    dead_snake_segments = 
      updated_players
      |> Map.values()
      |> Enum.filter(&(not &1.alive))
      |> Enum.flat_map(& &1.snake)
    
    updated_obstacles = room.obstacles ++ dead_snake_segments
    
    %{room | players: updated_players, seeds: updated_seeds, obstacles: updated_obstacles}
  end
  
  defp check_seed_consumption(head, seeds) do
    case Enum.find(seeds, &(&1 == head)) do
      nil -> {false, seeds, 0}
      seed -> {true, Enum.reject(seeds, &(&1 == seed)), 10}
    end
  end
  
  defp spawn_seeds(%__MODULE__{} = room) do
    now = DateTime.utc_now()
    time_since_last_spawn = case room.last_seed_spawn do
      nil -> @seed_spawn_interval + 1
      last -> DateTime.diff(now, last, :millisecond)
    end
    
    if time_since_last_spawn >= @seed_spawn_interval and length(room.seeds) < @max_seeds do
      grid_width = div(@canvas_width, @grid_size)
      grid_height = div(@canvas_height, @grid_size)
      
      occupied_positions = 
        (room.players |> Map.values() |> Enum.flat_map(& &1.snake)) ++
        room.seeds ++
        room.obstacles
        |> MapSet.new()
      
      case find_random_empty_position(grid_width, grid_height, occupied_positions) do
        nil -> room
        new_seed ->
          %{room | 
            seeds: [new_seed | room.seeds],
            last_seed_spawn: now
          }
      end
    else
      room
    end
  end
  
  defp update_obstacle_cooldowns(%__MODULE__{} = room) do
    now = DateTime.utc_now()
    
    updated_players = 
      room.players
      |> Enum.map(fn {id, player} ->
        if player.alive and not player.canPlaceObstacle and player.lastObstacleTime do
          time_since_obstacle = DateTime.diff(now, player.lastObstacleTime, :millisecond)
          
          if time_since_obstacle >= @obstacle_placement_cooldown do
            updated_player = %{player | canPlaceObstacle: true}
            {id, updated_player}
          else
            {id, player}
          end
        else
          {id, player}
        end
      end)
      |> Enum.into(%{})
    
    %{room | players: updated_players}
  end
  
  defp check_game_end(%__MODULE__{} = room) do
    alive_players = room.players |> Map.values() |> Enum.filter(& &1.alive)
    
    case length(alive_players) do
      0 -> %{room | state: :finished, winner: nil}
      1 -> 
        winner = List.first(alive_players)
        %{room | state: :finished, winner: winner.id}
      _ -> room
    end
  end
  
  defp wrap_result(%__MODULE__{} = room), do: {:ok, room}
  
  defp find_random_empty_position(grid_width, grid_height, occupied_positions) do
    # Try up to 100 times to find an empty position
    Enum.reduce_while(1..100, nil, fn _, _ ->
      x = :rand.uniform(grid_width) - 1
      y = :rand.uniform(grid_height) - 1
      pos = %{x: x, y: y}
      
      if MapSet.member?(occupied_positions, pos) do
        {:cont, nil}
      else
        {:halt, pos}
      end
    end)
  end
  
  defp is_valid_obstacle_position(pos, %__MODULE__{} = room) do
    grid_width = div(@canvas_width, @grid_size)
    grid_height = div(@canvas_height, @grid_size)
    
    # Check bounds
    in_bounds = pos.x >= 0 and pos.x < grid_width and pos.y >= 0 and pos.y < grid_height
    
    # Check not occupied
    occupied_positions = 
      (room.players |> Map.values() |> Enum.flat_map(& &1.snake)) ++
      room.seeds ++
      room.obstacles
      |> MapSet.new()
    
    not_occupied = not MapSet.member?(occupied_positions, pos)
    
    in_bounds and not_occupied
  end
  
  defp format_players(players) do
    players
    |> Enum.map(fn {_id, player} ->
      Map.take(player, [:id, :name, :color, :snake, :alive, :score, :canPlaceObstacle])
    end)
  end
end