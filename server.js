import './lib/env.js';

// Polyfill zlib & worker_threads for Node.js < 22 (fixes Undici v7/v8 crashes on Node 18/20)
import { createRequire as _topCreateRequire } from 'node:module';
try {
  const _topReq = _topCreateRequire(import.meta.url);
  for (const modName of ['node:worker_threads', 'worker_threads']) {
    try {
      const _wt = _topReq(modName);
      if (_wt && !_wt.markAsUncloneable) {
        _wt.markAsUncloneable = function(obj) { return obj; };
      }
    } catch (_) {}
  }
  for (const modName of ['node:zlib', 'zlib']) {
    try {
      const _zlib = _topReq(modName);
      if (_zlib && !_zlib.createZstdDecompress) {
        Object.defineProperty(_zlib, 'createZstdDecompress', {
          value: function() {},
          configurable: true,
          writable: true
        });
      }
      if (_zlib?.constants && !_zlib.constants.ZSTD_d_windowLogMax) {
        try {
          Object.defineProperty(_zlib.constants, 'ZSTD_d_windowLogMax', {
            value: 23,
            configurable: true,
            writable: true
          });
        } catch (_) {
          _zlib.constants.ZSTD_d_windowLogMax = 23;
        }
      }
    } catch (_) {}
  }
} catch (_) {}

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import compression from 'compression';

import { initDefaultDataFiles, readJsonFile, writeJsonFile, USERS_FILE, OVERLAYS_FILE } from './lib/db.js';
import * as dbModule from './lib/db.js';
import { checkAdminAuth } from './lib/adminAuth.js';
import { decryptToken, getUserFromReq, refreshTwitchToken, getUserTikTokSessionId, migrateUserSecrets } from './lib/security.js';
import { StreamManager } from './lib/streamManager.js';
import { emoteManager } from './lib/emoteManager.js';

import { createSpotlightRouter } from './routes/spotlight.js';
import feedbackRouter from './routes/feedback.js';
import socialRotatorRouter from './routes/socialRotator.js';
import overlaysRouter, { setOverlaysIo } from './routes/overlays.js';
import { createAuthRouter } from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi default database files jika belum ada
initDefaultDataFiles();
migrateUserSecrets(dbModule);

const app = express();
const server = http.createServer(app);
// ==========================================
// CORS / ORIGIN POLICY
// ==========================================
// Diizinkan: same-origin, origin aplikasi native (Capacitor/Electron/localhost), host dari
// PUBLIC_URL / TWITCH_REDIRECT_URI, dan daftar ALLOWED_ORIGINS di .env (pisah koma).
// ALLOWED_ORIGINS=* mengembalikan perilaku lama (semua origin diizinkan).
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOW_ALL_ORIGINS = ALLOWED_ORIGINS.includes('*');
const NATIVE_ORIGIN_RE = /^(capacitor|ionic|file):\/\/|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const SELF_HOSTS = new Set();
for (const u of [process.env.PUBLIC_URL, process.env.TWITCH_REDIRECT_URI, process.env.YOUTUBE_REDIRECT_URI]) {
  try { if (u) SELF_HOSTS.add(new URL(u).host.toLowerCase()); } catch (_) {}
}

function isOriginAllowed(origin, req) {
  if (!origin || origin === 'null') return true; // non-browser / same-origin tanpa header
  if (ALLOW_ALL_ORIGINS) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (NATIVE_ORIGIN_RE.test(origin)) return true;
  let originHost = '';
  try { originHost = new URL(origin).host.toLowerCase(); } catch (_) { return false; }
  if (SELF_HOSTS.has(originHost)) return true;
  const hosts = [req?.headers?.host, req?.headers?.['x-forwarded-host']]
    .filter(Boolean).flatMap(h => String(h).split(',')).map(h => h.trim().toLowerCase());
  return hosts.includes(originHost);
}

const io = new SocketIOServer(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  allowRequest: (req, callback) => {
    callback(null, isOriginAllowed(req.headers.origin, req));
  }
});

