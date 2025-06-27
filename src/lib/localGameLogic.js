const DEFAULT_GAME_CONFIG = {
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 480,
  GRID_SIZE: 20,
  MAX_SNAKE_LENGTH: 15,
  GAME_SPEED: 150, // Note: This will be handled by the client's game loop interval
  MAX_SEEDS: 5,
  SEED_SPAWN_INTERVAL: 4000, // Note: This will be handled by the client's seed spawning interval
  OBSTACLE_PLACEMENT_COOLDOWN: 15000,
}

class LocalGame {
  constructor(config = {}, isAIMode = true) {
    this.config = { ...DEFAULT_GAME_CONFIG, ...config }
    this.isAIMode = isAIMode
    this.reset()
  }

  reset() {
    this.gameState = 'countdown' // countdown, playing, gameOver
    this.countdown = 3
    this.winner = null

    this.player1 = this._createPlayer('Player 1', '#FF6B6B', { x: 100, y: 100 }, { x: 1, y: 0 })
    this.player2 = this._createPlayer(
      this.isAIMode ? 'AI' : 'Player 2',
      '#4ECDC4',
      { x: 600, y: 400 },
      { x: -1, y: 0 },
      this.isAIMode
    )

    this.obstacles = []
    this.seeds = []
    this.lastSeedSpawnTime = Date.now()

    // Spawn initial seeds
    for (let i = 0; i < 3; i++) {
      this.spawnSeed()
    }
  }

  _createPlayer(name, color, startPos, startDir, isAI = false) {
    return {
      name,
      color,
      snake: [startPos],
      direction: { ...startDir },
      nextDirection: { ...startDir },
      alive: true,
      score: 0,
      lastObstaclePlacement: 0,
      isAI,
    }
  }

  // --- Game State Access ---
  getGameState() {
    return {
      gameState: this.gameState,
      countdown: this.countdown,
      winner: this.winner,
      player1: this.player1,
      player2: this.player2,
      obstacles: this.obstacles,
      seeds: this.seeds,
      config: this.config,
    }
  }

  // --- Player Actions ---
  setPlayerDirection(playerNum, direction) {
    const player = playerNum === 1 ? this.player1 : this.player2
    if (!player || !player.alive) return

    // Prevent 180-degree turn
    if (player.direction.x === -direction.x && player.direction.y === -direction.y) {
      return
    }
    player.nextDirection = { ...direction }
  }

  canPlaceObstacle(playerNum) {
    const player = playerNum === 1 ? this.player1 : this.player2
    if (!player || !player.alive || player.snake.length <= 1) return false
    const now = Date.now()
    return now - player.lastObstaclePlacement >= this.config.OBSTACLE_PLACEMENT_COOLDOWN
  }

  placeObstacle(playerNum) {
    const player = playerNum === 1 ? this.player1 : this.player2

    if (!this.canPlaceObstacle(playerNum)) return false

    const newSnake = [...player.snake]
    const tail = newSnake.pop() // Remove last segment

    if (tail) {
      this.obstacles.push({
        x: tail.x,
        y: tail.y,
        type: 'dotted', // Or any other relevant info
        placedBy: playerNum,
      })
    }

    player.snake = newSnake
    player.score = Math.max(0, newSnake.length - 1)
    player.lastObstaclePlacement = Date.now()
    return true
  }

  // --- Game Logic ---
  isPositionFree(x, y, excludeSnakes = false) {
    if (this.obstacles.some((obstacle) => obstacle.x === x && obstacle.y === y)) {
      return false
    }
    if (this.seeds.some((seed) => seed.x === x && seed.y === y)) {
      return false
    }

    if (!excludeSnakes) {
      if (
        this.player1.alive &&
        this.player1.snake.some((segment) => segment.x === x && segment.y === y)
      ) {
        return false
      }
      if (
        this.player2.alive &&
        this.player2.snake.some((segment) => segment.x === x && segment.y === y)
      ) {
        return false
      }
    }
    return true
  }

  spawnSeed() {
    if (this.seeds.length >= this.config.MAX_SEEDS) return

    let attempts = 0
    const maxAttempts = 100
    while (attempts < maxAttempts) {
      const x =
        Math.floor(Math.random() * (this.config.CANVAS_WIDTH / this.config.GRID_SIZE)) *
        this.config.GRID_SIZE
      const y =
        Math.floor(Math.random() * (this.config.CANVAS_HEIGHT / this.config.GRID_SIZE)) *
        this.config.GRID_SIZE

      if (this.isPositionFree(x, y)) {
        this.seeds.push({ x, y })
        break
      }
      attempts++
    }
  }

