import { CheckCircle, Clock, Heart, Skull } from 'phosphor-react'
import React, { useCallback, useEffect, useRef } from 'react'

function GameScreen({ gameData, playerId }) {
  const canvasRef = useRef(null)

  const lightenColor = (color, percent) => {
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
  }

  const drawDottedObstacle = (ctx, obstacle) => {
    // Draw dotted obstacle
    ctx.fillStyle = '#999'
    ctx.fillRect(obstacle.x + 2, obstacle.y + 2, 16, 16)

    // Add dotted pattern
    ctx.fillStyle = '#333'
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(obstacle.x + 2 + i * 4, obstacle.y + 2 + j * 4, 2, 2)
        }
      }
    }
  }

  const drawSolidObstacle = (ctx, obstacle) => {
    // Draw solid obstacle (from seeds or dead snakes)
    ctx.fillStyle = '#666'
    ctx.fillRect(obstacle.x, obstacle.y, 20, 20)
  }

  const drawSeeds = useCallback((ctx) => {
    if (!gameData.seeds) return
    
    ctx.fillStyle = '#FFD700' // Gold color for seeds
    for (const seed of gameData.seeds) {
      ctx.beginPath()
      ctx.arc(seed.x + 10, seed.y + 10, 8, 0, 2 * Math.PI)
      ctx.fill()

      // Add a small highlight
      ctx.fillStyle = '#FFF'
      ctx.beginPath()
      ctx.arc(seed.x + 8, seed.y + 8, 3, 0, 2 * Math.PI)
      ctx.fill()
      ctx.fillStyle = '#FFD700'
    }
  }, [gameData])

  const drawObstacles = useCallback((ctx) => {
    for (const obstacle of gameData.obstacles) {
      if (obstacle.type === 'dotted') {
        drawDottedObstacle(ctx, obstacle)
      } else {
        drawSolidObstacle(ctx, obstacle)
      }
    }
  }, [gameData, drawDottedObstacle, drawSolidObstacle])

  const drawSnakeHead = (ctx, segment, player, isCurrentPlayer) => {
    ctx.fillStyle = player.color
    ctx.fillRect(segment.x, segment.y, 20, 20)

    // Add white outline for current player
    if (isCurrentPlayer) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.strokeRect(segment.x - 1, segment.y - 1, 22, 22)
    }

    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(segment.x, segment.y, 20, 20)
  }

  const drawSnakeBody = (ctx, segment, player, isCurrentPlayer) => {
    ctx.fillStyle = lightenColor(player.color, 0.3)
    ctx.fillRect(segment.x + 1, segment.y + 1, 18, 18)

    // Add white outline for current player's body
    if (isCurrentPlayer) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.strokeRect(segment.x, segment.y, 20, 20)
    }
  }

  const drawSnakes = useCallback((ctx) => {
    for (const player of gameData.players) {
      if (!player.alive) continue

      const isCurrentPlayer = player.id === playerId

      for (const [index, segment] of player.snake.entries()) {
        if (index === 0) {
          drawSnakeHead(ctx, segment, player, isCurrentPlayer)
        } else {
          drawSnakeBody(ctx, segment, player, isCurrentPlayer)
        }
      }
    }
  }, [gameData, playerId, drawSnakeHead, drawSnakeBody])

  const renderGame = useCallback(() => {
    if (!gameData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawSeeds(ctx)
    drawObstacles(ctx)
    drawSnakes(ctx)
  }, [gameData, drawSeeds, drawObstacles, drawSnakes])

  useEffect(() => {
    renderGame()
  }, [renderGame])

  if (!gameData) {
    return (
      <div className="screen">
        <div className="game-ui">
          <h2>Loading game...</h2>
        </div>
      </div>
    )
  }

  const myPlayer = gameData.players.find((p) => p.id === playerId)

  return (
    <div className="screen">
      <div className="game-ui">
        <div className="game-info">
          <div>Score: {myPlayer ? myPlayer.score : 0}</div>
          <div>Players Alive: {gameData.playersAlive}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            My Status:{' '}
            {myPlayer?.alive ? (
              <>
                <Heart size={14} color="#4CAF50" />
                Alive
              </>
            ) : (
              <>
                <Skull size={14} color="#f44336" />
                Eliminated
              </>
            )}
          </div>
          {myPlayer?.alive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Obstacle:{' '}
              {myPlayer.canPlaceObstacle ? (
                <>
                  <CheckCircle size={14} color="#4CAF50" />
                  Ready
                </>
              ) : (
                <>
                  <Clock size={14} color="#FF9800" />
                  Cooldown
                </>
              )}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="game-canvas" width={640} height={480} />

        <div className="controls-info">
          <p>WASD/Arrows: Move • Seeds: Grow • SPACE: Place obstacle (15s cooldown)</p>
        </div>
      </div>
    </div>
  )
}

export default GameScreen
