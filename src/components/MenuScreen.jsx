import React, { useState } from 'react'

function MenuScreen({ onCreateRoom, onJoinRoom, isConnected }) {
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
      <h1>🐍 Snake Fighter</h1>

      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
          color: isConnected ? '#4CAF50' : '#f44336',
        }}
      >
        {isConnected ? '🟢 Connected to server' : '🔴 Connecting to server...'}
      </div>

      <div className="form-group">
        <input
          type="text"
          className="input-field"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, roomId ? handleJoinRoom : handleCreateRoom)}
          maxLength={20}
          autoFocus
        />
      </div>

      <div className="form-group">
        <input
          type="text"
          className="input-field"
          placeholder="Enter Room ID (optional)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, handleJoinRoom)}
          maxLength={6}
        />
      </div>

      <div className="form-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCreateRoom}
          disabled={!playerName.trim() || !isConnected}
        >
          {isConnected ? 'Create New Room' : 'Connecting...'}
        </button>

        <button
          type="button"
          className="btn"
          onClick={handleJoinRoom}
          disabled={!playerName.trim() || !roomId.trim() || !isConnected}
        >
          {isConnected ? 'Join Room' : 'Connecting...'}
        </button>
      </div>

      <div style={{ marginTop: '40px', fontSize: '14px', opacity: '0.8' }}>
        <p>🎮 Create a room to host a game</p>
        <p>🏠 Join an existing room with the Room ID</p>
        <p>👥 Need at least 2 players to start</p>
      </div>
    </div>
  )
}

export default MenuScreen
