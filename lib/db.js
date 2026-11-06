import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Database Paths
export const FEEDBACK_FILE = path.join(rootDir, 'data', 'feedback.json');
export const OVERLAYS_FILE = path.join(rootDir, 'data', 'overlays.json');
export const ADMIN_FILE = path.join(rootDir, 'data', 'admin.json');
export const USERS_FILE = path.join(rootDir, 'data', 'users.json');
export const SOCIAL_ROTATOR_FILE = path.join(rootDir, 'data', 'social_rotator.json');

export function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`[DB] Error reading ${filePath}:`, e.message);
  }
  return defaultValue;
}

export function writeJsonFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[DB] Error writing ${filePath}:`, e.message);
  }
}

// Inisialisasi default database files jika belum ada
export function initDefaultDataFiles() {
  const defaultOverlays = {
    "default": {
      "id": "default",
      "name": "Default Simple Overlay",
      "twitch": "",
      "youtube": "",
      "tiktok": "",
      "theme": "simple",
      "chatDirection": "bottom",
      "chatFade": "none",
      "fontSize": 15,
      "hideDelay": 0,
      "showBadges": true,
      "showAvatars": true,
      "showAlerts": true,
      "showEmotes": true,
      "customCss": "/* Kustomisasi CSS untuk OBS Overlay Anda */\n.overlay-chat-item {\n  /* margin-bottom: 8px; */\n}\n.overlay-chat-text {\n  /* font-weight: 500; */\n}",
      "customJs": "// Skrip JS kustom (opsional)",
      "createdAt": 1728560000000,
      "updatedAt": 1728560000000
    }
  };

  if (!fs.existsSync(OVERLAYS_FILE)) {
    writeJsonFile(OVERLAYS_FILE, defaultOverlays);
  }
  if (!fs.existsSync(FEEDBACK_FILE)) {
    writeJsonFile(FEEDBACK_FILE, []);
  }
  if (!fs.existsSync(USERS_FILE)) {
    writeJsonFile(USERS_FILE, {});
  }
  if (!fs.existsSync(SOCIAL_ROTATOR_FILE)) {
    const defaultSocialRotator = {
      "default": {
        "id": "default",
        "theme": "glass",
        "animation": "slide-up",
        "duration": 6,
        "pauseInterval": 0,
        "scale": "md",
        "layout": "badge",
        "sound": false,
        "randomize": false,
        "items": [
          { "id": "1", "platform": "tiktok", "handle": "@streampulse", "label": "Follow TikTok", "enabled": true },
          { "id": "2", "platform": "youtube", "handle": "StreamPulseTV", "label": "Subscribe YouTube", "enabled": true },
          { "id": "3", "platform": "instagram", "handle": "@streampulse.live", "label": "Follow Instagram", "enabled": true },
          { "id": "4", "platform": "discord", "handle": "discord.gg/streampulse", "label": "Join Discord", "enabled": true },
          { "id": "5", "platform": "twitch", "handle": "streampulse_live", "label": "Follow Twitch", "enabled": true }
        ],
        "updatedAt": 1728560000000
      }
    };
    writeJsonFile(SOCIAL_ROTATOR_FILE, defaultSocialRotator);
  }
}
