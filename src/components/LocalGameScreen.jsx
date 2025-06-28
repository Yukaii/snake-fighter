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

// Custom hook for game initialization
const useGameInitialization = (isAIMode, gameInstanceRef, setGameRenderData, setUiGameState) => {
  return useCallback(() => {
    if (!gameInstanceRef.current) {
      gameInstanceRef.current = new LocalGame(
        {
          CANVAS_WIDTH: GAME_CONFIG_DEFAULTS.CANVAS_WIDTH,
          CANVAS_HEIGHT: GAME_CONFIG_DEFAULTS.CANVAS_HEIGHT,
          GRID_SIZE: GAME_CONFIG_DEFAULTS.GRID_SIZE,
        },
        isAIMode
      )
    } else {
      gameInstanceRef.current.reset()
    }
    setGameRenderData(gameInstanceRef.current.getGameState())
    setUiGameState(gameInstanceRef.current.gameState)
  }, [isAIMode, gameInstanceRef, setGameRenderData, setUiGameState])
}

// Custom hook for mobile detection
const useMobileDetection = () => {
  const [showMobileControls, setShowMobileControls] = useState(false)

  useEffect(() => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    setShowMobileControls(isMobile)
  }, [])

  return showMobileControls
}

// Custom hook for countdown effect
const useCountdownEffect = (uiGameState, gameInstanceRef, setGameRenderData, setUiGameState) => {
  useEffect(() => {
    if (uiGameState === 'countdown' && gameInstanceRef.current) {
      const interval = setInterval(() => {
        const gameStarted = gameInstanceRef.current.tickCountdown()
        const currentData = gameInstanceRef.current.getGameState()
        setGameRenderData(currentData)
        if (gameStarted) {
          setUiGameState('playing')
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [uiGameState, gameInstanceRef, setGameRenderData, setUiGameState])
}

// Custom hook for game loop and seed spawning
const useGameLoop = (
  uiGameState,
  gameInstanceRef,
  gameLoop,
  gameLoopIntervalRef,
  seedSpawnIntervalRef
) => {
  useEffect(() => {
    if (uiGameState === 'playing' && gameInstanceRef.current) {
      gameLoopIntervalRef.current = setInterval(gameLoop, GAME_CONFIG_DEFAULTS.GAME_SPEED)

      seedSpawnIntervalRef.current = setInterval(() => {
        if (gameInstanceRef.current && gameInstanceRef.current.gameState === 'playing') {
          gameInstanceRef.current.spawnSeed()
        }
      }, GAME_CONFIG_DEFAULTS.SEED_SPAWN_INTERVAL)

      return () => {
        if (gameLoopIntervalRef.current) clearInterval(gameLoopIntervalRef.current)
        if (seedSpawnIntervalRef.current) clearInterval(seedSpawnIntervalRef.current)
      }
    }
  }, [uiGameState, gameLoop, gameInstanceRef, gameLoopIntervalRef, seedSpawnIntervalRef])
}

// Component for mobile controls
const MobileControls = ({ showMobileControls, handleMobileDirection, handleMobileObstacle }) => {
  if (!showMobileControls) return null

  return (
    <div className="mobile-controls">
      <MobileController
        onArrowPress={handleMobileDirection}
        onObstaclePlace={handleMobileObstacle}
        disabled={false}
      />
    </div>
  )
}

// Component for game info display
const GameInfo = ({ player1, player2, gameInstanceRef, isAIMode }) => (
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
      {gameInstanceRef.current && !isAIMode && (
        <div>Obstacle: {gameInstanceRef.current.canPlaceObstacle(2) ? '✅' : '⏳'}</div>
      )}
      {gameInstanceRef.current && isAIMode && (
        <div>AI Obstacle: {gameInstanceRef.current.canPlaceObstacle(2) ? '✅' : '⏳'}</div>
      )}
    </div>
  </div>
)

function LocalGameScreen({ onReturnToMenu, isAIMode = false }) {
  const canvasRef = useRef(null)
  const gameInstanceRef = useRef(null)
  const gameLoopIntervalRef = useRef(null)
  const seedSpawnIntervalRef = useRef(null)

  const [uiGameState, setUiGameState] = useState('countdown')
  const [gameRenderData, setGameRenderData] = useState(null)
  const [controlType, setControlType] = useState('arrows')

  const showMobileControls = useMobileDetection()

  const initializeGame = useGameInitialization(
    isAIMode,
    gameInstanceRef,
    setGameRenderData,
    setUiGameState
  )

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

  const getDirectionFromKey = useCallback((key) => {
    const directions = {
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
      arrowup: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 },
    }
    return directions[key.toLowerCase()]
  }, [])

  const handlePlayer1Controls = useCallback(
    (e, game) => {
      const direction = getDirectionFromKey(e.key)
      if (direction) {
        game.setPlayerDirection(1, direction)
        return true
      }

      if (e.key === ' ') {
        e.preventDefault()
        game.placeObstacle(1)
        setGameRenderData(game.getGameState())
        return true
      }

      return false
    },
    [getDirectionFromKey]
  )

  const handlePlayer2Controls = useCallback(
    (e, game) => {
      if (isAIMode) return false

      const direction = getDirectionFromKey(e.key)
      if (direction && e.key.startsWith('Arrow')) {
        game.setPlayerDirection(2, direction)
        return true
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        game.placeObstacle(2)
        setGameRenderData(game.getGameState())
        return true
      }

      return false
    },
    [isAIMode, getDirectionFromKey]
  )

  const handleKeyPress = useCallback(
    (e) => {
      if (!gameInstanceRef.current || gameInstanceRef.current.gameState !== 'playing') return

      if (e.key === 'Escape') {
        onReturnToMenu()
        return
      }

      const game = gameInstanceRef.current
      const handled = handlePlayer1Controls(e, game) || handlePlayer2Controls(e, game)

      if (!handled) return
    },
    [handlePlayer1Controls, handlePlayer2Controls, onReturnToMenu]
  )

  const clearCanvas = useCallback((ctx, width, height) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
  }, [])

  const drawSeeds = useCallback((ctx, seeds) => {
    if (!seeds || seeds.length === 0) return

    ctx.fillStyle = '#FFD700'
    for (const seed of seeds) {
      ctx.beginPath()
      ctx.arc(seed.x + 10, seed.y + 10, 8, 0, 2 * Math.PI)
      ctx.fill()

      ctx.fillStyle = '#FFF'
      ctx.beginPath()
      ctx.arc(seed.x + 8, seed.y + 8, 3, 0, 2 * Math.PI)
      ctx.fill()
      ctx.fillStyle = '#FFD700'
    }
  }, [])

  const drawDottedPattern = useCallback((ctx, obstacle, gridSize) => {
    ctx.fillStyle = '#333'
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(
            obstacle.x + 2 + i * (gridSize / 5),
            obstacle.y + 2 + j * (gridSize / 5),
            gridSize / 10,
            gridSize / 10
          )
        }
      }
    }
  }, [])

  const drawSpecialObstacle = useCallback(
    (ctx, obstacle, gridSize) => {
      ctx.fillStyle = obstacle.type === 'player-remains' ? '#555' : '#999'
      ctx.fillRect(obstacle.x + 2, obstacle.y + 2, gridSize - 4, gridSize - 4)

      if (obstacle.type === 'dotted') {
        drawDottedPattern(ctx, obstacle, gridSize)
      }
    },
    [drawDottedPattern]
  )

  const drawRegularObstacle = useCallback((ctx, obstacle, gridSize) => {
    ctx.fillStyle = '#666'
    ctx.fillRect(obstacle.x, obstacle.y, gridSize, gridSize)
  }, [])

  const drawObstacles = useCallback(
    (ctx, obstacles, gridSize) => {
      if (!obstacles || obstacles.length === 0) return

      for (const obstacle of obstacles) {
        const isSpecial = obstacle.type === 'dotted' || obstacle.type === 'player-remains'
        if (isSpecial) {
          drawSpecialObstacle(ctx, obstacle, gridSize)
        } else {
          drawRegularObstacle(ctx, obstacle, gridSize)
        }
      }
    },
    [drawSpecialObstacle, drawRegularObstacle]
  )

  const drawSnakeSegment = useCallback(
    (ctx, segment, isHead, player, gridSize, isHumanInAI) => {
      if (isHead) {
        ctx.fillStyle = player.color
        ctx.fillRect(segment.x, segment.y, gridSize, gridSize)

        if (isHumanInAI) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 3
          ctx.strokeRect(segment.x - 1, segment.y - 1, gridSize + 2, gridSize + 2)
        }
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.strokeRect(segment.x, segment.y, gridSize, gridSize)
      } else {
        ctx.fillStyle = lightenColor(player.color, 0.3)
        ctx.fillRect(segment.x + 1, segment.y + 1, gridSize - 2, gridSize - 2)
        if (isHumanInAI) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.strokeRect(segment.x, segment.y, gridSize, gridSize)
        }
      }
    },
    [lightenColor]
  )

  const drawSnakes = useCallback(
    (ctx, player1, player2, gridSize) => {
      for (const p of [player1, player2]) {
        if (!p || !p.alive || !p.snake) continue

        const isHumanPlayer1 = p === player1
        const isHumanInAI = isAIMode && isHumanPlayer1

        for (const [index, segment] of p.snake.entries()) {
          drawSnakeSegment(ctx, segment, index === 0, p, gridSize, isHumanInAI)
        }
      }
    },
    [isAIMode, drawSnakeSegment]
  )

  const renderGame = useCallback(() => {
    if (!canvasRef.current || !gameRenderData) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { player1, player2, obstacles, seeds, config } = gameRenderData
    const { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE } = config

    clearCanvas(ctx, CANVAS_WIDTH, CANVAS_HEIGHT)
    drawSeeds(ctx, seeds)
    drawObstacles(ctx, obstacles, GRID_SIZE)
    drawSnakes(ctx, player1, player2, GRID_SIZE)
  }, [gameRenderData, clearCanvas, drawSeeds, drawObstacles, drawSnakes])

  // Use custom hooks for game effects
  useCountdownEffect(uiGameState, gameInstanceRef, setGameRenderData, setUiGameState)
  useGameLoop(uiGameState, gameInstanceRef, gameLoop, gameLoopIntervalRef, seedSpawnIntervalRef)

  // Render game board
  useEffect(() => {
    renderGame()
  }, [renderGame]) // Removed gameRenderData, renderGame dependency is enough

  // Key event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

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
        <GameInfo
          player1={player1}
          player2={player2}
          gameInstanceRef={gameInstanceRef}
          isAIMode={isAIMode}
        />

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

      <MobileControls
        showMobileControls={showMobileControls && player1.alive && uiGameState === 'playing'}
        handleMobileDirection={handleMobileDirection}
        handleMobileObstacle={handleMobileObstacle}
      />
    </div>
  )
}

export default LocalGameScreen
