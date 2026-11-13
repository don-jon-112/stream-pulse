import crypto from 'crypto';
import { readJsonFile, ADMIN_FILE } from './db.js';

// Satu-satunya sumber autentikasi admin (sebelumnya disalin di 3 file).
// Prioritas password: data/admin.json (hasil "ganti password") -> ADMIN_PASSWORD di .env.
// Tidak ada password default: bila keduanya kosong, semua akses admin ditolak.

let warned = false;

export function getAdminPassword() {
  const adminData = readJsonFile(ADMIN_FILE, null);
  if (adminData && adminData.password) return String(adminData.password);
  if (process.env.ADMIN_PASSWORD) return String(process.env.ADMIN_PASSWORD);
  if (!warned) {
    warned = true;
    console.warn('[Security] ADMIN_PASSWORD belum diisi di .env — akses admin dinonaktifkan.');
  }
  return '';
}

// Perbandingan waktu-konstan (hash dulu agar panjang sama).
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkAdminPassword(candidate) {
  const current = getAdminPassword();
  if (!current || !candidate) return false;
  return safeEqual(candidate, current);
}

export function checkAdminAuth(req) {
  const token = (req.headers['x-admin-key'] || req.headers['authorization'] || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  return checkAdminPassword(token);
}
