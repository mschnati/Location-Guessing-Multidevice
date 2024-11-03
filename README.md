# Location Guessing Game

A real-time multiplayer game where players guess locations on images uploaded by the host.

## Website demo
The game can be tested [here](https://locationguessinggame.onrender.com), but be patient as its a free server that will spin down with inactivity, which can delay requests by 50 seconds or more.

## Location Guessing Game
This is a multi device version of my [game repository](https://github.com/mschnati/LocationGuessingGame) that was designed to be played on one device (tablet) and passed around.

## Features
- Create/join games with custom codes
- Upload and share images
- Real-time multiplayer functionality
- Dark mode support
- Interactive map guessing
- Distance-based scoring
- Live player rankings

## Tech Stack
- React + Vite (Frontend)
- Node.js + Express (Backend)
- Socket.io (Real-time communication)
- Tailwind CSS (Styling)

## Installation

```bash
# Clone repository
git clone https://github.com/mschnati/Location-Guessing-Multidevice.git
cd location-guessing-game

# Install dependencies
npm run install-client    # Install frontend dependencies
npm run install-server   # Install backend dependencies
```

## Run locally in development mode

```bash
# Terminal 1 - Start server
cd server
npm run dev

# Terminal 2 - Start client
cd client
npm run dev
```

Server runs on http://localhost:3000. This IP is not needed to join

Client runs on http://localhost:5173 and other IP-addresses that will be shown in the terminal that you can use to join from other devices

## Game Flow
1. Host creates game (optional custom code)
2. Players join with game code
3. Host uploads image and sets target
4. Players make guesses
5. Host reveals results
6. Rankings shown based on distance

## Environment Variables

```properties
PORT=3000, 5173
```
Can be changed in the config files or via a .env file

## Project Structure
```plaintext
/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── game/     # Game components
│   │   └── App.jsx       # Main app
│   └── package.json
├── server/               # Node.js backend
│   ├── config/
│   │   │   └── config.js # File to change port/address 
│   ├── server.js         # Express + Socket.io
│   └── package.json
└── package.json          # Root scripts
```

## Scripts
```json
{
  "install-client": "cd client && npm install",
  "install-server": "cd server && npm install",
  "build-client": "cd client && npm run build",
  "build": "npm run install-client && npm run install-server && npm run build-client",
  "start": "cd server && npm start"
}
```