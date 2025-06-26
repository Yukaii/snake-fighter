#!/usr/bin/env node

import React, { useState, useEffect, useCallback } from 'react'
import { render, Box, Text, useInput, useApp } from 'ink'
import { io } from 'socket.io-client'
import TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'

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

// Helper to create elements with JSX-like syntax
const h = React.createElement

// Header component
const Header = () => h(Box, {
  borderStyle: "single",
  borderColor: COLORS.border,
  padding: 1,
  marginBottom: 1
}, h(Text, {
  color: COLORS.primary,
  bold: true
}, '🐍 SNAKE FIGHTER - TUI CLIENT 🐍'))

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

  return h(Box, { flexDirection: "column", padding: 1 }, [
    h(Header, { key: 'header' }),
    
    h(Box, {
      key: 'status',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1,
      marginBottom: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, { key: 'label', color: COLORS.accent }, 'Connection Status: '),
      h(Text, {
        key: 'status',
        color: isConnected ? COLORS.primary : COLORS.danger
      }, isConnected ? '✅ Connected' : '❌ Disconnected')
    ])),

    h(Box, {
      key: 'name',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1,
      marginBottom: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, { key: 'label', color: COLORS.accent }, 'Player Name:'),
      currentInput === 'name' 
        ? h(TextInput, {
            key: 'input',
            value: playerName,
            onChange: setPlayerName,
            placeholder: "Enter your name..."
          })
        : h(Text, { key: 'display', color: COLORS.text }, playerName || '(not set)'),
      currentInput === 'name' && h(Text, {
        key: 'help',
        color: COLORS.textSecondary,
        dimColor: true
      }, 'Press Enter to continue')
    ])),

    currentInput === 'roomId' && h(Box, {
      key: 'roomId',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1,
      marginBottom: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, { key: 'label', color: COLORS.accent }, 'Room ID:'),
      h(TextInput, {
        key: 'input',
        value: roomId,
        onChange: setRoomId,
        placeholder: "Enter room ID..."
      }),
      h(Text, {
        key: 'help',
        color: COLORS.textSecondary,
        dimColor: true
      }, 'Press Enter to join, Escape to cancel')
    ])),

    currentInput === 'action' && h(Box, {
      key: 'menu',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, {
        key: 'label',
        color: COLORS.accent,
        marginBottom: 1
      }, 'Choose an option:'),
      h(SelectInput, {
        key: 'select',
        items: menuItems,
        onSelect: handleSelect
      })
    ]))
  ])
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

  return h(Box, { flexDirection: "column", padding: 1 }, [
    h(Header, { key: 'header' }),
    
    h(Box, {
      key: 'room-info',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1,
      marginBottom: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, { key: 'room', color: COLORS.accent }, `Room: ${room.id}`),
      h(Text, {
        key: 'players',
        color: COLORS.textSecondary
      }, `Players: ${room.players.length}/${room.maxPlayers}`)
    ])),

    h(Box, {
      key: 'players',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1,
      marginBottom: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, {
        key: 'label',
        color: COLORS.accent,
        marginBottom: 1
      }, 'Players:'),
      ...room.players.map((player, index) => h(Text, {
        key: player.id,
        color: COLORS.text
      }, `${index + 1}. ${player.name} ${player.id === room.host ? '👑' : ''} ${player.id === playerId ? '(You)' : ''}`))
    ])),

    h(Box, {
      key: 'controls',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1
    }, h(Box, { flexDirection: "column" }, [
      room.host === playerId 
        ? h(Text, { key: 'host', color: COLORS.primary }, 'You are the host!')
        : h(Text, { key: 'wait', color: COLORS.textSecondary }, 'Waiting for host to start game...'),
      room.host === playerId && h(Text, {
        key: 'start',
        color: COLORS.textSecondary
      }, 'Press Enter to start game'),
      h(Text, {
        key: 'leave',
        color: COLORS.textSecondary
      }, 'Press Escape to leave room')
    ]))
  ])
}

