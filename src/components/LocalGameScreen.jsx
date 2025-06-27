import React, { useEffect, useRef, useState, useCallback } from 'react'
import LocalGame from '../lib/localGameLogic' // Import the new game logic
import MobileController from './ui/MobileController'

// Default game config, can be overridden by LocalGame instance if needed
const GAME_CONFIG_DEFAULTS = {
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 480,
  GRID_SIZE: 20,
  GAME_SPEED: 150, // Interval for game loop
  SEED_SPAWN_INTERVAL: 4000, // Interval for trying to spawn seeds
}

function LocalGameScreen({ onReturnToMenu, isAIMode = false }) {
  const canvasRef = useRef(null)
  const gameInstanceRef = useRef(null) // Ref to store LocalGame instance
  const gameLoopIntervalRef = useRef(null)
  const seedSpawnIntervalRef = useRef(null)

  // UI state that depends on the gameInstance's state
  const [uiGameState, setUiGameState] = useState('countdown')
  const [gameRenderData, setGameRenderData] = useState(null) // For player scores, snake positions etc.
  const [controlType, setControlType] = useState('arrows')
  const [showMobileControls, setShowMobileControls] = useState(false)

  // Initialize or reset the game instance
  const initializeGame = useCallback(() => {
    if (!gameInstanceRef.current) {
      gameInstanceRef.current = new LocalGame(
        {
          CANVAS_WIDTH: GAME_CONFIG_DEFAULTS.CANVAS_WIDTH,
          CANVAS_HEIGHT: GAME_CONFIG_DEFAULTS.CANVAS_HEIGHT,
          GRID_SIZE: GAME_CONFIG_DEFAULTS.GRID_SIZE,
          // Other config if needed by LocalGame's constructor
        },
        isAIMode
      )
    } else {
      gameInstanceRef.current.reset()
    }
    setGameRenderData(gameInstanceRef.current.getGameState())
    setUiGameState(gameInstanceRef.current.gameState)
  }, [isAIMode])

  useEffect(() => {
    initializeGame()

    // Cleanup intervals when component unmounts
    return () => {
      if (gameLoopIntervalRef.current) clearInterval(gameLoopIntervalRef.current)
      if (seedSpawnIntervalRef.current) clearInterval(seedSpawnIntervalRef.current)
    }
  }, [initializeGame])

  const lightenColor = useCallback((color, percent) => {
    const num = Number.parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent * 100)
    const R = (num >> 16) + amt
    const G = ((num >> 8) & 0x00ff) + amt
    const B = (num & 0x0000ff) + amt
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`
  }, []) // No dependencies, it's a pure function of its inputs

  const gameLoop = useCallback(() => {
    if (!gameInstanceRef.current || gameInstanceRef.current.gameState !== 'playing') {
      return
    }

    gameInstanceRef.current.update()
    const newGameData = gameInstanceRef.current.getGameState()
    setGameRenderData(newGameData) // Update UI with new state

    if (newGameData.gameState === 'gameOver') {
      setUiGameState('gameOver')
      if (gameLoopIntervalRef.current) clearInterval(gameLoopIntervalRef.current)
      if (seedSpawnIntervalRef.current) clearInterval(seedSpawnIntervalRef.current)
    }
  }, [])

  const handleKeyPress = useCallback(
    (e) => {
      if (!gameInstanceRef.current || gameInstanceRef.current.gameState !== 'playing') return

      const game = gameInstanceRef.current
      let directionP1 = null

      switch (e.key.toLowerCase()) {
        case 'w':
          directionP1 = { x: 0, y: -1 }
          break
        case 's':
          directionP1 = { x: 0, y: 1 }
          break
        case 'a':
          directionP1 = { x: -1, y: 0 }
          break
        case 'd':
          directionP1 = { x: 1, y: 0 }
          break
        case ' ':
          e.preventDefault()
          game.placeObstacle(1)
          setGameRenderData(game.getGameState()) // Update UI if obstacle placed
          return
      }

      if (directionP1) {
        game.setPlayerDirection(1, directionP1)
      }

      if (!isAIMode) {
        let directionP2 = null
        switch (e.key.toLowerCase()) {
          case 'i':
            directionP2 = { x: 0, y: -1 }
            break
          case 'k':
            directionP2 = { x: 0, y: 1 }
            break
          case 'j':
            directionP2 = { x: -1, y: 0 }
            break
          case 'l':
            directionP2 = { x: 1, y: 0 }
            break
          case 'enter':
            e.preventDefault()
            game.placeObstacle(2)
            setGameRenderData(game.getGameState()) // Update UI
            return
        }
        if (directionP2) {
          game.setPlayerDirection(2, directionP2)
        }
      }
    },
    [isAIMode]
  )

  const renderGame = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const { player1, player2, obstacles, seeds, config } = gameRenderData
    const { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE } = config

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw seeds
    if (seeds && seeds.length > 0) {
      ctx.fillStyle = '#FFD700'
      for (const seed of seeds) {
        ctx.beginPath()
        ctx.arc(seed.x + 10, seed.y + 10, 8, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = '#FFF'
        ctx.beginPath()
        ctx.arc(seed.x + 8, seed.y + 8, 3, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#FFD700' // Reset to seed color
      }
    }

    // Draw obstacles
    if (obstacles && obstacles.length > 0) {
      for (const obstacle of obstacles) {
        if (obstacle.type === 'dotted' || obstacle.type === 'player-remains') {
          ctx.fillStyle = obstacle.type === 'player-remains' ? '#555' : '#999'
          ctx.fillRect(obstacle.x + 2, obstacle.y + 2, GRID_SIZE - 4, GRID_SIZE - 4)

          if (obstacle.type === 'dotted') {
            ctx.fillStyle = '#333'
            for (let i = 0; i < 4; i++) {
              for (let j = 0; j < 4; j++) {
                if ((i + j) % 2 === 0) {
                  ctx.fillRect(
                    obstacle.x + 2 + i * (GRID_SIZE / 5),
                    obstacle.y + 2 + j * (GRID_SIZE / 5),
                    GRID_SIZE / 10,
                    GRID_SIZE / 10
                  )
                }
              }
            }
          }
        } else {
          ctx.fillStyle = '#666'
          ctx.fillRect(obstacle.x, obstacle.y, GRID_SIZE, GRID_SIZE)
        }
      }
    }

    // Draw snakes
    for (const p of [player1, player2]) {
      if (!p || !p.alive || !p.snake) continue

      const isHumanPlayer1 = p === player1

      for (const [index, segment] of p.snake.entries()) {
        if (index === 0) {
          // Head
          ctx.fillStyle = p.color
          ctx.fillRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE)

          if (isAIMode && isHumanPlayer1) {
            // Highlight human player in AI mode
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 3
            ctx.strokeRect(segment.x - 1, segment.y - 1, GRID_SIZE + 2, GRID_SIZE + 2)
          }
          ctx.strokeStyle = '#fff' // Default head outline
          ctx.lineWidth = 2
          ctx.strokeRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE)
        } else {
          // Body
          ctx.fillStyle = lightenColor(p.color, 0.3)
          ctx.fillRect(segment.x + 1, segment.y + 1, GRID_SIZE - 2, GRID_SIZE - 2)
          if (isAIMode && isHumanPlayer1) {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 2
            ctx.strokeRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE)
          }
        }
      }
    }
  }, [gameRenderData, isAIMode, lightenColor]) // Added lightenColor

  // Countdown effect
  useEffect(() => {
    if (uiGameState === 'countdown' && gameInstanceRef.current) {
      const interval = setInterval(() => {
        const gameStarted = gameInstanceRef.current.tickCountdown()
        const currentData = gameInstanceRef.current.getGameState()
        setGameRenderData(currentData) // Update countdown value in UI
        if (gameStarted) {
          setUiGameState('playing') // Transition to playing state
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [uiGameState])

  // Game loop and seed spawning effect
  useEffect(() => {
    if (uiGameState === 'playing' && gameInstanceRef.current) {
      // Start game loop
      gameLoopIntervalRef.current = setInterval(gameLoop, GAME_CONFIG_DEFAULTS.GAME_SPEED)

      // Start seed spawning
      seedSpawnIntervalRef.current = setInterval(() => {
        if (gameInstanceRef.current && gameInstanceRef.current.gameState === 'playing') {
          gameInstanceRef.current.spawnSeed()
          // No direct setGameRenderData here, gameLoop will pick up changes
        }
      }, GAME_CONFIG_DEFAULTS.SEED_SPAWN_INTERVAL)

      return () => {
        if (gameLoopIntervalRef.current) clearInterval(gameLoopIntervalRef.current)
        if (seedSpawnIntervalRef.current) clearInterval(seedSpawnIntervalRef.current)
      }
    }
  }, [uiGameState, gameLoop])

  // Render game board
  useEffect(() => {
    renderGame()
  }, [renderGame]) // Removed gameRenderData, renderGame dependency is enough

  // Key event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Detect mobile device
  useEffect(() => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    setShowMobileControls(isMobile)
  }, [])

  const handleMobileDirection = useCallback(
    (direction) => {
      if (gameInstanceRef.current && gameInstanceRef.current.gameState === 'playing') {
        gameInstanceRef.current.setPlayerDirection(1, direction)
      }
    },
    [] // No dependencies as gameInstanceRef is stable
  )

  const handleMobileObstacle = useCallback(() => {
    if (gameInstanceRef.current && gameInstanceRef.current.gameState === 'playing') {
      gameInstanceRef.current.placeObstacle(1)
      setGameRenderData(gameInstanceRef.current.getGameState()) // Update UI after action
    }
  }, []) // gameInstanceRef is stable

  const restartGame = () => {
    initializeGame() // This will reset the gameInstance and UI state
  }

  // --- Render Functions ---
  if (!gameRenderData) {
    return <div>Loading Game...</div> // Or some other loading indicator
  }

  const { player1, player2, countdown, winner } = gameRenderData

  if (uiGameState === 'countdown') {
    return (
      <div className="screen">
        <div style={{ textAlign: 'center' }}>
          <h2>🐍 {isAIMode ? 'vs AI Mode' : 'Local 2-Player Mode'}</h2>
          <h1 style={{ fontSize: '4rem', margin: '50px 0' }}>{countdown}</h1>
          <p>Get ready! 🚀</p>
          <div style={{ marginTop: '40px', fontSize: '14px' }}>
            <p>
              <strong>Player 1:</strong> WASD + Space
            </p>
            {isAIMode ? (
              <p>
                <strong>AI:</strong> Computer Controlled
              </p>
            ) : (
              <p>
                <strong>Player 2:</strong> IJKL + Enter
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (uiGameState === 'gameOver') {
    const scores = [
      { name: player1.name, score: player1.score, id: 'p1' }, // Add id for key
      { name: player2.name, score: player2.score, id: 'p2' }, // Add id for key
    ].sort((a, b) => b.score - a.score)

    return (
      <div className="screen">
        <div style={{ textAlign: 'center' }}>
          <h2>🏁 Game Over!</h2>
          {winner ? <h3>🏆 {winner.name} Wins!</h3> : <h3>💥 It's a Draw!</h3>}
          <div style={{ margin: '30px 0' }}>
            <h4>Final Scores:</h4>
            {scores.map((s, index) => (
              <div key={s.id} style={{ margin: '10px 0', fontSize: '18px' }}>
                {index === 0 ? '🥇' : '🥈'} {s.name}: {s.score}
              </div>
            ))}
          </div>
          <div className="form-group">
            <button type="button" className="btn" onClick={restartGame}>
              🔄 Play Again
            </button>
            <button type="button" className="btn btn-secondary" onClick={onReturnToMenu}>
              🏠 Return to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Playing state
  return (
    <div className="screen">
      <div className="game-ui">
        <div className="game-info" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div>
              <strong>{player1.name}:</strong> {player1.score} {player1.alive ? '🐍' : '💀'}
            </div>
            {gameInstanceRef.current && (
              <div>Obstacle: {gameInstanceRef.current.canPlaceObstacle(1) ? '✅' : '⏳'}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>
              <strong>{player2.name}:</strong> {player2.score} {player2.alive ? '🐍' : '💀'}
            </div>
            {gameInstanceRef.current &&
              !isAIMode && ( // Only show for P2 if not AI
                <div>Obstacle: {gameInstanceRef.current.canPlaceObstacle(2) ? '✅' : '⏳'}</div>
              )}
            {gameInstanceRef.current &&
              isAIMode && ( // AI obstacle status (optional to show)
                <div>AI Obstacle: {gameInstanceRef.current.canPlaceObstacle(2) ? '✅' : '⏳'}</div>
              )}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={GAME_CONFIG_DEFAULTS.CANVAS_WIDTH}
          height={GAME_CONFIG_DEFAULTS.CANVAS_HEIGHT}
        />

        <div className="controls-info">
          {/* ... (rest of controls info, same as before) ... */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p>
                <strong>Player 1:</strong> WASD + Space
              </p>
            </div>
            <div>
              {isAIMode ? (
                <p>
                  <strong>AI:</strong> Computer Controlled
                </p>
              ) : (
                <p>
                  <strong>Player 2:</strong> IJKL + Enter
                </p>
              )}
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '10px' }}>
            🟡 Eat seeds to grow • Press action key to place dotted obstacles (15s cooldown)
          </p>
          {showMobileControls && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              <label htmlFor="local-control-type-select" style={{ fontSize: '14px' }}>
                Control Type:
              </label>
              <select
                id="local-control-type-select"
                value={controlType}
                onChange={(e) => setControlType(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: '1px solid #ccc',
                  background: 'var(--bg-color)',
                  color: 'var(--text-color)',
                }}
              >
                <option value="arrows">Arrow Keys</option>
                <option value="joystick">Joystick</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {showMobileControls && player1.alive && uiGameState === 'playing' && (
        <MobileController
          onDirectionChange={handleMobileDirection}
          onObstaclePlace={handleMobileObstacle}
          controlType={controlType}
          disabled={!player1.alive || uiGameState !== 'playing'}
        />
      )}
    </div>
  )
}

export default LocalGameScreen
