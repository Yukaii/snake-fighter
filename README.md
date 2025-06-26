# Snake Fighter

A real-time multiplayer Snake game built with React frontend and Node.js WebSocket backend.

## Features

- **Real-time Multiplayer** - Up to 8 players per room
- **WebSocket Communication** - Low-latency game updates using Socket.IO
- **Room System** - Create and join game rooms with unique codes
- **React Frontend** - Modern, responsive user interface
- **Single Service Architecture** - Caddy handles both static assets and WebSocket proxying

## Game Features

- Real-time multiplayer snake battles
- Collision detection with walls, self, and other players
- Dynamic obstacle generation from eliminated players
- Room-based gameplay with host controls
- Countdown system and score tracking
- Responsive controls and smooth animations

## Usage

Players can:
- Create new game rooms or join existing ones with room codes
- Battle up to 7 other players in real-time
- Use arrow keys or WASD to control their snake
- Compete for the highest score and longest survival time

## Development

### Commands

- `npm run dev` - Start development server (nodemon + vite)
- `npm run build` - Build client with Vite
- `npm run start` - Start production server
- `npm run client` - Start Vite dev server only
- `npm run lint` - Run Biome linter
- `npm run format` - Check formatting with Biome
- `npm run check` - Run all Biome checks (lint + format)
- `npm run check:fix` - Auto-fix all Biome issues

### Project Structure

- `src/components/` - React components (PascalCase)
- `src/hooks/` - Custom React hooks (camelCase, prefixed with 'use')
- `server.js` - Express/Socket.IO server (CommonJS)
- Client uses ES modules, server uses CommonJS

### Code Style

- **Indentation**: 2 spaces, no tabs
- **Line width**: 100 characters
- **Quotes**: Single quotes for JS, double quotes for JSX attributes
- **Semicolons**: As needed (ASI-safe)
- **Trailing commas**: ES5 style
- **Arrow functions**: Always use parentheses around parameters

## Architecture

The deployment uses an optimized single-service architecture:
- **Node.js Backend** serves WebSocket connections and game logic
- **React Frontend** built with Vite for optimal performance
- **Caddy Reverse Proxy** handles static file serving with compression and WebSocket proxying
- **Single Container** deployment for simplicity and efficiency

## Deployment

[![Deployed on Zeabur](https://zeabur.com/deployed-on-zeabur-dark.svg)](https://zeabur.com/referral?referralCode=Yukaii&utm_source=Yukaii&utm_campaign=oss)

