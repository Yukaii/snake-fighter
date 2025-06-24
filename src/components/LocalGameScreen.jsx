import React, { useEffect, useRef, useState, useCallback } from 'react'

const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  GRID_SIZE: 20,
  MAX_SNAKE_LENGTH: 15,
  GAME_SPEED: 150,
  MAX_SEEDS: 5,
  SEED_SPAWN_INTERVAL: 4000,
  OBSTACLE_PLACEMENT_COOLDOWN: 15000,
}

function LocalGameScreen({ onReturnToMenu, isAIMode = false }) {
  const canvasRef = useRef(null)
  const gameLoopRef = useRef(null)
  const seedSpawnRef = useRef(null)
  const currentSeedsRef = useRef([])
  const player1Ref = useRef(null)
  const player2Ref = useRef(null)
  const obstaclesRef = useRef([])

  const [gameState, setGameState] = useState('countdown') // countdown, playing, gameOver
  const [countdown, setCountdown] = useState(3)

  const [player1, setPlayer1] = useState({
    name: 'Player 1',
    color: '#FF6B6B',
    snake: [{ x: 100, y: 100 }],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    alive: true,
    score: 0,
    lastObstaclePlacement: 0,
  })

  const [player2, setPlayer2] = useState({
    name: isAIMode ? 'AI' : 'Player 2',
    color: '#4ECDC4',
    snake: [{ x: 600, y: 400 }],
    direction: { x: -1, y: 0 },
    nextDirection: { x: -1, y: 0 },
    alive: true,
    score: 0,
    lastObstaclePlacement: 0,
    isAI: isAIMode,
  })

  const [obstacles, setObstacles] = useState([])
  const [seeds, setSeeds] = useState([])
  const [gameOverData, setGameOverData] = useState(null)

  const lightenColor = (color, percent) => {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent * 100)
    const R = (num >> 16) + amt
    const G = ((num >> 8) & 0x00ff) + amt
    const B = (num & 0x0000ff) + amt
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    )
  }

  const isPositionFree = (x, y, excludeSnakes = false, currentObstacles = obstacles, currentSeeds = seeds, currentPlayer1 = player1, currentPlayer2 = player2) => {
    // Check obstacles
    if (currentObstacles && currentObstacles.some(obstacle => obstacle.x === x && obstacle.y === y)) {
      return false
    }

    // Check seeds
    if (currentSeeds && currentSeeds.some(seed => seed.x === x && seed.y === y)) {
      return false
    }

    if (!excludeSnakes) {
      // Check both snakes
      if (currentPlayer1 && currentPlayer1.alive && currentPlayer1.snake && currentPlayer1.snake.some(segment => segment.x === x && segment.y === y)) {
        return false
      }
      if (currentPlayer2 && currentPlayer2.alive && currentPlayer2.snake && currentPlayer2.snake.some(segment => segment.x === x && segment.y === y)) {
        return false
      }
    }

    return true
  }

  const spawnSeed = () => {
    if (seeds.length >= GAME_CONFIG.MAX_SEEDS) return

    let attempts = 0
    const maxAttempts = 100

    while (attempts < maxAttempts) {
      const x = Math.floor(Math.random() * (GAME_CONFIG.CANVAS_WIDTH / GAME_CONFIG.GRID_SIZE)) * GAME_CONFIG.GRID_SIZE
      const y = Math.floor(Math.random() * (GAME_CONFIG.CANVAS_HEIGHT / GAME_CONFIG.GRID_SIZE)) * GAME_CONFIG.GRID_SIZE

      if (isPositionFree(x, y)) {
        setSeeds(prev => [...prev, { x, y }])
        break
      }
      attempts++
    }
  }

  const canPlaceObstacle = (player) => {
    if (!player.alive || player.snake.length <= 1) return false
    const now = Date.now()
    return (now - player.lastObstaclePlacement) >= GAME_CONFIG.OBSTACLE_PLACEMENT_COOLDOWN
  }

  const placeObstacle = (playerNum) => {
    const player = playerNum === 1 ? player1 : player2
    const setPlayer = playerNum === 1 ? setPlayer1 : setPlayer2

    if (!canPlaceObstacle(player)) return

    setPlayer(prev => {
      const newSnake = [...prev.snake]
      const tail = newSnake.pop()

      if (tail) {
        setObstacles(prevObstacles => [...prevObstacles, {
          x: tail.x,
          y: tail.y,
          type: 'dotted',
          placedBy: playerNum
        }])
      }

      return {
        ...prev,
        snake: newSnake,
        score: Math.max(0, newSnake.length - 1),
        lastObstaclePlacement: Date.now()
      }
    })
  }


  const calculateAIDirection = (aiPlayer, humanPlayer, currentSeeds, currentObstacles) => {
    if (!aiPlayer.alive) return aiPlayer.direction

    const head = aiPlayer.snake[0]
    const possibleDirections = [
      { x: 0, y: -1 }, // up
      { x: 0, y: 1 },  // down
      { x: -1, y: 0 }, // left
      { x: 1, y: 0 }   // right
    ]

    // Filter out 180-degree turns
    const validDirections = possibleDirections.filter(dir => {
      return !(dir.x === -aiPlayer.direction.x && dir.y === -aiPlayer.direction.y)
    })

    // Helper function to check if position is safe
    const isPositionSafe = (pos, lookahead = 0) => {
      // Check walls
      if (pos.x < 0 || pos.x >= GAME_CONFIG.CANVAS_WIDTH ||
          pos.y < 0 || pos.y >= GAME_CONFIG.CANVAS_HEIGHT) {
        return false
      }

      // Check obstacles
      if (currentObstacles.some(obs => obs.x === pos.x && obs.y === pos.y)) {
        return false
      }

      // Check self collision
      if (aiPlayer.snake.some(segment => segment.x === pos.x && segment.y === pos.y)) {
        return false
      }

      // Check human player collision
      if (humanPlayer && humanPlayer.alive && humanPlayer.snake.some(segment =>
          segment.x === pos.x && segment.y === pos.y)) {
        return false
      }

      return true
    }

    // Calculate available space from a position using flood fill
    const calculateAvailableSpace = (startPos) => {
      const visited = new Set()
      const queue = [startPos]
      let spaceCount = 0

      while (queue.length > 0 && spaceCount < 50) { // Limit search to prevent lag
        const pos = queue.shift()
        const key = `${pos.x},${pos.y}`

        if (visited.has(key)) continue
        visited.add(key)

        if (!isPositionSafe(pos)) continue

        spaceCount++

        // Add neighboring positions
        const neighbors = [
          { x: pos.x, y: pos.y - GAME_CONFIG.GRID_SIZE },
          { x: pos.x, y: pos.y + GAME_CONFIG.GRID_SIZE },
          { x: pos.x - GAME_CONFIG.GRID_SIZE, y: pos.y },
          { x: pos.x + GAME_CONFIG.GRID_SIZE, y: pos.y }
        ]

        for (const neighbor of neighbors) {
          if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
            queue.push(neighbor)
          }
        }
      }

      return spaceCount
    }

    // Calculate safety score for each direction
    const directionScores = validDirections.map(direction => {
      const nextHead = {
        x: head.x + direction.x * GAME_CONFIG.GRID_SIZE,
        y: head.y + direction.y * GAME_CONFIG.GRID_SIZE
      }

      let score = 0

      // Immediate safety check - if move is lethal, heavily penalize
      if (!isPositionSafe(nextHead)) {
        score -= 10000
      } else {
        // Reward safe moves
        score += 100

        // Calculate available space from this position
        const availableSpace = calculateAvailableSpace(nextHead)
        score += availableSpace * 10 // More space = better score

        // Look ahead multiple moves for danger
        let currentPos = nextHead
        for (let lookahead = 1; lookahead <= 5; lookahead++) {
          const futureHead = {
            x: currentPos.x + direction.x * GAME_CONFIG.GRID_SIZE,
            y: currentPos.y + direction.y * GAME_CONFIG.GRID_SIZE
          }

          if (!isPositionSafe(futureHead)) {
            score -= 200 / lookahead // Penalize future danger
            break
          }

          // Penalize getting too close to walls
          const wallDistance = Math.min(
            futureHead.x,
            GAME_CONFIG.CANVAS_WIDTH - futureHead.x - GAME_CONFIG.GRID_SIZE,
            futureHead.y,
            GAME_CONFIG.CANVAS_HEIGHT - futureHead.y - GAME_CONFIG.GRID_SIZE
          )

          if (wallDistance < GAME_CONFIG.GRID_SIZE * 2) {
            score -= (20 - wallDistance) / lookahead
          }

          currentPos = futureHead
        }

        // Seek nearest seed, but only if it's safe to do so
        if (currentSeeds.length > 0) {
          const nearestSeed = currentSeeds.reduce((nearest, seed) => {
            const distToSeed = Math.abs(seed.x - nextHead.x) + Math.abs(seed.y - nextHead.y)
            const distToNearest = Math.abs(nearest.x - nextHead.x) + Math.abs(nearest.y - nextHead.y)
            return distToSeed < distToNearest ? seed : nearest
          })

          const distanceToSeed = Math.abs(nearestSeed.x - nextHead.x) + Math.abs(nearestSeed.y - nextHead.y)
          // Only seek seeds if we have enough space
          if (availableSpace > 10) {
            score += Math.max(0, 100 - distanceToSeed * 0.5)
          }
        }

        // Add slight randomness for unpredictability
        score += Math.random() * 5
      }

      return { direction, score }
    })

    // Sort by score and pick the best safe option
    directionScores.sort((a, b) => b.score - a.score)

    // Always choose the safest available move, even if it's not optimal for food
    for (const option of directionScores) {
      if (option.score > -5000) { // Only avoid moves that are immediately lethal
        return option.direction
      }
    }

    // If all moves are bad, try to find the least bad one
    return directionScores[0].direction
  }

  const checkCollisionForPlayer = (player, otherPlayer, currentObstacles) => {
    if (!player.alive || !player.snake || player.snake.length === 0) return false

    const head = player.snake[0]

    // Check wall collisions
    if (head.x < 0 || head.x >= GAME_CONFIG.CANVAS_WIDTH ||
        head.y < 0 || head.y >= GAME_CONFIG.CANVAS_HEIGHT) {
      return true
    }

    // Check obstacle collisions
    if (currentObstacles.some(obstacle => obstacle.x === head.x && obstacle.y === head.y)) {
      return true
    }

    // Check self collision
    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        return true
      }
    }

    // Check collision with other player
    if (otherPlayer && otherPlayer.alive && otherPlayer.snake) {
      if (otherPlayer.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        return true
      }
    }

    return false
  }

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return

    // Get current state from refs
    const currentSeeds = currentSeedsRef.current
    const currentPlayer1 = player1Ref.current
    const currentPlayer2 = player2Ref.current
    const currentObstacles = obstaclesRef.current

    if (!currentPlayer1 || !currentPlayer2) return

    let seedsEatenThisTurn = []

    // Update AI direction if player 2 is AI - apply immediately for this frame
    let updatedPlayer2 = currentPlayer2
    if (isAIMode && currentPlayer2.alive) {
      const aiDirection = calculateAIDirection(currentPlayer2, currentPlayer1, currentSeeds, currentObstacles)
      updatedPlayer2 = { ...currentPlayer2, direction: aiDirection, nextDirection: aiDirection }

      // AI occasionally places obstacles strategically
      if (canPlaceObstacle(currentPlayer2) && Math.random() < 0.1) { // Reduced to 10% chance
        const humanHead = currentPlayer1.snake[0]
        const aiTail = currentPlayer2.snake[currentPlayer2.snake.length - 1]

        // Place obstacle if it might block human player's path
        const distanceToHuman = Math.abs(aiTail.x - humanHead.x) + Math.abs(aiTail.y - humanHead.y)
        if (distanceToHuman < 200 && currentPlayer2.snake.length > 3) {
          placeObstacle(2)
        }
      }
    }

    // Calculate new positions for both players
    let newPlayer1 = null
    let newPlayer2 = null

    // Move Player 1
    if (currentPlayer1.alive) {
      const head1 = { ...currentPlayer1.snake[0] }
      head1.x += currentPlayer1.direction.x * GAME_CONFIG.GRID_SIZE
      head1.y += currentPlayer1.direction.y * GAME_CONFIG.GRID_SIZE

      let newSnake1 = [head1, ...currentPlayer1.snake]

      // Check if player 1 ate a seed
      const eatenSeedIndex1 = currentSeeds.findIndex(seed => seed.x === head1.x && seed.y === head1.y)

      if (eatenSeedIndex1 !== -1) {
        seedsEatenThisTurn.push(eatenSeedIndex1)
      } else {
        // Normal movement - remove tail
        if (newSnake1.length > GAME_CONFIG.MAX_SNAKE_LENGTH) {
          newSnake1.pop()
        } else if (newSnake1.length > 1) {
          newSnake1.pop()
        }
      }

      newPlayer1 = {
        ...currentPlayer1,
        snake: newSnake1,
        direction: { ...currentPlayer1.nextDirection },
        score: Math.max(0, newSnake1.length - 1)
      }
    }

    // Move Player 2
    if (updatedPlayer2.alive) {
      const head2 = { ...updatedPlayer2.snake[0] }
      head2.x += updatedPlayer2.direction.x * GAME_CONFIG.GRID_SIZE
      head2.y += updatedPlayer2.direction.y * GAME_CONFIG.GRID_SIZE

      let newSnake2 = [head2, ...updatedPlayer2.snake]

      // Check if player 2 ate a seed (that player 1 didn't already eat)
      const eatenSeedIndex2 = currentSeeds.findIndex((seed, index) =>
        seed.x === head2.x && seed.y === head2.y && !seedsEatenThisTurn.includes(index)
      )

      if (eatenSeedIndex2 !== -1) {
        seedsEatenThisTurn.push(eatenSeedIndex2)
      } else {
        // Normal movement - remove tail
        if (newSnake2.length > GAME_CONFIG.MAX_SNAKE_LENGTH) {
          newSnake2.pop()
        } else if (newSnake2.length > 1) {
          newSnake2.pop()
        }
      }

      newPlayer2 = {
        ...updatedPlayer2,
        snake: newSnake2,
        direction: { ...updatedPlayer2.nextDirection },
        score: Math.max(0, newSnake2.length - 1)
      }
    }

    // Remove eaten seeds
    if (seedsEatenThisTurn.length > 0) {
      setSeeds(prevSeeds =>
        prevSeeds.filter((_, index) => !seedsEatenThisTurn.includes(index))
      )
    }

    // Update players and check collisions
    if (newPlayer1) {
      const collision1 = checkCollisionForPlayer(newPlayer1, newPlayer2 || currentPlayer2, currentObstacles)
      if (collision1) {
        setObstacles(prevObstacles => [...prevObstacles, ...newPlayer1.snake])
        setPlayer1({ ...newPlayer1, alive: false })
      } else {
        setPlayer1(newPlayer1)
      }
    }

    if (newPlayer2) {
      const collision2 = checkCollisionForPlayer(newPlayer2, newPlayer1 || currentPlayer1, currentObstacles)
      if (collision2) {
        setObstacles(prevObstacles => [...prevObstacles, ...newPlayer2.snake])
        setPlayer2({ ...newPlayer2, alive: false })
      } else {
        setPlayer2(newPlayer2)
      }
    }
  }, [gameState, isAIMode])

  const handleKeyPress = useCallback((e) => {
    if (gameState !== 'playing') return

    // Player 1 controls (WASD + Space)
    switch (e.key.toLowerCase()) {
      case 'w':
        setPlayer1(prev => {
          // Prevent 180-degree turn
          if (prev.direction.y !== 1) {
            return { ...prev, nextDirection: { x: 0, y: -1 } }
          }
          return prev
        })
        break
      case 's':
        setPlayer1(prev => {
          // Prevent 180-degree turn
          if (prev.direction.y !== -1) {
            return { ...prev, nextDirection: { x: 0, y: 1 } }
          }
          return prev
        })
        break
      case 'a':
        setPlayer1(prev => {
          // Prevent 180-degree turn
          if (prev.direction.x !== 1) {
            return { ...prev, nextDirection: { x: -1, y: 0 } }
          }
          return prev
        })
        break
      case 'd':
        setPlayer1(prev => {
          // Prevent 180-degree turn
          if (prev.direction.x !== -1) {
            return { ...prev, nextDirection: { x: 1, y: 0 } }
          }
          return prev
        })
        break
      case ' ':
        e.preventDefault()
        placeObstacle(1)
        break
    }

    // Player 2 controls (IJKL + Enter) - only if not AI mode
    if (!isAIMode) {
      switch (e.key.toLowerCase()) {
        case 'i':
          setPlayer2(prev => {
            // Prevent 180-degree turn
            if (prev.direction.y !== 1) {
              return { ...prev, nextDirection: { x: 0, y: -1 } }
            }
            return prev
          })
          break
        case 'k':
          setPlayer2(prev => {
            // Prevent 180-degree turn
            if (prev.direction.y !== -1) {
              return { ...prev, nextDirection: { x: 0, y: 1 } }
            }
            return prev
          })
          break
        case 'j':
          setPlayer2(prev => {
            // Prevent 180-degree turn
            if (prev.direction.x !== 1) {
              return { ...prev, nextDirection: { x: -1, y: 0 } }
            }
            return prev
          })
          break
        case 'l':
          setPlayer2(prev => {
            // Prevent 180-degree turn
            if (prev.direction.x !== -1) {
              return { ...prev, nextDirection: { x: 1, y: 0 } }
            }
            return prev
          })
          break
        case 'enter':
          e.preventDefault()
          placeObstacle(2)
          break
      }
    }
  }, [gameState, player1, player2])

  const renderGame = (currentPlayer1, currentPlayer2, currentObstacles, currentSeeds) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw seeds
    if (currentSeeds && currentSeeds.length > 0) {
      ctx.fillStyle = '#FFD700'
      currentSeeds.forEach(seed => {
        ctx.beginPath()
        ctx.arc(seed.x + 10, seed.y + 10, 8, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = '#FFF'
        ctx.beginPath()
        ctx.arc(seed.x + 8, seed.y + 8, 3, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#FFD700'
      })
    }

    // Draw obstacles
    if (currentObstacles && currentObstacles.length > 0) {
      currentObstacles.forEach(obstacle => {
        if (obstacle.type === 'dotted') {
          ctx.fillStyle = '#999'
          ctx.fillRect(obstacle.x + 2, obstacle.y + 2, 16, 16)

          ctx.fillStyle = '#333'
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              if ((i + j) % 2 === 0) {
                ctx.fillRect(obstacle.x + 2 + i * 4, obstacle.y + 2 + j * 4, 2, 2)
              }
            }
          }
        } else {
          ctx.fillStyle = '#666'
          ctx.fillRect(obstacle.x, obstacle.y, 20, 20)
        }
      })
    }

    // Draw snakes
    [currentPlayer1, currentPlayer2].forEach(player => {
      if (!player || !player.alive || !player.snake) return

      player.snake.forEach((segment, index) => {
        if (index === 0) {
          // Draw head
          ctx.fillStyle = player.color
          ctx.fillRect(segment.x, segment.y, 20, 20)
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.strokeRect(segment.x, segment.y, 20, 20)
        } else {
          // Draw body
          ctx.fillStyle = lightenColor(player.color, 0.3)
          ctx.fillRect(segment.x + 1, segment.y + 1, 18, 18)
        }
      })
    })
  }

  // Countdown effect
  useEffect(() => {
    if (gameState === 'countdown') {
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setGameState('playing')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(countdownInterval)
    }
  }, [gameState])

  // Game loop effect
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = setInterval(gameLoop, GAME_CONFIG.GAME_SPEED)

      return () => {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, gameLoop])

  // Initial seed spawning effect
  useEffect(() => {
    if (gameState === 'playing') {
      // Spawn initial seeds
      for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnSeed(), i * 500)
      }

      // Start seed spawning
      seedSpawnRef.current = setInterval(() => {
        // Use ref to get current seeds length to avoid stale closure
        if (currentSeedsRef.current.length < GAME_CONFIG.MAX_SEEDS) {
          spawnSeed()
        }
      }, GAME_CONFIG.SEED_SPAWN_INTERVAL)

      return () => {
        if (seedSpawnRef.current) clearInterval(seedSpawnRef.current)
      }
    }
  }, [gameState])

  // Check game over effect
  useEffect(() => {
    if (gameState === 'playing') {
      const alivePlayers = [player1, player2].filter(p => p.alive)
      if (alivePlayers.length <= 1) {
        setGameState('gameOver')
        const winner = alivePlayers.length > 0 ? alivePlayers[0] : null
        setGameOverData({
          winner: winner ? { name: winner.name } : null,
          scores: [
            { name: player1.name, score: player1.score },
            { name: player2.name, score: player2.score }
          ].sort((a, b) => b.score - a.score)
        })
      }
    }
  }, [player1.alive, player2.alive, gameState, player1.name, player1.score, player2.name, player2.score])

  // Keep refs in sync
  useEffect(() => {
    currentSeedsRef.current = seeds
  }, [seeds])

  useEffect(() => {
    player1Ref.current = player1
  }, [player1])

  useEffect(() => {
    player2Ref.current = player2
  }, [player2])

  useEffect(() => {
    obstaclesRef.current = obstacles
  }, [obstacles])

  // Render effect
  useEffect(() => {
    renderGame(player1, player2, obstacles, seeds)
  }, [player1, player2, obstacles, seeds])

  // Key event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  const restartGame = () => {
    setGameState('countdown')
    setCountdown(3)
    setPlayer1({
      name: 'Player 1',
      color: '#FF6B6B',
      snake: [{ x: 100, y: 100 }],
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      alive: true,
      score: 0,
      lastObstaclePlacement: 0,
    })
    setPlayer2({
      name: isAIMode ? 'AI' : 'Player 2',
      color: '#4ECDC4',
      snake: [{ x: 600, y: 400 }],
      direction: { x: -1, y: 0 },
      nextDirection: { x: -1, y: 0 },
      alive: true,
      score: 0,
      lastObstaclePlacement: 0,
      isAI: isAIMode,
    })
    setObstacles([])
    setSeeds([])
    setGameOverData(null)
  }

  if (gameState === 'countdown') {
    return (
      <div className="screen">
        <div style={{ textAlign: 'center' }}>
          <h2>🐍 {isAIMode ? 'vs AI Mode' : 'Local 2-Player Mode'}</h2>
          <h1 style={{ fontSize: '4rem', margin: '50px 0' }}>{countdown}</h1>
          <p>Get ready! 🚀</p>
          <div style={{ marginTop: '40px', fontSize: '14px' }}>
            <p><strong>Player 1:</strong> WASD + Space</p>
            {isAIMode ? (
              <p><strong>AI:</strong> Computer Controlled</p>
            ) : (
              <p><strong>Player 2:</strong> IJKL + Enter</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'gameOver') {
    return (
      <div className="screen">
        <div style={{ textAlign: 'center' }}>
          <h2>🏁 Game Over!</h2>
          {gameOverData.winner ? (
            <h3>🏆 {gameOverData.winner.name} Wins!</h3>
          ) : (
            <h3>💥 It's a Draw!</h3>
          )}

          <div style={{ margin: '30px 0' }}>
            <h4>Final Scores:</h4>
            {gameOverData.scores.map((score, index) => (
              <div key={index} style={{ margin: '10px 0', fontSize: '18px' }}>
                {index === 0 ? '🥇' : '🥈'} {score.name}: {score.score}
              </div>
            ))}
          </div>

          <div className="form-group">
            <button className="btn" onClick={restartGame}>
              🔄 Play Again
            </button>
            <button className="btn btn-secondary" onClick={onReturnToMenu}>
              🏠 Return to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="game-ui">
        <div className="game-info" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div><strong>Player 1 ({player1.name}):</strong> {player1.score} {player1.alive ? '🐍' : '💀'}</div>
            <div>Obstacle: {canPlaceObstacle(player1) ? '✅' : '⏳'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><strong>Player 2 ({player2.name}):</strong> {player2.score} {player2.alive ? '🐍' : '💀'}</div>
            <div>Obstacle: {canPlaceObstacle(player2) ? '✅' : '⏳'}</div>
          </div>
        </div>

        <canvas ref={canvasRef} className="game-canvas" width={800} height={600} />

        <div className="controls-info">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p><strong>Player 1:</strong> WASD + Space</p>
            </div>
            <div>
              {isAIMode ? (
                <p><strong>AI:</strong> Computer Controlled</p>
              ) : (
                <p><strong>Player 2:</strong> IJKL + Enter</p>
              )}
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '10px' }}>
            🟡 Eat seeds to grow • Press action key to place dotted obstacles (15s cooldown)
          </p>
        </div>
      </div>
    </div>
  )
}

export default LocalGameScreen
