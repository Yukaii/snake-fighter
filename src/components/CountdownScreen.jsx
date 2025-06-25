import React from 'react'

function CountdownScreen({ countdown }) {
  return (
    <div className="countdown-overlay">
      <h2>Game Starting In</h2>
      <div className="countdown-number">{countdown}</div>
      <p style={{ fontSize: '18px', marginTop: '20px' }}>Get ready to play!</p>
    </div>
  )
}

export default CountdownScreen
