import express from 'express';
import http from 'http';
import cors from 'cors';
import { matchesRouter } from './routes/matches.js';
import { commentaryRouter } from './routes/commentary.js';
import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';

const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : 8000;
const PORT = (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) ? parsedPort : 8000;
const HOST = process.env.HOST || '0.0.0.0';
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(origin => origin);

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors({
    origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.use(securityMiddleware());
app.use('/matches', matchesRouter);
app.use('/matches/:id/commentary', commentaryRouter);
const { broadcastMatchCreated, broadcastCommentary } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated; // Make the broadcast function available in route handlers
app.locals.broadcastCommentary = broadcastCommentary; // Make the commentary broadcast function available in route handlers

server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket server is available at ${baseUrl.replace('http', 'ws')}/ws`);
});