// Countdown Screen Component
const CountdownScreen = ({ countdown }) => h(Box, {
  flexDirection: "column",
  padding: 1,
  alignItems: "center",
  justifyContent: "center"
}, [
  h(Header, { key: 'header' }),
  h(Box, {
    key: 'countdown',
    borderStyle: "single",
    borderColor: COLORS.border,
    padding: 2
  }, h(Box, { flexDirection: "column", alignItems: "center" }, [
    h(Text, {
      key: 'label',
      color: COLORS.accent
    }, 'Game Starting In'),
    h(Text, {
      key: 'number',
      color: COLORS.primary,
      bold: true
    }, countdown.toString())
  ]))
])

// Game Screen Component - Simplified for terminal display
const GameScreen = ({ gameData, playerId }) => {
  const [gameDisplay, setGameDisplay] = useState('')

  // Convert game data to ASCII representation
  useEffect(() => {
    if (!gameData || !gameData.players) {
      setGameDisplay('Loading game...')
      return
    }

    const width = 32
    const height = 16
    const grid = Array(height).fill().map(() => Array(width).fill(' '))

    // Draw players
    gameData.players.forEach((player, index) => {
      if (!player.snake || !player.alive) return
      
      const chars = ['●', '○', '◆', '◇', '▲', '△', '■', '□']
      const char = chars[index] || '●'
      
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
          grid[y][x] = '@'
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

  const currentPlayer = gameData?.players?.find(p => p.id === playerId)

  return h(Box, { flexDirection: "column", padding: 1 }, [
    h(Header, { key: 'header' }),
    
    h(Box, { key: 'game', flexDirection: "row" }, [
      h(Box, {
        key: 'field',
        borderStyle: "single",
        borderColor: COLORS.border,
        padding: 1,
        marginRight: 1,
        width: "65%"
      }, h(Text, { fontFamily: "monospace" }, gameDisplay)),
      
      h(Box, { key: 'sidebar', flexDirection: "column", width: "35%" }, [
        h(Box, {
          key: 'score',
          borderStyle: "single",
          borderColor: COLORS.border,
          padding: 1,
          marginBottom: 1
        }, h(Box, { flexDirection: "column" }, [
          h(Text, { key: 'label', color: COLORS.accent }, 'Your Score:'),
          h(Text, { key: 'value', color: COLORS.primary }, (currentPlayer?.score || 0).toString())
        ])),
        
        h(Box, {
          key: 'players',
          borderStyle: "single",
          borderColor: COLORS.border,
          padding: 1,
          marginBottom: 1
        }, h(Box, { flexDirection: "column" }, [
          h(Text, {
            key: 'label',
            color: COLORS.accent,
            marginBottom: 1
          }, 'Players:'),
          ...(gameData?.players?.map(player => h(Text, {
            key: player.id,
            color: player.alive ? COLORS.text : COLORS.danger
          }, `${player.name}: ${player.score} ${!player.alive ? '💀' : ''}`)) || [])
        ])),

        h(Box, {
          key: 'controls',
          borderStyle: "single",
          borderColor: COLORS.border,
          padding: 1
        }, h(Box, { flexDirection: "column" }, [
          h(Text, { key: 'label', color: COLORS.textSecondary }, 'Controls:'),
          h(Text, { key: 'wasd', color: COLORS.textSecondary }, 'WASD/Arrows'),
          h(Text, { key: 'esc', color: COLORS.textSecondary }, 'ESC to quit')
        ]))
      ])
    ])
  ])
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

  return h(Box, { flexDirection: "column", padding: 1, alignItems: "center" }, [
    h(Header, { key: 'header' }),
    
    h(Box, {
      key: 'result',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 2,
      marginBottom: 1
    }, h(Box, { flexDirection: "column", alignItems: "center" }, [
      h(Text, {
        key: 'message',
        color: isWinner ? COLORS.primary : COLORS.danger,
        bold: true
      }, isWinner ? '🎉 YOU WON! 🎉' : winner ? `${winner.name} WON!` : 'GAME OVER')
    ])),

    h(Box, {
      key: 'scores',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1,
      marginBottom: 1
    }, h(Box, { flexDirection: "column" }, [
      h(Text, {
        key: 'label',
        color: COLORS.accent,
        marginBottom: 1
      }, 'Final Scores:'),
      ...scores.map((score, index) => h(Text, {
        key: score.id,
        color: index === 0 ? COLORS.primary : COLORS.text
      }, `${index + 1}. ${score.name}: ${score.score}${score.id === playerId ? ' (You)' : ''}`))
    ])),

    h(Box, {
      key: 'controls',
      borderStyle: "single",
      borderColor: COLORS.border,
      padding: 1
    }, h(Box, { flexDirection: "column", alignItems: "center" }, [
      h(Text, { key: 'again', color: COLORS.textSecondary }, 'Press Enter to play again'),
      h(Text, { key: 'menu', color: COLORS.textSecondary }, 'Press Escape to return to menu')
    ]))
  ])
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

    // Global escape handler
    if (key.escape && gameState === GAME_STATES.LOCAL_GAME) {
      returnToMenu()
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

  const elements = []

  if (error) {
    elements.push(h(Box, {
      key: 'error',
      borderStyle: "single",
      borderColor: COLORS.danger,
      padding: 1,
      marginBottom: 1
    }, h(Text, { color: COLORS.danger }, `❌ ${error}`)))
  }

  if (gameState === GAME_STATES.MENU) {
    elements.push(h(MenuScreen, {
      key: 'menu',
      onCreateRoom: createRoom,
      onJoinRoom: joinRoom,
      onStartLocalGame: startLocalGame,
      isConnected: isConnected
    }))
  }

  if (gameState === GAME_STATES.LOBBY && currentRoom) {
    elements.push(h(LobbyScreen, {
      key: 'lobby',
      room: currentRoom,
      playerId: playerId,
      onStartGame: startGame,
      onLeaveRoom: leaveRoom
    }))
  }

  if (gameState === GAME_STATES.COUNTDOWN) {
    elements.push(h(CountdownScreen, {
      key: 'countdown',
      countdown: countdown
    }))
  }

  if (gameState === GAME_STATES.PLAYING) {
    elements.push(h(GameScreen, {
      key: 'game',
      gameData: gameData,
      playerId: playerId
    }))
  }

  if (gameState === GAME_STATES.GAME_OVER && gameOverData) {
    elements.push(h(GameOverScreen, {
      key: 'gameover',
      gameOverData: gameOverData,
      playerId: playerId,
      onPlayAgain: returnToLobby,
      onReturnToMenu: returnToMenu
    }))
  }

  if (gameState === GAME_STATES.LOCAL_GAME) {
    elements.push(h(Box, {
      key: 'local',
      flexDirection: "column",
      padding: 1,
      alignItems: "center",
      justifyContent: "center"
    }, [
      h(Header, { key: 'header' }),
      h(Box, {
        key: 'content',
        borderStyle: "single",
        borderColor: COLORS.border,
        padding: 2
      }, h(Box, { flexDirection: "column", alignItems: "center" }, [
        h(Text, { key: 'title', color: COLORS.accent }, 'Local Game Mode'),
        h(Text, { key: 'note', color: COLORS.textSecondary }, 'Not implemented yet'),
        h(Text, { key: 'help', color: COLORS.textSecondary }, 'Press Escape to return to menu')
      ]))
    ]))
  }

  return h(Box, {
    flexDirection: "column",
    height: "100%",
    width: "100%"
  }, elements)
}

// Handle exit gracefully
process.on('SIGINT', () => {
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.exit(0)
})

// Render the app
render(h(SnakeFighterTUI))