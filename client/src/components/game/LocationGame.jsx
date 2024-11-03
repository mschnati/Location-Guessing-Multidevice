import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Upload, MapPin, Users, Trophy, ArrowRight, X } from 'lucide-react';
const port = process.env.PORT || 3000;

// Color palette for player identification
const COLORS = [
  '#C96212', '#14B311', '#1911B3', '#9E1C82', '#B59624',
  '#A64830', '#9B59B6', '#3498DB', '#E67E22', '#45B7D1'
];

// Initialize socket connection
console.log(window.location.hostname == 'locationguessinggame.onrender.com'
  ? `http://${window.location.hostname}:10000`
  : `http://${window.location.hostname}:${port}`)
const socket = io(  
  window.location.hostname == 'locationguessinggame.onrender.com'
    ? `http://${window.location.hostname}:10000`
    : `http://${window.location.hostname}:${port}`, // for render server
{
  reconnection: true,
  reconnectionAttempts: 120,
  reconnectionDelay: 1000
});

const LocationGame = () => {
  // Game state management
  const [gameCode, setGameCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState('setup'); // 'setup', 'playing', 'results'
  
  // Player management
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [customGameCode, setCustomGameCode] = useState('');
  
  // Game content
  const [imageUrl, setImageUrl] = useState(null);
  const [question, setQuestion] = useState('');
  const [targetPoint, setTargetPoint] = useState(null);
  
  // Guessing mechanics
  const [guesses, setGuesses] = useState([]);
  const [pendingGuess, setPendingGuess] = useState(null);
  const [lockedGuess, setLockedGuess] = useState(false);
  const [allPlayersGuessed, setAllPlayersGuessed] = useState(false);
  const [winner, setWinner] = useState(null);

  const imageRef = useRef(null);
  const fileInputRef = useRef(null);

  // Socket event handlers
  useEffect(() => {
    // Game initialization events
    socket.on('gameStarted', (gameData) => {
      setGameStarted(true);
      setImageUrl(gameData.imageUrl);
      setQuestion(gameData.question);
      // Only host sees target point during game
      setTargetPoint(isHost ? gameData.targetPoint : null);
      setGuesses([]);
      setLockedGuess(false);
    });

    // Player management events
    socket.on('updatePlayerList', ({ players }) => {
      // Update players with colors
      const playersWithColors = players.map((player, index) => ({
        ...player,
        color: COLORS[index % COLORS.length]
      }));
      setPlayers(playersWithColors);
    });

    // Game progress events
    socket.on('playerGuessed', ({ playerId, guess }) => {
      if (isHost) {
        setGuesses(prev => [...prev, { playerId, guess }]);
      }
    });

    // Results handling
    socket.on('resultsRevealed', ({ guesses, targetPoint }) => {
      // Filter unique guesses by playerId
      const uniqueGuesses = guesses.reduce((acc, curr) => {
        if (!acc.find(g => g.playerId === curr.playerId)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      const processedGuesses = uniqueGuesses.map(g => ({
        ...g,
        distance: calculateDistance(g.guess, targetPoint),
        color: COLORS[players.findIndex(p => p.id === g.playerId) % COLORS.length]
      }));
      
      setGuesses(processedGuesses);
      setTargetPoint(targetPoint);
      setGameMode('results');
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
      setGameStarted(false); // Reset to waiting state
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('gameStarted');
      socket.off('updatePlayerList');
      socket.off('playerGuessed');
      socket.off('resultsRevealed');
      socket.off('gameReset');
    };
  }, [isHost, players, gameCode]);

  // Calculate distance between two points on the image
  const calculateDistance = (point1, point2) => {
    const xDiff = point1.x - point2.x;
    const yDiff = point1.y - point2.y;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff) * 2;
  };

  // Render player list with colored badges
  const renderPlayers = () => (
    <div className="flex flex-wrap gap-2">
      {players.map((player, index) => (
        <Badge 
          key={player.id}
          style={{ 
            backgroundColor: `${COLORS[index % COLORS.length]}15`,
            borderColor: COLORS[index % COLORS.length],
            color: COLORS[index % COLORS.length]
          }}
          variant="outline"
          className="px-3 py-1.5"
        >
          {player.name}
          {/* Allow host to remove players */}
          {isHost && player.id !== socket.id && (
            <button
              className="ml-2 hover:opacity-80"
              onClick={() => handleRemovePlayer(player.id)}
            >
              <X size={14} />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );

  // Render distance lines between guesses and target
  const renderDistanceLine = (start, end, color, key) => (
    <svg 
      key={key}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    >
      <line
        x1={`${start.x}%`}
        y1={`${start.y}%`}
        x2={`${end.x}%`}
        y2={`${end.y}%`}
        stroke={color}
        strokeWidth="2"
        strokeDasharray="4"
        opacity="0.6"
      />
    </svg>
  );

  const resetGame = () => {
    setGameCode('');
    setIsHost(false);
    setGameStarted(false);
    setPlayers([]);
    setCurrentPlayer(null);
    setImageUrl(null);
    setQuestion('');
    setTargetPoint(null);
    setGuesses([]);
    setPendingGuess(null);
    setNewPlayerName('');
  };

  const handleCreateGame = () => {
    const name = newPlayerName.trim();
    if (!name) {
      alert('Please enter your name');
      return;
    }
    
    if (!socket.connected) {
      console.error('Socket not connected');
      alert('Unable to connect to server. Please try again.');
      return;
    }

    socket.emit('createGame', customGameCode.trim(), (code) => {
      if (!code) {
        console.error('No game code received');
        alert('Failed to create game. Please try again.');
        return;
      }
      
      console.log('Game code received:', code);
      setGameCode(code);
      setIsHost(true);
      setCurrentPlayer({ id: socket.id, name });
      setPlayers([{ id: socket.id, name, score: 0 }]);
    });
  };

  const handleJoinGame = (code) => {
    const name = newPlayerName.trim();
    if (!code || !name) {
      alert('Please enter game code and your name');
      return;
    }
    
    socket.emit('joinGame', code, name, (response) => {
      if (response.success) {
        setGameCode(code);
        setCurrentPlayer({ id: socket.id, name });
      } else {
        alert(response.message);
      }
    });
  };

  useEffect(() => {
    if (currentPlayer && gameCode) {
      socket.emit('updatePlayer', gameCode, { id: socket.id, name: currentPlayer.name });
    }
  }, [currentPlayer, gameCode]);

  const handleStartGame = () => {
    if (!imageUrl || !targetPoint) {
      alert('Please upload an image and set the target point');
      return;
    }
    const gameData = {
      imageUrl,
      question,
      targetPoint
    };
    socket.emit('startGame', gameCode, gameData);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0] || event.dataTransfer?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImageUrl(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
    handleImageUpload(e);
  };

  const handleSetTargetPoint = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTargetPoint({ x, y });
  };

  const handleGuess = (e) => {
    if (!gameStarted || isHost || lockedGuess) return;
    
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingGuess({ x, y });
  };

  const handleLockGuess = () => {
    if (!pendingGuess) return;
    
    setLockedGuess(true);
    socket.emit('submitGuess', { gameCode, guess: pendingGuess }, (response) => {
      if (response.success) {
        console.log('Guess submitted successfully');
      }
    });
  };

  // Update handleRevealResults
  const handleRevealResults = () => {
    if (!guesses.length) return;
    
    const processedGuesses = guesses.map(g => ({
      ...g,
      distance: calculateDistance(g.guess, targetPoint)
    }));

    const winner = processedGuesses.reduce((prev, curr) => 
      prev.distance < curr.distance ? prev : curr
    );

    socket.emit('revealResults', {
      gameCode,
      guesses: processedGuesses,
      targetPoint,
      winner: winner.playerId
    });
    setGameMode('results');
  };

  // For New Game button
  const handleResetGame = () => {
    if (isHost) {
      socket.emit('resetGame', { gameCode }, (response) => {
        if (response.success) {
          setGameMode('setup');
          setImageUrl(null);
          setQuestion('');
          setTargetPoint(null);
          setGuesses([]);
          setPendingGuess(null);
          setLockedGuess(false);
          setWinner(null);
          setGameStarted(false); // Reset game state
        }
      });
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto my-8"> {/* Increased max-width */}
      <CardHeader className="px-6"> {/* Added horizontal padding */}
        <CardTitle className="text-2xl flex items-center gap-2"> {/* Larger title */}
          <MapPin className="w-7 h-7" />
          Location Guessing Game
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 space-y-8"> {/* Increased spacing */}
        {!gameCode ? (
          <div className="space-y-4">
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Enter your name"
            />
            <Input
              value={customGameCode}
              onChange={(e) => setCustomGameCode(e.target.value.toUpperCase())} // Convert to uppercase on input
              placeholder="Game code (optional for create, required for join)"
              maxLength={5}
            />
            <div className="flex space-x-2">
              <Button onClick={handleCreateGame}>Create Game</Button>
              <Button 
                onClick={() => handleJoinGame(customGameCode)}
                disabled={!customGameCode.trim()}
              >
                Join Game
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="text-gray-600 dark:text-gray-400">Game Code:</span>
                <span className="font-mono text-xl font-bold tracking-wider text-primary">
                  {gameCode}
                </span>
              </div>
              {renderPlayers()}
            </div>
            {isHost && !gameStarted && (
              <div className="space-y-4">
                <div>
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Enter the question for the players ('Where is...?')"
                  />
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex items-center justify-center w-full h-32 px-4 
                      border-2 border-dashed rounded-lg cursor-pointer 
                      bg-white dark:bg-gray-950 
                      border-gray-300 dark:border-gray-700 
                      hover:border-gray-400 dark:hover:border-gray-600 
                      focus:outline-none"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Drop an image here or click to upload
                      </div>
                    </div>
                  </label>
                </div>
                {imageUrl && !gameStarted && (
                  <div className="space-y-2 mt-4">
                    {!targetPoint && (
                      <div className="text-center bg-white/80 text-gray-800 p-2 rounded">
                        Click on the image to set the target point
                      </div>
                    )}
                    <div className="relative min-h-[400px]"> {/* Added minimum height */}
                      <img
                        src={imageUrl}
                        alt="Game Map"
                        onClick={!gameStarted ? handleSetTargetPoint : undefined}
                        className="w-full h-auto min-h-[400px] object-contain cursor-crosshair"
                      />
                      {targetPoint && (
                        <div
                          className="absolute"
                          style={{
                            left: `${targetPoint.x}%`,
                            top: `${targetPoint.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <MapPin className="text-red-500" />
                          <div 
                            className="absolute mt-1 text-xs font-medium px-2 py-1 rounded-full bg-white/90 shadow-md -translate-x-1/2 left-1/2"
                            style={{ color: 'rgb(239, 68, 68)' }} // text-red-500 color
                          >
                            Target
                          </div>
                        </div>
                      )}
                    </div>
                    {targetPoint && (
                      <Button 
                        onClick={handleStartGame} 
                        className="w-full mt-4"
                        disabled={players.filter(p => p.id !== socket.id).length === 0}
                        variant={players.filter(p => p.id !== socket.id).length === 0 ? "secondary" : "default"}
                      >
                        {players.filter(p => p.id !== socket.id).length === 0 ? (
                          "Waiting for players to join..."
                        ) : (
                          "Start Game"
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            {!isHost && !gameStarted && (
              <div className="mt-4">
                <p>Waiting for the host to start the game...</p>
              </div>
            )}
            {gameStarted && (
              <div>
                {/* Guessing Stage */}
                {gameMode !== 'results' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                      <div className="text-lg font-medium text-gray-900 dark:text-gray-100">Question:</div>
                      <div className="text-gray-700 dark:text-gray-300">{question}</div>
                    </div>
                    </div>
                    {!isHost && !lockedGuess && (
                    <div 
                      className={`text-center p-2 rounded-lg ${
                        pendingGuess ? 'bg-blue-50 dark:bg-blue-900/50' : 'bg-yellow-50 dark:bg-yellow-900/50'
                      }`}
                    >
                      {!pendingGuess ? (
                        <p className="text-sm font-medium animate-pulse">
                          Click anywhere on the map to place your guess
                        </p>
                      ) : (
                        <Button 
                          onClick={handleLockGuess}
                          className="w-full animate-pulse"
                        >
                          Click to Lock Guess
                        </Button>
                      )}
                    </div>
                  )}
                    <div className="relative">
                      <img
                        src={imageUrl}
                        alt="Game Map"
                        onClick={!isHost && !lockedGuess ? handleGuess : undefined}
                        className={`w-full h-auto ${!isHost && !lockedGuess ? 'cursor-crosshair' : ''}`}
                      />
                      {pendingGuess && !lockedGuess && !isHost && (
                        <div
                          className="absolute"
                          style={{
                            left: `${pendingGuess.x}%`,
                            top: `${pendingGuess.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <MapPin className="text-blue-500" />
                        </div>
                      )}
                      {isHost && guesses.map((guess) => (
                        <div
                          key={guess.playerId}
                          className="absolute"
                          style={{
                            left: `${guess.guess.x}%`,
                            top: `${guess.guess.y}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <MapPin style={{ color: COLORS[players.findIndex(p => p.id === guess.playerId) % COLORS.length] }} />
                        </div>
                      ))}
                    </div>

                    {isHost && guesses.length > 0 && (
                      <Button
                        onClick={handleRevealResults}
                        className="w-full gap-2"
                        variant={guesses.length === players.filter(p => p.id !== socket.id).length ? "default" : "secondary"}
                      >
                        <div className="flex items-center gap-2">
                          {guesses.length === players.filter(p => p.id !== socket.id).length ? (
                            <>
                              <Trophy className="w-4 h-4" />
                              All players guessed - Reveal Results
                            </>
                          ) : (
                            <>
                              <Users className="w-4 h-4" />
                              Waiting for guesses ({guesses.length}/{players.filter(p => p.id !== socket.id).length})
                            </>
                          )}
                        </div>
                      </Button>
                    )}
                  </div>
                )}

                {/* Results Stage */}
                {gameMode === 'results' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-medium text-gray-900 dark:text-gray-100">Question:</div>
                        <div className="text-gray-700 dark:text-gray-300">{question}</div>
                      </div>
                    </div>

                    <div className="relative">
                      <img
                        src={imageUrl}
                        alt="Game Map"
                        className="w-full h-auto"
                      />
                      {guesses.map((guess) => 
                        renderDistanceLine(
                          guess.guess, 
                          targetPoint, 
                          COLORS[players.findIndex(p => p.id === guess.playerId) % COLORS.length],
                          `distance-line-${guess.playerId}`
                        )
                      )}
                      <div
                        className="absolute"
                        style={{
                          left: `${targetPoint.x}%`,
                          top: `${targetPoint.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <MapPin className="text-red-500" />
                        <div 
                          className="absolute mt-1 text-xs font-medium px-2 py-1 rounded-full bg-white/90 shadow-md -translate-x-1/2 left-1/2"
                          style={{ color: 'rgb(239, 68, 68)' }} // text-red-500 color
                        >
                          Target
                        </div>
                      </div>
                      {guesses.map((guess) => {
                        const playerColor = COLORS[players.findIndex(p => p.id === guess.playerId) % COLORS.length];
                        return (
                          <div
                            key={guess.playerId}
                            className="absolute"
                            style={{
                              left: `${guess.guess.x}%`,
                              top: `${guess.guess.y}%`,
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            <MapPin style={{ color: playerColor }} />
                            <div 
                              className="absolute mt-1 text-xs font-medium px-2 py-1 rounded-full bg-white/90 shadow-md whitespace-nowrap transform -translate-x-1/2 left-1/2"
                              style={{ color: playerColor }}
                            >
                              {players.find(p => p.id === guess.playerId)?.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Final Rankings
                      </h3>
                      {[...guesses]
                        .sort((a, b) => calculateDistance(a.guess, targetPoint) - calculateDistance(b.guess, targetPoint))
                        .map((guess, index) => {
                          const color = COLORS[players.findIndex(p => p.id === guess.playerId) % COLORS.length];
                          const distance = calculateDistance(guess.guess, targetPoint);
                          return (
                            <div
                              key={guess.playerId}
                              className="flex items-center gap-3 p-3 rounded-lg"
                              style={{ backgroundColor: `${color}10` }}
                            >
                              <div className="text-2xl">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium" style={{ color }}>
                                  {players.find(p => p.id === guess.playerId)?.name}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {Math.round(distance)} units away
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {/* Only show New Game button for host */}
                    {isHost && (
                      <Button 
                        onClick={handleResetGame}
                        className="w-full mt-4"
                      >
                        New Game
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationGame;