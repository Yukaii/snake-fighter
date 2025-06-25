const express = require('express')
const http = require('node:http')
const socketIo = require('socket.io')
const { v4: uuidv4 } = require('uuid')
const path = require('node:path')
const cors = require('cors')

const app = express()

// Enable CORS for Express - allow all origins
const corsOptions = {
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))

const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for WebSocket
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// Always serve the React build files from dist directory
app.use(express.static(path.join(__dirname, 'dist')))

// API routes for socket.io are handled automatically

// Catch-all handler: send back React's index.html file for SPA routing
app.get('*', (_req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html')

  // Check if the dist/index.html exists
  if (require('node:fs').existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    // Fallback: serve a simple message if build doesn't exist
    res.status(404).send(`
            <html>
                <head><title>Snake Fighter</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>🐍 Snake Fighter</h1>
                    <p>Build not found. Please run <code>bun run build</code> first.</p>
                    <p>Then restart the server.</p>
                </body>
            </html>
        `)
  }
})

const PORT = process.env.PORT || 3000

const rooms = new Map()
const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  GRID_SIZE: 20,
  MAX_SNAKE_LENGTH: 15,
  GAME_SPEED: 150,
  COUNTDOWN_TIME: 3,
}

class GameRoom {
  constructor(id, hostId) {
    this.id = id
    this.hostId = hostId
    this.players = new Map()
    this.gameState = 'waiting' // waiting, countdown, playing, finished
    this.obstacles = []
    this.countdownTimer = null
    this.gameLoop = null
    this.startTime = null
  }

  addPlayer(playerId, playerData) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F']
    const color = colors[this.players.size % colors.length]

    // If this is the first player, make them the host
    if (this.players.size === 0) {
      this.hostId = playerId
    }

