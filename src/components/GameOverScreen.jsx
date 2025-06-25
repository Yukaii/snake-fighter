import { Medal, Trophy } from 'phosphor-react'
import React from 'react'

function GameOverScreen({ gameOverData, playerId, onPlayAgain }) {
  const myPlayer = gameOverData.scores.find((p) => p.id === playerId)

  return (
    <div className="screen">
      <div className="game-over-container">
        <h2>Game Over!</h2>

        <div className="score-display">Your Score: {myPlayer ? myPlayer.score : 0}</div>

        <div
          className="winner-display"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {gameOverData.winner ? (
            <>
              <Trophy size={20} color="#FFD700" />
              Winner: {gameOverData.winner.name}
            </>
          ) : (
            'No Winner'
          )}
        </div>

        <div style={{ margin: '30px 0' }}>
          <h3>Final Scores:</h3>
          <div
            style={{
              display: 'grid',
              gap: '10px',
              maxWidth: '400px',
              margin: '20px auto',
            }}
          >
            {gameOverData.scores
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 15px',
                    background: index === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    border: player.id === playerId ? '2px solid #4CAF50' : 'none',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {index === 0 && <Trophy size={16} color="#FFD700" />}
                    {index === 1 && <Medal size={16} color="#C0C0C0" />}
                    {index === 2 && <Medal size={16} color="#CD7F32" />}
                    {player.name}
                    {player.id === playerId && ' (You)'}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{player.score}</span>
                </div>
              ))}
          </div>
        </div>

        <button type="button" className="btn" onClick={onPlayAgain}>
          Return to Lobby
        </button>

        <div style={{ marginTop: '20px', fontSize: '14px', opacity: '0.7' }}>
          <p>The game will automatically return to lobby in a few seconds...</p>
        </div>
      </div>
    </div>
  )
}

export default GameOverScreen
