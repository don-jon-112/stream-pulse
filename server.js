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
const ADMIN_FILE = path.join(__dirname, 'data', 'admin.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

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

app.get(['/admin', '/features-admin', '/admin-features'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
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
function getAdminPassword() {
  const adminData = readJsonFile(ADMIN_FILE, null);
  if (adminData && adminData.password) {
    return adminData.password;
  }
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function checkAdminAuth(req) {
  const token = (req.headers['x-admin-key'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return token === getAdminPassword();
}

app.get('/api/feedback', (req, res) => {
  const list = readJsonFile(FEEDBACK_FILE, []);
  // Sembunyikan item yang di-reject dari publik, prioritaskan pinned
  const publicList = list.filter(x => x.status !== 'rejected');
  publicList.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.upvotes || 0) - (a.upvotes || 0) || b.createdAt - a.createdAt);
  res.json(publicList);
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
    adminNote: '',
    pinned: false,
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
// ADMIN FEATURE MANAGEMENT ENDPOINTS
// ==========================================
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const currentPassword = getAdminPassword();
  if (password === currentPassword) {
    return res.json({ success: true, token: currentPassword });
  }
  return res.status(401).json({ error: 'Password Admin salah! Silakan coba lagi.' });
});

app.post('/api/admin/change-password', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ error: 'Password baru minimal 4 karakter' });
  }
  const cleanPass = String(newPassword).trim();
  writeJsonFile(ADMIN_FILE, { password: cleanPass, updatedAt: Date.now() });
  res.json({ success: true, token: cleanPass, message: 'Password admin berhasil diubah!' });
});

app.get('/api/admin/feedback', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  const list = readJsonFile(FEEDBACK_FILE, []);
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.upvotes || 0) - (a.upvotes || 0) || b.createdAt - a.createdAt);
  res.json(list);
});

app.patch('/api/admin/feedback/:id', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  const { id } = req.params;
  const { status, adminNote, pinned, title, description, category, upvotes } = req.body || {};

  const list = readJsonFile(FEEDBACK_FILE, []);
  const item = list.find(x => x.id === id);
  if (!item) return res.status(404).json({ error: 'Request fitur tidak ditemukan' });

  if (status !== undefined) {
    if (!['todo', 'in_progress', 'done', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }
    item.status = status;
  }
  if (adminNote !== undefined) item.adminNote = String(adminNote).trim().slice(0, 500);
  if (pinned !== undefined) item.pinned = Boolean(pinned);
  if (title !== undefined && title.trim()) item.title = String(title).trim().slice(0, 150);
  if (description !== undefined && description.trim()) item.description = String(description).trim().slice(0, 1000);
  if (category !== undefined) item.category = category;
  if (upvotes !== undefined && !isNaN(upvotes)) item.upvotes = Math.max(0, parseInt(upvotes, 10));
  item.updatedAt = Date.now();

  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, item });
});

app.delete('/api/admin/feedback/:id', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  const { id } = req.params;
  let list = readJsonFile(FEEDBACK_FILE, []);
  const initialLen = list.length;
  list = list.filter(x => x.id !== id);
  if (list.length === initialLen) return res.status(404).json({ error: 'Request fitur tidak ditemukan' });

  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, deletedId: id });
});

app.post('/api/admin/feedback', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  const { title, description, category, author, status, adminNote, pinned } = req.body || {};
  if (!title || !description) {
    return res.status(400).json({ error: 'Judul dan deskripsi wajib diisi' });
  }

  const list = readJsonFile(FEEDBACK_FILE, []);
  const newItem = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: String(title).trim().slice(0, 150),
    description: String(description).trim().slice(0, 1000),
    category: ['twitch', 'youtube', 'tiktok', 'overlay', 'core', 'general'].includes(category) ? category : 'core',
    author: (author ? String(author).trim().slice(0, 50) : 'Pengembang (Admin)'),
    status: ['todo', 'in_progress', 'done', 'rejected'].includes(status) ? status : 'todo',
    adminNote: adminNote ? String(adminNote).trim().slice(0, 500) : '',
    pinned: Boolean(pinned),
    upvotes: 5,
    createdAt: Date.now()
  };

  list.push(newItem);
  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, item: newItem });
});

