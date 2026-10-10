import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import compression from 'compression';
import { StreamManager } from './lib/streamManager.js';
import { emoteManager } from './lib/emoteManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Paths
const FEEDBACK_FILE = path.join(__dirname, 'data', 'feedback.json');
const OVERLAYS_FILE = path.join(__dirname, 'data', 'overlays.json');

function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`[DB] Error reading ${filePath}:`, e.message);
  }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[DB] Error writing ${filePath}:`, e.message);
  }
}

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

// HTML Pages
app.get('/donate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'donate.html'));
});

app.get(['/features', '/roadmap'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'features.html'));
});

app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get(['/overlay-studio', '/studio'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studio.html'));
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

app.get('/api/emotes/global', (req, res) => {
  res.json(emoteManager.getGlobalEmotes ? emoteManager.getGlobalEmotes() : {});
});

app.post('/api/channels', async (req, res) => {
  const { twitch, twitchToken, youtube, tiktok } = req.body || {};
  if (twitch !== undefined) await streamManager.connectTwitch(twitch, twitchToken);
  if (youtube !== undefined) await streamManager.connectYouTube(youtube);
  if (tiktok !== undefined) await streamManager.connectTikTok(tiktok);
  res.json({ success: true, state: streamManager.getInitialState() });
});

// ==========================================
// FEATURE REQUESTS & KANBAN API
// ==========================================
app.get('/api/feedback', (req, res) => {
  const list = readJsonFile(FEEDBACK_FILE, []);
  // Urutkan berdasarkan upvotes terbanyak, lalu tanggal terbaru
  list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || b.createdAt - a.createdAt);
  res.json(list);
});

app.post('/api/feedback', (req, res) => {
  const { title, description, category, author } = req.body || {};
  if (!title || !description) {
    return res.status(400).json({ error: 'Judul dan deskripsi wajib diisi' });
  }

  const list = readJsonFile(FEEDBACK_FILE, []);
  const newItem = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: String(title).trim().slice(0, 150),
    description: String(description).trim().slice(0, 1000),
    category: ['twitch', 'youtube', 'tiktok', 'overlay', 'core', 'general'].includes(category) ? category : 'general',
    author: (author ? String(author).trim().slice(0, 50) : 'Streamer Anonymous'),
    status: 'todo',
    upvotes: 1,
    createdAt: Date.now()
  };

  list.push(newItem);
  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, item: newItem });
});

app.post('/api/feedback/:id/upvote', (req, res) => {
  const { id } = req.params;
  const list = readJsonFile(FEEDBACK_FILE, []);
  const item = list.find(x => x.id === id);
  if (!item) return res.status(404).json({ error: 'Request tidak ditemukan' });

  item.upvotes = (item.upvotes || 0) + 1;
  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, upvotes: item.upvotes });
});

app.patch('/api/feedback/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['todo', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid (todo, in_progress, done)' });
  }

  const list = readJsonFile(FEEDBACK_FILE, []);
  const item = list.find(x => x.id === id);
  if (!item) return res.status(404).json({ error: 'Request tidak ditemukan' });

  item.status = status;
  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, item });
});

// ==========================================
// OBS OVERLAY PROFILES API
// ==========================================
app.get('/api/overlays/:id', (req, res) => {
  const { id } = req.params;
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const profile = overlays[id] || overlays['default'] || null;
  res.json(profile || { id, theme: 'glass', fontSize: 15, hideDelay: 0, customCss: '', customJs: '' });
});

app.post('/api/overlays', (req, res) => {
  const data = req.body || {};
  const id = data.id && /^[a-zA-Z0-9_-]+$/.test(data.id) ? data.id : `ovl_${Math.random().toString(36).substr(2, 8)}`;
  const overlays = readJsonFile(OVERLAYS_FILE, {});

  overlays[id] = {
    ...overlays[id],
    ...data,
    id,
    updatedAt: Date.now()
  };

  writeJsonFile(OVERLAYS_FILE, overlays);
  res.json({ success: true, id, overlay: overlays[id] });
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

