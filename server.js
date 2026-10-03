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
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));

// Initialize Stream Manager
const streamManager = new StreamManager(io);

// Socket.io Connection
io.on('connection', (socket) => {
  // Kirim state awal saat client baru terhubung
  socket.emit('initial_state', streamManager.getInitialState());

  // Update channels yang dipantau
  socket.on('update_channels', async (data) => {
    const { twitch, youtube, tiktok } = data || {};

    if (twitch !== undefined && twitch !== streamManager.activeChannels.twitch) {
      if (twitch) {
        streamManager.connectTwitch(twitch);
      } else {
        streamManager.disconnectTwitch();
      }
    }

    if (youtube !== undefined && youtube !== streamManager.activeChannels.youtube) {
      if (youtube) {
        streamManager.connectYouTube(youtube);
      } else {
        streamManager.disconnectYouTube();
      }
    }

    if (tiktok !== undefined && tiktok !== streamManager.activeChannels.tiktok) {
      if (tiktok) {
        streamManager.connectTikTok(tiktok);
      } else {
        streamManager.disconnectTikTok();
      }
    }
  });

  // Putuskan platform tertentu
  socket.on('disconnect_platform', async ({ platform }) => {
    if (platform === 'twitch') await streamManager.disconnectTwitch();
    if (platform === 'youtube') await streamManager.disconnectYouTube();
    if (platform === 'tiktok') await streamManager.disconnectTikTok();
  });

  // Kirim test / demo event
  socket.on('send_test_event', ({ platform, type }) => {
    streamManager.sendTestEvent(platform, type);
  });

  // Bersihkan history event
  socket.on('clear_events', () => {
    streamManager.clearEventHistory();
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
  const { twitch, youtube, tiktok } = req.body || {};
  if (twitch !== undefined) await streamManager.connectTwitch(twitch);
  if (youtube !== undefined) await streamManager.connectYouTube(youtube);
  if (tiktok !== undefined) await streamManager.connectTikTok(tiktok);
  res.json({ success: true, state: streamManager.getInitialState() });
});

// Start Server & display local IP for mobile access
server.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  const localIps = [];

  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
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
