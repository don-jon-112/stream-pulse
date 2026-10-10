import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import * as argon2 from '@node-rs/argon2';
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
    let token = data?.twitchToken;
    if (data?.userToken) {
      const users = readJsonFile(USERS_FILE, {});
      const u = Object.values(users).find(x => x.token === data.userToken);
      if (u && (!token || token.includes('***') || token.includes('Tersimpan'))) {
        token = decryptToken(u.channels?.twitchTokenEncrypted);
      }
    }
    await streamManager.updateClientChannels(socket, { ...data, twitchToken: token });
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

app.get(['/privacy', '/privacy-policy'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
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
  let resolvedTwitchToken = twitchToken;

  const user = getUserFromReq(req);
  if (user && (!resolvedTwitchToken || resolvedTwitchToken.includes('***') || resolvedTwitchToken.includes('Tersimpan'))) {
    if (user.channels?.twitchTokenEncrypted) {
      resolvedTwitchToken = decryptToken(user.channels.twitchTokenEncrypted);
    }
  }

  if (twitch !== undefined) await streamManager.connectTwitch(twitch, resolvedTwitchToken);
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
// SECURITY HELPERS: ARGON2, AES-256, & RATE LIMITING
// ==========================================
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET || 'streampulse_secure_secret_key_2026').digest(); // 32 bytes

export async function hashPassword(plainPassword) {
  try {
    return await argon2.hash(String(plainPassword));
  } catch (err) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
  }
}

export async function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !plainPassword) return false;
  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedHash, String(plainPassword));
    } catch (e) {
      return false;
    }
  } else if (storedHash.startsWith('scrypt$')) {
    const [, salt, hash] = storedHash.split('$');
    const testHash = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  }
  return storedHash === plainPassword;
}

export function encryptToken(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedString) {
  if (!encryptedString || !encryptedString.includes(':')) return encryptedString || '';
  try {
    const [ivHex, tagHex, encrypted] = encryptedString.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('[Security] Gagal mendecrypt token:', err.message);
    return '';
  }
}

// In-Memory Rate Limiting & Verification Code Store
const verificationStore = new Map(); // email -> { code, expiresAt }
const rateLimitStore = new Map(); // key -> { count, resetAt }

function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  if (entry.count >= maxAttempts) {
    const waitHours = Math.ceil((entry.resetAt - now) / 3600000);
    const waitMinutes = Math.ceil((entry.resetAt - now) / 60000);
    return {
      allowed: false,
      waitTime: waitHours > 1 ? `${waitHours} jam` : `${waitMinutes} menit`
    };
  }
  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true, remaining: maxAttempts - entry.count };
}

// Mail Transporter Setup
const mailTransporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: (process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}) : null;

