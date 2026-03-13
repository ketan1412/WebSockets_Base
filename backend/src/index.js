import express from 'express';
import http from 'http';
import { matchesRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';

const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : 8000;
const PORT = (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) ? parsedPort : 8000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.use('/matches', matchesRouter);
const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated; // Make the broadcast function available in route handlers

server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket server is available at ${baseUrl.replace('http', 'ws')}/ws`);
});