// ==========================================
// USER AUTH & OVERLAY LIMITS (MAX 3 PER USER)
// ==========================================
function getUserFromReq(req) {
  const token = (req.headers['x-user-token'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const users = readJsonFile(USERS_FILE, {});
  return Object.values(users).find(u => u.token === token) || null;
}

app.post('/api/user/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  const cleanUser = String(username).trim().toLowerCase();
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanUser)) {
    return res.status(400).json({ error: 'Username harus 3-20 karakter alfanumerik (a-z, 0-9, _, -)' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Password minimal 4 karakter' });
  }

  const users = readJsonFile(USERS_FILE, {});
  if (users[cleanUser]) {
    return res.status(400).json({ error: 'Username ini sudah terdaftar! Silakan login.' });
  }

  const token = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newUser = {
    username: cleanUser,
    password: String(password),
    token,
    overlayIds: [],
    createdAt: Date.now()
  };

  users[cleanUser] = newUser;
  writeJsonFile(USERS_FILE, users);

  res.json({
    success: true,
    user: {
      username: newUser.username,
      token: newUser.token,
      overlayIds: newUser.overlayIds
    }
  });
});

app.post('/api/user/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const users = readJsonFile(USERS_FILE, {});
  const user = users[cleanUser];

  if (!user || user.password !== String(password)) {
    return res.status(401).json({ error: 'Username atau password salah!' });
  }

  if (!user.token) {
    user.token = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    users[cleanUser] = user;
    writeJsonFile(USERS_FILE, users);
  }

  res.json({
    success: true,
    user: {
      username: user.username,
      token: user.token,
      overlayIds: user.overlayIds || []
    }
  });
});

app.get('/api/user/me', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Belum login' });
  }
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const userOverlays = (user.overlayIds || []).map(id => overlays[id] || { id, theme: 'glass' });
  res.json({
    username: user.username,
    token: user.token,
    overlayIds: user.overlayIds || [],
    overlays: userOverlays,
    maxLimit: 3
  });
});

// Generate URL Overlay Baru (Maksimal 3 per user)
app.post('/api/user/overlays/generate', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk membuat overlay baru.' });
  }

  const users = readJsonFile(USERS_FILE, {});
  const currentUser = users[user.username] || user;
  if (!currentUser.overlayIds) currentUser.overlayIds = [];

  if (currentUser.overlayIds.length >= 3) {
    return res.status(400).json({
      error: 'Batas kuota 3 Overlay per akun telah tercapai! Anda dapat mengedit salah satu dari 3 overlay yang ada atau menghapusnya untuk membuat yang baru.'
    });
  }

  const newId = `ovl_${Math.random().toString(36).substr(2, 7)}`;
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  overlays[newId] = {
    id: newId,
    owner: currentUser.username,
    theme: 'glass',
    fontSize: 15,
    hideDelay: 0,
    showBadges: true,
    showAvatars: true,
    showEmotes: true,
    showAlerts: true,
    maskLinks: false,
    maxMessages: 15,
    customCss: '',
    customJs: '',
    updatedAt: Date.now()
  };

  currentUser.overlayIds.push(newId);
  users[currentUser.username] = currentUser;

  writeJsonFile(OVERLAYS_FILE, overlays);
  writeJsonFile(USERS_FILE, users);

  res.json({
    success: true,
    id: newId,
    overlay: overlays[newId],
    count: currentUser.overlayIds.length,
    maxLimit: 3
  });
});

// Load / Claim existing overlay into user's slot (if slots available)
app.post('/api/user/overlays/claim', (req, res) => {
  const user = getUserFromReq(req);
  const { urlOrId } = req.body || {};
  if (!urlOrId) return res.status(400).json({ error: 'URL atau ID Overlay tidak boleh kosong' });

  let targetId = String(urlOrId).trim();
  try {
    if (targetId.includes('?id=')) {
      const u = new URL(targetId, 'http://localhost');
      targetId = u.searchParams.get('id') || targetId;
    } else if (targetId.startsWith('http')) {
      const u = new URL(targetId);
      targetId = u.searchParams.get('id') || targetId;
    }
  } catch (e) {}

  targetId = targetId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!targetId) return res.status(400).json({ error: 'Format URL/ID tidak valid' });

  const overlays = readJsonFile(OVERLAYS_FILE, {});
  if (!overlays[targetId]) {
    return res.status(404).json({ error: `Overlay dengan ID "${targetId}" tidak ditemukan!` });
  }

  if (user) {
    const users = readJsonFile(USERS_FILE, {});
    const currentUser = users[user.username] || user;
    if (!currentUser.overlayIds) currentUser.overlayIds = [];
    if (!currentUser.overlayIds.includes(targetId)) {
      if (currentUser.overlayIds.length >= 3) {
        return res.status(400).json({
          error: 'Slot overlay Anda penuh (maksimal 3). Hapus salah satu terlebih dahulu untuk menautkan ID ini.'
        });
      }
      currentUser.overlayIds.push(targetId);
      users[currentUser.username] = currentUser;
      writeJsonFile(USERS_FILE, users);
    }
  }

  res.json({ success: true, id: targetId, overlay: overlays[targetId] });
});

