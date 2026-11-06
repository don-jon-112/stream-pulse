import express from 'express';
import { readJsonFile, writeJsonFile, SOCIAL_ROTATOR_FILE, USERS_FILE } from '../lib/db.js';
import { getUserFromReq } from '../lib/security.js';

const router = express.Router();

router.get('/social-rotator/config', (req, res) => {
  const rotators = readJsonFile(SOCIAL_ROTATOR_FILE, {});
  const id = (req.query.id || '').trim();
  const token = (req.query.token || '').trim();
  const username = (req.query.user || req.query.username || '').trim().toLowerCase();

  // 1. Match by profile ID
  if (id && rotators[id]) {
    return res.json({ success: true, id, config: rotators[id] });
  }

  // 2. Match by user token or username
  if (token || username) {
    const users = readJsonFile(USERS_FILE, {});
    let matchedUser = null;
    if (token) matchedUser = Object.values(users).find(u => u.token === token);
    if (!matchedUser && username) matchedUser = Object.values(users).find(u => (u.username || '').toLowerCase() === username);

    if (matchedUser && matchedUser.socialRotatorId && rotators[matchedUser.socialRotatorId]) {
      return res.json({ success: true, id: matchedUser.socialRotatorId, config: rotators[matchedUser.socialRotatorId] });
    }
  }

  // 3. Fallback to default
  const defaultConfig = rotators['default'] || {
    theme: 'glass',
    animation: 'slide-up',
    duration: 6,
    pauseInterval: 0,
    scale: 'md',
    layout: 'badge',
    sound: false,
    randomize: false,
    items: [
      { id: '1', platform: 'tiktok', handle: '@streampulse', label: 'Follow TikTok', enabled: true },
      { id: '2', platform: 'youtube', handle: 'StreamPulseTV', label: 'Subscribe YouTube', enabled: true },
      { id: '3', platform: 'instagram', handle: '@streampulse.live', label: 'Follow Instagram', enabled: true },
      { id: '4', platform: 'discord', handle: 'discord.gg/streampulse', label: 'Join Discord', enabled: true },
      { id: '5', platform: 'twitch', handle: 'streampulse_live', label: 'Follow Twitch', enabled: true }
    ],
    updatedAt: Date.now()
  };

  res.json({ success: true, id: 'default', config: defaultConfig });
});

router.post('/social-rotator/config', (req, res) => {
  const rotators = readJsonFile(SOCIAL_ROTATOR_FILE, {});
  const users = readJsonFile(USERS_FILE, {});
  const user = getUserFromReq(req, users);
  let id = (req.body.id || '').trim();

  if (!id || id === 'default') {
    if (user && user.socialRotatorId) {
      id = user.socialRotatorId;
    } else {
      id = `soc_${Math.random().toString(36).substr(2, 8)}`;
    }
  }

  const config = {
    id,
    theme: req.body.theme || 'glass',
    animation: req.body.animation || 'slide-up',
    duration: Number(req.body.duration) || 6,
    pauseInterval: Number(req.body.pauseInterval) || 0,
    scale: req.body.scale || 'md',
    layout: req.body.layout || 'badge',
    sound: Boolean(req.body.sound),
    randomize: Boolean(req.body.randomize),
    items: Array.isArray(req.body.items) ? req.body.items : [],
    updatedAt: Date.now()
  };

  rotators[id] = config;
  writeJsonFile(SOCIAL_ROTATOR_FILE, rotators);

  if (user) {
    const currentUser = users[user.username] || user;
    currentUser.socialRotatorId = id;
    users[user.username] = currentUser;
    writeJsonFile(USERS_FILE, users);
  }

  res.json({ success: true, id, config });
});

export default router;
