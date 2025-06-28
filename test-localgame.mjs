#!/usr/bin/env node

import LocalGame from './src/lib/localGameLogic.js'

console.log('🐍 Snake Fighter - LocalGame Test Suite')
console.log('=====================================\n')

const config = {
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 480,
  GRID_SIZE: 20,
  MAX_SNAKE_LENGTH: 15,
  GAME_SPEED: 150,
  MAX_SEEDS: 5,
  SEED_SPAWN_INTERVAL: 4000,
  OBSTACLE_PLACEMENT_COOLDOWN: 15000,
}

function testCountdown() {
  console.log('📊 Testing Countdown Logic...')
  const game = new LocalGame(config, true) // AI mode
  const initialState = game.getGameState()

  console.log(`Initial state: ${initialState.gameState}, countdown: ${initialState.countdown}`)
  console.log(`Player1: ${initialState.player1.name} at ${JSON.stringify(initialState.player1.snake[0])}`)
  console.log(`Player2: ${initialState.player2.name} at ${JSON.stringify(initialState.player2.snake[0])}`)
  console.log(`Seeds: ${initialState.seeds.length} spawned`)

  console.log('\nCountdown sequence:')
  for (let i = 0; i < 5; i++) {
    const gameStarted = game.tickCountdown()
    const state = game.getGameState()
    console.log(`  ${i + 1}. countdown: ${state.countdown}, gameState: ${state.gameState}, started: ${gameStarted}`)

    if (gameStarted) {
      console.log('  ✅ Game started successfully!')
      break
    }
  }

  return game
}

function testMovement(game) {
  console.log('\n🎮 Testing Movement and AI...')

  for (let i = 0; i < 10; i++) {
    game.update()
    const state = game.getGameState()

    if (i === 0 || i === 4 || i === 9) {
      console.log(`Update ${i + 1}:`)
      console.log(`  Player1: ${JSON.stringify(state.player1.snake[0])} (length: ${state.player1.snake.length})`)
      console.log(`  Player2: ${JSON.stringify(state.player2.snake[0])} (length: ${state.player2.snake.length})`)
      console.log(`  Seeds: ${state.seeds.length}, Obstacles: ${state.obstacles.length}`)
    }

    if (state.gameState === 'gameOver') {
      console.log(`  🏁 Game over after ${i + 1} updates!`)
      if (state.winner) {
        console.log(`  🏆 Winner: ${state.winner.name}`)
      }
      break
    }
  }

  return game
}

function testPlayerControls(game) {
  console.log('\n🕹️  Testing Player Controls...')

  const directions = [
    { name: 'UP', dir: { x: 0, y: -1 } },
    { name: 'RIGHT', dir: { x: 1, y: 0 } },
    { name: 'DOWN', dir: { x: 0, y: 1 } },
    { name: 'LEFT', dir: { x: -1, y: 0 } }
  ]

  directions.forEach((test, index) => {
    const beforeState = game.getGameState()
    const beforeHead = { ...beforeState.player1.snake[0] }

    game.setPlayerDirection(1, test.dir)
    game.update()

    const afterState = game.getGameState()
    const afterHead = afterState.player1.snake[0]

    const moved = beforeHead.x !== afterHead.x || beforeHead.y !== afterHead.y
    console.log(`  ${test.name}: ${JSON.stringify(beforeHead)} → ${JSON.stringify(afterHead)} ${moved ? '✅' : '❌'}`)
  })
}

function testObstaclePlacement(game) {
  console.log('\n🧱 Testing Obstacle Placement...')

  const beforeState = game.getGameState()
  const canPlace = game.canPlaceObstacle(1)
  console.log(`  Can place obstacle: ${canPlace}`)

  if (canPlace) {
    const beforeObstacles = beforeState.obstacles.length
    const beforeSnakeLength = beforeState.player1.snake.length

    const placed = game.placeObstacle(1)
    const afterState = game.getGameState()

    console.log(`  Obstacle placed: ${placed}`)
    console.log(`  Obstacles: ${beforeObstacles} → ${afterState.obstacles.length}`)
    console.log(`  Snake length: ${beforeSnakeLength} → ${afterState.player1.snake.length}`)
  }
}

function testGameStates() {
  console.log('\n🎯 Testing Game State Transitions...')

  // Test 2-player mode
  const game2p = new LocalGame(config, false)
  console.log(`  2P Mode - Player2: ${game2p.getGameState().player2.name} (AI: ${game2p.getGameState().player2.isAI})`)

  // Test AI mode
  const gameAI = new LocalGame(config, true)
  console.log(`  AI Mode - Player2: ${gameAI.getGameState().player2.name} (AI: ${gameAI.getGameState().player2.isAI})`)
}

function runFullTest() {
  try {
    // Test countdown and initialization
    const game = testCountdown()

    // Test movement and AI
    testMovement(game)

    // Test player controls
    testPlayerControls(game)

    // Test obstacle placement
    testObstaclePlacement(game)

    // Test different game modes
    testGameStates()

    console.log('\n✅ All tests completed successfully!')
    console.log('\n💡 TUI Client Integration Notes:')
    console.log('  - Use normalized direction vectors: { x: 1, y: 0 }')
    console.log('  - Call localGame.tickCountdown() during countdown')
    console.log('  - Call localGame.update() every 150ms during play')
    console.log('  - Initial game data is available immediately after creation')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    console.error(error.stack)
  }
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullTest()
}

// Export for use in other scripts
export { testCountdown, testMovement, testPlayerControls, testObstaclePlacement, testGameStates, runFullTest }
