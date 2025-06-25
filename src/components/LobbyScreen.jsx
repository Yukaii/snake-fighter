import { Crown, GameController } from 'phosphor-react'
import React from 'react'
import TUIButton from './ui/TUIButton'
import TUIContainer from './ui/TUIContainer'
import TUIText from './ui/TUIText'

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
      <TUIContainer title="Game Lobby" className="lobby-container">
        <TUIText variant="h2">Game Lobby</TUIText>

        <div className="room-id-display">Room ID: {room.id}</div>

        <div style={{ margin: '15px 0' }}>
          <TUIText variant="h2">Players ({room.players.length}/8)</TUIText>
          <div className="players-grid">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`player-card ${player.id === room.hostId ? 'host' : ''}`}
                style={{
                  backgroundColor: player.color,
                  color: getContrastColor(player.color),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {player.id === room.hostId && <Crown size={14} color="#FFD700" />}
                {player.name}
                {player.id === room.hostId && ' (Host)'}
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          {isHost && (
            <TUIButton variant="primary" onClick={onStartGame} disabled={!canStartGame}>
              {room.players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
            </TUIButton>
          )}

          {!isHost && (
            <TUIText style={{ fontSize: '18px', margin: '20px 0' }}>
              Waiting for host to start the game...
            </TUIText>
          )}
        </div>

        <TUIButton variant="danger" onClick={onLeaveRoom}>
          Leave Room
        </TUIButton>

        <TUIContainer style={{ marginTop: '15px' }}>
          <TUIText variant="small" style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <GameController size={14} style={{ display: 'inline', marginRight: '4px' }} />
            WASD/Arrows • Max 15 segments • Dead = obstacles • Last standing wins
          </TUIText>
        </TUIContainer>
      </TUIContainer>
    </div>
  )
}

export default LobbyScreen
