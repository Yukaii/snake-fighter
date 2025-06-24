class SnakeFighterClient {
    constructor() {
        this.socket = io();
        this.gameState = 'menu';
        this.currentRoom = null;
        this.playerId = null;
        this.canvas = null;
        this.ctx = null;
        this.keys = {};
        
        this.initElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.setupKeyboardControls();
    }

    initElements() {
        this.elements = {
            menu: document.getElementById('menu'),
            lobby: document.getElementById('lobby'),
            countdown: document.getElementById('countdown'),
            game: document.getElementById('game'),
            gameOver: document.getElementById('gameOver'),
            
            roomId: document.getElementById('roomId'),
            playerName: document.getElementById('playerName'),
            joinRoom: document.getElementById('joinRoom'),
            createRoom: document.getElementById('createRoom'),
            
            currentRoom: document.getElementById('currentRoom'),
            players: document.getElementById('players'),
            hostControls: document.getElementById('hostControls'),
            startGame: document.getElementById('startGame'),
            leaveRoom: document.getElementById('leaveRoom'),
            
            countdownTimer: document.getElementById('countdownTimer'),
            
            gameCanvas: document.getElementById('gameCanvas'),
            score: document.getElementById('score'),
            playersAlive: document.getElementById('playersAlive'),
            
            finalScore: document.getElementById('finalScore'),
            winner: document.getElementById('winner'),
            playAgain: document.getElementById('playAgain')
        };
        
        this.canvas = this.elements.gameCanvas;
        this.ctx = this.canvas.getContext('2d');
    }

    setupEventListeners() {
        this.elements.createRoom.addEventListener('click', () => this.createRoom());
        this.elements.joinRoom.addEventListener('click', () => this.joinRoom());
        this.elements.startGame.addEventListener('click', () => this.startGame());
        this.elements.leaveRoom.addEventListener('click', () => this.leaveRoom());
        this.elements.playAgain.addEventListener('click', () => this.returnToLobby());
        
        this.elements.roomId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        this.elements.playerName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.elements.roomId.value) this.joinRoom();
                else this.createRoom();
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('room-created', (data) => {
            this.currentRoom = data.room;
            this.playerId = this.socket.id;
            this.showLobby();
        });

        this.socket.on('room-joined', (data) => {
            this.currentRoom = data.room;
            this.playerId = this.socket.id;
            this.showLobby();
        });

        this.socket.on('player-joined', (data) => {
            this.currentRoom.players.push(data.player);
            this.updatePlayerList();
        });

        this.socket.on('player-left', (data) => {
            this.currentRoom.players = this.currentRoom.players.filter(p => p.id !== data.playerId);
            this.updatePlayerList();
        });

        this.socket.on('room-updated', (data) => {
            this.currentRoom = data.room;
            this.updatePlayerList();
        });

        this.socket.on('countdown-start', (countdown) => {
            this.showCountdown(countdown);
        });

        this.socket.on('countdown-tick', (countdown) => {
            this.elements.countdownTimer.textContent = countdown;
        });

        this.socket.on('game-start', () => {
            this.showGame();
        });

        this.socket.on('game-update', (gameData) => {
            this.renderGame(gameData);
        });

        this.socket.on('player-eliminated', (data) => {
            console.log(`${data.playerName} was eliminated!`);
        });

        this.socket.on('game-end', (data) => {
            this.showGameOver(data);
        });

        this.socket.on('return-to-lobby', () => {
            this.returnToLobby();
        });

        this.socket.on('error', (message) => {
            alert(message);
        });
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            if (this.gameState === 'playing') {
                let direction = null;
                
                switch(e.key.toLowerCase()) {
                    case 'w':
                    case 'arrowup':
                        direction = { x: 0, y: -1 };
                        break;
                    case 's':
                    case 'arrowdown':
                        direction = { x: 0, y: 1 };
                        break;
                    case 'a':
                    case 'arrowleft':
                        direction = { x: -1, y: 0 };
                        break;
                    case 'd':
                    case 'arrowright':
                        direction = { x: 1, y: 0 };
                        break;
                }
                
                if (direction) {
                    e.preventDefault();
                    this.socket.emit('player-direction', direction);
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    createRoom() {
        const playerName = this.elements.playerName.value.trim();
        if (!playerName) {
            alert('Please enter your name');
            return;
        }
        
        this.socket.emit('create-room', { name: playerName });
    }

    joinRoom() {
        const roomId = this.elements.roomId.value.trim().toUpperCase();
        const playerName = this.elements.playerName.value.trim();
        
        if (!roomId || !playerName) {
            alert('Please enter room ID and your name');
            return;
        }
        
        this.socket.emit('join-room', { roomId, playerData: { name: playerName } });
    }

    startGame() {
        this.socket.emit('start-game');
    }

    leaveRoom() {
        this.socket.emit('leave-room');
        this.showMenu();
    }

    returnToLobby() {
        this.showLobby();
    }

    showMenu() {
        this.gameState = 'menu';
        this.hideAllScreens();
        this.elements.menu.classList.remove('hidden');
        this.currentRoom = null;
        this.playerId = null;
    }

    showLobby() {
        this.gameState = 'lobby';
        this.hideAllScreens();
        this.elements.lobby.classList.remove('hidden');
        this.elements.currentRoom.textContent = this.currentRoom.id;
        this.updatePlayerList();
        
        if (this.currentRoom.hostId === this.playerId) {
            this.elements.hostControls.classList.remove('hidden');
        } else {
            this.elements.hostControls.classList.add('hidden');
        }
    }

    showCountdown(countdown) {
        this.gameState = 'countdown';
        this.hideAllScreens();
        this.elements.countdown.classList.remove('hidden');
        this.elements.countdownTimer.textContent = countdown;
    }

    showGame() {
        this.gameState = 'playing';
        this.hideAllScreens();
        this.elements.game.classList.remove('hidden');
        this.clearCanvas();
    }

    showGameOver(data) {
        this.gameState = 'gameOver';
        this.hideAllScreens();
        this.elements.gameOver.classList.remove('hidden');
        
        const myPlayer = data.scores.find(p => p.id === this.playerId);
        this.elements.finalScore.textContent = `Your Score: ${myPlayer ? myPlayer.score : 0}`;
        
        if (data.winner) {
            this.elements.winner.textContent = `Winner: ${data.winner.name}`;
        } else {
            this.elements.winner.textContent = 'No Winner';
        }
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    updatePlayerList() {
        this.elements.players.innerHTML = '';
        this.currentRoom.players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.name;
            li.style.backgroundColor = player.color;
            li.style.color = this.getContrastColor(player.color);
            if (player.id === this.currentRoom.hostId) {
                li.textContent += ' (Host)';
            }
            this.elements.players.appendChild(li);
        });
        
        const canStart = this.currentRoom.players.length >= 2 && this.currentRoom.hostId === this.playerId;
        this.elements.startGame.disabled = !canStart;
    }

    renderGame(gameData) {
        if (this.gameState !== 'playing') return;
        
        this.clearCanvas();
        
        // Draw obstacles
        this.ctx.fillStyle = '#666';
        gameData.obstacles.forEach(obstacle => {
            this.ctx.fillRect(obstacle.x, obstacle.y, 20, 20);
        });
        
        // Draw snakes
        gameData.players.forEach(player => {
            if (!player.alive) return;
            
            this.ctx.fillStyle = player.color;
            player.snake.forEach((segment, index) => {
                if (index === 0) {
                    // Draw head with border
                    this.ctx.fillStyle = player.color;
                    this.ctx.fillRect(segment.x, segment.y, 20, 20);
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(segment.x, segment.y, 20, 20);
                } else {
                    // Draw body
                    this.ctx.fillStyle = this.lightenColor(player.color, 0.3);
                    this.ctx.fillRect(segment.x + 1, segment.y + 1, 18, 18);
                }
            });
        });
        
        // Update UI
        const myPlayer = gameData.players.find(p => p.id === this.playerId);
        if (myPlayer) {
            this.elements.score.textContent = `Score: ${myPlayer.score}`;
        }
        this.elements.playersAlive.textContent = `Players Alive: ${gameData.playersAlive}`;
    }

    clearCanvas() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getContrastColor(hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return brightness > 128 ? '#000' : '#fff';
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent * 100);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SnakeFighterClient();
});