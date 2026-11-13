import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let argon2 = null;
try {
  const a2 = await import('@node-rs/argon2');
  argon2 = a2.default || a2;
} catch (_) {}

let nodemailer = null;
try {
  const nm = await import('nodemailer');
  nodemailer = nm.default || nm;
} catch (_) {}

// Kunci enkripsi: ENCRYPTION_SECRET dari .env. Jika kosong, dibuat acak sekali per-instalasi
// dan disimpan di data/.enc_key (tidak ada lagi kunci default yang sama untuk semua orang).
function resolveEncryptionSecret() {
  if (process.env.ENCRYPTION_SECRET) return process.env.ENCRYPTION_SECRET;
  const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const keyFile = path.join(dataDir, '.enc_key');
  try {
    if (fs.existsSync(keyFile)) {
      const saved = fs.readFileSync(keyFile, 'utf8').trim();
      if (saved) return saved;
    }
    fs.mkdirSync(dataDir, { recursive: true });
    const fresh = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyFile, fresh, { mode: 0o600 });
    console.warn('[Security] ENCRYPTION_SECRET belum diisi di .env — memakai kunci acak di data/.enc_key. Isi ENCRYPTION_SECRET untuk produksi.');
    return fresh;
  } catch (e) {
    throw new Error('ENCRYPTION_SECRET wajib diisi di .env (gagal membuat kunci otomatis: ' + e.message + ')');
  }
}
const ENCRYPTION_KEY = crypto.createHash('sha256').update(resolveEncryptionSecret()).digest(); // 32 bytes

export function isLegacyPasswordFormat(storedHash) {
  return typeof storedHash === 'string' && !storedHash.startsWith('$argon2') && !storedHash.startsWith('scrypt$');
}

export async function hashPassword(plainPassword) {
  try {
    if (argon2) {
      return await argon2.hash(String(plainPassword));
    }
  } catch (err) {}
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export async function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !plainPassword) return false;
  if (storedHash.startsWith('$argon2') && argon2) {
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
  // Format lama (plaintext): bandingkan waktu-konstan; login akan otomatis me-rehash.
  const a = crypto.createHash('sha256').update(String(storedHash)).digest();
  const b = crypto.createHash('sha256').update(String(plainPassword)).digest();
  return crypto.timingSafeEqual(a, b);
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

// In-Memory Rate Limiting & Verification Code Store (dengan pembersihan TTL otomatis berkala)
// --- TikTok Session ID: disimpan terenkripsi (sama seperti token Twitch) ---
export function getUserTikTokSessionId(user) {
  const c = user?.channels || {};
  if (c.tiktokSessionIdEncrypted) return String(decryptToken(c.tiktokSessionIdEncrypted) || '').trim();
  return String(c.tiktokSessionId || '').trim(); // data lama (plaintext) sebelum migrasi
}

export function setUserTikTokSessionId(user, value) {
  if (!user.channels) user.channels = {};
  const clean = String(value || '').trim();
  user.channels.tiktokSessionIdEncrypted = clean ? encryptToken(clean) : '';
  delete user.channels.tiktokSessionId;
}

// Enkripsi otomatis sessionId plaintext yang masih tersimpan dari versi lama.
export function migrateUserSecrets(dbModule) {
  try {
    const { readJsonFile, writeJsonFile, USERS_FILE } = dbModule;
    const users = readJsonFile(USERS_FILE, {});
    let changed = 0;
    for (const u of Object.values(users)) {
      if (u?.channels?.tiktokSessionId && !u.channels.tiktokSessionIdEncrypted) {
        setUserTikTokSessionId(u, u.channels.tiktokSessionId);
        changed++;
      }
    }
    if (changed) {
      writeJsonFile(USERS_FILE, users);
      console.log(`[Security] ${changed} TikTok Session ID lama dienkripsi.`);
    }
  } catch (e) {
    console.warn('[Security] Migrasi secret gagal:', e.message);
  }
}

export const verificationStore = new Map(); // email -> { code, expiresAt }
export const rateLimitStore = new Map(); // key -> { count, resetAt }

// Bersihkan entri kedaluwarsa secara berkala setiap 10 menit agar memori server tidak bocor
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationStore.entries()) {
    if (data?.expiresAt && now > data.expiresAt) {
      verificationStore.delete(email);
    }
  }
  for (const [key, data] of rateLimitStore.entries()) {
    if (data?.resetAt && now > data.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

export function isRateLimited(key, maxAttempts) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry) return { allowed: true };
  if (now > entry.resetAt) {
    rateLimitStore.delete(key);
    return { allowed: true };
  }
  if (entry.count >= maxAttempts) {
    const waitHours = Math.ceil((entry.resetAt - now) / 3600000);
    const waitMinutes = Math.ceil((entry.resetAt - now) / 60000);
    return {
      allowed: false,
      waitTime: waitHours > 1 ? `${waitHours} jam` : `${waitMinutes} menit`
    };
  }
  return { allowed: true, remaining: maxAttempts - entry.count };
}