async function sendVerificationEmail(email, code) {
  if (mailTransporter && process.env.SMTP_USER) {
    try {
      await mailTransporter.sendMail({
        from: process.env.SMTP_FROM || `"StreamPulse" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Kode Verifikasi Pendaftaran StreamPulse: ${code}`,
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:auto; background:#0d111b; color:#f8fafc; padding:24px; border-radius:12px; border:1px solid #6366f1;">
            <h2 style="color:#67e8f9; margin-top:0;">StreamPulse Verification Code</h2>
            <p style="font-size:0.9rem; line-height:1.5;">Gunakan kode verifikasi berikut untuk menyelesaikan pendaftaran akun StreamPulse Anda:</p>
            <div style="text-align:center; padding:16px; background:#1e1b4b; border-radius:8px; font-size:2.2rem; font-weight:800; letter-spacing:6px; color:#fbbf24; margin:20px 0;">
              ${code}
            </div>
            <p style="font-size:0.8rem; color:#94a3b8;">Kode ini berlaku selama 15 menit. Jika Anda tidak merasa mendaftar di StreamPulse, abaikan email ini.</p>
          </div>
        `
      });
      return true;
    } catch (e) {
      console.warn('[SMTP] Error sending mail:', e.message);
    }
  }

  // Fallback Dev / Server Log
  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL VERIFIKASI STREAMPULSE]`);
  console.log(`   Tujuan: ${email}`);
  console.log(`   Kode:   ${code}`);
  console.log(`   (Atur SMTP_HOST, SMTP_USER, SMTP_PASS di .env untuk kirim email nyata via SMTP)`);
  console.log(`======================================================\n`);
  return true;
}

// ==========================================
// USER AUTH & OVERLAY LIMITS (MAX 3 PER USER)
// ==========================================
function getUserFromReq(req) {
  const token = (req.headers['x-user-token'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const users = readJsonFile(USERS_FILE, {});
  return Object.values(users).find(u => u.token === token) || null;
}

// 1. Send Email Verification Code
app.post('/api/auth/send-code', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip';
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Format alamat email tidak valid!' });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // Rate limit: Max 5 attempts per 1 hour per IP/email
  const limitCheck = checkRateLimit(`send_code_${cleanEmail}_${clientIp}`, 5, 3600000);
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: `Terlalu banyak permintaan verifikasi. Silakan coba lagi dalam ${limitCheck.waitTime}.` });
  }

  const users = readJsonFile(USERS_FILE, {});
  const emailExists = Object.values(users).some(u => u.email === cleanEmail);
  if (emailExists) {
    return res.status(400).json({ error: 'Email ini sudah terdaftar! Silakan login.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationStore.set(cleanEmail, {
    code,
    expiresAt: Date.now() + (15 * 60 * 1000) // 15 mins
  });

  await sendVerificationEmail(cleanEmail, code);

  res.json({
    success: true,
    message: `Kode verifikasi 6 digit telah dikirim ke ${cleanEmail}. Periksa kotak masuk / spam email Anda!`,
    isDevMode: !mailTransporter,
    devCode: !mailTransporter ? code : undefined
  });
});

// 2. Register Account with Argon2
app.post('/api/auth/register', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip';
  const { username, email, password, code } = req.body || {};

  if (!username || !email || !password || !code) {
    return res.status(400).json({ error: 'Semua kolom (username, email, password, dan kode verifikasi) wajib diisi!' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();

  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanUser)) {
    return res.status(400).json({ error: 'Username harus 3-20 karakter alfanumerik (a-z, 0-9, _, -)' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Password minimal 4 karakter' });
  }

  // Verify Code
  const vEntry = verificationStore.get(cleanEmail);
  if (!vEntry || vEntry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Kode verifikasi kedaluwarsa atau belum diminta. Silakan minta kode baru.' });
  }
  if (vEntry.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Kode verifikasi salah! Periksa kembali email Anda.' });
  }

  const users = readJsonFile(USERS_FILE, {});
  if (users[cleanUser]) {
    return res.status(400).json({ error: 'Username ini sudah digunakan! Silakan pilih username lain.' });
  }
  if (Object.values(users).some(u => u.email === cleanEmail)) {
    return res.status(400).json({ error: 'Email ini sudah terdaftar! Silakan login.' });
  }

  verificationStore.delete(cleanEmail);

  // Argon2 password hash
  const hashedPassword = await hashPassword(password);
  const token = `usr_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

  const newUser = {
    username: cleanUser,
    email: cleanEmail,
    password: hashedPassword,
    token,
    overlayIds: [],
    channels: {
      twitch: '',
      youtube: '',
      tiktok: '',
      twitchTokenEncrypted: ''
    },
    createdAt: Date.now()
  };

  users[cleanUser] = newUser;
  writeJsonFile(USERS_FILE, users);

  res.json({
    success: true,
    user: {
      username: newUser.username,
      email: newUser.email,
      token: newUser.token,
      overlayIds: newUser.overlayIds,
      channels: {
        twitch: '',
        youtube: '',
        tiktok: '',
        hasTwitchToken: false
      }
    }
  });
});

// 3. Login with Argon2 & Rate Limiting
app.post('/api/auth/login', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip';
  const { usernameOrEmail, password } = req.body || {};

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Username/Email dan password wajib diisi!' });
  }

  const cleanQuery = String(usernameOrEmail).trim().toLowerCase();

  // Rate limit: Max 5 failed attempts per 15 minutes
  const limitCheck = checkRateLimit(`login_${cleanQuery}_${clientIp}`, 5, 15 * 60 * 1000);
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: `Terlalu banyak percobaan login gagal. Demi keamanan, silakan coba lagi dalam ${limitCheck.waitTime}.` });
  }

  const users = readJsonFile(USERS_FILE, {});
  const user = users[cleanQuery] || Object.values(users).find(u => u.email === cleanQuery);

  if (!user) {
    return res.status(401).json({ error: 'Akun dengan username atau email tersebut tidak ditemukan!' });
  }

  const passwordValid = await verifyPassword(password, user.password);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Password salah! Periksa kembali password Anda.' });
  }

  // Clear rate limit on successful login
  rateLimitStore.delete(`login_${cleanQuery}_${clientIp}`);

  if (!user.token) {
    user.token = `usr_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    users[user.username] = user;
    writeJsonFile(USERS_FILE, users);
  }

  res.json({
    success: true,
    user: {
      username: user.username,
      email: user.email || '',
      token: user.token,
      overlayIds: user.overlayIds || [],
      channels: {
        twitch: user.channels?.twitch || '',
        youtube: user.channels?.youtube || '',
        tiktok: user.channels?.tiktok || '',
        hasTwitchToken: Boolean(user.channels?.twitchTokenEncrypted)
      }
    }
  });
});

// 4. Current User Profile
app.get('/api/user/me', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Belum login' });
  }
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const userOverlays = (user.overlayIds || []).map(id => overlays[id] || { id, theme: 'glass' });

  res.json({
    username: user.username,
    email: user.email || '',
    token: user.token,
    overlayIds: user.overlayIds || [],
    overlays: userOverlays,
    channels: {
      twitch: user.channels?.twitch || '',
      youtube: user.channels?.youtube || '',
      tiktok: user.channels?.tiktok || '',
      hasTwitchToken: Boolean(user.channels?.twitchTokenEncrypted)
    },
    maxLimit: 3
  });
});

// 5. Save User Homepage Channels with Encrypted OAuth Token
app.post('/api/user/channels', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk menyimpan saluran Anda.' });

  const { twitch, youtube, tiktok, twitchToken } = req.body || {};
  const users = readJsonFile(USERS_FILE, {});
  const currentUser = users[user.username] || user;

  if (!currentUser.channels) currentUser.channels = {};
  if (twitch !== undefined) currentUser.channels.twitch = String(twitch).trim();
  if (youtube !== undefined) currentUser.channels.youtube = String(youtube).trim();
  if (tiktok !== undefined) currentUser.channels.tiktok = String(tiktok).trim();

  // Encrypt OAuth Token if provided and not masked placeholder
  if (twitchToken !== undefined && !String(twitchToken).includes('***') && String(twitchToken).trim()) {
    currentUser.channels.twitchTokenEncrypted = encryptToken(String(twitchToken).trim());
  } else if (twitchToken === '') {
    currentUser.channels.twitchTokenEncrypted = '';
  }

  users[currentUser.username] = currentUser;
  writeJsonFile(USERS_FILE, users);

  res.json({
    success: true,
    message: 'Konfigurasi saluran berhasil disimpan ke akun Anda!',
    channels: {
      twitch: currentUser.channels.twitch || '',
      youtube: currentUser.channels.youtube || '',
      tiktok: currentUser.channels.tiktok || '',
      hasTwitchToken: Boolean(currentUser.channels.twitchTokenEncrypted)
    }
  });
});

