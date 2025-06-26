#!/usr/bin/env node

const { io } = require('socket.io-client')

class AIPlayer {
  constructor(name = 'AI Player') {
    this.name = name
    this.socket = null
    this.gameState = null
    this.playerId = null
    this.currentRoom = null
    this.direction = { x: 1, y: 0 }
    this.lastMove = Date.now()
    this.gameConfig = {
      CANVAS_WIDTH: 640,
      CANVAS_HEIGHT: 480,
      GRID_SIZE: 20,
    }
  }

  connect(serverUrl = 'http://localhost:3000') {
    console.log(`🤖 AI Player "${this.name}" connecting to ${serverUrl}...`)

    this.socket = io(serverUrl)

    this.socket.on('connect', () => {
      this.playerId = this.socket.id
      console.log(`✅ Connected as ${this.playerId}`)
    })

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server')
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message)
    })

    this.socket.on('room-created', (data) => {
      this.currentRoom = data.room
      console.log(`🏠 Room created: ${data.roomId}`)
      console.log(`👑 You are the host. Waiting for opponent...`)
    })

    this.socket.on('room-joined', (data) => {
      this.currentRoom = data.room
      console.log(`🏠 Joined room: ${data.room.id}`)
    })

    this.socket.on('player-joined', (data) => {
      console.log(`👤 Player joined: ${data.player.name}`)

      // Auto-start game when we have 2 players and we're the host
      if (this.currentRoom && this.currentRoom.hostId === this.playerId && this.currentRoom.players.length >= 2) {
        setTimeout(() => {
          console.log('🚀 Auto-starting game...')
          this.socket.emit('start-game')
        }, 1000)
      }
    })

    this.socket.on('room-updated', (data) => {
      this.currentRoom = data.room
    })

    this.socket.on('countdown-start', (countdown) => {
      console.log(`⏰ Game starting in ${countdown} seconds...`)
    })

    this.socket.on('countdown-tick', (countdown) => {
      console.log(`⏰ ${countdown}...`)
    })

    this.socket.on('game-start', () => {
      console.log('🎮 Game started! AI is now playing...')
      this.startAI()
    })

    this.socket.on('game-update', (data) => {
      this.gameState = data
      this.makeMove()
    })

    this.socket.on('player-eliminated', (data) => {
      if (data.playerId === this.playerId) {
        console.log('💀 AI was eliminated!')
      } else {
        console.log(`💀 ${data.playerName} was eliminated!`)
      }
    })

    this.socket.on('game-end', (data) => {
      if (data.winner && data.winner.id === this.playerId) {
        console.log('🎉 AI WON!')
      } else if (data.winner) {
        console.log(`😞 AI lost. Winner: ${data.winner.name}`)
      } else {
        console.log('🤝 Game ended in a draw')
      }

      console.log('\n📊 Final Scores:')
      data.scores.forEach(score => {
        const isAI = score.id === this.playerId
        console.log(`${isAI ? '🤖' : '👤'} ${score.name}: ${score.score}`)
      })
    })

    this.socket.on('return-to-lobby', () => {
      console.log('🔄 Returning to lobby...')
    })

    this.socket.on('error', (error) => {
      console.error('❌ Game error:', error)
    })
  }

  createRoom() {
    if (!this.socket || !this.socket.connected) {
      console.error('❌ Not connected to server')
      return
    }

    console.log('🏠 Creating room...')
    this.socket.emit('create-room', { name: this.name })
  }

  joinRoom(roomId) {
    if (!this.socket || !this.socket.connected) {
      console.error('❌ Not connected to server')
      return
    }

    console.log(`🏠 Joining room ${roomId}...`)
    this.socket.emit('join-room', { roomId, playerData: { name: this.name } })
  }

  startAI() {
    console.log('🧠 AI brain activated!')
  }

  findMyPlayer() {
    if (!this.gameState || !this.gameState.players) return null
    return this.gameState.players.find(p => p.id === this.playerId)
  }

  makeMove() {
    if (!this.gameState || !this.socket) return

    const now = Date.now()
    if (now - this.lastMove < 100) return // Throttle moves

    const myPlayer = this.findMyPlayer()
    if (!myPlayer || !myPlayer.alive) return

    const newDirection = this.calculateBestMove(myPlayer)

    if (newDirection && (newDirection.x !== this.direction.x || newDirection.y !== this.direction.y)) {
      this.direction = newDirection
      this.socket.emit('player-direction', newDirection)
      this.lastMove = now
    }

    // Consider placing obstacles strategically
    if (this.shouldPlaceObstacle(myPlayer)) {
      this.socket.emit('place-obstacle')
    }
  }

  calculateBestMove(myPlayer) {
    const head = myPlayer.snake[0]
    const directions = [
      { x: 0, y: -1, name: 'UP' },    // Up
      { x: 1, y: 0, name: 'RIGHT' },  // Right
      { x: 0, y: 1, name: 'DOWN' },   // Down
      { x: -1, y: 0, name: 'LEFT' }   // Left
    ]

    // Filter out reverse direction
    const validDirections = directions.filter(dir => {
      const currentDir = this.direction
      return !(dir.x === -currentDir.x && dir.y === -currentDir.y)
    })

    // Score each direction
    const scoredDirections = validDirections.map(dir => {
      const newX = head.x + dir.x * this.gameConfig.GRID_SIZE
      const newY = head.y + dir.y * this.gameConfig.GRID_SIZE

      let score = 0

      // Avoid walls
      if (newX < 0 || newX >= this.gameConfig.CANVAS_WIDTH ||
          newY < 0 || newY >= this.gameConfig.CANVAS_HEIGHT) {
        score -= 1000
      }

      // Avoid self collision
      if (myPlayer.snake.some(segment => segment.x === newX && segment.y === newY)) {
        score -= 1000
      }

      // Avoid other players
      this.gameState.players.forEach(player => {
        if (player.id !== this.playerId && player.alive) {
          if (player.snake.some(segment => segment.x === newX && segment.y === newY)) {
            score -= 1000
          }
        }
      })

      // Avoid obstacles
      if (this.gameState.obstacles.some(obstacle => obstacle.x === newX && obstacle.y === newY)) {
        score -= 1000
      }

      // Prefer moves toward seeds
      if (this.gameState.seeds && this.gameState.seeds.length > 0) {
        const closestSeed = this.gameState.seeds.reduce((closest, seed) => {
          const distance = Math.abs(newX - seed.x) + Math.abs(newY - seed.y)
          return distance < closest.distance ? { seed, distance } : closest
        }, { distance: Infinity })

        if (closestSeed.distance !== Infinity) {
          score += 100 / (closestSeed.distance + 1)
        }
      }

      // Prefer open space (simple lookahead)
      const openSpaceScore = this.calculateOpenSpace(newX, newY, 3)
      score += openSpaceScore

      return { ...dir, score, newX, newY }
    })

    // Choose best direction
    const bestDirection = scoredDirections.reduce((best, current) =>
      current.score > best.score ? current : best
    )

    return bestDirection.score > -500 ? { x: bestDirection.x, y: bestDirection.y } : null
  }

  calculateOpenSpace(x, y, depth) {
    if (depth <= 0) return 0

    let openSpace = 0
    const directions = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
    ]

    directions.forEach(dir => {
      const newX = x + dir.x * this.gameConfig.GRID_SIZE
      const newY = y + dir.y * this.gameConfig.GRID_SIZE

      if (this.isPositionSafe(newX, newY)) {
        openSpace += 1 + this.calculateOpenSpace(newX, newY, depth - 1) * 0.5
      }
    })

    return openSpace
  }

  isPositionSafe(x, y) {
    // Check bounds
    if (x < 0 || x >= this.gameConfig.CANVAS_WIDTH ||
        y < 0 || y >= this.gameConfig.CANVAS_HEIGHT) {
      return false
    }

    // Check obstacles
    if (this.gameState.obstacles.some(obstacle => obstacle.x === x && obstacle.y === y)) {
      return false
    }

    // Check all snakes
    for (const player of this.gameState.players) {
      if (player.alive && player.snake.some(segment => segment.x === x && segment.y === y)) {
        return false
      }
    }

    return true
  }

  shouldPlaceObstacle(myPlayer) {
    if (!myPlayer.canPlaceObstacle || myPlayer.snake.length <= 2) return false

    // Only place obstacles if we're in a good position
    const enemyPlayers = this.gameState.players.filter(p => p.id !== this.playerId && p.alive)
    if (enemyPlayers.length === 0) return false

    // Place obstacle if enemy is close
    const head = myPlayer.snake[0]
    const closestEnemy = enemyPlayers.reduce((closest, player) => {
      const enemyHead = player.snake[0]
      const distance = Math.abs(head.x - enemyHead.x) + Math.abs(head.y - enemyHead.y)
      return distance < closest.distance ? { player, distance } : closest
    }, { distance: Infinity })

    return closestEnemy.distance < 100 && Math.random() < 0.3
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command) {
    console.log(`
🐍 Snake Fighter CLI AI Client

Usage:
  node cli-ai-client.js create [name] [server]  - Create a room and wait for opponent
  node cli-ai-client.js join <roomId> [name] [server] - Join existing room

Examples:
  node cli-ai-client.js create "AI Bot"
  node cli-ai-client.js join ABC123 "Smart AI"
  node cli-ai-client.js create "AI Bot" "http://localhost:3000"
    `)
    process.exit(0)
  }

  const name = args[1] || 'AI Player'
  const serverUrl = args[2] || 'http://localhost:3000'

  const ai = new AIPlayer(name)

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 AI disconnecting...')
    ai.disconnect()
    process.exit(0)
  })

  ai.connect(serverUrl)

  if (command === 'create') {
    setTimeout(() => ai.createRoom(), 1000)
  } else if (command === 'join') {
    const roomId = args[1]
    const aiName = args[2] || 'AI Player'
    const server = args[3] || 'http://localhost:3000'

    if (!roomId) {
      console.error('❌ Room ID required for join command')
      process.exit(1)
    }

    ai.name = aiName
    ai.connect(server)
    setTimeout(() => ai.joinRoom(roomId), 1000)
  }
}

if (require.main === module) {
  main()
}

module.exports = AIPlayer
