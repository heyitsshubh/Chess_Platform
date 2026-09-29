const axios = require('axios');
const { io } = require('socket.io-client');
const { ChessGame } = require('../packages/chess-engine/dist');

const API_URL = process.env.API_URL || 'http://192.168.1.39';

async function startBot() {
  try {
    const timestamp = Date.now();
    const email = `bot_${timestamp}@chess.local`;
    const username = `ChessBot_${timestamp.toString().slice(-4)}`;
    const password = 'Password123!';

    console.log(`[Bot Engine] Registering bot: ${username}...`);
    await axios.post(`${API_URL}/auth/register`, { email, username, password });

    console.log(`[Bot Engine] Logging in...`);
    const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
    const token = loginRes.data.data.accessToken;

    console.log(`[Bot Engine] Connecting to Socket.IO gateway at ${API_URL}...`);
    const socket = io(API_URL, {
      path: '/socket.io/',
      transports: ['websocket'],
      auth: { token }
    });

    let botGameId = null;
    let botColor = null; // 'white' or 'black'

    function makeBotMove(fen) {
      if (!botGameId) return;
      try {
        const game = new ChessGame(fen);
        const sideToMove = game.board.sideToMove === 0 ? 'white' : 'black';

        if (sideToMove !== botColor) {
          console.log(`[Bot Engine] Waiting for opponent (${sideToMove}'s turn)...`);
          return;
        }

        const legalMoves = game.generateLegalMoves();
        if (legalMoves.length === 0) {
          console.log('[Bot Engine] No legal moves left (game over/mate/stalemate).');
          return;
        }

        // Pick a random legal move
        const chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        const from = chosenMove & 0x3f;
        const to = (chosenMove >> 6) & 0x3f;
        console.log(`[Bot Engine] Making move: sq ${from} -> sq ${to} (code: ${chosenMove})...`);

        setTimeout(() => {
          socket.emit('game:move', { gameId: botGameId, move: chosenMove });
        }, 600);
      } catch (err) {
        console.error('[Bot Engine] Error making move:', err.message);
      }
    }

    socket.on('connect', () => {
      console.log(`[Bot Engine] Connected (socket ID: ${socket.id}). Joining 3|0 queue...`);
      socket.emit('matchmaking:join', '3|0');
    });

    socket.on('matchmaking:matched', (data) => {
      botGameId = data.gameId;
      const isWhite = data.white.username === username;
      botColor = isWhite ? 'white' : 'black';
      console.log(`🎉 [Bot Engine] MATCHED! Game ID: ${botGameId}`);
      console.log(`[Bot Engine] Playing as ${botColor.toUpperCase()} vs ${isWhite ? data.black.username : data.white.username}`);

      makeBotMove(data.fen);
    });

    socket.on('game:move_made', (data) => {
      console.log(`[Bot Engine] Board updated. FEN: ${data.fen}`);
      makeBotMove(data.fen);
    });

    socket.on('game:end', (data) => {
      console.log(`🏆 [Bot Engine] Game ended! Winner: ${data.winner}, Reason: ${data.reason}`);
      socket.disconnect();
      process.exit(0);
    });

    socket.on('connect_error', (err) => {
      console.error('[Bot Engine] Connection error:', err.message);
    });
  } catch (err) {
    console.error('[Bot Engine] Fatal error:', err.response?.data || err.message);
  }
}

startBot();
