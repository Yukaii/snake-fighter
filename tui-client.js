#!/usr/bin/env node

const React = require('react')
const { useState, useEffect, useCallback } = React
const { render, Box, Text, useInput, useApp } = require('ink')
const { io } = require('socket.io-client')
const TextInput = require('ink-text-input').default
const SelectInput = require('ink-select-input').default
const Spinner = require('ink-spinner').default

// Game states
const GAME_STATES = {
  MENU: 'menu',
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
  LOCAL_GAME: 'localGame',
}

// TUI Theme colors
const COLORS = {
  primary: '#00ff00',
  secondary: '#00ffff',
  danger: '#ff0000',
  background: '#000000',
  accent: '#ffff00',
  text: '#00ff00',
  textSecondary: '#ffffff',
  border: '#00ff00',
}

// Header component
const Header = () => (
  <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
    <Text color={COLORS.primary} bold>
      🐍 SNAKE FIGHTER - TUI CLIENT 🐍
    </Text>
  </Box>
)

// Menu Screen Component
const MenuScreen = ({ onCreateRoom, onJoinRoom, onStartLocalGame, isConnected }) => {
  const [playerName, setPlayerName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [currentInput, setCurrentInput] = useState('name')

  useInput((input, key) => {
    if (key.return) {
      if (currentInput === 'name' && playerName.trim()) {
        setCurrentInput('action')
      } else if (currentInput === 'roomId' && roomId.trim()) {
        onJoinRoom(roomId.trim().toUpperCase(), playerName.trim())
      }
    }
    if (key.escape) {
      setCurrentInput('name')
    }
  })

  const menuItems = [
    {
      label: '🌐 Create Online Room',
      value: 'create',
      disabled: !isConnected || !playerName.trim(),
    },
    {
      label: '🏠 Join Room',
      value: 'join',
      disabled: !isConnected || !playerName.trim(),
    },
    {
      label: '🖥️  Local Game',
      value: 'local',
      disabled: !playerName.trim(),
    },
    {
      label: '🤖 AI Game',
      value: 'ai',
      disabled: !playerName.trim(),
    },
    {
      label: '❌ Exit',
      value: 'exit',
    },
  ]

  const handleSelect = (item) => {
    switch (item.value) {
      case 'create':
        onCreateRoom(playerName.trim())
        break
      case 'join':
        setCurrentInput('roomId')
        break
      case 'local':
        onStartLocalGame()
        break
      case 'ai':
        // TODO: Implement AI game
        break
      case 'exit':
        process.exit(0)
        break
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      
      <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color={COLORS.accent}>Connection Status: </Text>
          <Text color={isConnected ? COLORS.primary : COLORS.danger}>
            {isConnected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
        </Box>
      </Box>

      <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color={COLORS.accent}>Player Name:</Text>
          {currentInput === 'name' ? (
            <TextInput
              value={playerName}
              onChange={setPlayerName}
              placeholder="Enter your name..."
            />
          ) : (
            <Text color={COLORS.text}>{playerName || '(not set)'}</Text>
          )}
          {currentInput === 'name' && (
            <Text color={COLORS.textSecondary} dimColor>
              Press Enter to continue
            </Text>
          )}
        </Box>
      </Box>

      {currentInput === 'roomId' && (
        <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
          <Box flexDirection="column">
            <Text color={COLORS.accent}>Room ID:</Text>
            <TextInput
              value={roomId}
              onChange={setRoomId}
              placeholder="Enter room ID..."
            />
            <Text color={COLORS.textSecondary} dimColor>
              Press Enter to join, Escape to cancel
            </Text>
          </Box>
        </Box>
      )}

      {currentInput === 'action' && (
        <Box borderStyle="single" borderColor={COLORS.border} padding={1}>
          <Box flexDirection="column">
            <Text color={COLORS.accent} marginBottom={1}>
              Choose an option:
            </Text>
            <SelectInput items={menuItems} onSelect={handleSelect} />
          </Box>
        </Box>
      )}
    </Box>
  )
}

// Lobby Screen Component
const LobbyScreen = ({ room, playerId, onStartGame, onLeaveRoom }) => {
  useInput((input, key) => {
    if (key.return && room.host === playerId) {
      onStartGame()
    }
    if (key.escape) {
      onLeaveRoom()
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      
      <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color={COLORS.accent}>Room: {room.id}</Text>
          <Text color={COLORS.textSecondary}>
            Players: {room.players.length}/{room.maxPlayers}
          </Text>
        </Box>
      </Box>

      <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color={COLORS.accent} marginBottom={1}>
            Players:
          </Text>
          {room.players.map((player, index) => (
            <Text key={player.id} color={COLORS.text}>
              {index + 1}. {player.name} {player.id === room.host && '👑'} {player.id === playerId && '(You)'}
            </Text>
          ))}
        </Box>
      </Box>

      <Box borderStyle="single" borderColor={COLORS.border} padding={1}>
        <Box flexDirection="column">
          {room.host === playerId ? (
            <>
              <Text color={COLORS.primary}>You are the host!</Text>
              <Text color={COLORS.textSecondary}>Press Enter to start game</Text>
            </>
          ) : (
            <Text color={COLORS.textSecondary}>Waiting for host to start game...</Text>
          )}
          <Text color={COLORS.textSecondary}>Press Escape to leave room</Text>
        </Box>
      </Box>
    </Box>
  )
}

// Countdown Screen Component
const CountdownScreen = ({ countdown }) => (
  <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center">
    <Header />
    <Box borderStyle="single" borderColor={COLORS.border} padding={2}>
      <Box flexDirection="column" alignItems="center">
        <Text color={COLORS.accent} fontSize={24}>
          Game Starting In
        </Text>
        <Text color={COLORS.primary} fontSize={48} bold>
          {countdown}
        </Text>
      </Box>
    </Box>
  </Box>
)

// Game Screen Component
const GameScreen = ({ gameData, playerId }) => {
  const [gameDisplay, setGameDisplay] = useState('')

  // Convert game data to ASCII representation
  useEffect(() => {
    if (!gameData || !gameData.players) return

    const width = 32
    const height = 20
    const grid = Array(height).fill().map(() => Array(width).fill(' '))

    // Draw players
    gameData.players.forEach((player, index) => {
      if (!player.snake || !player.alive) return
      
      const char = ['●', '○', '◆', '◇', '▲', '△', '■', '□'][index] || '●'
      
      player.snake.forEach((segment, segIndex) => {
        const x = Math.floor(segment.x / 20)
        const y = Math.floor(segment.y / 20)
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = segIndex === 0 ? char : '·'
        }
      })
    })

    // Draw seeds
    if (gameData.seeds) {
      gameData.seeds.forEach(seed => {
        const x = Math.floor(seed.x / 20)
        const y = Math.floor(seed.y / 20)
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = '🍎'
        }
      })
    }

    // Draw obstacles
    if (gameData.obstacles) {
      gameData.obstacles.forEach(obstacle => {
        const x = Math.floor(obstacle.x / 20)
        const y = Math.floor(obstacle.y / 20)
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = '#'
        }
      })
    }

    const display = grid.map(row => row.join('')).join('\n')
    setGameDisplay(display)
  }, [gameData])

  useInput((input, key) => {
    // TODO: Send movement commands to server
    // This will be implemented when socket connection is properly set up
  })

  const currentPlayer = gameData?.players?.find(p => p.id === playerId)

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      
      <Box flexDirection="row">
        <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginRight={1} width="70%">
          <Text fontFamily="monospace">{gameDisplay}</Text>
        </Box>
        
        <Box flexDirection="column" width="30%">
          <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
            <Box flexDirection="column">
              <Text color={COLORS.accent}>Your Score:</Text>
              <Text color={COLORS.primary}>{currentPlayer?.score || 0}</Text>
            </Box>
          </Box>
          
          <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
            <Box flexDirection="column">
              <Text color={COLORS.accent} marginBottom={1}>
                Players:
              </Text>
              {gameData?.players?.map(player => (
                <Text key={player.id} color={player.alive ? COLORS.text : COLORS.danger}>
                  {player.name}: {player.score} {!player.alive && '💀'}
                </Text>
              ))}
            </Box>
          </Box>

          <Box borderStyle="single" borderColor={COLORS.border} padding={1}>
            <Box flexDirection="column">
              <Text color={COLORS.textSecondary}>Controls:</Text>
              <Text color={COLORS.textSecondary}>WASD or Arrow Keys</Text>
              <Text color={COLORS.textSecondary}>ESC to quit</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// Game Over Screen Component
const GameOverScreen = ({ gameOverData, playerId, onPlayAgain, onReturnToMenu }) => {
  useInput((input, key) => {
    if (key.return) {
      onPlayAgain()
    }
    if (key.escape) {
      onReturnToMenu()
    }
  })

  const winner = gameOverData?.winner
  const scores = gameOverData?.scores || []
  const isWinner = winner?.id === playerId

  return (
    <Box flexDirection="column" padding={1} alignItems="center">
      <Header />
      
      <Box borderStyle="single" borderColor={COLORS.border} padding={2} marginBottom={1}>
        <Box flexDirection="column" alignItems="center">
          <Text color={isWinner ? COLORS.primary : COLORS.danger} bold fontSize={20}>
            {isWinner ? '🎉 YOU WON! 🎉' : winner ? `${winner.name} WON!` : 'GAME OVER'}
          </Text>
        </Box>
      </Box>

      <Box borderStyle="single" borderColor={COLORS.border} padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color={COLORS.accent} marginBottom={1}>
            Final Scores:
          </Text>
          {scores.map((score, index) => (
            <Text key={score.id} color={index === 0 ? COLORS.primary : COLORS.text}>
              {index + 1}. {score.name}: {score.score}
              {score.id === playerId && ' (You)'}
            </Text>
          ))}
        </Box>
      </Box>

      <Box borderStyle="single" borderColor={COLORS.border} padding={1}>
        <Box flexDirection="column" alignItems="center">
          <Text color={COLORS.textSecondary}>Press Enter to play again</Text>
          <Text color={COLORS.textSecondary}>Press Escape to return to menu</Text>
        </Box>
      </Box>
    </Box>
  )
}

// Main App Component
const SnakeFighterTUI = () => {
  const [gameState, setGameState] = useState(GAME_STATES.MENU)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [countdown, setCountdown] = useState(3)
  const [gameData, setGameData] = useState(null)
  const [gameOverData, setGameOverData] = useState(null)
  const [error, setError] = useState('')

  const { exit } = useApp()

  // Initialize socket connection
  useEffect(() => {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
    const socketInstance = io(serverUrl)
    setSocket(socketInstance)

    socketInstance.on('connect', () => {
      setPlayerId(socketInstance.id)
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      setError(`Connection error: ${error.message}`)
      setIsConnected(false)
    })

    socketInstance.on('room-created', (data) => {
      setCurrentRoom(data.room)
      setGameState(GAME_STATES.LOBBY)
    })

    socketInstance.on('room-joined', (data) => {
      setCurrentRoom(data.room)
      setGameState(GAME_STATES.LOBBY)
    })

    socketInstance.on('player-joined', (data) => {
      setCurrentRoom(data.room)
    })

    socketInstance.on('player-left', (data) => {
      setCurrentRoom(data.room)
    })

    socketInstance.on('game-starting', () => {
      setGameState(GAME_STATES.COUNTDOWN)
      setCountdown(3)
    })

    socketInstance.on('countdown', (data) => {
      setCountdown(data.count)
    })

    socketInstance.on('game-start', () => {
      setGameState(GAME_STATES.PLAYING)
    })

    socketInstance.on('game-state', (data) => {
      setGameData(data)
    })

    socketInstance.on('game-over', (data) => {
      setGameOverData(data)
      setGameState(GAME_STATES.GAME_OVER)
    })

    socketInstance.on('return-to-lobby', () => {
      setGameState(GAME_STATES.LOBBY)
    })

    socketInstance.on('error', (error) => {
      setError(error.message || 'An error occurred')
    })

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // Global key handlers
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
    }
    
    // Game controls
    if (gameState === GAME_STATES.PLAYING && socket && isConnected) {
      let direction = null
      
      if (key.upArrow || input === 'w') {
        direction = { x: 0, y: -1 }
      } else if (key.downArrow || input === 's') {
        direction = { x: 0, y: 1 }
      } else if (key.leftArrow || input === 'a') {
        direction = { x: -1, y: 0 }
      } else if (key.rightArrow || input === 'd') {
        direction = { x: 1, y: 0 }
      }
      
      if (direction) {
        socket.emit('player-move', direction)
      }
    }
  })

  // Handle errors
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(''), 3000)
      return () => clearTimeout(timeout)
    }
  }, [error])

  const createRoom = useCallback((playerName) => {
    if (!socket || !isConnected) return
    socket.emit('create-room', { name: playerName })
  }, [socket, isConnected])

  const joinRoom = useCallback((roomId, playerName) => {
    if (!socket || !isConnected) return
    socket.emit('join-room', { roomId, playerData: { name: playerName } })
  }, [socket, isConnected])

  const startGame = useCallback(() => {
    if (!socket || !isConnected || !currentRoom) return
    socket.emit('start-game', { roomId: currentRoom.id })
  }, [socket, isConnected, currentRoom])

  const leaveRoom = useCallback(() => {
    if (!socket || !isConnected) return
    socket.emit('leave-room')
    setCurrentRoom(null)
    setGameState(GAME_STATES.MENU)
  }, [socket, isConnected])

  const startLocalGame = useCallback(() => {
    setGameState(GAME_STATES.LOCAL_GAME)
  }, [])

  const returnToMenu = useCallback(() => {
    setGameState(GAME_STATES.MENU)
    setCurrentRoom(null)
    setGameData(null)
    setGameOverData(null)
  }, [])

  const returnToLobby = useCallback(() => {
    if (currentRoom) {
      setGameState(GAME_STATES.LOBBY)
    } else {
      returnToMenu()
    }
  }, [currentRoom, returnToMenu])

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {error && (
        <Box borderStyle="single" borderColor={COLORS.danger} padding={1} marginBottom={1}>
          <Text color={COLORS.danger}>❌ {error}</Text>
        </Box>
      )}

      {gameState === GAME_STATES.MENU && (
        <MenuScreen
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onStartLocalGame={startLocalGame}
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

      {gameState === GAME_STATES.COUNTDOWN && (
        <CountdownScreen countdown={countdown} />
      )}

      {gameState === GAME_STATES.PLAYING && (
        <GameScreen gameData={gameData} playerId={playerId} />
      )}

      {gameState === GAME_STATES.GAME_OVER && gameOverData && (
        <GameOverScreen
          gameOverData={gameOverData}
          playerId={playerId}
          onPlayAgain={returnToLobby}
          onReturnToMenu={returnToMenu}
        />
      )}

      {gameState === GAME_STATES.LOCAL_GAME && (
        <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center">
          <Header />
          <Box borderStyle="single" borderColor={COLORS.border} padding={2}>
            <Box flexDirection="column" alignItems="center">
              <Text color={COLORS.accent}>Local Game Mode</Text>
              <Text color={COLORS.textSecondary}>Not implemented yet</Text>
              <Text color={COLORS.textSecondary}>Press Escape to return to menu</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// Render the app
render(<SnakeFighterTUI />)