    this.players.set(playerId, {
      id: playerId,
      name: playerData.name,
      color: color,
      snake: this.createSnake(),
      alive: true,
      score: 0,
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
    })
  }

  removePlayer(playerId) {
    this.players.delete(playerId)
    if (playerId === this.hostId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value
    }
  }

  createSnake() {
    const startX =
      Math.floor(Math.random() * (GAME_CONFIG.CANVAS_WIDTH / GAME_CONFIG.GRID_SIZE - 3)) + 1
    const startY =
      Math.floor(Math.random() * (GAME_CONFIG.CANVAS_HEIGHT / GAME_CONFIG.GRID_SIZE - 3)) + 1

    return [
      {
        x: startX * GAME_CONFIG.GRID_SIZE,
        y: startY * GAME_CONFIG.GRID_SIZE,
      },
    ]
  }

  startCountdown() {
    if (this.gameState !== 'waiting') return

    this.gameState = 'countdown'
    let countdown = GAME_CONFIG.COUNTDOWN_TIME

    io.to(this.id).emit('countdown-start', countdown)

    this.countdownTimer = setInterval(() => {
      countdown--
      if (countdown > 0) {
        io.to(this.id).emit('countdown-tick', countdown)
      } else {
        clearInterval(this.countdownTimer)
        this.countdownTimer = null
        this.startGame()
      }
    }, 1000)
  }

  startGame() {
    this.gameState = 'playing'
    this.startTime = Date.now()

    for (const player of this.players) {
      player.alive = true
      player.score = 0
      player.snake = this.createSnake()
      player.direction = { x: 1, y: 0 }
      player.nextDirection = { x: 1, y: 0 }
    }

    this.obstacles = []

    io.to(this.id).emit('game-start')
    this.startGameLoop()
  }

  startGameLoop() {
    this.gameLoop = setInterval(() => {
      this.updateGame()
      this.sendGameState()
    }, GAME_CONFIG.GAME_SPEED)
  }

  updateGame() {
    if (this.gameState !== 'playing') return

    const alivePlayers = Array.from(this.players.values()).filter((p) => p.alive)

    if (alivePlayers.length <= 1) {
      this.endGame()
      return
    }

    for (const player of alivePlayers) {
      player.direction = { ...player.nextDirection }
      this.moveSnake(player)
      this.checkCollisions(player)
    }
  }

  moveSnake(player) {
    const head = { ...player.snake[0] }
    head.x += player.direction.x * GAME_CONFIG.GRID_SIZE
    head.y += player.direction.y * GAME_CONFIG.GRID_SIZE

    player.snake.unshift(head)

    if (player.snake.length > GAME_CONFIG.MAX_SNAKE_LENGTH) {
      player.snake.pop()
    }

    player.score = Math.max(0, player.snake.length - 1)
  }

  checkCollisions(player) {
    const head = player.snake[0]

    // Wall collision
    if (
      head.x < 0 ||
      head.x >= GAME_CONFIG.CANVAS_WIDTH ||
      head.y < 0 ||
      head.y >= GAME_CONFIG.CANVAS_HEIGHT
    ) {
      this.eliminatePlayer(player)
      return
    }

    // Self collision
    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        this.eliminatePlayer(player)
        return
      }
    }

    // Other players collision
    for (const otherPlayer of this.players) {
      if (otherPlayer.id !== player.id && otherPlayer.alive) {
        for (const segment of otherPlayer.snake) {
          if (head.x === segment.x && head.y === segment.y) {
            this.eliminatePlayer(player)
            return
          }
        }
      }
    }

    // Obstacle collision
    for (const obstacle of this.obstacles) {
      if (head.x === obstacle.x && head.y === obstacle.y) {
        this.eliminatePlayer(player)
        return
      }
    }
  }

  eliminatePlayer(player) {
    player.alive = false

    // Convert snake body to obstacles
    for (const segment of player.snake) {
      this.obstacles.push({ ...segment })
    }

    io.to(this.id).emit('player-eliminated', {
      playerId: player.id,
      playerName: player.name,
    })
  }

  endGame() {
    this.gameState = 'finished'
    if (this.gameLoop) {
      clearInterval(this.gameLoop)
      this.gameLoop = null
    }

    const alivePlayers = Array.from(this.players.values()).filter((p) => p.alive)
    const winner = alivePlayers.length > 0 ? alivePlayers[0] : null

    io.to(this.id).emit('game-end', {
      winner: winner ? { id: winner.id, name: winner.name } : null,
      scores: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
      })),
    })

    // Reset game state after 5 seconds
    setTimeout(() => {
      if (this.gameState === 'finished') {
        this.gameState = 'waiting'
        io.to(this.id).emit('return-to-lobby')
      }
    }, 5000)
  }

  updatePlayerDirection(playerId, direction) {
    const player = this.players.get(playerId)
    if (!player || !player.alive) return

    // Prevent 180-degree turns
    const currentDir = player.direction
    if (
      (direction.x === -currentDir.x && direction.y === currentDir.y) ||
      (direction.y === -currentDir.y && direction.x === currentDir.x)
    ) {
      return
    }

    player.nextDirection = direction
  }

  sendGameState() {
    const gameData = {
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        snake: p.snake,
        alive: p.alive,
        score: p.score,
      })),
      obstacles: this.obstacles,
      playersAlive: Array.from(this.players.values()).filter((p) => p.alive).length,
    }

    io.to(this.id).emit('game-update', gameData)
  }

  getRoomData() {
    return {
      id: this.id,
      hostId: this.hostId,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      })),
      gameState: this.gameState,
    }
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('create-room', (playerData) => {
    console.log('Create room event received:', playerData)
    const roomId = uuidv4().slice(0, 6).toUpperCase()
    const room = new GameRoom(roomId, socket.id)
    room.addPlayer(socket.id, playerData)
    rooms.set(roomId, room)

    socket.join(roomId)
    const roomData = room.getRoomData()
    console.log('Sending room-created event with data:', roomData)
    socket.emit('room-created', { roomId, room: roomData })

    console.log(`Room ${roomId} created by ${playerData.name}`)
  })

  socket.on('join-room', ({ roomId, playerData }) => {
    const room = rooms.get(roomId)
    if (!room) {
      socket.emit('error', 'Room not found')
      return
    }

    if (room.gameState !== 'waiting') {
      socket.emit('error', 'Game is already in progress')
      return
    }

    if (room.players.size >= 8) {
      socket.emit('error', 'Room is full')
      return
    }

    room.addPlayer(socket.id, playerData)
    socket.join(roomId)

    socket.emit('room-joined', { room: room.getRoomData() })
    socket.to(roomId).emit('player-joined', {
      player: { id: socket.id, name: playerData.name, color: room.players.get(socket.id).color },
    })

    // Send updated room data to all players to ensure host info is correct
    io.to(roomId).emit('room-updated', { room: room.getRoomData() })

    console.log(`${playerData.name} joined room ${roomId}`)
  })

  socket.on('start-game', () => {
    const room = Array.from(rooms.values()).find((r) => r.hostId === socket.id)
    if (room && room.gameState === 'waiting' && room.players.size >= 2) {
      room.startCountdown()
      console.log(`Game starting in room ${room.id}`)
    }
  })

  socket.on('player-direction', (direction) => {
    const room = Array.from(rooms.values()).find((r) => r.players.has(socket.id))
    if (room) {
      room.updatePlayerDirection(socket.id, direction)
    }
  })

  socket.on('leave-room', () => {
    handlePlayerLeave(socket.id)
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    handlePlayerLeave(socket.id)
  })

  function handlePlayerLeave(playerId) {
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(playerId)) {
        room.removePlayer(playerId)
        socket.to(roomId).emit('player-left', { playerId })

        if (room.players.size === 0) {
          if (room.gameLoop) clearInterval(room.gameLoop)
          if (room.countdownTimer) clearInterval(room.countdownTimer)
          rooms.delete(roomId)
          console.log(`Room ${roomId} deleted`)
        } else {
          socket.to(roomId).emit('room-updated', { room: room.getRoomData() })
        }
        break
      }
    }
  }
})

server.listen(PORT, () => {
  console.log(`Snake Fighter server running on port ${PORT}`)
  console.log(
    `Game Config: Max Snake Length: ${GAME_CONFIG.MAX_SNAKE_LENGTH}, Game Speed: ${GAME_CONFIG.GAME_SPEED}ms`
  )
})
