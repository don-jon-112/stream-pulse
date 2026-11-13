import express from 'express';
import { readJsonFile, writeJsonFile, OVERLAYS_FILE, USERS_FILE, ADMIN_FILE } from '../lib/db.js';
import { checkAdminAuth } from '../lib/adminAuth.js';
import { getUserFromReq } from '../lib/security.js';

const router = express.Router();

let ioInstance = null;
export function setOverlaysIo(io) {
  ioInstance = io;
}


// ==========================================
// OBS OVERLAY PROFILES API
// ==========================================
router.get('/overlays', (req, res) => {
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

router.get('/overlays/:id', (req, res) => {
  const { id } = req.params;
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const profile = overlays[id] || (id === 'default' ? overlays['default'] : null);
  if (profile) {
    const clone = { ...profile };
    if (clone.owner) {
      const users = readJsonFile(USERS_FILE, {});
      const u = users[clone.owner];
      if (u && u.channels) {
        if (!clone.twitch && u.channels.twitch) clone.twitch = u.channels.twitch;
        if (!clone.youtube && u.channels.youtube) clone.youtube = u.channels.youtube;
        if (!clone.tiktok && u.channels.tiktok) clone.tiktok = u.channels.tiktok;
      }
    }
    return res.json(clone);
  }
  res.json({ id, theme: 'glass', fontSize: 15, hideDelay: 0, customCss: '', customJs: '' });
});

router.post('/overlays', (req, res) => {
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  if (!user) {
    return res.status(401).json({ error: 'Akses ditolak: Hanya pengguna yang telah login yang dapat menyimpan konfigurasi overlay OBS.' });
  }

  const data = req.body || {};
  const currentUser = users[user.username] || user;
  if (!currentUser.overlayIds) currentUser.overlayIds = [];

  let id = data.id && /^[a-zA-Z0-9_-]+$/.test(data.id) ? data.id : null;
  const overlays = readJsonFile(OVERLAYS_FILE, {});

  // Jika ID adalah 'default' atau kosong, jangan menimpa slot global 'default'
  if (!id || id === 'default') {
    if (currentUser.overlayIds.length > 0) {
      id = currentUser.overlayIds[0];
    } else {
      id = `ovl_${Math.random().toString(36).substr(2, 7)}`;
    }
  }

  // Keamanan Penjagaan Kepemilikan Slot:
  if (overlays[id]) {
    const isOwner = (overlays[id].owner === currentUser.username) || (currentUser.overlayIds.includes(id));
    if (!isOwner) {
      // Jika id adalah default atau milik akun lain, jangan overwrite milik orang lain/global
      if (currentUser.overlayIds.length > 0) {
        id = currentUser.overlayIds[0];
      } else {
        if (currentUser.overlayIds.length >= 5) {
          return res.status(403).json({
            error: `Akses ditolak: Slot ID "${id}" bukan milik akun Anda dan kuota 5 slot telah penuh.`
          });
        }
        id = `ovl_${Math.random().toString(36).substr(2, 7)}`;
        currentUser.overlayIds.push(id);
        users[user.username] = currentUser;
        writeJsonFile(USERS_FILE, users);
      }
    }
  } else {
    // ID baru yang belum ada di database, verifikasi kuota 5 slot per akun
    if (!currentUser.overlayIds.includes(id)) {
      if (currentUser.overlayIds.length >= 5) {
        return res.status(400).json({ error: 'Batas kuota 5 slot overlay telah tercapai. Anda dapat memilih salah satu slot yang ada untuk di-overwrite atau hapus slot yang tidak digunakan.' });
      }
      currentUser.overlayIds.push(id);
      users[user.username] = currentUser;
      writeJsonFile(USERS_FILE, users);
    }
  }

  const existingName = (overlays[id] && overlays[id].name) ? overlays[id].name : undefined;

  overlays[id] = {
    ...overlays[id],
    ...data,
    id,
    owner: currentUser.username,
    updatedAt: Date.now()
  };

  // Pastikan nama kustom tidak ter-reset menjadi ID atau string kosong saat user menyimpan setting
  if (data.name && String(data.name).trim() && String(data.name).trim() !== id) {
    overlays[id].name = String(data.name).trim();
  } else if (existingName) {
    overlays[id].name = existingName;
  }

  writeJsonFile(OVERLAYS_FILE, overlays);
  if (ioInstance) {
    ioInstance.emit('overlay_updated', { id, overlay: overlays[id] });
  }
  res.json({ success: true, id, overlay: overlays[id], overlayIds: currentUser.overlayIds });
});

// ==========================================
// USER OVERLAY SLOT MANAGEMENT
// ==========================================
router.post('/user/overlays/generate', (req, res) => {
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  if (!user) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk membuat overlay baru.' });
  }

  const currentUser = users[user.username] || user;
  if (!currentUser.overlayIds) currentUser.overlayIds = [];

  if (currentUser.overlayIds.length >= 5) {
    return res.status(400).json({
      error: 'Batas kuota 5 Overlay per akun telah tercapai! Anda dapat mengedit salah satu dari 5 overlay yang ada atau menghapusnya untuk membuat yang baru.'
    });
  }

  const newId = `ovl_${Math.random().toString(36).substr(2, 7)}`;
  const overlays = readJsonFile(OVERLAYS_FILE, {});
  overlays[newId] = {
    id: newId,
    name: newId,
    owner: currentUser.username,
    theme: 'glass',
    chatDirection: 'bottom',
    chatFade: 'none',
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
    maxLimit: 5
  });
});

