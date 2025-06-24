import React, { useState, useEffect, useCallback } from 'react'
import CountdownScreen from './components/CountdownScreen'
import GameOverScreen from './components/GameOverScreen'
import GameScreen from './components/GameScreen'
import LobbyScreen from './components/LobbyScreen'
import MenuScreen from './components/MenuScreen'
import LocalGameScreen from './components/LocalGameScreen'
import { useSocket } from './hooks/useSocket'

const GAME_STATES = {
  MENU: 'menu',
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
  LOCAL_GAME: 'localGame',
  AI_GAME: 'aiGame',
}

function App() {
  const [gameState, setGameState] = useState(GAME_STATES.MENU)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [countdown, setCountdown] = useState(3)
  const [gameData, setGameData] = useState(null)
  const [gameOverData, setGameOverData] = useState(null)
  const [error, setError] = useState('')

  const { socket, isConnected } = useSocket()

  const handleError = useCallback((message) => {
    console.error('Game error:', message)
    setError(message)
    setTimeout(() => setError(''), 3000)
  }, [])

  const handleKeyPress = useCallback(
    (e) => {
      if (gameState !== GAME_STATES.PLAYING || !socket || !isConnected) return

      let direction = null

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          direction = { x: 0, y: -1 }
          break
        case 's':
        case 'arrowdown':
          direction = { x: 0, y: 1 }
          break
        case 'a':
        case 'arrowleft':
          direction = { x: -1, y: 0 }
          break
        case 'd':
        case 'arrowright':
          direction = { x: 1, y: 0 }
          break
        case ' ':
        case 'space':
          e.preventDefault()
          socket.emit('place-obstacle')
          return
      }

      if (direction) {
        e.preventDefault()
        socket.emit('player-direction', direction)
      }
    },
    [gameState, socket, isConnected]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  useEffect(() => {
    if (!socket) return

    // Set player ID when socket connects
    if (socket.connected) {
      setPlayerId(socket.id)
      console.log('Player ID set on mount:', socket.id)
    }

    socket.on('connect', () => {
      setPlayerId(socket.id)
      console.log('Player ID set on connect:', socket.id)
    })

    socket.on('room-created', (data) => {
      console.log('Room created event received:', data)
      setCurrentRoom(data.room)
      setGameState(GAME_STATES.LOBBY)
    })

    socket.on('room-joined', (data) => {
      console.log('Room joined event received:', data)
      setCurrentRoom(data.room)
      setGameState(GAME_STATES.LOBBY)
    })

    socket.on('player-joined', (data) => {
      console.log('Player joined event received:', data)
      setCurrentRoom((prev) => {
        const updatedRoom = {
          ...prev,
          players: [...prev.players, data.player],
        }
        console.log('Updated room after player joined:', updatedRoom)
        return updatedRoom
      })
    })

    socket.on('player-left', (data) => {
      setCurrentRoom((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== data.playerId),
      }))
    })

    socket.on('room-updated', (data) => {
      console.log('Room updated event received:', data)
      setCurrentRoom(data.room)
    })

    socket.on('countdown-start', (countdownValue) => {
      setCountdown(countdownValue)
      setGameState(GAME_STATES.COUNTDOWN)
    })

    socket.on('countdown-tick', (countdownValue) => {
      setCountdown(countdownValue)
    })

    socket.on('game-start', () => {
      setGameState(GAME_STATES.PLAYING)
    })

    socket.on('game-update', (data) => {
      setGameData(data)
    })

    socket.on('player-eliminated', (data) => {
      console.log(`${data.playerName} was eliminated!`)
    })

    socket.on('game-end', (data) => {
      setGameOverData(data)
      setGameState(GAME_STATES.GAME_OVER)
    })

    socket.on('return-to-lobby', () => {
      setGameState(GAME_STATES.LOBBY)
      setGameData(null)
      setGameOverData(null)
    })

    socket.on('error', handleError)

    return () => {
      socket.off('connect')
      socket.off('room-created')
      socket.off('room-joined')
      socket.off('player-joined')
      socket.off('player-left')
      socket.off('room-updated')
      socket.off('countdown-start')
      socket.off('countdown-tick')
      socket.off('game-start')
      socket.off('game-update')
      socket.off('player-eliminated')
      socket.off('game-end')
      socket.off('return-to-lobby')
      socket.off('error')
    }
  }, [socket, handleError])

  const createRoom = (playerName) => {
    console.log('Create room called with:', playerName, 'Socket connected:', isConnected)
    if (!socket || !isConnected) {
      handleError('Not connected to server')
      return
    }
    console.log('Emitting create-room event')
    socket.emit('create-room', { name: playerName })
  }

  const joinRoom = (roomId, playerName) => {
    console.log('Join room called with:', roomId, playerName, 'Socket connected:', isConnected)
    if (!socket || !isConnected) {
      handleError('Not connected to server')
      return
    }
    console.log('Emitting join-room event')
    socket.emit('join-room', { roomId, playerData: { name: playerName } })
  }

  const startGame = () => {
    if (!socket || !isConnected) {
      handleError('Not connected to server')
      return
    }
    socket.emit('start-game')
  }

  const leaveRoom = () => {
    if (!socket || !isConnected) return
    socket.emit('leave-room')
    setCurrentRoom(null)
    setGameState(GAME_STATES.MENU)
    setGameData(null)
    setGameOverData(null)
  }

  const returnToLobby = () => {
    setGameState(GAME_STATES.LOBBY)
    setGameData(null)
    setGameOverData(null)
  }

  const startLocalGame = () => {
    setGameState(GAME_STATES.LOCAL_GAME)
  }

  const startAIGame = () => {
    setGameState(GAME_STATES.AI_GAME)
  }

  const returnToMenu = () => {
    setGameState(GAME_STATES.MENU)
    setCurrentRoom(null)
    setGameData(null)
    setGameOverData(null)
  }

  return (
    <div className="game-container">
      {error && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#f44336',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            zIndex: 1001,
          }}
        >
          {error}
        </div>
      )}

      {gameState === GAME_STATES.MENU && (
        <MenuScreen
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onStartLocalGame={startLocalGame}
          onStartAIGame={startAIGame}
          isConnected={isConnected}
        />
      )}

      {gameState === GAME_STATES.LOBBY && currentRoom && (
        <LobbyScreen
          room={currentRoom}
          playerId={playerId}
          onStartGame={startGame}
          onLeaveRoom={leaveRoom}
        />
      )}

      {gameState === GAME_STATES.COUNTDOWN && <CountdownScreen countdown={countdown} />}

      {gameState === GAME_STATES.PLAYING && <GameScreen gameData={gameData} playerId={playerId} />}

      {gameState === GAME_STATES.GAME_OVER && gameOverData && (
        <GameOverScreen
          gameOverData={gameOverData}
          playerId={playerId}
          onPlayAgain={returnToLobby}
        />
      )}

      {gameState === GAME_STATES.LOCAL_GAME && (
        <LocalGameScreen onReturnToMenu={returnToMenu} />
      )}

      {gameState === GAME_STATES.AI_GAME && (
        <LocalGameScreen onReturnToMenu={returnToMenu} isAIMode={true} />
      )}
    </div>
  )
}

export default App
