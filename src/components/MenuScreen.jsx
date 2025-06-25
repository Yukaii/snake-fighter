import { Desktop, GameController, Globe, Robot, Users } from 'phosphor-react'
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
      <TUIText variant="h1">Snake Fighter</TUIText>

      <TUIContainer
        style={{
          marginBottom: '10px',
          padding: '6px 10px',
          background: isConnected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
          color: isConnected ? '#4CAF50' : '#f44336',
          fontSize: '14px',
        }}
      >
        {isConnected ? 'Connected to server' : 'Connecting to server...'}
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

      <div style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '15px' }}>
        <TUIContainer title="Local Modes">
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <TUIButton
            onClick={onStartLocalGame}
            style={{
              background: '#9C27B0',
              color: 'white',
              flex: '1',
              minWidth: '140px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={16} />
            2-Player
          </TUIButton>

          <TUIButton
            onClick={onStartAIGame}
            style={{
              background: '#FF9800',
              color: 'white',
              flex: '1',
              minWidth: '140px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Robot size={16} />
            vs AI
          </TUIButton>
        </div>
        </TUIContainer>
      </div>

      <TUIContainer style={{ marginTop: '20px' }}>
        <TUIText variant="small" style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <Globe size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Online: Create/join rooms (2+ players)
          <br />
          <Desktop size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Local: WASD+Space | IJKL+Enter (2P) | vs AI
        </TUIText>
      </TUIContainer>
    </div>
  )
}

export default MenuScreen