router.post('/user/overlays/claim', (req, res) => {
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
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
    const currentUser = users[user.username] || user;
    if (overlays[targetId].owner && overlays[targetId].owner !== currentUser.username) {
      return res.status(403).json({ error: 'Akses ditolak: Slot ID ini sudah terdaftar sebagai milik akun lain.' });
    }
    if (!currentUser.overlayIds) currentUser.overlayIds = [];
    if (!currentUser.overlayIds.includes(targetId)) {
      if (currentUser.overlayIds.length >= 5) {
        return res.status(400).json({
          error: 'Slot overlay Anda penuh (maksimal 5). Hapus salah satu terlebih dahulu untuk menautkan ID ini.'
        });
      }
      currentUser.overlayIds.push(targetId);
      users[currentUser.username] = currentUser;
      writeJsonFile(USERS_FILE, users);
    }
  }

  res.json({ success: true, id: targetId, overlay: overlays[targetId] });
});

router.delete('/user/overlays/:id', (req, res) => {
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  const { id } = req.params;

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

router.patch('/user/overlays/:id/rename', (req, res) => {
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  const { id } = req.params;
  const { name } = req.body || {};

  const overlays = readJsonFile(OVERLAYS_FILE, {});
  if (!overlays[id] || (overlays[id].owner && overlays[id].owner !== user.username)) {
    return res.status(404).json({ error: 'Slot overlay tidak ditemukan atau bukan milik Anda' });
  }

  overlays[id].name = String(name || '').trim();
  overlays[id].updatedAt = Date.now();
  writeJsonFile(OVERLAYS_FILE, overlays);

  res.json({ success: true, id, name: overlays[id].name, overlay: overlays[id] });
});

router.post('/user/overlays/duplicate', (req, res) => {
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  if (!user) return res.status(401).json({ error: 'Silakan login terlebih dahulu untuk menduplikat overlay.' });

  const { sourceId } = req.body || {};
  if (!sourceId) return res.status(400).json({ error: 'Source ID overlay wajib disertakan.' });

  const currentUser = users[user.username] || user;
  if (!currentUser.overlayIds) currentUser.overlayIds = [];

  if (currentUser.overlayIds.length >= 5) {
    return res.status(400).json({
      error: 'Batas kuota 5 Overlay per akun telah tercapai! Hapus salah satu slot terlebih dahulu untuk menduplikat.'
    });
  }

  const overlays = readJsonFile(OVERLAYS_FILE, {});
  const sourceOverlay = overlays[sourceId] || overlays['default'] || {};

  const newId = `ovl_${Math.random().toString(36).substr(2, 7)}`;
  const sourceName = sourceOverlay.name || sourceId;
  const newName = `${sourceName} (Copy)`;

  overlays[newId] = {
    ...sourceOverlay,
    id: newId,
    name: newName,
    owner: currentUser.username,
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
    maxLimit: 5
  });
});

// Admin overlay inspection
router.get('/admin/all-overlays', (req, res) => {
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

router.delete('/admin/overlays/:id', (req, res) => {
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
  res.json({ success: true, deletedOverlay: id });
});

export default router;