// 6. Generate New Overlay (Max 3 Slots)
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

// 7. Load / Claim Existing Overlay
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

// 8. Delete Single Overlay Slot
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

// 9. Permanent Account Deletion (GDPR / Privacy Compliance)
app.delete('/api/user/account', async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk menghapus akun.' });

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Konfirmasi password diperlukan untuk menghapus akun.' });
  }

  const users = readJsonFile(USERS_FILE, {});
  const currentUser = users[user.username];
  if (!currentUser) return res.status(404).json({ error: 'User tidak ditemukan' });

  const passwordValid = await verifyPassword(password, currentUser.password);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Password konfirmasi salah! Akun tidak dihapus.' });
  }

  // Delete all user overlays
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  (currentUser.overlayIds || []).forEach(oId => {
    delete overlays[oId];
  });
  writeJsonFile(OVERLAYS_FILE, overlays);

  // Delete user record
  delete users[user.username];
  writeJsonFile(USERS_FILE, users);

  res.json({
    success: true,
    message: 'Akun Anda beserta seluruh data saluran dan overlay telah dihapus secara permanen dari server StreamPulse.'
  });
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
  const user = getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ error: 'Akses ditolak: Hanya pengguna yang telah login yang dapat menyimpan konfigurasi overlay OBS.' });
  }

  const data = req.body || {};
  const id = data.id && /^[a-zA-Z0-9_-]+$/.test(data.id) ? data.id : `ovl_${Math.random().toString(36).substr(2, 8)}`;
  const overlays = readJsonFile(OVERLAYS_FILE, {});

  const users = readJsonFile(USERS_FILE, {});
  const currentUser = users[user.username] || user;
  if (!currentUser.overlayIds) currentUser.overlayIds = [];

  // Overwrite or create new slot if slots < 3
  if (!currentUser.overlayIds.includes(id)) {
    if (currentUser.overlayIds.length >= 3) {
      return res.status(400).json({ error: 'Batas kuota 3 slot overlay telah tercapai. Anda dapat memilih salah satu slot yang ada untuk di-overwrite atau hapus slot yang tidak digunakan.' });
    }
    currentUser.overlayIds.push(id);
    users[user.username] = currentUser;
    writeJsonFile(USERS_FILE, users);
  }

  overlays[id] = {
    ...overlays[id],
    ...data,
    id,
    owner: currentUser.username,
    updatedAt: Date.now()
  };

  writeJsonFile(OVERLAYS_FILE, overlays);
  res.json({ success: true, id, overlay: overlays[id], overlayIds: currentUser.overlayIds });
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

