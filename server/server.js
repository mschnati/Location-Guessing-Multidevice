// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PORT, CLIENT_URL } = require('./config/config');
const errorHandler = require('./middleware/errorHandler');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins, adjust as needed
    methods: ["GET", "POST"],
    credentials: true
  }
});

const games = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create Game
  socket.on('createGame', (customCode, callback) => {
    const gameCode = (customCode || generateGameCode()).toUpperCase();
    
    // Case insensitive check if game exists
    if (customCode && Object.keys(games).some(code => code.toUpperCase() === gameCode)) {
      callback(null);
      return;
    }
    
    socket.join(gameCode);
    games[gameCode] = {
      host: socket.id,
      players: {},
      gameData: null
    };
    callback(gameCode);
  });

  // Join Game
  socket.on('joinGame', (gameCode, playerName, callback) => {
    const upperGameCode = gameCode.toUpperCase();
    const game = games[upperGameCode];
    
    if (!game) {
      callback({ success: false, message: 'Game not found' });
      return;
    }
  
    // Add player to game
    game.players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0
    };
  
    // Join socket room
    socket.join(upperGameCode);
  
    // Send updated player list to all clients
    const playerList = Object.values(game.players);
    io.to(upperGameCode).emit('updatePlayerList', { players: playerList });
    
    callback({ success: true });
  });

  // Update Player
  socket.on('updatePlayer', (gameCode, playerData) => {
    const game = games[gameCode];
    if (game) {
      game.players[socket.id] = {
        ...game.players[socket.id],
        ...playerData
      };
    }
  });

  // Start Game
  socket.on('startGame', (gameCode, gameData) => {
    const game = games[gameCode];
    if (game && game.host === socket.id) {
      game.gameData = gameData;
      io.to(gameCode).emit('gameStarted', gameData);
    }
  });

  // Player Action (Guess)
  socket.on('playerAction', (gameCode, actionData) => {
    const game = games[gameCode];
    if (game) {
      const player = game.players[socket.id];
      if (actionData.type === 'guess' && player) {
        // Calculate distance from target point
        const { x: targetX, y: targetY } = game.gameData.targetPoint;
        const { x: guessX, y: guessY } = actionData.guess;
        const distance = Math.hypot(targetX - guessX, targetY - guessY);

        // Update player's score (example calculation)
        player.score = Math.max(0, 100 - distance);

        // Broadcast the guess and updated score to all players
        io.to(gameCode).emit('playerAction', {
          playerId: socket.id,
          actionData,
          score: player.score
        });
      }
    }
  });

  socket.on('submitGuess', ({ gameCode, guess }, callback) => {
    const game = games[gameCode];
    if (game) {
      socket.to(gameCode).emit('playerGuessed', {
        playerId: socket.id,
        guess
      });
      
      // Check if all players have guessed
      const players = Object.keys(game.players).filter(id => id !== game.host);
      const guesses = game.guesses || [];
      if (guesses.length === players.length) {
        io.to(gameCode).emit('allPlayersGuessed');
      }
      
      callback({ success: true });
    }
  });

  socket.on('revealResults', ({ gameCode, winner, targetPoint }) => {
    io.to(gameCode).emit('resultsRevealed', { winner, targetPoint });
  });

  socket.on('revealResults', ({ gameCode, guesses, scores, targetPoint }) => {
    io.to(gameCode).emit('resultsRevealed', { guesses, scores, targetPoint });
  });

  socket.on('revealResults', ({ gameCode, guesses, targetPoint, winner }) => {
    io.to(gameCode).emit('resultsRevealed', { guesses, targetPoint, winner });
  });

  socket.on('requestPlayerList', ({ gameCode }) => {
    const game = games[gameCode];
    if (game) {
      const playerList = Object.values(game.players).map(player => ({
        id: player.id,
        name: player.name
      }));
      io.to(gameCode).emit('playerListUpdate', { players: playerList });
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    for (const gameCode in games) {
      const game = games[gameCode];
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        socket.to(gameCode).emit('playerDisconnected', { playerId: socket.id });
        if (socket.id === game.host) {
          // End the game if the host disconnects
          io.to(gameCode).emit('gameEnded', { message: 'Host disconnected' });
          delete games[gameCode];
        }
        break;
      }
    }
  });

  socket.on('playerJoined', (gameCode, playerName, callback) => {
    // Check if player already exists
    if (games[gameCode].players[socket.id]) {
      return;
    }
    
    // Add player only once
    games[gameCode].players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0
    };

    // Send complete player list to all clients
    const playerList = Object.values(games[gameCode].players);
    io.to(gameCode).emit('updatePlayerList', { players: playerList });
    callback({ success: true });
  });

  socket.on('gameReset', () => {
    setGameMode('setup');
    setImageUrl(null);
    setQuestion('');
    setTargetPoint(null);
    setGuesses([]);
    setPendingGuess(null);
    setLockedGuess(false);
    setWinner(null);
    // Keep gameCode and players
  });

  socket.on('resetGame', ({ gameCode }, callback) => {
    const game = games[gameCode];
    if (game && game.host === socket.id) {
      // Keep players but reset game data
      game.gameData = null;
      game.guesses = [];
      io.to(gameCode).emit('gameReset');
      callback({ success: true });
    } else {
      callback({ success: false });
    }
  });

});

// Generate Game Code
function generateGameCode() {
  return Math.random().toString(36).substr(2, 5).toUpperCase();
}

app.use(errorHandler);

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});