import React from 'react'

function LobbyScreen({ room, playerId, onStartGame, onLeaveRoom }) {
  const isHost = room.hostId === playerId
  const canStartGame = room.players.length >= 2 && isHost

  console.log('LobbyScreen render:', {
    playerId,
    hostId: room.hostId,
    isHost,
    playerCount: room.players.length,
    canStartGame,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
  })

  const getContrastColor = (hexColor) => {
    const r = Number.parseInt(hexColor.slice(1, 3), 16)
    const g = Number.parseInt(hexColor.slice(3, 5), 16)
    const b = Number.parseInt(hexColor.slice(5, 7), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#000' : '#fff'
  }

  return (
    <div className="screen">
      <div className="lobby-container">
        <h2>Game Lobby</h2>

        <div className="room-id-display">Room ID: {room.id}</div>

        <div style={{ margin: '30px 0' }}>
          <h3>Players ({room.players.length}/8)</h3>
          <div className="players-grid">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`player-card ${player.id === room.hostId ? 'host' : ''}`}
                style={{
                  backgroundColor: player.color,
                  color: getContrastColor(player.color),
                }}
              >
                {player.name}
                {player.id === room.hostId && ' (Host)'}
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          {isHost && (
            <button type="button" className="btn" onClick={onStartGame} disabled={!canStartGame}>
              {room.players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
            </button>
          )}

          {!isHost && (
            <p style={{ fontSize: '18px', margin: '20px 0' }}>
              Waiting for host to start the game...
            </p>
          )}
        </div>

        <button type="button" className="btn btn-danger" onClick={onLeaveRoom}>
          Leave Room
        </button>

        <div style={{ marginTop: '30px', fontSize: '14px', opacity: '0.8' }}>
          <p>🎮 Controls: WASD or Arrow Keys</p>
          <p>🐍 Snake growth is limited to 15 segments</p>
          <p>💀 Dead snakes become obstacles</p>
          <p>🏆 Last player standing wins!</p>
        </div>
      </div>
    </div>
  )
}

export default LobbyScreen
