# LocalGame Test Suite

This test suite validates the core game logic used by both the TUI client and web client for local/AI games.

## Running Tests

```bash
# Run the full test suite
npm run test:localgame

# Or run directly
node test-localgame.mjs
```

## What It Tests

### 🕹️ Core Functionality
- **Countdown Logic**: Verifies 3-2-1 countdown and transition to playing state
- **Movement System**: Tests snake movement and AI pathfinding
- **Player Controls**: Validates direction changes (UP, DOWN, LEFT, RIGHT)
- **Obstacle Placement**: Tests obstacle creation and snake length reduction
- **Game Modes**: Verifies 2-player vs AI mode differences

### 🐛 Common Issues Detected
- Incorrect direction vectors (should be normalized: `{x: 1, y: 0}`)
- Missing countdown synchronization
- Game state transition problems
- AI behavior issues

## Test Output

The test provides detailed output showing:
- Initial game state and player positions
- Countdown sequence progression
- Snake movement over time
- Control responsiveness
- Game mode configurations

## Integration Notes

Key points for TUI/web client integration:

1. **Direction Vectors**: Use normalized vectors (`{x: 1, y: 0}`) not pixel coordinates
2. **Countdown**: Call `localGame.tickCountdown()` during countdown phase
3. **Game Loop**: Call `localGame.update()` every 150ms during gameplay
4. **Initial Data**: Game data is available immediately after LocalGame creation

## Troubleshooting

If tests fail:
1. Check that LocalGame import path is correct
2. Verify that the game logic hasn't been modified
3. Look for console errors or stack traces
4. Compare output with expected behavior patterns

## Extending Tests

The test script exports individual test functions that can be imported:

```javascript
import { testCountdown, testMovement } from './test-localgame.mjs'

// Run specific tests
testCountdown()
testMovement(game)
```