export function recordFailedAttempt(key, maxAttempts, windowMs) {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
  } else {
    entry.count++;
  }
  rateLimitStore.set(key, entry);
}

export function checkRateLimit(key, maxAttempts, windowMs) {
  const check = isRateLimited(key, maxAttempts);
  if (!check.allowed) return check;
  recordFailedAttempt(key, maxAttempts, windowMs);
  return check;
}

// Mail Transporter Setup (Lazy initialization to ensure process.env is fully loaded)
let mailTransporter = null;
function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (!process.env.SMTP_HOST || !nodemailer) return null;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return mailTransporter;
}

export async function sendVerificationEmail(email, code) {
  const transporter = getMailTransporter();
  if (transporter && process.env.SMTP_USER) {
    try {
      console.log(`[SMTP] Mengirim email verifikasi ke ${email} via ${process.env.SMTP_HOST}...`);
      await transporter.sendMail({
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
      console.log(`[SMTP] Sukses! Email verifikasi terkirim ke ${email}`);
      return true;
    } catch (e) {
      console.error(`[SMTP] GAGAL mengirim email ke ${email}:`, e.message);
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

export function getUserFromReq(req, usersData) {
  const token = (req.headers['x-user-token'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return Object.values(usersData || {}).find(u => u.token === token) || null;
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'sea3yunko17ptmjkwf98imtypufch4';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

export async function refreshTwitchToken(usernameOrChannel, dbModule) {
  if (!usernameOrChannel) return null;
  if (!TWITCH_CLIENT_SECRET) {
    console.warn('[Twitch Token Refresh] TWITCH_CLIENT_SECRET belum diisi di .env');
    return null;
  }
  const cleanTarget = String(usernameOrChannel).trim().toLowerCase().replace(/^[#@]/, '');
  const { readJsonFile, writeJsonFile, USERS_FILE } = dbModule;
  const users = readJsonFile(USERS_FILE, {});

  const user = Object.values(users).find(u => {
    const twitchCh = (u.channels?.twitch || '').toLowerCase().replace(/^[#@]/, '');
    const uname = (u.username || '').toLowerCase();
    return twitchCh === cleanTarget || uname === cleanTarget;
  });

  if (!user || !user.channels?.twitchRefreshTokenEncrypted) {
    return null;
  }

  const refreshToken = decryptToken(user.channels.twitchRefreshTokenEncrypted);
  if (!refreshToken) {
    return null;
  }

  try {
    console.log(`[Twitch Token Refresh] 🔄 Memperbarui access token Twitch untuk "${user.username}" (#${user.channels.twitch || cleanTarget})...`);
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString(),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Twitch Token Refresh] ❌ Refresh gagal (${res.status}):`, errText);
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    user.channels.twitchTokenEncrypted = encryptToken(newAccessToken);
    if (newRefreshToken) {
      user.channels.twitchRefreshTokenEncrypted = encryptToken(newRefreshToken);
    }
    users[user.username] = user;
    writeJsonFile(USERS_FILE, users);

    console.log(`[Twitch Token Refresh] ✅ Token Twitch berhasil diperbarui otomatis tanpa relogin! (#${user.channels.twitch})`);
    return newAccessToken;
  } catch (err) {
    console.error(`[Twitch Token Refresh] Exception:`, err.message);
    return null;
  }
}