// Delete user overlay slot
app.delete('/api/user/overlays/:id', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  const { id } = req.params;

  const users = readJsonFile(USERS_FILE, {});
  const currentUser = users[user.username] || user;
  if (!currentUser.overlayIds) currentUser.overlayIds = [];
  currentUser.overlayIds = currentUser.overlayIds.filter(x => x !== id);
  users[currentUser.username] = currentUser;
  writeJsonFile(USERS_FILE, users);

  const overlays = readJsonFile(OVERLAYS_FILE, {});
  if (overlays[id] && (overlays[id].owner === currentUser.username || !overlays[id].owner)) {
    delete overlays[id];
    writeJsonFile(OVERLAYS_FILE, overlays);
  }

  res.json({ success: true, remaining: currentUser.overlayIds });
});

// ==========================================
// OBS OVERLAY PROFILES API
// ==========================================
app.get('/api/overlays', (req, res) => {
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const list = Object.keys(overlays).map(id => ({
    id,
    theme: overlays[id].theme || 'glass',
    twitch: overlays[id].twitch || '',
    youtube: overlays[id].youtube || '',
    tiktok: overlays[id].tiktok || '',
    updatedAt: overlays[id].updatedAt || 0
  }));
  res.json(list);
});

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

  // If user is authenticated, associate with user
  const user = getUserFromReq(req);
  if (user) {
    const users = readJsonFile(USERS_FILE, {});
    const currentUser = users[user.username];
    if (currentUser) {
      if (!currentUser.overlayIds) currentUser.overlayIds = [];
      if (!currentUser.overlayIds.includes(id) && currentUser.overlayIds.length < 3) {
        currentUser.overlayIds.push(id);
        writeJsonFile(USERS_FILE, users);
      }
    }
  }

  overlays[id] = {
    ...overlays[id],
    ...data,
    id,
    owner: overlays[id]?.owner || (user ? user.username : 'public'),
    updatedAt: Date.now()
  };

  writeJsonFile(OVERLAYS_FILE, overlays);
  res.json({ success: true, id, overlay: overlays[id] });
});

// ==========================================
// ADMIN USER & OVERLAY MONITORING ENDPOINTS
// ==========================================
app.get('/api/admin/users', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak' });
  }
  const users = readJsonFile(USERS_FILE, {});
  const list = Object.values(users).map(u => ({
    username: u.username,
    createdAt: u.createdAt || 0,
    overlayCount: (u.overlayIds || []).length,
    overlayIds: u.overlayIds || []
  }));
  res.json(list);
});

app.delete('/api/admin/users/:username', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak' });
  }
  const { username } = req.params;
  const users = readJsonFile(USERS_FILE, {});
  if (!users[username]) return res.status(404).json({ error: 'User tidak ditemukan' });

  const overlays = readJsonFile(OVERLAYS_FILE, {});
  (users[username].overlayIds || []).forEach(id => {
    delete overlays[id];
  });
  delete users[username];

  writeJsonFile(USERS_FILE, users);
  writeJsonFile(OVERLAYS_FILE, overlays);
  res.json({ success: true, deletedUser: username });
});

app.get('/api/admin/all-overlays', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak' });
  }
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const list = Object.keys(overlays).map(id => ({
    id,
    owner: overlays[id].owner || 'Publik / Anonim',
    theme: overlays[id].theme || 'glass',
    twitch: overlays[id].twitch || '',
    youtube: overlays[id].youtube || '',
    tiktok: overlays[id].tiktok || '',
    updatedAt: overlays[id].updatedAt || 0
  }));
  res.json(list);
});

app.delete('/api/admin/overlays/:id', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak' });
  }
  const { id } = req.params;
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  if (!overlays[id]) return res.status(404).json({ error: 'Overlay tidak ditemukan' });
  delete overlays[id];
  writeJsonFile(OVERLAYS_FILE, overlays);

  const users = readJsonFile(USERS_FILE, {});
  for (const u of Object.values(users)) {
    if (u.overlayIds && u.overlayIds.includes(id)) {
      u.overlayIds = u.overlayIds.filter(x => x !== id);
    }
  }
  writeJsonFile(USERS_FILE, users);

  res.json({ success: true, deletedId: id });
});

app.get('/api/admin/system-stats', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak' });
  }
  const mem = process.memoryUsage();
  res.json({
    uptime: Math.floor(process.uptime()),
    ramRssMb: Math.round(mem.rss / 1024 / 1024),
    ramHeapMb: Math.round(mem.heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT
  });
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

