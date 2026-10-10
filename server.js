import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import compression from 'compression';
import { StreamManager } from './lib/streamManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json());

// Cegah cache browser agar script terbaru selalu langsung aktif
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  etag: false
}));

// Initialize Stream Manager
const streamManager = new StreamManager(io);

// Socket.io Connection
io.on('connection', (socket) => {
  // Kirim state awal saat client baru terhubung
  socket.emit('initial_state', streamManager.getClientInitialState(socket));

  // Update channels yang dipantau oleh client ini
  socket.on('update_channels', async (data) => {
    await streamManager.updateClientChannels(socket, data);
  });

  // Putuskan platform tertentu untuk client ini
  socket.on('disconnect_platform', async ({ platform }) => {
    await streamManager.disconnectClientPlatform(socket, platform);
  });

  // Kirim test / demo event (hanya ke client ini agar tidak mengganggu pengguna lain)
  socket.on('send_test_event', ({ platform, type }) => {
    streamManager.sendTestEvent(platform, type, socket);
  });

  // Bersihkan history event di client ini
  socket.on('clear_events', () => {
    socket.emit('events_cleared');
  });

  // Client disconnect cleanup
  socket.on('disconnect', async () => {
    await streamManager.handleClientDisconnect(socket);
  });

  // Health ping check
  socket.on('ping_check', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });
});

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json(streamManager.getInitialState());
});

app.get('/api/events', (req, res) => {
  res.json({
    total: streamManager.eventHistory.length,
    events: streamManager.eventHistory
  });
});

app.post('/api/channels', async (req, res) => {
  const { twitch, twitchToken, youtube, tiktok } = req.body || {};
  if (twitch !== undefined) await streamManager.connectTwitch(twitch, twitchToken);
  if (youtube !== undefined) await streamManager.connectYouTube(youtube);
  if (tiktok !== undefined) await streamManager.connectTikTok(tiktok);
  res.json({ success: true, state: streamManager.getInitialState() });
});

// Start Server & display local IP for mobile access
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n[Server] Port ${PORT} sudah aktif. Menggunakan server yang sedang berjalan.`);
  } else {
    console.error('[Server] Server error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  const localIps = [];

  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIps.push(net.address);
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`🚀 StreamPulse MultiChat Server Aktif!`);
  console.log(`   - Local PC:   http://localhost:${PORT}`);
  if (localIps.length > 0) {
    console.log(`   - Akses HP:   http://${localIps[0]}:${PORT}`);
    localIps.forEach((ip, idx) => {
      if (idx > 0) console.log(`                 http://${ip}:${PORT}`);
    });
  }
  console.log(`==================================================\n`);
});

