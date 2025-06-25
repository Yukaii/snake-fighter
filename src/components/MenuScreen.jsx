import React, { useState } from 'react'
import TUIButton from './ui/TUIButton'
import TUIContainer from './ui/TUIContainer'
import TUIInput from './ui/TUIInput'
import TUIText from './ui/TUIText'

function MenuScreen({ onCreateRoom, onJoinRoom, onStartLocalGame, onStartAIGame, isConnected }) {
  const [playerName, setPlayerName] = useState('')
  const [roomId, setRoomId] = useState('')

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert('Please enter your name')
      return
    }
    onCreateRoom(playerName.trim())
  }

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomId.trim()) {
      alert('Please enter your name and room ID')
      return
    }
    onJoinRoom(roomId.trim().toUpperCase(), playerName.trim())
  }

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action()
    }
  }

  return (
    <div className="screen">
      <TUIText variant="h1">🐍 Snake Fighter</TUIText>

      <TUIContainer
        style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
          color: isConnected ? '#4CAF50' : '#f44336',
        }}
      >
        {isConnected ? '🟢 Connected to server' : '🔴 Connecting to server...'}
      </TUIContainer>

      <div className="form-group">
        <TUIInput
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, roomId ? handleJoinRoom : handleCreateRoom)}
          maxLength={20}
          autoFocus
        />
      </div>

      <div className="form-group">
        <TUIInput
          placeholder="Enter Room ID (optional)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, handleJoinRoom)}
          maxLength={6}
        />
      </div>

      <div className="form-group">
        <TUIButton
          variant="secondary"
          onClick={handleCreateRoom}
          disabled={!playerName.trim() || !isConnected}
        >
          {isConnected ? 'Create New Room' : 'Connecting...'}
        </TUIButton>

        <TUIButton
          variant="primary"
          onClick={handleJoinRoom}
          disabled={!playerName.trim() || !roomId.trim() || !isConnected}
        >
          {isConnected ? 'Join Room' : 'Connecting...'}
        </TUIButton>
      </div>

      <TUIContainer
        title="Local Modes"
        style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}
      >
        <TUIButton
          onClick={onStartLocalGame}
          style={{
            backgroundColor: '#9C27B0',
            color: 'white',
            width: '100%',
            marginBottom: '10px',
          }}
        >
          🎮 Local 2-Player Mode
        </TUIButton>

        <TUIButton
          onClick={onStartAIGame}
          style={{
            backgroundColor: '#FF9800',
            color: 'white',
            width: '100%',
          }}
        >
          🤖 vs AI Mode
        </TUIButton>
      </TUIContainer>

      <TUIContainer style={{ marginTop: '40px' }}>
        <TUIText variant="small">
          🌐 Online Multiplayer:
          <br />🎮 Create a room to host a game
          <br />🏠 Join an existing room with the Room ID
          <br />👥 Need at least 2 players to start
          <br />
          <br />💻 Local Modes:
          <br />🎮 Two players: WASD + Space | IJKL + Enter
          <br />🤖 vs AI: WASD + Space vs Computer
        </TUIText>
      </TUIContainer>
    </div>
  )
}

export default MenuScreen
