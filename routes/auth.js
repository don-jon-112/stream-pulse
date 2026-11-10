import express from 'express';
import crypto from 'crypto';
import { readJsonFile, writeJsonFile, USERS_FILE, OVERLAYS_FILE, ADMIN_FILE } from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  encryptToken,
  decryptToken,
  verificationStore,
  rateLimitStore,
  isRateLimited,
  recordFailedAttempt,
  checkRateLimit,
  sendVerificationEmail,
  getUserFromReq
} from '../lib/security.js';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'sea3yunko17ptmjkwf98imtypufch4';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || 'q341sygmjw843bik91y6p79cr91pz2';
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '';
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';

const twitchOauthStates = new Map();
const youtubeOauthStates = new Map();

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

function getTwitchRedirectUri(req) {
  if (process.env.TWITCH_REDIRECT_URI) return process.env.TWITCH_REDIRECT_URI;
  if (req.query?.redirect_origin) {
    try {
      const parsed = new URL(req.query.redirect_origin);
      return `${parsed.origin}/auth/twitch/callback`;
    } catch (e) {}
  }
  if (req.headers.referer) {
    try {
      const parsed = new URL(req.headers.referer);
      return `${parsed.origin}/auth/twitch/callback`;
    } catch (e) {}
  }
  const fwdHost = req.headers['x-forwarded-host'];
  if (fwdHost) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    return `${proto}://${fwdHost}/auth/twitch/callback`;
  }
  const host = req.headers.host || 'localhost:3000';
  let proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    proto = 'https';
  }
  return `${proto}://${host}/auth/twitch/callback`;
}

function getYouTubeRedirectUri(req) {
  if (process.env.YOUTUBE_REDIRECT_URI) return process.env.YOUTUBE_REDIRECT_URI;
  if (req.query?.redirect_origin) {
    try {
      const parsed = new URL(req.query.redirect_origin);
      return `${parsed.origin}/auth/youtube/callback`;
    } catch (e) {}
  }
  if (req.headers.referer) {
    try {
      const parsed = new URL(req.headers.referer);
      return `${parsed.origin}/auth/youtube/callback`;
    } catch (e) {}
  }
  const fwdHost = req.headers['x-forwarded-host'];
  if (fwdHost) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    return `${proto}://${fwdHost}/auth/youtube/callback`;
  }
  const host = req.headers.host || 'localhost:3000';
  let proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    proto = 'https';
  }
  return `${proto}://${host}/auth/youtube/callback`;
}