  _checkCollisionForPlayer(player, otherPlayer) {
    if (!player.alive || !player.snake || player.snake.length === 0) return false
    const head = player.snake[0]

    if (
      head.x < 0 ||
      head.x >= this.config.CANVAS_WIDTH ||
      head.y < 0 ||
      head.y >= this.config.CANVAS_HEIGHT
    ) {
      return true // Wall collision
    }

    if (this.obstacles.some((obstacle) => obstacle.x === head.x && obstacle.y === head.y)) {
      return true // Obstacle collision
    }

    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        return true // Self collision
      }
    }

    if (
      otherPlayer.alive &&
      otherPlayer.snake.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      return true // Other player collision
    }
    return false
  }

  _calculateAIDirection() {
    const aiPlayer = this.player2 // Assuming player2 is AI
    const humanPlayer = this.player1
    if (!aiPlayer.alive) return aiPlayer.direction

    const head = aiPlayer.snake[0]
    const possibleDirections = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]

    const validDirections = possibleDirections.filter(
      (dir) => !(dir.x === -aiPlayer.direction.x && dir.y === -aiPlayer.direction.y)
    )

    const isPositionSafe = (pos) => {
      if (
        pos.x < 0 ||
        pos.x >= this.config.CANVAS_WIDTH ||
        pos.y < 0 ||
        pos.y >= this.config.CANVAS_HEIGHT
      )
        return false
      if (this.obstacles.some((obs) => obs.x === pos.x && obs.y === pos.y)) return false
      if (aiPlayer.snake.some((seg) => seg.x === pos.x && seg.y === pos.y)) return false
      if (humanPlayer.alive && humanPlayer.snake.some((seg) => seg.x === pos.x && seg.y === pos.y))
        return false
      return true
    }

    const getNeighbors = (pos) => [
      { x: pos.x, y: pos.y - this.config.GRID_SIZE },
      { x: pos.x, y: pos.y + this.config.GRID_SIZE },
      { x: pos.x - this.config.GRID_SIZE, y: pos.y },
      { x: pos.x + this.config.GRID_SIZE, y: pos.y },
    ]

    const addUnvisitedNeighbors = (pos, queue, visited) => {
      const neighbors = getNeighbors(pos)
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`
        if (!visited.has(neighborKey)) {
          queue.push(neighbor)
        }
      }
    }

    const calculateAvailableSpace = (startPos) => {
      const visited = new Set()
      const queue = [startPos]
      let spaceCount = 0

      while (queue.length > 0 && spaceCount < 50) {
        // Limit search depth
        const pos = queue.shift()
        const key = `${pos.x},${pos.y}`

        if (visited.has(key)) continue
        visited.add(key)

        if (!isPositionSafe(pos)) continue

        spaceCount++
        addUnvisitedNeighbors(pos, queue, visited)
      }
      return spaceCount
    }

    const directionScores = validDirections.map((direction) => {
      const nextHead = {
        x: head.x + direction.x * this.config.GRID_SIZE,
        y: head.y + direction.y * this.config.GRID_SIZE,
      }
      let score = 0

      if (!isPositionSafe(nextHead)) {
        score -= 10000
      } else {
        score += 100
        const availableSpace = calculateAvailableSpace(nextHead)
        score += availableSpace * 10

        let currentPos = nextHead
        for (let lookahead = 1; lookahead <= 5; lookahead++) {
          const futureHead = {
            x: currentPos.x + direction.x * this.config.GRID_SIZE,
            y: currentPos.y + direction.y * this.config.GRID_SIZE,
          }
          if (!isPositionSafe(futureHead)) {
            score -= 200 / lookahead
            break
          }
          const wallDistance = Math.min(
            futureHead.x,
            this.config.CANVAS_WIDTH - futureHead.x - this.config.GRID_SIZE,
            futureHead.y,
            this.config.CANVAS_HEIGHT - futureHead.y - this.config.GRID_SIZE
          )
          if (wallDistance < this.config.GRID_SIZE * 2) {
            score -= (20 - wallDistance) / lookahead
          }
          currentPos = futureHead
        }

        if (this.seeds.length > 0) {
          const nearestSeed = this.seeds.reduce((nearest, seed) => {
            const distToSeed = Math.abs(seed.x - nextHead.x) + Math.abs(seed.y - nextHead.y)
            const distToNearest =
              Math.abs(nearest.x - nextHead.x) + Math.abs(nearest.y - nextHead.y)
            return distToSeed < distToNearest ? seed : nearest
          })
          const distanceToSeed =
            Math.abs(nearestSeed.x - nextHead.x) + Math.abs(nearestSeed.y - nextHead.y)
          if (availableSpace > 10) {
            // Only seek seeds if space allows
            score += Math.max(0, 100 - distanceToSeed * 0.5)
          }
        }
        score += Math.random() * 5 // Slight randomness
      }
      return { direction, score }
    })

    directionScores.sort((a, b) => b.score - a.score)
    for (const option of directionScores) {
      if (option.score > -5000) return option.direction
    }
    return directionScores[0]?.direction || aiPlayer.direction // Fallback
  }

  tickCountdown() {
    if (this.gameState !== 'countdown') return false
    this.countdown -= 1
    if (this.countdown <= 0) {
      this.gameState = 'playing'
      this.lastSeedSpawnTime = Date.now() // Reset seed spawn timer
      return true // Game starting
    }
    return false // Still counting down
  }

  // Call this method regularly from the client's game loop (e.g., setInterval)
  update() {
    if (this.gameState !== 'playing') return

    // AI makes a move
    if (this.player2.isAI && this.player2.alive) {
      const aiDirection = this._calculateAIDirection()
      this.setPlayerDirection(2, aiDirection) // AI controls player 2

      // AI obstacle placement
      if (this.canPlaceObstacle(2) && Math.random() < 0.05) {
        // Reduced chance
        const humanHead = this.player1.snake[0]
        const aiTail = this.player2.snake[this.player2.snake.length - 1]
        const distanceToHuman = Math.abs(aiTail.x - humanHead.x) + Math.abs(aiTail.y - humanHead.y)
        if (distanceToHuman < 200 && this.player2.snake.length > 3) {
          this.placeObstacle(2)
        }
      }
    }

    const seedsEatenThisTurn = new Set()

    // --- Move Players ---
    const players = [this.player1, this.player2]
    const newPlayerStates = []

    for (const player of players) {
      if (!player.alive) {
        newPlayerStates.push({ ...player }) // Keep dead player's state
        continue
      }

      player.direction = { ...player.nextDirection } // Commit next direction
      const head = { ...player.snake[0] }
      head.x += player.direction.x * this.config.GRID_SIZE
      head.y += player.direction.y * this.config.GRID_SIZE

      const newSnake = [head, ...player.snake]
      let ateSeed = false

      const eatenSeedIndex = this.seeds.findIndex(
        (seed, index) => seed.x === head.x && seed.y === head.y && !seedsEatenThisTurn.has(index)
      )

      if (eatenSeedIndex !== -1) {
        seedsEatenThisTurn.add(eatenSeedIndex)
        ateSeed = true
      }

      if (!ateSeed) {
        if (newSnake.length > this.config.MAX_SNAKE_LENGTH || newSnake.length > 1) {
          newSnake.pop()
        }
      }

      newPlayerStates.push({
        ...player,
        snake: newSnake,
        score: Math.max(0, newSnake.length - 1),
      })
    }

    // Update main player objects after calculating moves for both
    this.player1 = newPlayerStates[0]
    this.player2 = newPlayerStates[1]

    // Remove eaten seeds
    if (seedsEatenThisTurn.size > 0) {
      this.seeds = this.seeds.filter((_, index) => !seedsEatenThisTurn.has(index))
    }

    // --- Check Collisions ---
    if (this.player1.alive) {
      const collision1 = this._checkCollisionForPlayer(this.player1, this.player2)
      if (collision1) {
        this.obstacles.push(...this.player1.snake.map((s) => ({ ...s, type: 'player-remains' })))
        this.player1.alive = false
      }
    }
    if (this.player2.alive) {
      const collision2 = this._checkCollisionForPlayer(this.player2, this.player1)
      if (collision2) {
        this.obstacles.push(...this.player2.snake.map((s) => ({ ...s, type: 'player-remains' })))
        this.player2.alive = false
      }
    }

    // --- Check Game Over ---
    const alivePlayers = [this.player1, this.player2].filter((p) => p.alive)
    if (alivePlayers.length <= (this.isAIMode ? 0 : 1)) {
      // If AI mode, game over if human dies. If 2P, if 1 or 0 alive.
      this.gameState = 'gameOver'
      if (alivePlayers.length === 1) {
        this.winner = { name: alivePlayers[0].name, id: alivePlayers[0] === this.player1 ? 1 : 2 }
      } else if (this.player1.score > this.player2.score) {
        this.winner = { name: this.player1.name, id: 1 }
      } else if (this.player2.score > this.player1.score) {
        this.winner = { name: this.player2.name, id: 2 }
      } else {
        this.winner = null // Draw
      }
    }

    // --- Spawn new seeds periodically ---
    // This should ideally be driven by the client's timer calling spawnSeed,
    // but can be approximated here if the update is called at a regular interval.
    // For more precise timing, client should call spawnSeed based on SEED_SPAWN_INTERVAL.
    if (Date.now() - this.lastSeedSpawnTime > this.config.SEED_SPAWN_INTERVAL) {
      if (this.seeds.length < this.config.MAX_SEEDS) {
        this.spawnSeed()
      }
      this.lastSeedSpawnTime = Date.now()
    }
  }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalGame // For CommonJS environments (like Node for TUI)
} else {
  window.LocalGame = LocalGame // For browser environments (if needed directly)
}
