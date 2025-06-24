import React, { useEffect, useRef } from 'react'

function GameScreen({ gameData, playerId }) {
  const canvasRef = useRef(null)

  const lightenColor = (color, percent) => {
    const num = Number.parseInt(color.replace('#', ''), 16)
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

  const renderGame = () => {
    if (!gameData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw obstacles
    ctx.fillStyle = '#666'
    gameData.obstacles.forEach((obstacle) => {
      ctx.fillRect(obstacle.x, obstacle.y, 20, 20)
    })

    // Draw snakes
    gameData.players.forEach((player) => {
      if (!player.alive) return

      player.snake.forEach((segment, index) => {
        if (index === 0) {
          // Draw head with border
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

  useEffect(() => {
    renderGame()
  }, [gameData])

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
          <div>My Status: {myPlayer && myPlayer.alive ? '🐍 Alive' : '💀 Eliminated'}</div>
        </div>

        <canvas ref={canvasRef} className="game-canvas" width={800} height={600} />

        <div className="controls-info">
          <p>Use WASD or Arrow Keys to move your snake</p>
          <p>Avoid walls, obstacles, and other snakes!</p>
        </div>
      </div>
    </div>
  )
}

export default GameScreen
