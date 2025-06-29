defmodule SnakeFighterServer.EngineIO do
  @moduledoc """
  Engine.IO protocol implementation for Elixir/Phoenix.

  Engine.IO is the transport layer that Socket.IO is built on top of.
  It handles the low-level details of maintaining a connection between
  the client and server using WebSocket and HTTP long-polling as fallback.

  Protocol specification: https://github.com/socketio/engine.io-protocol
  """

  # Engine.IO protocol constants
  @protocol_version 4
  @ping_interval 25_000  # 25 seconds
  @ping_timeout 20_000   # 20 seconds

  # Engine.IO packet types
  @packet_open 0
  @packet_close 1
  @packet_ping 2
  @packet_pong 3
  @packet_message 4
  @packet_upgrade 5
  @packet_noop 6

  # Transport types
  @transport_polling "polling"
  @transport_websocket "websocket"

  @type packet_type :: 0..6
  @type transport :: String.t()
  @type session_id :: String.t()

  @type handshake_data :: %{
    sid: session_id(),
    upgrades: [String.t()],
    pingInterval: non_neg_integer(),
    pingTimeout: non_neg_integer()
  }

  defstruct [
    :session_id,
    :transport,
    :upgraded,
    :ping_interval,
    :ping_timeout,
    :last_ping,
    :state
  ]

  @type t :: %__MODULE__{
    session_id: session_id() | nil,
    transport: transport(),
    upgraded: boolean(),
    ping_interval: non_neg_integer(),
    ping_timeout: non_neg_integer(),
    last_ping: DateTime.t() | nil,
    state: :connecting | :open | :closing | :closed
  }

  @doc """
  Creates a new Engine.IO session
  """
  def new_session(transport \\ @transport_polling) do
    session_id = generate_session_id()

    %__MODULE__{
      session_id: session_id,
      transport: transport,
      upgraded: false,
      ping_interval: @ping_interval,
      ping_timeout: @ping_timeout,
      last_ping: DateTime.utc_now(),
      state: :connecting
    }
  end

  @doc """
  Generates handshake response for Engine.IO client
  """
  def handshake_response(%__MODULE__{} = session) do
    upgrades = case session.transport do
      @transport_polling -> [@transport_websocket]
      @transport_websocket -> []
    end

    handshake_data = %{
      sid: session.session_id,
      upgrades: upgrades,
      pingInterval: session.ping_interval,
      pingTimeout: session.ping_timeout,
      maxPayload: 1000000
    }

    encoded_data = Jason.encode!(handshake_data)
    encode_packet(@packet_open, encoded_data)
  end

  @doc """
  Encodes an Engine.IO packet
  """
  def encode_packet(type, data \\ "") when type in 0..6 do
    "#{type}#{data}"
  end

  @doc """
  Encodes multiple Engine.IO packets for HTTP long-polling transport.
  Packets are separated by the record separator character (ASCII 30).
  """
  def encode_payload(packets) when is_list(packets) do
    Enum.join(packets, <<30>>)
  end

  @doc """
  Decodes an Engine.IO packet
  """
  def decode_packet(packet) when is_binary(packet) do
    case packet do
      <<type_char, data::binary>> when type_char in ?0..?6 ->
        type = type_char - ?0
        {:ok, type, data}

      "" ->
        {:error, :empty_packet}

      _ ->
        {:error, :invalid_packet}
    end
  end

  @doc """
  Decodes a payload containing multiple Engine.IO packets.
  Packets are separated by the record separator character (ASCII 30).
  """
  def decode_payload(payload) when is_binary(payload) do
    cond do
      payload == "" ->
        {:ok, []}

      String.contains?(payload, <<30>>) ->
        packets = String.split(payload, <<30>>, trim: true)
        decode_packets(packets, [])

      true ->
        case decode_packet(payload) do
          {:ok, type, data} -> {:ok, [{type, data}]}
          error -> error
        end
    end
  end

  defp decode_packets([], acc), do: {:ok, Enum.reverse(acc)}

  defp decode_packets([packet | rest], acc) do
    case decode_packet(packet) do
      {:ok, type, data} ->
        decode_packets(rest, [{type, data} | acc])

      error ->
        error
    end
  end

  @doc """
  Handles ping/pong mechanism
  """
  def handle_ping(%__MODULE__{} = session) do
    pong_packet = encode_packet(@packet_pong)
    updated_session = %{session | last_ping: DateTime.utc_now()}

    {pong_packet, updated_session}
  end

  @doc """
  Checks if session needs a ping
  """
  def needs_ping?(%__MODULE__{} = session) do
    case session.last_ping do
      nil -> true
      last_ping ->
        diff = DateTime.diff(DateTime.utc_now(), last_ping, :millisecond)
        diff >= session.ping_interval
    end
  end

  @doc """
  Checks if session has timed out
  """
  def timed_out?(%__MODULE__{} = session) do
    case session.last_ping do
      nil -> false
      last_ping ->
        diff = DateTime.diff(DateTime.utc_now(), last_ping, :millisecond)
        diff >= (session.ping_interval + session.ping_timeout)
    end
  end

  @doc """
  Upgrades transport from polling to websocket
  """
  def upgrade_transport(%__MODULE__{transport: @transport_polling} = session) do
    %{session | transport: @transport_websocket, upgraded: true}
  end

  def upgrade_transport(%__MODULE__{} = session), do: session

  @doc """
  Generates a unique session ID
  """
  def generate_session_id do
    :crypto.strong_rand_bytes(20)
    |> Base.encode64(padding: false)
    |> String.replace("+", "_")
    |> String.replace("/", "-")
  end

  @doc """
  Gets packet type constants for use in other modules
  """
  def packet_types do
    %{
      open: @packet_open,
      close: @packet_close,
      ping: @packet_ping,
      pong: @packet_pong,
      message: @packet_message,
      upgrade: @packet_upgrade,
      noop: @packet_noop
    }
  end

  @doc """
  Gets transport type constants
  """
  def transport_types do
    %{
      polling: @transport_polling,
      websocket: @transport_websocket
    }
  end
end
