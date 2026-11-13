import express from 'express';
import { readJsonFile, writeJsonFile, FEEDBACK_FILE, ADMIN_FILE } from '../lib/db.js';
import { checkAdminAuth, checkAdminPassword } from '../lib/adminAuth.js';
import { isRateLimited, recordFailedAttempt, rateLimitStore } from '../lib/security.js';

const router = express.Router();


function sanitizeFeedbackList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(x => {
    if (!x || !x.title || !x.description) return false;
    const t = String(x.title).toLowerCase();
    const d = String(x.description).toLowerCase();
    // Bersihkan probe bot scanner (ZEN_STORAGE, bot injection, session dump)
    if (t.includes('zen_storage') || d.includes('zen_storage') || d.includes('"origin":') || d.includes('"href":') || d.includes('"ls":{}')) {
      return false;
    }
    return true;
  });
}

// Auto-purge spam saat module dimuat
try {
  const currentList = readJsonFile(FEEDBACK_FILE, []);
  const sanitized = sanitizeFeedbackList(currentList);
  if (sanitized.length !== currentList.length) {
    writeJsonFile(FEEDBACK_FILE, sanitized);
  }
} catch (_) {}

// ==========================================
// PUBLIC FEATURE REQUESTS
// ==========================================
router.get('/feedback', (req, res) => {
  let list = readJsonFile(FEEDBACK_FILE, []);
  const cleanList = sanitizeFeedbackList(list);
  if (cleanList.length !== list.length) {
    writeJsonFile(FEEDBACK_FILE, cleanList);
    list = cleanList;
  }
  // Sembunyikan item yang di-reject dari publik, prioritaskan pinned
  const publicList = list.filter(x => x.status !== 'rejected');
  publicList.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.upvotes || 0) - (a.upvotes || 0) || b.createdAt - a.createdAt);
  res.json(publicList);
});

router.post('/feedback', (req, res) => {
  // Pengajuan usulan ide publik telah dinonaktifkan untuk mencegah bot/crawler spam
  return res.status(403).json({ error: 'Pengajuan usulan ide publik telah dinonaktifkan.' });
});

router.post('/feedback/:id/upvote', (req, res) => {
  const { id } = req.params;
  const list = readJsonFile(FEEDBACK_FILE, []);
  const item = list.find(x => x.id === id);
  if (!item) return res.status(404).json({ error: 'Request tidak ditemukan' });

  item.upvotes = (item.upvotes || 0) + 1;
  writeJsonFile(FEEDBACK_FILE, list);
  res.json({ success: true, upvotes: item.upvotes });
});

router.patch('/feedback/:id/status', (req, res) => {
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
router.post('/admin/login', (req, res) => {
  const { password } = req.body || {};
  const rlKey = `admin_login_${req.ip || req.socket.remoteAddress || 'ip'}`;
  const limit = isRateLimited(rlKey, 5);
  if (!limit.allowed) {
    return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${limit.waitTime}.` });
  }
  if (checkAdminPassword(password)) {
    rateLimitStore.delete(rlKey);
    return res.json({ success: true, token: String(password) });
  }
  recordFailedAttempt(rlKey, 5, 15 * 60 * 1000);
  return res.status(401).json({ error: 'Password Admin salah! Silakan coba lagi.' });
});

router.post('/admin/change-password', (req, res) => {
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

router.get('/admin/feedback', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  let list = readJsonFile(FEEDBACK_FILE, []);
  const cleanList = sanitizeFeedbackList(list);
  if (cleanList.length !== list.length) {
    writeJsonFile(FEEDBACK_FILE, cleanList);
    list = cleanList;
  }
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.upvotes || 0) - (a.upvotes || 0) || b.createdAt - a.createdAt);
  res.json(list);
});

router.patch('/admin/feedback/:id', (req, res) => {
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

router.delete('/admin/feedback/:id', (req, res) => {
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

router.post('/admin/feedback', (req, res) => {
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

router.get('/admin/system-stats', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Akses ditolak: Diperlukan autentikasi admin' });
  }
  const mem = process.memoryUsage();
  res.json({
    uptime: Math.floor(process.uptime()),
    ramRssMb: Math.round(mem.rss / 1024 / 1024),
    ramHeapMb: Math.round(mem.heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    platform: process.platform,
    port: process.env.PORT || 3000
  });
});

export default router;

