defmodule SnakeFighterServer.SocketIO do
  @moduledoc """
  Socket.IO protocol implementation for Elixir/Phoenix.

  Socket.IO is the application layer built on top of Engine.IO.
  It provides features like namespaces, rooms, and event-based communication.

  Protocol specification: https://github.com/socketio/socket.io-protocol
  """

  alias SnakeFighterServer.EngineIO

  # Socket.IO packet types
  @packet_connect 0
  @packet_disconnect 1
  @packet_event 2
  @packet_ack 3
  @packet_connect_error 4
  @packet_binary_event 5
  @packet_binary_ack 6

  @default_namespace "/"

  @type packet_type :: 0..6
  @type namespace :: String.t()
  @type event_name :: String.t()
  @type event_data :: any()
  @type ack_id :: non_neg_integer()

  @type socket_packet :: %{
          type: packet_type(),
          namespace: namespace(),
          data: any(),
          id: ack_id() | nil
        }

  defstruct [
    :engine_session,
    :namespace,
    :rooms,
    :connected,
    :ack_counter
  ]

  @type t :: %__MODULE__{
          engine_session: EngineIO.t(),
          namespace: namespace(),
          rooms: MapSet.t(String.t()),
          connected: boolean(),
          ack_counter: non_neg_integer()
        }

  @doc """
  Creates a new Socket.IO connection
  """
  def new_connection(transport \\ "polling", namespace \\ @default_namespace) do
    engine_session = EngineIO.new_session(transport)

    %__MODULE__{
      engine_session: engine_session,
      namespace: namespace,
      rooms: MapSet.new(),
      connected: false,
      ack_counter: 0
    }
  end

  @doc """
  Handles Socket.IO handshake (Engine.IO handshake only)
  """
  def handshake(%__MODULE__{} = socket) do
    engine_handshake = EngineIO.handshake_response(socket.engine_session)

    # Return only Engine.IO handshake, Socket.IO connect will be sent in next poll
    {[engine_handshake], socket}
  end

  @doc """
  Generates the Socket.IO connect packet for established connections
  """
  def connect_packet(%__MODULE__{} = socket) do
    # Socket.IO v4 connect packet includes session ID and authentication status
    connect_data = %{
      sid: socket.engine_session.session_id
    }
    connect_packet = encode_packet(@packet_connect, socket.namespace, connect_data)
    {[connect_packet], %{socket | connected: true}}
  end

  @doc """
  Encodes a Socket.IO packet into Engine.IO message format.

  Format: <packet type>[<# of binary attachments>-][<namespace>,][<acknowledgment id>][JSON-stringified payload without binary]
  """
  def encode_packet(type, namespace \\ @default_namespace, data \\ nil, id \\ nil)

  def encode_packet(type, namespace, data, id) when type in 0..6 do
    # Handle binary data separately
    {binary_attachments, clean_data} = extract_binary_data(data)

    # Start with packet type
    packet_str = "#{type}"

    # Add binary attachment count if there are any
    packet_str = if length(binary_attachments) > 0 do
      packet_str <> "#{length(binary_attachments)}-"
    else
      packet_str
    end

    # Add namespace if not default
    packet_str =
      if namespace != @default_namespace do
        packet_str <> namespace <> ","
      else
        packet_str
      end

    # Add ack id if present
    packet_str =
      if id do
        packet_str <> "#{id}"
      else
        packet_str
      end

    # Add data if present
    packet_str =
      if clean_data do
        encoded_data = Jason.encode!(clean_data)
        packet_str <> encoded_data
      else
        packet_str
      end

    # Wrap in Engine.IO message packet
    engine_packet = EngineIO.encode_packet(EngineIO.packet_types().message, packet_str)

    # Return packet with binary attachments if any
    if length(binary_attachments) > 0 do
      {engine_packet, binary_attachments}
    else
      engine_packet
    end
  end

  @doc """
  Decodes a Socket.IO packet from Engine.IO message
  """
  def decode_packet(engine_packet) when is_binary(engine_packet) do
    with {:ok, engine_type, engine_data} <- EngineIO.decode_packet(engine_packet),
         true <- engine_type == EngineIO.packet_types().message do
      parse_socket_packet(engine_data)
    else
      _ -> {:error, :invalid_socket_packet}
    end
  end

  defp parse_socket_packet(packet_data) when is_binary(packet_data) do
    case packet_data do
      <<type_char, rest::binary>> when type_char in ?0..?6 ->
        type = type_char - ?0

        # Check for binary attachments count
        {binary_count, rest} = parse_binary_count(rest)
        {namespace, rest} = parse_namespace(rest)
        {ack_id, rest} = parse_ack_id(rest)
        data = parse_data(rest)

        {:ok,
         %{
           type: type,
           namespace: namespace,
           data: data,
           id: ack_id,
           binary_count: binary_count
         }}

      _ ->
        {:error, :invalid_packet_format}
    end
  end

  defp parse_binary_count(data) do
    # Only parse binary count if data starts with a digit followed by "-"
    case Regex.run(~r/^(\d+)-(.*)$/, data) do
      [_, count_str, rest] ->
        case Integer.parse(count_str) do
          {count, ""} -> {count, rest}
          _ -> {0, data}
        end
      nil ->
        {0, data}
    end
  end

  defp parse_namespace(<<"/", rest::binary>>) do
    case String.split(rest, ",", parts: 2) do
      [namespace, remaining] -> {"/" <> namespace, remaining}
      [namespace] -> {"/" <> namespace, ""}
    end
  end

  defp parse_namespace(rest) do
    # For default namespace, data continues without namespace prefix
    {@default_namespace, rest}
  end

  defp parse_ack_id(data) do
    case Integer.parse(data) do
      {id, rest} -> {id, rest}
      :error -> {nil, data}
    end
  end

  defp parse_data(""), do: nil

  defp parse_data(data) do
    case Jason.decode(data) do
      {:ok, decoded} -> decoded
      {:error, _} -> data
    end
  end

  @doc """
  Creates an event packet
  """
  def emit_event(event_name, data, namespace \\ @default_namespace, ack_id \\ nil) do
    event_data = [event_name | List.wrap(data)]
    encode_packet(@packet_event, namespace, event_data, ack_id)
  end

  @doc """
  Creates an acknowledgment packet
  """
  def emit_ack(ack_id, data, namespace \\ @default_namespace) do
    ack_data = List.wrap(data)
    encode_packet(@packet_ack, namespace, ack_data, ack_id)
  end

  @doc """
  Creates a disconnect packet
  """
  def emit_disconnect(reason \\ "io server disconnect", namespace \\ @default_namespace) do
    encode_packet(@packet_disconnect, namespace, reason)
  end

  @doc """
  Joins a room
  """
  def join_room(%__MODULE__{} = socket, room) when is_binary(room) do
    %{socket | rooms: MapSet.put(socket.rooms, room)}
  end

  @doc """
  Leaves a room
  """
  def leave_room(%__MODULE__{} = socket, room) when is_binary(room) do
    %{socket | rooms: MapSet.delete(socket.rooms, room)}
  end

  @doc """
  Checks if socket is in a room
  """
  def in_room?(%__MODULE__{} = socket, room) when is_binary(room) do
    MapSet.member?(socket.rooms, room)
  end

  @doc """
  Gets next acknowledgment ID
  """
  def next_ack_id(%__MODULE__{} = socket) do
    new_counter = socket.ack_counter + 1
    {new_counter, %{socket | ack_counter: new_counter}}
  end

  @doc """
  Handles ping from Engine.IO layer
  """
  def handle_ping(%__MODULE__{} = socket) do
    {pong_packet, updated_engine} = EngineIO.handle_ping(socket.engine_session)
    updated_socket = %{socket | engine_session: updated_engine}

    {pong_packet, updated_socket}
  end

  @doc """
  Checks if connection needs ping
  """
  def needs_ping?(%__MODULE__{} = socket) do
    EngineIO.needs_ping?(socket.engine_session)
  end

  @doc """
  Checks if connection has timed out
  """
  def timed_out?(%__MODULE__{} = socket) do
    EngineIO.timed_out?(socket.engine_session)
  end

  @doc """
  Gets packet type constants for use in other modules
  """
  def packet_types do
    %{
      connect: @packet_connect,
      disconnect: @packet_disconnect,
      event: @packet_event,
      ack: @packet_ack,
      connect_error: @packet_connect_error,
      binary_event: @packet_binary_event,
      binary_ack: @packet_binary_ack
    }
  end

  # Private helper functions

  @doc """
  Extracts binary data from a data structure and replaces it with placeholders.
  Returns {binary_attachments, clean_data}.
  """
  defp extract_binary_data(data) do
    extract_binary_data(data, [], 0)
  end

  defp extract_binary_data(data, attachments, _counter) when is_binary(data) do
    # Check if this is actual binary data (not a string)
    if String.valid?(data) do
      {attachments, data}
    else
      # This is binary data, replace with placeholder
      placeholder = %{"_placeholder" => true, "num" => length(attachments)}
      {attachments ++ [data], placeholder}
    end
  end

  defp extract_binary_data(data, attachments, counter) when is_list(data) do
    {new_attachments, new_data} =
      Enum.reduce(data, {attachments, []}, fn item, {acc_attachments, acc_data} ->
        {item_attachments, clean_item} = extract_binary_data(item, acc_attachments, counter)
        {item_attachments, acc_data ++ [clean_item]}
      end)

    {new_attachments, new_data}
  end

  defp extract_binary_data(data, attachments, counter) when is_map(data) do
    {new_attachments, new_data} =
      Enum.reduce(data, {attachments, %{}}, fn {key, value}, {acc_attachments, acc_data} ->
        {value_attachments, clean_value} = extract_binary_data(value, acc_attachments, counter)
        {value_attachments, Map.put(acc_data, key, clean_value)}
      end)

    {new_attachments, new_data}
  end

  defp extract_binary_data(data, attachments, _counter) do
    # For other data types (numbers, atoms, etc.), return as-is
    {attachments, data}
  end
end
