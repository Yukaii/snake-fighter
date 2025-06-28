#!/usr/bin/env node

import LocalGame from './src/lib/localGameLogic.js'

console.log('Testing LocalGame...')

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

const game = new LocalGame(config, true) // AI mode
console.log('Initial state:', game.getGameState())

console.log('\nTesting countdown...')
for (let i = 0; i < 5; i++) {
  const gameStarted = game.tickCountdown()
  const state = game.getGameState()
  console.log(`Countdown ${i}: ${state.countdown}, gameState: ${state.gameState}, gameStarted: ${gameStarted}`)
  
  if (gameStarted) {
    console.log('Game started!')
    break
  }
}

console.log('\nTesting game updates...')
for (let i = 0; i < 5; i++) {
  game.update()
  const state = game.getGameState()
  console.log(`Update ${i}: Player1 snake length: ${state.player1.snake.length}, Player2 snake length: ${state.player2.snake.length}`)
  console.log(`  Player1 head: ${JSON.stringify(state.player1.snake[0])}`)
  console.log(`  Player2 head: ${JSON.stringify(state.player2.snake[0])}`)
}

console.log('\nTesting player direction change...')
game.setPlayerDirection(1, { x: 0, y: -1 }) // Move player 1 up
game.update()
const finalState = game.getGameState()
console.log('After direction change:')
console.log(`  Player1 head: ${JSON.stringify(finalState.player1.snake[0])}`)
console.log(`  Player1 direction: ${JSON.stringify(finalState.player1.direction)}`)