const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(cors((req, callback) => {
  callback(null, { origin: isOriginAllowed(req.headers.origin, req) });
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Tiered Caching & Performance Header Configuration:
app.use((req, res, next) => {
  // Header keamanan dasar (CSP sengaja belum dipasang karena halaman memakai banyak inline script)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }
  next();
});

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 3600000,
  etag: true,
  setHeaders: (res, filePath) => {
    const lower = filePath.toLowerCase();
    if (/\.(html|js|css|mjs)$/i.test(lower)) {
      // Selalu validasi ulang (ETag -> 304) agar update langsung terlihat, tidak tersangkut cache
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (/\.(png|jpe?g|gif|webp|svg|ico|mp3|wav|ogg|woff2?|ttf|eot)$/i.test(lower)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  }
}));

// Initialize Stream Manager
const streamManager = new StreamManager(io);
setOverlaysIo(io);

// Hubungkan StreamManager dengan Twitch Token Auto-Refresh
streamManager.setTokenRefreshHandler((ch) => refreshTwitchToken(ch, dbModule));

// ==========================================
// CHAT SPOTLIGHT (PIN KOMENTAR KE OBS)
// ==========================================
let currentSpotlight = null;
let spotlightServerTimer = null;

function setServerSpotlight(data) {
  if (spotlightServerTimer) {
    clearTimeout(spotlightServerTimer);
    spotlightServerTimer = null;
  }
  currentSpotlight = data;
  io.emit('spotlight_chat', currentSpotlight);
  console.log(`[Spotlight] Komentar dipin: "${data?.author?.name || 'User'}": "${(data?.text || '').substring(0, 35)}..."`);

  const durSec = parseInt(data?.duration, 10) || 0;
  if (durSec > 0) {
    spotlightServerTimer = setTimeout(() => {
      clearServerSpotlight();
    }, durSec * 1000);
  }
}

function clearServerSpotlight() {
  if (spotlightServerTimer) {
    clearTimeout(spotlightServerTimer);
    spotlightServerTimer = null;
  }
  currentSpotlight = null;
  io.emit('spotlight_clear');
  console.log('[Spotlight] Komentar dilepas (unpinned)');
}

// ==========================================
// SOCKET.IO REALTIME EVENT BUS
// ==========================================
io.on('connection', (socket) => {
  socket.emit('initial_state', streamManager.getClientInitialState(socket));

  if (currentSpotlight) {
    socket.emit('spotlight_active', currentSpotlight);
  }

  // Pin/unpin spotlight hanya untuk akun yang login (token dikirim dari dock, tidak disiarkan ke overlay)
  const isValidSpotlightUser = (token) => {
    if (!token || typeof token !== 'string') return false;
    return Object.values(readJsonFile(USERS_FILE, {})).some(u => u.token === token);
  };

  socket.on('spotlight_chat', (data) => {
    if (!data || typeof data !== 'object' || !isValidSpotlightUser(data.userToken)) return;
    const { userToken, ...safeData } = data;
    setServerSpotlight(safeData);
  });

  socket.on('spotlight_clear', (data) => {
    if (!data || !isValidSpotlightUser(data.userToken)) return;
    clearServerSpotlight();
  });

  socket.on('get_spotlight', (callback) => {
    if (typeof callback === 'function') {
      callback(currentSpotlight);
    }
  });

  const handleUpdateChannels = async (data, callback) => {
    let token = data?.twitchToken;
    let cleanTwitch = (data?.twitch || '').trim().toLowerCase().replace(/^[#@]/, '');
    let cleanYouTube = (data?.youtube || '').trim();
    let cleanTikTok = streamManager.parseTikTokInput ? streamManager.parseTikTokInput(data?.tiktok) : (data?.tiktok || '').trim().replace(/^@/, '');
    let tiktokSessionId = data?.tiktokSessionId ? String(data.tiktokSessionId).trim() : '';

    let ownerUsername = null;
    if (data?.userToken) {
      const users = readJsonFile(USERS_FILE, {});
      const u = Object.values(users).find(x => x.token === data.userToken);
      if (u) {
        ownerUsername = u.username;
        if (!token || token.includes('***') || token.includes('Tersimpan') || token.includes('••••')) {
          token = decryptToken(u.channels?.twitchTokenEncrypted);
        }
        if (!cleanTwitch && u.channels?.twitch) cleanTwitch = u.channels.twitch.toLowerCase().replace(/^[#@]/, '');
        if (!cleanYouTube && u.channels?.youtube) cleanYouTube = u.channels.youtube;
        if (!cleanTikTok && u.channels?.tiktok) cleanTikTok = u.channels.tiktok.replace(/^@/, '');
        if (!tiktokSessionId) tiktokSessionId = getUserTikTokSessionId(u);
      }
    }

    if (data?.overlayId) {
      const overlays = readJsonFile(OVERLAYS_FILE, {});
      const ovl = overlays[data.overlayId];
      if (ovl) {
        if (!cleanTwitch && ovl.twitch) cleanTwitch = ovl.twitch.toLowerCase().replace(/^[#@]/, '');
        if (!cleanYouTube && ovl.youtube) cleanYouTube = ovl.youtube;
        if (!cleanTikTok && ovl.tiktok) cleanTikTok = ovl.tiktok.replace(/^@/, '');

        if (ovl.owner) {
          const users = readJsonFile(USERS_FILE, {});
          const u = users[ovl.owner];
          if (u) {
            ownerUsername = ownerUsername || u.username;
            if (!cleanTwitch && u.channels?.twitch) cleanTwitch = u.channels.twitch.toLowerCase().replace(/^[#@]/, '');
            if (!cleanYouTube && u.channels?.youtube) cleanYouTube = u.channels.youtube;
            if (!cleanTikTok && u.channels?.tiktok) cleanTikTok = u.channels.tiktok.replace(/^@/, '');
            // Overlay/dock OBS: ambil Session ID TikTok milik pemilik overlay (sebelumnya tidak terkirim)
            if (!tiktokSessionId) tiktokSessionId = getUserTikTokSessionId(u);
            if (!token && u.channels?.twitchTokenEncrypted) {
              token = decryptToken(u.channels.twitchTokenEncrypted);
            }
          }
        }
      }
    }

    // Gabungkan socket ini ke room milik akun, supaya perubahan saluran dari halaman lain
    // (hapus/ganti channel) bisa langsung diberitahukan ke dock & overlay yang sedang terbuka.
    if (ownerUsername) {
      const room = `user:${ownerUsername}`;
      if (socket.data.userRoom && socket.data.userRoom !== room) socket.leave(socket.data.userRoom);
      socket.data.userRoom = room;
      socket.join(room);
    }

    // Fallback terakhir: TIKTOK_SESSION_ID dari .env agar tetap ada setelah restart
    if (!tiktokSessionId && process.env.TIKTOK_SESSION_ID) {
      tiktokSessionId = String(process.env.TIKTOK_SESSION_ID).trim();
    }

    if (!token && cleanTwitch) {
      const users = readJsonFile(USERS_FILE, {});
      const matched = Object.values(users).find(x => {
        const t = (x.channels?.twitch || x.username || '').toLowerCase().replace(/^[#@]/, '');
        return t === cleanTwitch;
      });
      if (matched?.channels?.twitchTokenEncrypted) {
        token = decryptToken(matched.channels.twitchTokenEncrypted);
      }
    }

    if (!token && cleanTwitch) {
      const existingPool = streamManager.twitchPool.get(cleanTwitch);
      if (existingPool && existingPool.token) {
        token = existingPool.token;
      }
    }

    await streamManager.updateClientChannels(socket, {
      ...data,
      twitch: cleanTwitch,
      youtube: cleanYouTube,
      tiktok: cleanTikTok,
      tiktokSessionId: tiktokSessionId,
      twitchToken: token
    });

    const authStatus = {
      hasTwitchAuth: !!token,
      twitchChannel: cleanTwitch
    };
    socket.emit('auth_status', authStatus);
    if (typeof callback === 'function') {
      callback(authStatus);
    }
  };

  socket.on('client_stream_relay', (data) => {
    // Relay dari klien hanya diterima dengan token akun yang valid
    const relayUser = data && data.userToken
      ? Object.values(readJsonFile(USERS_FILE, {})).find(x => x.token === data.userToken)
      : null;
    if (!relayUser) return;
    streamManager.handleClientRelay(socket, data);
  });

  socket.on('update_channels', handleUpdateChannels);
  socket.on('set_channels', handleUpdateChannels);

  socket.on('disconnect_platform', async ({ platform }) => {
    await streamManager.disconnectClientPlatform(socket, platform);
  });

  socket.on('send_test_event', ({ platform, type }) => {
    streamManager.sendTestEvent(platform, type, socket);
  });

  socket.on('send_chat_message', async ({ platform, channel, message, userToken }, callback) => {
    try {
      if (platform !== 'twitch') {
        const msg = platform === 'youtube'
          ? 'Pengiriman chat YouTube dinonaktifkan sementara menunggu verifikasi OAuth Google.'
          : `Pengiriman chat ke ${platform || 'platform ini'} belum didukung saat ini.`;
        if (typeof callback === 'function') callback({ success: false, error: msg });
        return;
      }

      let token = '';
      if (userToken) {
        const users = readJsonFile(USERS_FILE, {});
        const u = Object.values(users).find(x => x.token === userToken);
        if (u?.channels?.twitchTokenEncrypted) {
          token = decryptToken(u.channels.twitchTokenEncrypted);
        }
      }

      const cleanCh = (channel || '').trim().toLowerCase().replace(/^[#@]/, '');
      const result = await streamManager.sendTwitchChatMessage(cleanCh, message, token);
      if (typeof callback === 'function') {
        callback(result);
      }
    } catch (err) {
      console.error('[send_chat_message] Error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Gagal mengirim pesan chat' });
      }
    }
  });

  socket.on('clear_events', () => {
    socket.emit('events_cleared');
  });

  socket.on('disconnect', async () => {
    await streamManager.handleClientDisconnect(socket);
  });

  socket.on('ping_check', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });
});

// ==========================================
// STATIC HTML PAGES & DOWNLOADS
// ==========================================
app.get(['/dock', '/obs-dock', '/browser-dock'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dock.html'));
});

app.get(['/in-game-overlay', '/game-overlay', '/hud'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'in-game-overlay.html'));
});

function ensurePortableZip() {
  const targetZip = path.join(__dirname, 'public', 'downloads', 'StreamPulse-Overlay-Portable.zip');
  const legacyZip = path.join(__dirname, 'public', 'downloads', 'StreamPulse-Portable-Win64.zip');
  const partsDir = path.join(__dirname, 'public', 'downloads', 'parts');

  if (!fs.existsSync(targetZip) && fs.existsSync(partsDir)) {
    try {
      const parts = fs.readdirSync(partsDir).filter(f => f.startsWith('StreamPulse-Overlay.zip.')).sort();
      if (parts.length > 0) {
        console.log('[AutoMerge] Menggabungkan paket mini overlay dari parts...');
        const bufs = parts.map(p => fs.readFileSync(path.join(partsDir, p)));
        fs.writeFileSync(targetZip, Buffer.concat(bufs));
        console.log('[AutoMerge] Paket StreamPulse-Overlay-Portable.zip siap diunduh!');
      }
    } catch (err) {
      console.warn('[AutoMerge] Gagal menggabungkan parts:', err.message);
    }
  }
  return fs.existsSync(targetZip) ? targetZip : legacyZip;
}

app.get(['/download', '/download/exe', '/download/portable', '/download/overlay', '/download/streampulse'], (req, res) => {
  const zipFile = ensurePortableZip();
  const possibleZipPaths = [
    zipFile,
    path.join(__dirname, 'public', 'downloads', 'StreamPulse-Overlay-Portable.zip'),
    path.join(process.cwd(), 'public', 'downloads', 'StreamPulse-Overlay-Portable.zip'),
    path.join(__dirname, 'public', 'downloads', 'StreamPulse-Portable-Win64.zip')
  ];

  const validZip = possibleZipPaths.find(p => p && fs.existsSync(p));
  if (validZip) {
    return res.download(validZip, 'StreamPulse-Overlay-Portable.zip');
  } else {
    res.status(404).send('File aplikasi mini overlay portable belum tersedia.');
  }
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

app.get(['/viewers', '/viewers-counter', '/obs-viewers'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewers.html'));
});

app.get(['/viewers-overlay', '/viewers-widget'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewers-overlay.html'));
});

app.get(['/social-rotator', '/socials', '/rotator', '/social-rotator-studio'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'social-rotator.html'));
});

app.get(['/social-rotator-overlay', '/social-overlay', '/socials-overlay', '/socials-widget'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'social-rotator-overlay.html'));
});

app.get(['/spotlight-overlay', '/chat-spotlight', '/spotlight', '/pin-overlay'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spotlight-overlay.html'));
});

app.get(['/tiktok', '/tiktok-widgets', '/tiktok-studio', '/tiktok-tools'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tiktok-widgets.html'));
});

app.get(['/tiktok-overlay', '/tiktok-top-gifter', '/tiktok-top-likes', '/tiktok-gift-jar', '/tiktok-like-waterfall', '/tiktok-alerts', '/tiktok-goals'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tiktok-overlay.html'));
});

app.get(['/admin', '/features-admin', '/admin-features'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/privacy', '/privacy-policy'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// ==========================================
// CORE REST ENDPOINTS
// ==========================================
app.get('/api/status', (req, res) => {
  res.json(streamManager.getInitialState());
});

// Diagnostik (khusus admin): siapa saja yang sedang memegang koneksi tiap channel.
// Tidak menampilkan token; query string pada URL halaman dibuang.
app.get('/api/admin/connections', (req, res) => {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Akses ditolak' });
  const describeSocket = (id) => {
    const sock = io.sockets.sockets.get(id);
    if (!sock) return { id, connected: false };
    const h = sock.handshake || {};
    let page = '';
    try { const u = new URL(h.headers?.referer || ''); page = u.origin + u.pathname; } catch (_) {}
    return {
      id,
      connected: true,
      account: (sock.data?.userRoom || '').replace(/^user:/, '') || null,
      page,
      ip: String(h.headers?.['x-forwarded-for'] || h.address || '').split(',')[0].trim(),
      userAgent: String(h.headers?.['user-agent'] || '').slice(0, 90),
      connectedSince: h.time || null
    };
  };
  const dump = (pool) => [...pool.entries()].map(([channel, item]) => ({
    channel,
    status: item.status?.status || '',
    viewerCount: item.viewerCount || 0,
    listeners: [...(item.listeners || [])].map(describeSocket)
  }));
  res.json({
    tiktok: dump(streamManager.tiktokPool),
    twitch: dump(streamManager.twitchPool),
    youtube: dump(streamManager.youtubePool),
    totalSockets: io.engine.clientsCount
  });
});

app.get('/api/events', (req, res) => {
  const events = Array.isArray(streamManager.eventHistory) ? streamManager.eventHistory : [];
  res.json({
    total: events.length,
    events: events
  });
});

app.get('/api/tiktok/top-gifters', (req, res) => {
  const channel = req.query.channel || '';
  const topGifters = streamManager.getTikTokTopGifters ? streamManager.getTikTokTopGifters(channel) : [];
  res.json({
    channel,
    total: topGifters.length,
    gifters: topGifters
  });
});

app.post('/api/tiktok/reset-gifters', (req, res) => {
  const user = getUserFromReq(req, readJsonFile(USERS_FILE, {}));
  if (!user) return res.status(401).json({ error: 'Login diperlukan' });
  // Hanya boleh mereset channel TikTok milik sendiri (bukan semua channel).
  const channel = user.channels?.tiktok || '';
  if (!channel) return res.status(400).json({ error: 'Akun belum punya channel TikTok' });
  if (streamManager.clearTikTokTopGifters) {
    streamManager.clearTikTokTopGifters(channel);
  }
  res.json({ success: true, message: 'Top gifters reset successfully' });
});

app.get('/api/emotes/global', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json(emoteManager.getGlobalEmotes ? emoteManager.getGlobalEmotes() : {});
});

app.post('/api/channels', async (req, res) => {
  const { twitch, twitchToken, youtube, tiktok } = req.body || {};
  let resolvedTwitchToken = twitchToken;

  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  if (!user) return res.status(401).json({ error: 'Login diperlukan' });
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

app.get('/api/twitch/avatar/:username', async (req, res) => {
  const { username } = req.params;
  const userId = req.query.id || null;
  const avatar = await streamManager.getTwitchAvatar(username, userId);
  res.json({ username, avatar });
});

// ==========================================
// MOUNT MODULAR SUB-ROUTERS
// ==========================================
app.use('/api', createSpotlightRouter({
  getSpotlight: () => currentSpotlight,
  setSpotlight: setServerSpotlight,
  clearSpotlight: clearServerSpotlight
}));
app.use('/api', feedbackRouter);
app.use('/api', socialRotatorRouter);
app.use('/api', overlaysRouter);
app.use(createAuthRouter(streamManager));

// Start HTTP Server
server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`🚀 StreamPulse MultiChat Server Aktif!`);
  console.log(`   - Local PC:   http://localhost:${PORT}`);
  console.log(`   - Akses HP:   http://${localIp}:${PORT}`);
  console.log(`==================================================\n`);
});