export function createAuthRouter(streamManager) {
  const router = express.Router();

  // 1. Send Email Verification Code
  router.post('/api/auth/send-code', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip';
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Format alamat email tidak valid!' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
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
      expiresAt: Date.now() + (15 * 60 * 1000)
    });

    await sendVerificationEmail(cleanEmail, code);

    res.json({
      success: true,
      message: `Kode verifikasi 6 digit telah dikirim ke ${cleanEmail}. Periksa kotak masuk / spam email Anda!`,
      isDevMode: !process.env.SMTP_HOST,
      devCode: !process.env.SMTP_HOST ? code : undefined
    });
  });

  // 2. Register Account
  router.post('/api/auth/register', async (req, res) => {
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

    const hashedPassword = await hashPassword(password);
    const token = `usr_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

    const initialSlotId = `ovl_${Math.random().toString(36).substr(2, 7)}`;
    const overlays = readJsonFile(OVERLAYS_FILE, {});
    overlays[initialSlotId] = {
      id: initialSlotId,
      name: 'Slot 1 (Utama)',
      owner: cleanUser,
      theme: 'glass',
      chatDirection: 'bottom',
      chatFade: 'none',
      horizontalDirection: 'right',
      chatRounded: 12,
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
    writeJsonFile(OVERLAYS_FILE, overlays);

    const newUser = {
      username: cleanUser,
      email: cleanEmail,
      password: hashedPassword,
      token,
      overlayIds: [initialSlotId],
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

  // 3. Login
  router.post('/api/auth/login', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip';
    const { usernameOrEmail, password } = req.body || {};

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username/Email dan password wajib diisi!' });
    }

    const cleanQuery = String(usernameOrEmail).trim().toLowerCase();
    const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('127.0.0.1');
    const maxAttempts = isLocal ? 20 : 7;
    const rateLimitKey = `login_${cleanQuery}_${clientIp}`;

    const limitCheck = isRateLimited(rateLimitKey, maxAttempts);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: `Terlalu banyak percobaan login gagal. Demi keamanan, silakan coba lagi dalam ${limitCheck.waitTime}.` });
    }

    const users = readJsonFile(USERS_FILE, {});
    const user = users[cleanQuery] || Object.values(users).find(u => 
      (u.username && u.username.toLowerCase() === cleanQuery) || 
      (u.email && u.email.toLowerCase() === cleanQuery)
    );

    if (!user) {
      recordFailedAttempt(rateLimitKey, maxAttempts, 15 * 60 * 1000);
      return res.status(401).json({ error: 'Akun dengan username atau email tersebut tidak ditemukan!' });
    }

    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      recordFailedAttempt(rateLimitKey, maxAttempts, 15 * 60 * 1000);
      return res.status(401).json({ error: 'Password salah! Periksa kembali password Anda.' });
    }

    rateLimitStore.delete(rateLimitKey);

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
          twitchDisplayName: user.channels?.twitchDisplayName || '',
          twitchAvatar: user.channels?.twitchAvatar || '',
          twitchUserId: user.channels?.twitchUserId || '',
          youtube: user.channels?.youtube || '',
          youtubeTitle: user.channels?.youtubeTitle || '',
          youtubeAvatar: user.channels?.youtubeAvatar || '',
          youtubeChannelId: user.channels?.youtubeChannelId || '',
          tiktok: user.channels?.tiktok || '',
          tiktokSessionId: user.channels?.tiktokSessionId || '',
          hasTwitchToken: Boolean(user.channels?.twitchTokenEncrypted),
          hasYouTubeToken: Boolean(user.channels?.youtubeTokenEncrypted)
        }
      }
    });
  });

  // 4. Current User Profile
  router.get('/api/user/me', (req, res) => {
    const users = readJsonFile(USERS_FILE, {});
    const user = getUserFromReq(req, users);
    if (!user) {
      return res.status(401).json({ error: 'Belum login' });
    }
    const overlays = readJsonFile(OVERLAYS_FILE, {});

    if (!user.overlayIds || user.overlayIds.length === 0) {
      const initialSlotId = `ovl_${Math.random().toString(36).substr(2, 7)}`;
      overlays[initialSlotId] = {
        id: initialSlotId,
        name: 'Slot 1 (Utama)',
        owner: user.username,
        theme: 'glass',
        chatDirection: 'bottom',
        chatFade: 'none',
        horizontalDirection: 'right',
        chatRounded: 12,
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
      user.overlayIds = [initialSlotId];
      users[user.username] = user;
      writeJsonFile(OVERLAYS_FILE, overlays);
      writeJsonFile(USERS_FILE, users);
    }

    const userOverlays = (user.overlayIds || []).map(id => overlays[id] || { id, theme: 'glass' });

    res.json({
      username: user.username,
      email: user.email || '',
      token: user.token,
      overlayIds: user.overlayIds || [],
      overlays: userOverlays,
      channels: {
        twitch: user.channels?.twitch || '',
        twitchDisplayName: user.channels?.twitchDisplayName || '',
        twitchAvatar: user.channels?.twitchAvatar || '',
        twitchUserId: user.channels?.twitchUserId || '',
        youtube: user.channels?.youtube || '',
        youtubeTitle: user.channels?.youtubeTitle || '',
        youtubeAvatar: user.channels?.youtubeAvatar || '',
        youtubeChannelId: user.channels?.youtubeChannelId || '',
        tiktok: user.channels?.tiktok || '',
        tiktokSessionId: user.channels?.tiktokSessionId || '',
        hasTwitchToken: Boolean(user.channels?.twitchTokenEncrypted),
        hasYouTubeToken: Boolean(user.channels?.youtubeTokenEncrypted)
      },
      maxLimit: 5
    });
  });

  // 4b. OBS Dock Auto-Config Endpoint
  router.get('/api/dock/config', (req, res) => {
    const token = (req.query.token || '').trim();
    const username = (req.query.user || req.query.username || '').trim().toLowerCase();

    const users = readJsonFile(USERS_FILE, {});
    let matchedUser = null;

    if (token) {
      matchedUser = Object.values(users).find(u => u.token === token);
    }
    if (!matchedUser && username) {
      matchedUser = Object.values(users).find(u => (u.username || '').toLowerCase() === username);
    }

    if (matchedUser) {
      return res.json({
        success: true,
        username: matchedUser.username,
        userToken: matchedUser.token,
        channels: {
          twitch: matchedUser.channels?.twitch || '',
          twitchDisplayName: matchedUser.channels?.twitchDisplayName || '',
          youtube: matchedUser.channels?.youtube || '',
          tiktok: matchedUser.channels?.tiktok || '',
          tiktokSessionId: matchedUser.channels?.tiktokSessionId || '',
          hasTwitchToken: Boolean(matchedUser.channels?.twitchTokenEncrypted)
        }
      });
    }

    res.status(404).json({ success: false, error: 'User tidak ditemukan' });
  });

  // 5. Save Channels
  router.post('/api/user/channels', (req, res) => {
    const users = readJsonFile(USERS_FILE, {});
    const user = getUserFromReq(req, users);
    if (!user) return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk menyimpan saluran Anda.' });

    const { twitch, youtube, tiktok, twitchToken, tiktokSessionId } = req.body || {};
    const currentUser = users[user.username] || user;

    if (!currentUser.channels) currentUser.channels = {};
    if (twitch !== undefined) currentUser.channels.twitch = String(twitch).trim();
    if (youtube !== undefined) currentUser.channels.youtube = String(youtube).trim();
    if (tiktok !== undefined) currentUser.channels.tiktok = streamManager?.parseTikTokInput ? streamManager.parseTikTokInput(tiktok) : String(tiktok).trim();
    if (tiktokSessionId !== undefined) {
      currentUser.channels.tiktokSessionId = String(tiktokSessionId).trim();
      if (currentUser.channels.tiktokSessionId) {
        globalThis._activeTikTokSessionId = currentUser.channels.tiktokSessionId;
      }
    }

    const isMaskedToken = String(twitchToken).includes('***') || String(twitchToken).includes('••••') || String(twitchToken).includes('Tersimpan');
    if (twitchToken !== undefined && !isMaskedToken && String(twitchToken).trim()) {
      currentUser.channels.twitchTokenEncrypted = encryptToken(String(twitchToken).trim());
    } else if (twitchToken === '') {
      currentUser.channels.twitchTokenEncrypted = '';
    }

    users[currentUser.username] = currentUser;
    writeJsonFile(USERS_FILE, users);

    if (Array.isArray(currentUser.overlayIds) && currentUser.overlayIds.length > 0) {
      const overlays = readJsonFile(OVERLAYS_FILE, {});
      let ovlUpdated = false;
      for (const ovlId of currentUser.overlayIds) {
        if (overlays[ovlId]) {
          if (twitch !== undefined) overlays[ovlId].twitch = currentUser.channels.twitch || '';
          if (youtube !== undefined) overlays[ovlId].youtube = currentUser.channels.youtube || '';
          if (tiktok !== undefined) overlays[ovlId].tiktok = currentUser.channels.tiktok || '';
          overlays[ovlId].updatedAt = Date.now();
          ovlUpdated = true;
        }
      }
      if (ovlUpdated) writeJsonFile(OVERLAYS_FILE, overlays);
    }

    res.json({
      success: true,
      message: 'Konfigurasi saluran berhasil disimpan ke akun Anda!',
      channels: {
        twitch: currentUser.channels.twitch || '',
        youtube: currentUser.channels.youtube || '',
        tiktok: currentUser.channels.tiktok || '',
        tiktokSessionId: currentUser.channels.tiktokSessionId || '',
        hasTwitchToken: Boolean(currentUser.channels.twitchTokenEncrypted)
      }
    });
  });

  // ==========================================
  // TWITCH OAUTH 2.0 FLOW
  // ==========================================
  router.get('/auth/twitch', (req, res) => {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      return res.status(500).send('Twitch Client ID / Secret belum dikonfigurasi di server.');
    }

    const redirectUri = getTwitchRedirectUri(req);
    const userToken = req.query.userToken || '';
    const state = crypto.randomBytes(16).toString('hex');

    const now = Date.now();
    for (const [st, val] of twitchOauthStates.entries()) {
      if (now - val.createdAt > 15 * 60 * 1000) {
        twitchOauthStates.delete(st);
      }
    }

    twitchOauthStates.set(state, { userToken, redirectUri, createdAt: now });

    const scopes = [
      'channel:read:redemptions',
      'chat:read',
      'chat:edit',
      'user:read:chat',
      'user:write:chat',
      'moderator:read:followers'
    ];

    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;
    res.redirect(authUrl);
  });

  router.get('/auth/twitch/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.warn('[Twitch OAuth] Auth error dari Twitch:', error, error_description);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Twitch Auth Gagal</title></head>
        <body style="background:#0b0e17;color:#f87171;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Gagal Menghubungkan Twitch</h3>
          <p>${error_description || error}</p>
          <button onclick="window.close()" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Tutup</button>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'TWITCH_AUTH_ERROR', error: '${error}' }, '*');
            }
          </script>
        </body>
        </html>
      `);
    }

    const stateData = twitchOauthStates.get(state);
    if (!stateData) {
      return res.status(400).send('State token tidak valid atau telah kedaluwarsa. Silakan coba login kembali.');
    }
    twitchOauthStates.delete(state);

    try {
      const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: stateData.redirectUri
        }).toString(),
        signal: AbortSignal.timeout(6000)
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      const userRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-Id': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`
        },
        signal: AbortSignal.timeout(4500)
      });

      if (!userRes.ok) {
        const errText = await userRes.text();
        throw new Error(`Failed to fetch Twitch user profile (${userRes.status}): ${errText}`);
      }

      const userData = await userRes.json();
      const broadcaster = userData.data?.[0];
      if (!broadcaster) {
        throw new Error('Data profil streamer Twitch tidak ditemukan.');
      }

      const twitchLogin = broadcaster.login.toLowerCase();
      const twitchDisplayName = broadcaster.display_name;
      const twitchUserId = broadcaster.id;
      const twitchAvatar = broadcaster.profile_image_url;

      if (stateData.userToken) {
        const users = readJsonFile(USERS_FILE, {});
        const linkedUser = Object.values(users).find(u => u.token === stateData.userToken);
        if (linkedUser) {
          if (!linkedUser.channels) linkedUser.channels = {};
          linkedUser.channels.twitch = twitchLogin;
          linkedUser.channels.twitchDisplayName = twitchDisplayName;
          linkedUser.channels.twitchUserId = twitchUserId;
          linkedUser.channels.twitchAvatar = twitchAvatar;
          linkedUser.channels.twitchTokenEncrypted = encryptToken(accessToken);
          if (refreshToken) {
            linkedUser.channels.twitchRefreshTokenEncrypted = encryptToken(refreshToken);
          }
          users[linkedUser.username] = linkedUser;
          writeJsonFile(USERS_FILE, users);
        }
      }

      res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>Twitch Berhasil Terhubung</title>
          <style>
            body { background: #0b0e17; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: rgba(30, 27, 75, 0.7); border: 1px solid #6366f1; padding: 28px 32px; border-radius: 16px; max-width: 380px; }
            .avatar { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #10b981; margin-bottom: 12px; object-fit: cover; }
            h2 { margin: 0 0 6px 0; color: #a855f7; font-size: 1.3rem; }
            p { margin: 4px 0 16px 0; color: #94a3b8; font-size: 0.85rem; }
            .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <img class="avatar" src="${twitchAvatar}" alt="${twitchDisplayName}">
            <h2>${twitchDisplayName}</h2>
            <span class="badge">✓ Twitch Terhubung</span>
            <p>Channel Points EventSub siap aktif.<br>Jendela ini akan menutup otomatis...</p>
          </div>
          <script>
            const authPayload = {
              type: 'TWITCH_AUTH_SUCCESS',
              twitch: '${twitchLogin}',
              displayName: '${twitchDisplayName}',
              userId: '${twitchUserId}',
              avatar: '${twitchAvatar}',
              token: '${accessToken}'
            };
            if (window.opener) {
              window.opener.postMessage(authPayload, '*');
              setTimeout(() => { window.close(); }, 700);
            } else {
              setTimeout(() => { window.location.href = '/'; }, 1200);
            }
          </script>
        </body>
        </html>
      `);
    } catch (err) {
      console.error('[Twitch OAuth] Callback exception:', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Twitch Auth Error</title></head>
        <body style="background:#0b0e17;color:#f87171;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Terjadi Kesalahan Saat Otentikasi Twitch</h3>
          <p>${err.message}</p>
          <button onclick="window.close()" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Tutup</button>
        </body>
        </html>
      `);
    }
  });

  router.post('/api/user/twitch/disconnect', (req, res) => {
    const users = readJsonFile(USERS_FILE, {});
    const user = getUserFromReq(req, users);
    if (user) {
      const currentUser = users[user.username] || user;
      if (currentUser.channels) {
        currentUser.channels.twitch = '';
        currentUser.channels.twitchDisplayName = '';
        currentUser.channels.twitchUserId = '';
        currentUser.channels.twitchAvatar = '';
        currentUser.channels.twitchTokenEncrypted = '';
        currentUser.channels.twitchRefreshTokenEncrypted = '';
      }
      users[currentUser.username] = currentUser;
      writeJsonFile(USERS_FILE, users);
    }
    res.json({ success: true, message: 'Twitch berhasil diputuskan.' });
  });

  // ==========================================
  // YOUTUBE (GOOGLE) OAUTH 2.0 FLOW
  // ==========================================
  router.get('/auth/youtube', (req, res) => {
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
      return res.status(500).send('YouTube Client ID / Secret belum dikonfigurasi di server.');
    }

    const redirectUri = getYouTubeRedirectUri(req);
    const userToken = req.query.userToken || '';
    const state = crypto.randomBytes(16).toString('hex');

    const now = Date.now();
    for (const [st, val] of youtubeOauthStates.entries()) {
      if (now - val.createdAt > 15 * 60 * 1000) {
        youtubeOauthStates.delete(st);
      }
    }

    youtubeOauthStates.set(state, { userToken, redirectUri, createdAt: now });

    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ];

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(YOUTUBE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&access_type=offline&prompt=consent&state=${state}`;
    res.redirect(authUrl);
  });

  router.get('/auth/youtube/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.warn('[YouTube OAuth] Auth error dari Google:', error, error_description);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>YouTube Auth Gagal</title></head>
        <body style="background:#0b0e17;color:#f87171;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Gagal Menghubungkan Akun YouTube</h3>
          <p>${error_description || error}</p>
          <button onclick="window.close()" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Tutup</button>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'YOUTUBE_AUTH_ERROR', error: '${error}' }, '*');
            }
          </script>
        </body>
        </html>
      `);
    }

    const stateData = youtubeOauthStates.get(state);
    if (!stateData) {
      return res.status(400).send('State token tidak valid atau telah kedaluwarsa. Silakan coba login kembali.');
    }
    youtubeOauthStates.delete(state);

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: stateData.redirectUri
        }).toString(),
        signal: AbortSignal.timeout(6000)
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000)
      });

      if (!ytRes.ok) {
        const errText = await ytRes.text();
        throw new Error(`Gagal mengambil profil YouTube (${ytRes.status}): ${errText}`);
      }

      const ytData = await ytRes.json();
      const channel = ytData.items?.[0];

      if (!channel) {
        throw new Error('Akun Google ini belum memiliki Channel YouTube.');
      }

      const channelId = channel.id;
      const channelTitle = channel.snippet.title;
      const customUrl = channel.snippet.customUrl || '';
      const avatar = channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.medium?.url || '';
      const youtubeTarget = customUrl || channelId || channelTitle;

      if (stateData.userToken) {
        const users = readJsonFile(USERS_FILE, {});
        const linkedUser = Object.values(users).find(u => u.token === stateData.userToken);
        if (linkedUser) {
          if (!linkedUser.channels) linkedUser.channels = {};
          linkedUser.channels.youtube = youtubeTarget;
          linkedUser.channels.youtubeChannelId = channelId;
          linkedUser.channels.youtubeTitle = channelTitle;
          linkedUser.channels.youtubeAvatar = avatar;
          linkedUser.channels.youtubeTokenEncrypted = encryptToken(accessToken);
          if (refreshToken) {
            linkedUser.channels.youtubeRefreshTokenEncrypted = encryptToken(refreshToken);
          }
          users[linkedUser.username] = linkedUser;
          writeJsonFile(USERS_FILE, users);
        }
      }

      res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>YouTube Berhasil Terhubung</title>
          <style>
            body { background: #0b0e17; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: rgba(30, 27, 75, 0.7); border: 1px solid #ef4444; padding: 28px 32px; border-radius: 16px; max-width: 380px; }
            .avatar { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #ef4444; margin-bottom: 12px; object-fit: cover; }
            h2 { margin: 0 0 6px 0; color: #f87171; font-size: 1.3rem; }
            p { margin: 4px 0 16px 0; color: #94a3b8; font-size: 0.85rem; }
            .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <img class="avatar" src="${avatar}" alt="${channelTitle}">
            <h2>${channelTitle}</h2>
            <span class="badge">✓ YouTube Terhubung</span>
            <p>Live stream channel siap dipantau.<br>Jendela ini akan menutup otomatis...</p>
          </div>
          <script>
            const authPayload = {
              type: 'YOUTUBE_AUTH_SUCCESS',
              channelId: '${channelId}',
              title: '${channelTitle.replace(/'/g, "\\'")}',
              customUrl: '${customUrl}',
              target: '${youtubeTarget}',
              avatar: '${avatar}',
              token: '${accessToken}'
            };
            if (window.opener) {
              window.opener.postMessage(authPayload, '*');
              setTimeout(() => { window.close(); }, 700);
            } else {
              setTimeout(() => { window.location.href = '/'; }, 1200);
            }
          </script>
        </body>
        </html>
      `);
    } catch (err) {
      console.error('[YouTube OAuth] Callback exception:', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>YouTube Auth Error</title></head>
        <body style="background:#0b0e17;color:#f87171;font-family:sans-serif;padding:30px;text-align:center;">
          <h3>Terjadi Kesalahan Saat Otentikasi YouTube</h3>
          <p>${err.message}</p>
          <button onclick="window.close()" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;">Tutup</button>
        </body>
        </html>
      `);
    }
  });

  router.post('/api/user/youtube/disconnect', (req, res) => {
    const users = readJsonFile(USERS_FILE, {});
    const user = getUserFromReq(req, users);
    if (user) {
      const currentUser = users[user.username] || user;
      if (currentUser.channels) {
        currentUser.channels.youtube = '';
        currentUser.channels.youtubeTitle = '';
        currentUser.channels.youtubeAvatar = '';
        currentUser.channels.youtubeChannelId = '';
        currentUser.channels.youtubeTokenEncrypted = '';
        currentUser.channels.youtubeRefreshTokenEncrypted = '';
      }
      users[currentUser.username] = currentUser;
      writeJsonFile(USERS_FILE, users);
    }
    res.json({ success: true, message: 'YouTube berhasil diputuskan.' });
  });

  // Account Deletion
  router.delete('/api/user/account', async (req, res) => {
    const users = readJsonFile(USERS_FILE, {});
    const user = getUserFromReq(req, users);
    if (!user) return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk menghapus akun.' });

    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Konfirmasi password diperlukan untuk menghapus akun.' });
    }

    const currentUser = users[user.username];
    if (!currentUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    const passwordValid = await verifyPassword(password, currentUser.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Password konfirmasi salah! Akun tidak dihapus.' });
    }

    const overlays = readJsonFile(OVERLAYS_FILE, {});
    (currentUser.overlayIds || []).forEach(oId => {
      delete overlays[oId];
    });
    writeJsonFile(OVERLAYS_FILE, overlays);

    delete users[user.username];
    writeJsonFile(USERS_FILE, users);

    res.json({
      success: true,
      message: 'Akun Anda beserta seluruh data saluran dan overlay telah dihapus secara permanen dari server StreamPulse.'
    });
  });

  // Admin users management
  router.get('/api/admin/users', (req, res) => {
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

  router.delete('/api/admin/users/:username', (req, res) => {
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

  return router;
}

export default createAuthRouter;
