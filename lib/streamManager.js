// Polyfill zlib & worker_threads for Node.js < 22 (fixes Undici v7/v8 crashes on Node 18/20)
import { createRequire as _smCreateRequire } from 'node:module';
try {
  const _smReq = _smCreateRequire(import.meta.url);
  for (const modName of ['node:worker_threads', 'worker_threads']) {
    try {
      const _wt = _smReq(modName);
      if (_wt && !_wt.markAsUncloneable) {
        _wt.markAsUncloneable = function(obj) { return obj; };
      }
    } catch (_) {}
  }
  for (const modName of ['node:zlib', 'zlib']) {
    try {
      const _zlib = _smReq(modName);
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
import tmi from 'tmi.js';
import { LiveChat } from 'youtube-chat';
import axios from 'axios';
let TikTokLiveClient = null;
let fetchTikTokRoomInfo = null;
let checkTikTokOnline = null;
let PirateEventType = { connected: 'connected', chat: 'chat', gift: 'gift', like: 'like', disconnected: 'disconnected' };
let PirateHostNotOnlineError = class HostNotOnlineError extends Error {};
try {
  const pirateModule = await import('piratetok-live-js');
  TikTokLiveClient = pirateModule.TikTokLiveClient;
  if (pirateModule.fetchRoomInfo) fetchTikTokRoomInfo = pirateModule.fetchRoomInfo;
  if (pirateModule.checkOnline) checkTikTokOnline = pirateModule.checkOnline;
  if (pirateModule.EventType) PirateEventType = pirateModule.EventType;
  if (pirateModule.HostNotOnlineError) PirateHostNotOnlineError = pirateModule.HostNotOnlineError;
} catch (e) {
  console.warn('[StreamManager] Native PirateTok engine tidak aktif di Node version ini:', e.message);
}


// Global dynamic cache dan session store TikTok (bounded to prevent memory leak)
globalThis._tiktokRoomIdCache = globalThis._tiktokRoomIdCache || new Map();
globalThis._activeTikTokSessionId = globalThis._activeTikTokSessionId || process.env.TIKTOK_SESSION_ID || '';

// Auto-reconnect TikTok: jeda bertahap (ms). Tidak ada polling saat channel offline;
// retry hanya dipakai saat koneksi putus/gagal tak terduga.
const TIKTOK_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000, 180000];
const TIKTOK_MAX_RETRIES = TIKTOK_RETRY_DELAYS_MS.length;

function setTikTokRoomIdCache(username, data) {
  if (!username) return;
  const clean = parseTikTokInput(username);
  if (globalThis._tiktokRoomIdCache.size >= 500) {
    const oldest = globalThis._tiktokRoomIdCache.keys().next().value;
    if (oldest) globalThis._tiktokRoomIdCache.delete(oldest);
  }
  globalThis._tiktokRoomIdCache.set(String(username).toLowerCase(), data);
  if (clean) globalThis._tiktokRoomIdCache.set(String(clean).toLowerCase(), data);
}

function clearTikTokRoomIdCache(username) {
  if (!username) return;
  const clean = parseTikTokInput(username);
  globalThis._tiktokRoomIdCache.delete(String(username).toLowerCase());
  if (clean) globalThis._tiktokRoomIdCache.delete(String(clean).toLowerCase());
  console.log(`[TikTok Cache] Cache Room ID untuk @${clean || username} dibersihkan.`);
}

// Global fetch hook untuk menyuntikkan Cookie TIKTOK_SESSION_ID ke request internal TikTok & bypass 403
const _nativeGlobalFetch = globalThis.fetch;
globalThis.fetch = async function(url, init = {}) {
  const urlStr = String(url);
  if (urlStr.includes('tiktok.com/api-live/user/room')) {
    // 1. Ekstrak uniqueId dari parameter URL
    let uniqueId = '';
    try {
      const u = new URL(urlStr);
      uniqueId = (u.searchParams.get('uniqueId') || '').trim();
    } catch (e) {
      const match = urlStr.match(/uniqueId=([^&]+)/);
      if (match) uniqueId = decodeURIComponent(match[1]).trim();
    }

    // 2. Jika uniqueId sudah berbentuk Room ID numerik murni (15-22 digit)
    if (uniqueId && /^\d{15,22}$/.test(uniqueId)) {
      const mockPayload = {
        statusCode: 0,
        data: {
          user: { roomId: uniqueId, status: 2, id: uniqueId },
          liveRoom: { status: 2, roomId: uniqueId }
        }
      };
      return new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Siapkan headers lengkap menyerupai browser Chrome asli
    const headers = new Headers(init.headers || {});
    const sId = (globalThis._activeTikTokSessionId || process.env.TIKTOK_SESSION_ID || '').trim();
    if (sId) {
      const existingCookie = headers.get('Cookie') || '';
      if (!existingCookie.includes('sessionid=')) {
        headers.set('Cookie', existingCookie ? `${existingCookie}; sessionid=${sId}; sessionid_ss=${sId}; sid_tt=${sId}` : `sessionid=${sId}; sessionid_ss=${sId}; sid_tt=${sId}`);
      }
    }
    if (!headers.has('Referer')) headers.set('Referer', uniqueId ? `https://www.tiktok.com/@${uniqueId}/live` : 'https://www.tiktok.com/');
    if (!headers.has('User-Agent')) headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    if (!headers.has('Accept')) headers.set('Accept', 'application/json, text/plain, */*');
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7');

    let resp = await _nativeGlobalFetch(url, { ...init, headers });

    // 4. Jika response sukses 200, periksa dan perbarui cache dengan Room ID yang benar-benar aktif saat ini
    if (resp.ok && uniqueId) {
      try {
        const cloned = resp.clone();
        const json = await cloned.json();
        const liveRoomId = json?.data?.liveRoom?.roomId || json?.data?.user?.roomId;
        const liveStatus = json?.data?.liveRoom?.status ?? json?.data?.user?.status;
        if (liveRoomId && (liveStatus === 2 || !liveStatus)) {
          setTikTokRoomIdCache(uniqueId, { roomId: String(liveRoomId), timestamp: Date.now() });
        } else if (liveStatus === 4) {
          clearTikTokRoomIdCache(uniqueId);
        }
      } catch (e) {}
      return resp;
    }

    // 5. Fallback cerdas: Jika response diblokir (403/429) dan kita punya username, coba scrape halaman HTML secara langsung
    if ((resp.status === 403 || resp.status === 429) && uniqueId) {
      try {
        const htmlResp = await _nativeGlobalFetch(`https://www.tiktok.com/@${encodeURIComponent(uniqueId)}/live`, {
          headers: {
            ...(sId ? { 'Cookie': `sessionid=${sId}; sessionid_ss=${sId}; sid_tt=${sId}` } : {}),
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          const roomMatch = html.match(/"roomId"\s*:\s*"(\d{15,22})"/i) || 
                            html.match(/room[_-]?id["']?\s*[:=]\s*["']?(\d{15,22})/i) ||
                            html.match(/"room_id"\s*:\s*"(\d{15,22})"/i);
          if (roomMatch && roomMatch[1]) {
            const foundRoomId = roomMatch[1];
            setTikTokRoomIdCache(uniqueId, { roomId: foundRoomId, timestamp: Date.now() });
            const mockPayload = {
              statusCode: 0,
              data: {
                user: { roomId: foundRoomId, status: 2, id: foundRoomId },
                liveRoom: { status: 2, roomId: foundRoomId }
              }
            };
            return new Response(JSON.stringify(mockPayload), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (fallbackErr) {}
    }

    // 6. Last-resort fallback: HANYA jika TikTok memblokir (403/429) DAN scraping HTML gagal,
    // gunakan cache yang usianya masih sangat baru (< 2 menit) untuk toleransi transient network error
    if (uniqueId && globalThis._tiktokRoomIdCache.has(uniqueId)) {
      const cached = globalThis._tiktokRoomIdCache.get(uniqueId);
      if (cached && cached.roomId && (Date.now() - cached.timestamp < 120000)) { // Maksimal 2 menit
        const mockPayload = {
          statusCode: 0,
          data: {
            user: { roomId: cached.roomId, status: 2, id: cached.roomId },
            liveRoom: { status: 2, roomId: cached.roomId }
          }
        };
        return new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return resp;
  }
  return _nativeGlobalFetch(url, init);
};
import WebSocket from 'ws';
import { emoteManager } from './emoteManager.js';

// Konfigurasi default axios dengan Browser User-Agent nyata agar tidak diblokir YouTube (HTTP 503 Bot Protection)
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
axios.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.9,id;q=0.8';
axios.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';



/**
 * Helper fleksibel untuk mengekstrak username atau room ID dari berbagai format input pengguna:
 * - Username murni: "jooo_nathan" atau "@jooo_nathan"
 * - Full URL: "https://www.tiktok.com/@jooo_nathan" atau "https://www.tiktok.com/@jooo_nathan/live"
 * - Full URL dengan room_id: "https://www.tiktok.com/@jooo_nathan/live?room_id=7412345678901234567"
 * - Direct Live URL: "https://www.tiktok.com/live/7412345678901234567"
 * - Mobile / Webcast URL: "https://m.tiktok.com/v/7412345678901234567.html"
 * - Room ID numerik: "7412345678901234567"
 */
export function parseTikTokInput(input) {
  if (!input) return '';
  let str = String(input).trim();
  if (/^\d{15,22}$/.test(str)) return str;
  const queryRoomMatch = str.match(/room_id=(\d{15,22})/);
  if (queryRoomMatch) return queryRoomMatch[1];
  const pathRoomMatch = str.match(/(?:\/live\/|\/room\/|\/v\/)(\d{15,22})/);
  if (pathRoomMatch) return pathRoomMatch[1];
  const userUrlMatch = str.match(/tiktok\.com\/@([a-zA-Z0-9_\.]{2,30})/i);
  if (userUrlMatch) return userUrlMatch[1].toLowerCase();
  str = str.replace(/^@/, '').split('?')[0].split('#')[0].replace(/\/$/, '').trim();
  return str.toLowerCase();
}

export class StreamManager {
  parseTikTokInput(input) {
    return parseTikTokInput(input);
  }

  constructor(io) {
    this.io = io;

    // Multi-User Connection Pools:
    // channel -> { client, listeners: Set<socketId>, status, emotes, ... }
    this.twitchPool = new Map();
    this.youtubePool = new Map();
    this.tiktokPool = new Map();

    // Client Sessions: socketId -> { twitch, twitchToken, youtube, tiktok }
    this.clientSessions = new Map();

    this.tokenRefreshHandler = null;
    this.processedEvents = new Map();
    this.processedRedeems = new Map();
    this.processedChats = new Map();
    this.twitchAvatars = new Map();
    this.globalTwitchBadges = new Map();
    this.channelTwitchBadges = new Map();
    this.eventHistory = [];
    this.tiktokTopGifters = new Map();
    this.tiktokTopLikes = new Map();

    // Inisialisasi global Twitch badges & viewer count poller saat server boot
    this.twitchAppToken = null;
    this.twitchAppTokenExpires = 0;
    this.initGlobalTwitchBadges();
    this.viewerPollerInterval = null;
    this.startViewerCountPoller();
  }

  setTwitchAvatarCache(key, url) {
    if (!key || !url) return;
    if (this.twitchAvatars.size >= 1000) {
      const oldest = this.twitchAvatars.keys().next().value;
      if (oldest) this.twitchAvatars.delete(oldest);
    }
    this.twitchAvatars.set(key, url);
  }

  setTokenRefreshHandler(fn) {
    this.tokenRefreshHandler = fn;
  }

  isDuplicateEvent(key) {
    if (!key) return false;
    const now = Date.now();
    for (const [k, time] of this.processedEvents.entries()) {
      if (now - time > 60000) {
        this.processedEvents.delete(k);
      }
    }
    if (this.processedEvents.has(key)) return true;
    this.processedEvents.set(key, now);
    return false;
  }

  async initGlobalTwitchBadges() {
    if (this.globalTwitchBadges.size > 0) return;

    // 1. Coba Official Twitch Helix API terlebih dahulu
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const token = await this.getTwitchAppToken();
      if (clientId && token) {
        const res = await fetch('https://api.twitch.tv/helix/chat/badges/global', {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const data = await res.json();
          for (const set of data?.data || []) {
            for (const ver of set.versions || []) {
              this.globalTwitchBadges.set(`${set.set_id}/${ver.id}`, {
                id: set.set_id,
                version: ver.id,
                url: ver.image_url_1x || ver.image_url_2x || ver.image_url_4x,
                title: ver.title || set.set_id
              });
            }
          }
          if (this.globalTwitchBadges.size > 0) {
            console.log(`[Badges] Global Twitch badges loaded via Helix: ${this.globalTwitchBadges.size} badges.`);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[Badges] Helix global badges warning, trying fallback:', e.message);
    }

    // 2. Fallback ke IVR API jika Helix gagal
    try {
      const res = await fetch('https://api.ivr.fi/v2/twitch/badges/global', {
        headers: { 'User-Agent': 'StreamPulse/1.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const set of data) {
            for (const ver of set.versions || []) {
              this.globalTwitchBadges.set(`${set.set_id}/${ver.id}`, {
                id: set.set_id,
                version: ver.id,
                url: ver.image_url_1x || ver.image_url_2x || ver.image_url_4x,
                title: ver.title || set.set_id
              });
            }
          }
          console.log(`[Badges] Global Twitch badges loaded via IVR: ${this.globalTwitchBadges.size} badges.`);
        }
      }
    } catch (e) {
      console.warn('[Badges] Failed to load global Twitch badges:', e.message);
    }
  }

  async loadChannelTwitchBadges(cleanChannel, broadcasterId = null) {
    if (!cleanChannel) return;
    const lower = cleanChannel.toLowerCase();
    if (this.channelTwitchBadges.has(lower)) return;

    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const token = await this.getTwitchAppToken();
      let bId = broadcasterId;

      // 1. Dapatkan broadcaster ID via Helix jika belum tersedia
      if (!bId && clientId && token) {
        try {
          const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(lower)}`, {
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(3500)
          });
          if (userRes.ok) {
            const uData = await userRes.json();
            bId = uData?.data?.[0]?.id || null;
          }
        } catch (_) {}
      }

      // 2. Fetch custom channel badges via Helix
      if (bId && clientId && token) {
        try {
          const badgeRes = await fetch(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${encodeURIComponent(bId)}`, {
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(3500)
          });
          if (badgeRes.ok) {
            const badgeData = await badgeRes.json();
            const chMap = new Map();
            for (const set of badgeData?.data || []) {
              for (const ver of set.versions || []) {
                chMap.set(`${set.set_id}/${ver.id}`, {
                  id: set.set_id,
                  version: ver.id,
                  url: ver.image_url_1x || ver.image_url_2x || ver.image_url_4x,
                  title: ver.title || set.set_id
                });
              }
            }
            if (chMap.size > 0) {
              this.channelTwitchBadges.set(lower, chMap);
              console.log(`[Badges] Loaded ${chMap.size} custom channel badges via Helix for #${cleanChannel}`);
              return;
            }
          }
        } catch (_) {}
      }

      // 3. Fallback IVR API jika Helix gagal
      const badgeRes = await fetch(`https://api.ivr.fi/v2/twitch/badges/channel?login=${encodeURIComponent(lower)}`, {
        headers: { 'User-Agent': 'StreamPulse/1.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (badgeRes.ok) {
        const data = await badgeRes.json();
        const chMap = new Map();
        if (Array.isArray(data)) {
          for (const set of data) {
            for (const ver of set.versions || []) {
              chMap.set(`${set.set_id}/${ver.id}`, {
                id: set.set_id,
                version: ver.id,
                url: ver.image_url_1x || ver.image_url_2x || ver.image_url_4x,
                title: ver.title || set.set_id
              });
            }
          }
          this.channelTwitchBadges.set(lower, chMap);
          console.log(`[Badges] Loaded ${chMap.size} custom channel badges via IVR for #${cleanChannel}`);
        }
      }
    } catch (e) {
      console.warn(`[Badges] Failed to load badges for #${cleanChannel}:`, e.message);
    }
  }

  resolveTwitchUserBadges(cleanChannel, badgesObj, extraFlags = {}) {
    const rawBadges = { ...(badgesObj || {}) };
    if (extraFlags.isBroadcaster && !rawBadges.broadcaster) rawBadges.broadcaster = '1';
    if (extraFlags.isMod && !rawBadges.moderator) rawBadges.moderator = '1';
    if (extraFlags.isSub && !rawBadges.subscriber) rawBadges.subscriber = '1';
    if (extraFlags.isVip && !rawBadges.vip) rawBadges.vip = '1';

    const lower = cleanChannel ? cleanChannel.toLowerCase() : '';
    const chMap = this.channelTwitchBadges.get(lower);
    const resolved = [];

    const STATIC_FALLBACKS = {
      broadcaster: { url: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1', title: 'Broadcaster' },
      moderator: { url: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1', title: 'Moderator' },
      vip: { url: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1', title: 'VIP' },
      subscriber: { url: 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1', title: 'Subscriber' },
      founder: { url: 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1', title: 'Founder' },
      partner: { url: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1', title: 'Verified Partner' },
      premium: { url: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/1', title: 'Prime Gaming' },
      turbo: { url: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/1', title: 'Turbo' },
      'sub-gifter': { url: 'https://static-cdn.jtvnw.net/badges/v1/f1d2c6e2-edde-422d-b61b-c3c2f4da8f1a/1', title: 'Sub Gifter' },
      bits: { url: 'https://static-cdn.jtvnw.net/badges/v1/73b5c3fb-24f9-4296-a73b-73e72f9d2f2d/1', title: 'Bits' },
      'bits-leader': { url: 'https://static-cdn.jtvnw.net/badges/v1/07b57f20-d3a7-47b8-8097-91544a8e63b6/1', title: 'Bits Leader' },
      'sub-gift-leader': { url: 'https://static-cdn.jtvnw.net/badges/v1/4b04396b-2856-42d4-a690-3486abdc79f7/1', title: 'Sub Gift Leader' },
      'artist-badge': { url: 'https://static-cdn.jtvnw.net/badges/v1/4300a897-d3b8-43f6-823b-36024586f5d6/1', title: 'Artist' },
      'hype-train': { url: 'https://static-cdn.jtvnw.net/badges/v1/660c326d-9273-4537-8824-348e3cf3a1e7/1', title: 'Hype Train' },
      'glhf-pledge': { url: 'https://static-cdn.jtvnw.net/badges/v1/3158e758-3cb4-43c5-94b3-7639810451c5/1', title: 'GLHF Pledge' }
    };

    const entries = Object.entries(rawBadges);
    for (const [key, ver] of entries) {
      if (resolved.length >= 3) break; // Maksimal 3 badge seperti resmi di Twitch

      const badgeKey = `${key}/${ver}`;
      const found = (chMap && chMap.get(badgeKey)) || 
                    this.globalTwitchBadges.get(badgeKey) ||
                    (chMap && chMap.get(`${key}/1`)) ||
                    this.globalTwitchBadges.get(`${key}/1`) ||
                    (chMap && chMap.get(`${key}/0`)) ||
                    this.globalTwitchBadges.get(`${key}/0`);

      if (found && found.url) {
        resolved.push(found);
      } else if (STATIC_FALLBACKS[key]) {
        resolved.push({
          id: key,
          version: ver,
          url: STATIC_FALLBACKS[key].url,
          title: STATIC_FALLBACKS[key].title
        });
      }
    }

    return resolved;
  }

  async getTwitchAvatar(username, userId = null) {
    if (!username && !userId) return null;
    const lower = (username || '').toLowerCase().trim();
    const cleanUserId = userId ? String(userId).trim() : null;
    const cacheKey = cleanUserId || lower;

    if (lower && this.twitchAvatars.has(lower)) {
      return this.twitchAvatars.get(lower);
    }
    if (cleanUserId && this.twitchAvatars.has(cleanUserId)) {
      return this.twitchAvatars.get(cleanUserId);
    }

    // Deduplicate in-flight requests untuk chatter yang sama
    if (!this._twitchAvatarPromises) this._twitchAvatarPromises = new Map();
    if (this._twitchAvatarPromises.has(cacheKey)) {
      return this._twitchAvatarPromises.get(cacheKey);
    }

    const fetchPromise = (async () => {
      // 1. Coba Twitch Helix API resmi (cepat, akurat, dan resmi)
      try {
        const clientId = process.env.TWITCH_CLIENT_ID;
        const token = await this.getTwitchAppToken();
        if (clientId && token) {
          const qParam = cleanUserId ? `id=${encodeURIComponent(cleanUserId)}` : `login=${encodeURIComponent(lower)}`;
          const helixRes = await fetch(`https://api.twitch.tv/helix/users?${qParam}`, {
            headers: {
              'Client-Id': clientId,
              'Authorization': `Bearer ${token}`
            },
            signal: AbortSignal.timeout(2800)
          });
          if (helixRes.ok) {
            const hData = await helixRes.json();
            const avatarUrl = hData?.data?.[0]?.profile_image_url;
            if (avatarUrl && avatarUrl.startsWith('http')) {
              if (lower) this.setTwitchAvatarCache(lower, avatarUrl);
              if (cleanUserId) this.setTwitchAvatarCache(cleanUserId, avatarUrl);
              return avatarUrl;
            }
          }
        }
      } catch (err) {
        // Fallthrough ke resolver cadangan
      }

      // 2. Fallback ke IVR API (Proxy publik Twitch resmi yang sangat cepat)
      try {
        const qParam = cleanUserId ? `id=${encodeURIComponent(cleanUserId)}` : `login=${encodeURIComponent(lower)}`;
        const ivrRes = await fetch(`https://api.ivr.fi/v2/twitch/user?${qParam}`, {
          headers: { 'User-Agent': 'StreamPulse/1.0' },
          signal: AbortSignal.timeout(2500)
        });
        if (ivrRes.ok) {
          const ivrData = await ivrRes.json();
          const avatarUrl = (Array.isArray(ivrData) ? ivrData[0]?.logo : ivrData?.logo) || '';
          if (avatarUrl && avatarUrl.startsWith('http')) {
            if (lower) this.setTwitchAvatarCache(lower, avatarUrl);
            if (cleanUserId) this.setTwitchAvatarCache(cleanUserId, avatarUrl);
            return avatarUrl;
          }
        }
      } catch (err) {
        // Fallthrough ke DecAPI
      }

      // 3. Fallback DecAPI jika username tersedia
      if (lower) {
        try {
          const res = await fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(lower)}`, {
            headers: { 'User-Agent': 'StreamPulse/1.0' },
            signal: AbortSignal.timeout(2000)
          });
          if (res.ok) {
            const url = (await res.text()).trim();
            if (url.startsWith('http') && !url.includes('cdd517eb')) {
              this.setTwitchAvatarCache(lower, url);
              if (cleanUserId) this.setTwitchAvatarCache(cleanUserId, url);
              return url;
            }
          }
        } catch (e) {}
      }

      // 4. Default official avatar Twitch (valid hash yang aktif dan 200 OK)
      const fallback = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/41780b5a-def8-11e9-94d9-784f43822e80-profile_image-300x300.png';
      return fallback;
    })().finally(() => {
      this._twitchAvatarPromises.delete(cacheKey);
    });

    this._twitchAvatarPromises.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // Dapatkan warna Twitch user (warna kustom atau kalkulasi deterministik palet resmi Twitch)
  getTwitchUserColor(username, userColor) {
    if (userColor && typeof userColor === 'string' && userColor.trim().startsWith('#')) {
      return userColor.trim();
    }
    const name = (username || '').toLowerCase();
    if (!name) return '#a970ff';

    // 15 Warna Default Resmi Twitch IRC
    const TWITCH_DEFAULT_COLORS = [
      '#FF0000', '#0000FF', '#00FF7F', '#B22222', '#FF7F50',
      '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E',
      '#5F9EA0', '#1E90FF', '#8A2BE2', '#00FF00', '#008000'
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TWITCH_DEFAULT_COLORS[Math.abs(hash) % TWITCH_DEFAULT_COLORS.length];
  }

  // Cek dan cegah event redeem ganda
  isDuplicateRedeem(key) {
    const now = Date.now();
    for (const [k, time] of this.processedRedeems.entries()) {
      if (now - time > 30000) {
        this.processedRedeems.delete(k);
      }
    }
    if (this.processedRedeems.has(key)) {
      return true;
    }
    this.processedRedeems.set(key, now);
    return false;
  }

  // Cek dan cegah pesan chat ganda (Twitch Shared Chat, mirroring, TikTok replay, atau packet duplicate)
  isDuplicateChat(key) {
    if (!key) return false;
    const now = Date.now();
    for (const [k, time] of this.processedChats.entries()) {
      if (now - time > 90000) {
        this.processedChats.delete(k);
      }
    }
    if (this.processedChats.has(key)) {
      return true;
    }
    this.processedChats.set(key, now);
    return false;
  }

  // Kirim status platform ke room channel tertentu
  broadcastStatus(platform, channelKey, status, message = '', extra = {}) {
    const payload = {
      platform,
      channel: channelKey,
      status,
      message,
      extra,
      timestamp: Date.now()
    };
    this.io.to(`${platform}:${channelKey}`).emit('platform_status', payload);
  }

  // Kirim chat ke room channel tertentu
  broadcastChat(platform, channelKey, chatData) {
    const item = {
      ...chatData,
      id: chatData.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: chatData.timestamp || Date.now()
    };
    this.io.to(`${platform}:${channelKey}`).emit('new_chat', item);
  }

  // Kirim event (gift, sub, dll) ke room channel tertentu
  broadcastEvent(platform, channelKey, eventData) {
    const eventItem = {
      ...eventData,
      id: eventData.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: eventData.timestamp || Date.now()
    };
    if (this.eventHistory) {
      this.eventHistory.push(eventItem);
      if (this.eventHistory.length > 100) {
        this.eventHistory.shift();
      }
    }

    // Real TikTok Top Gifter & Top Like Aggregator
    if (platform === 'tiktok' && (eventData.eventType === 'gift' || eventData.type === 'gift')) {
      const cleanKey = channelKey || 'default';
      if (!this.tiktokTopGifters.has(cleanKey)) {
        this.tiktokTopGifters.set(cleanKey, new Map());
      }
      const gMap = this.tiktokTopGifters.get(cleanKey);
      const author = eventData.author || 'User';
      const authorKey = author.toLowerCase();
      const diamonds = Number(eventData.diamonds) || 10;
      const avatar = eventData.avatar || '';

      let existing = gMap.get(authorKey);
      if (existing) {
        existing.diamonds += diamonds;
        if (avatar && (!existing.avatar || existing.avatar.includes('dicebear'))) {
          existing.avatar = avatar;
        }
      } else {
        gMap.set(authorKey, {
          name: author,
          diamonds: diamonds,
          avatar: avatar
        });
      }
    }

    this.io.to(`${platform}:${channelKey}`).emit('new_event', eventItem);
  }

  // Kirim viewer count update ke room channel tertentu
  broadcastViewerCount(platform, channelKey, count) {
    const safeCount = Math.max(0, parseInt(count, 10) || 0);
    const pool = platform === 'twitch' ? this.twitchPool : (platform === 'youtube' ? this.youtubePool : this.tiktokPool);
    const item = pool.get(channelKey);
    if (item) {
      item.viewerCount = safeCount;
    }
    const payload = {
      platform,
      channel: channelKey,
      count: safeCount,
      timestamp: Date.now()
    };
    this.io.to(`${platform}:${channelKey}`).emit('viewer_count', payload);
  }

  // Kirim pesan chat resmi ke Twitch via Helix API
  async sendTwitchChatMessage(channelName, text, rawToken = '') {
    const cleanChannel = (channelName || '').trim().toLowerCase().replace(/^[#@]/, '');
    const messageText = (text || '').trim();
    if (!cleanChannel || !messageText) {
      return { success: false, error: 'Nama channel atau pesan tidak boleh kosong' };
    }

    let token = (rawToken || '').trim().replace(/^(oauth:|bearer\s*)/i, '').trim();
    const poolItem = this.twitchPool.get(cleanChannel);
    if (!token && poolItem && poolItem.token) {
      token = poolItem.token;
    }

    if (!token) {
      return { success: false, error: 'Token otentikasi Twitch tidak ditemukan. Silakan hubungkan akun Twitch Anda terlebih dahulu.' };
    }

    try {
      let broadcasterId = poolItem?.broadcasterId;
      let clientId = poolItem?.clientId;

      if (!broadcasterId || !clientId) {
        const valRes = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { Authorization: `OAuth ${token}` },
          signal: AbortSignal.timeout(4500)
        });
        if (valRes.ok) {
          const valData = await valRes.json();
          clientId = valData.client_id || process.env.TWITCH_CLIENT_ID || 'sea3yunko17ptmjkwf98imtypufch4';
          broadcasterId = valData.user_id;
          if (poolItem) {
            poolItem.clientId = clientId;
            poolItem.broadcasterId = broadcasterId;
          }
        }
      }

      if (!clientId || !broadcasterId) {
        return { success: false, error: 'Gagal memvalidasi otorisasi token Twitch.' };
      }

      const sendRes = await fetch('https://api.twitch.tv/helix/chat/messages', {
        method: 'POST',
        headers: {
          'Client-Id': clientId,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          broadcaster_id: broadcasterId,
          sender_id: broadcasterId,
          message: messageText
        })
      });

      if (sendRes.ok) {
        return { success: true };
      } else {
        if (sendRes.status === 401 && typeof this.tokenRefreshHandler === 'function') {
          console.log(`[Twitch Chat] Token kedaluwarsa (401), mencoba auto-refresh untuk #${cleanChannel}...`);
          const newToken = await this.tokenRefreshHandler(cleanChannel);
          if (newToken) {
            return this.sendTwitchChatMessage(channelName, text, newToken);
          }
        }
        const errData = await sendRes.json().catch(() => ({}));
        const msg = errData.message || `HTTP ${sendRes.status}`;
        console.warn(`[Twitch Chat] Gagal kirim pesan ke #${cleanChannel}:`, msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      console.error(`[Twitch Chat] Exception saat kirim chat ke #${cleanChannel}:`, err);
      return { success: false, error: err.message };
    }
  }

  // Dapatkan App Access Token resmi Twitch menggunakan Client ID & Secret dari .env
  async getTwitchAppToken() {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    if (this.twitchAppToken && Date.now() < this.twitchAppTokenExpires) {
      return this.twitchAppToken;
    }

    try {
      const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials'
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        this.twitchAppToken = data.access_token;
        this.twitchAppTokenExpires = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
        return this.twitchAppToken;
      }
    } catch (err) {
      console.warn('[Twitch API] Gagal mendapatkan App Access Token:', err.message);
    }
    return null;
  }

  // Ambil jumlah viewer real-time langsung dari Twitch Helix API resmi
  async fetchRealTwitchViewerCount(channel) {
    const cleanCh = (channel || '').trim().toLowerCase().replace(/^[#@]/, '');
    if (!cleanCh) return 0;

    // 1. TIER 1: Twitch Official GQL API (Real-time, instant 25ms, no live indexing delay, no OAuth secret required)
    try {
      const gqlRes = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `query { user(login: "${cleanCh}") { stream { viewersCount } } }`
        }),
        signal: AbortSignal.timeout(3500)
      });
      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        if (gqlData?.data?.user) {
          const stream = gqlData.data.user.stream;
          return stream ? (Number(stream.viewersCount) || 0) : 0;
        }
      }
    } catch (gqlErr) {}

    // 2. TIER 2: Twitch Helix Streams API resmi
    const clientId = process.env.TWITCH_CLIENT_ID || 'sea3yunko17ptmjkwf98imtypufch4';
    const token = await this.getTwitchAppToken();

    if (clientId && token) {
      try {
        const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(cleanCh)}`, {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data) && data.data.length > 0) {
            return data.data[0].viewer_count || 0;
          }
          return 0; // Streamer sedang offline
        }
      } catch (err) {
        console.warn(`[Twitch Helix] Error fetch viewer count untuk #${cleanCh}:`, err.message);
      }
    }

    // 3. TIER 3: Fallback ke decapi jika API utama sedang terkendala
    try {
      const res = await fetch(`https://decapi.me/twitch/viewercount/${encodeURIComponent(cleanCh)}`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const text = (await res.text()).trim();
        return /^\d+$/.test(text) ? parseInt(text, 10) : 0;
      }
    } catch (e) {}

    return 0;
  }

  // Ambil jumlah viewer live YouTube secara real-time langsung tanpa OAuth (menggunakan YouTube Innertube API)
  async fetchRealYouTubeViewerCount(liveId) {
    if (!liveId) return 0;
    try {
      // 1. Coba via YouTube Innertube updated_metadata API
      const res = await fetch('https://www.youtube.com/youtubei/v1/updated_metadata?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240410.01.00',
              hl: 'en',
              gl: 'US'
            }
          },
          videoId: liveId
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        const actions = data.actions || [];
        for (const act of actions) {
          const uv = act.updateViewershipAction?.viewCount?.videoViewCountRenderer;
          if (uv) {
            // Live Concurrent Viewers (Penonton Aktif Saat Ini):
            // Di YouTube, angka penonton live disimpan dalam runs/simpleText (contoh: "14 watching now" atau runs: [{text: "14"}])
            let liveText = '';
            if (Array.isArray(uv.viewCount?.runs) && uv.viewCount.runs.length > 0) {
              liveText = uv.viewCount.runs[0]?.text || '';
            } else if (uv.viewCount?.simpleText) {
              liveText = uv.viewCount.simpleText;
            } else if (uv.extraShortViewCount?.simpleText) {
              liveText = uv.extraShortViewCount.simpleText;
            } else if (uv.shortViewCount?.simpleText) {
              liveText = uv.shortViewCount.simpleText;
            }

            if (liveText) {
              const count = parseInt(String(liveText).replace(/[^0-9]/g, ''), 10);
              if (!isNaN(count) && count >= 0) {
                return count;
              }
            }

            // Jika isLive false (bukan sedang live), barulah fallback ke originalViewCount
            if (!uv.isLive && uv.originalViewCount) {
              return parseInt(uv.originalViewCount, 10) || 0;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[YouTube Live] Gagal mengambil viewer count liveId ${liveId}:`, err.message);
    }

    // 2. Fallback: Scraping ringan halaman live watch YouTube untuk mencari "concurrentViewers"
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${liveId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const liveMatch = html.match(/"concurrentViewers":"(\d+)"/);
        if (liveMatch && liveMatch[1]) {
          return parseInt(liveMatch[1], 10) || 0;
        }
        const runsMatch = html.match(/"viewCount":\{"runs":\[\{"text":"([0-9,.]+)"\},\{"text":"\s*watching/i);
        if (runsMatch && runsMatch[1]) {
          return parseInt(runsMatch[1].replace(/[^0-9]/g, ''), 10) || 0;
        }
      }
    } catch (e) {}

    return 0;
  }

  // Ambil jumlah penonton live TikTok secara real-time langsung dari data liveRoom
  async fetchRealTikTokViewerCount(username, explicitRoomId = null) {
    if (!username) return 0;
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase();

    // 1. Prioritas: Gunakan TikTokLiveClient.fetchRoomInfo via roomId (resmi Webcast API)
    try {
      let roomId = explicitRoomId;
      if (!roomId) {
        const poolItem = this.tiktokPool?.get(cleanUser);
        if (poolItem?.roomId) roomId = poolItem.roomId;
        const cached = globalThis._tiktokRoomIdCache?.get(cleanUser);
        if (!roomId && cached?.roomId && (Date.now() - cached.timestamp < 120000)) roomId = cached.roomId;
      }
      if (!roomId && (checkTikTokOnline || TikTokLiveClient?.checkOnline)) {
        const checker = checkTikTokOnline || TikTokLiveClient.checkOnline;
        const online = await checker(cleanUser, 5000).catch(() => null);
        if (online?.roomId) {
          roomId = String(online.roomId);
          const poolItem = this.tiktokPool?.get(cleanUser);
          if (poolItem) poolItem.roomId = roomId;
          setTikTokRoomIdCache(cleanUser, { roomId, timestamp: Date.now() });
        }
      }
      if (roomId && (fetchTikTokRoomInfo || TikTokLiveClient?.fetchRoomInfo)) {
        const fetcher = fetchTikTokRoomInfo || TikTokLiveClient.fetchRoomInfo;
        const info = await fetcher(roomId, 6000).catch(() => null);
        const vCount = Number(info?.viewers);
        if (!isNaN(vCount) && vCount >= 0) {
          return vCount;
        }
      }
    } catch (e) {}

    // 2. Fallback via liveRoom API jika tersedia
    try {
      const res = await axios.get(`https://www.tiktok.com/api-live/user/room/?uniqueId=${encodeURIComponent(cleanUser)}&sourceType=54&aid=1988`, {
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': `https://www.tiktok.com/@${cleanUser}/live`
        }
      });
      const liveRoom = res.data?.data?.liveRoom;
      if (liveRoom) {
        // liveRoomStats.userCount adalah penonton yang sedang menonton saat ini (concurrent viewers)
        // BUKAN enterCount (yang merupakan akumulasi total pengunjung sejak awal live)
        const count = liveRoom.liveRoomStats?.userCount ?? liveRoom.user_count;
        if (count !== undefined && count !== null) {
          return Math.max(0, parseInt(count, 10) || 0);
        }
      }
    } catch (e) {}
    return 0;
  }

  // Poller berkala untuk viewer count Twitch, YouTube, & TikTok (paralel concurrent)
  startViewerCountPoller() {
    if (this.viewerPollerInterval) return;
    this.viewerPollerInterval = setInterval(async () => {
      const tasks = [];

      // 1. Twitch (Real Helix API)
      for (const [ch, poolItem] of this.twitchPool.entries()) {
        tasks.push((async () => {
          try {
            const count = await this.fetchRealTwitchViewerCount(ch);
            poolItem.viewerCount = count;
            this.broadcastViewerCount('twitch', ch, count);
          } catch (e) {}
        })());
      }

      // 2. YouTube (Real Innertube API - Tanpa OAuth)
      for (const [yt, poolItem] of this.youtubePool.entries()) {
        if (poolItem.liveId) {
          tasks.push((async () => {
            try {
              const count = await this.fetchRealYouTubeViewerCount(poolItem.liveId);
              poolItem.viewerCount = count;
              this.broadcastViewerCount('youtube', yt, count);
            } catch (e) {}
          })());
        }
      }

      // 3. TikTok (Real Concurrent Viewers)
      for (const [tt, poolItem] of this.tiktokPool.entries()) {
        const isConnected = poolItem.connection && (poolItem.status?.status === 'connected' || poolItem.connection.abortController);
        if (isConnected) {
          tasks.push((async () => {
            try {
              const count = await this.fetchRealTikTokViewerCount(tt, poolItem.roomId);
              if (count >= 0) {
                poolItem.viewerCount = count;
                this.broadcastViewerCount('tiktok', tt, count);
              }
            } catch (e) {}
          })());
        }
      }

      if (tasks.length > 0) {
        await Promise.allSettled(tasks);
      }
    }, 12000);
  }

  // State awal untuk client baru
  getClientInitialState(socket) {
    const session = this.clientSessions.get(socket.id) || {
      twitch: '',
      twitchToken: '',
      youtube: '',
      tiktok: ''
    };

    // Client strictly uses its own assigned session channels to prevent data leaks from other users
    const activeTwitch = session.twitch || '';
    const activeYoutube = session.youtube || '';
    const activeTiktok = session.tiktok || '';

    // Auto-join socket to stream rooms only if explicitly configured for this client
    if (socket) {
      if (activeTwitch) socket.join(`twitch:${activeTwitch}`);
      if (activeYoutube) socket.join(`youtube:${activeYoutube}`);
      if (activeTiktok) socket.join(`tiktok:${activeTiktok}`);
    }

    const statuses = {
      twitch: { status: 'idle', message: 'Belum dihubungkan' },
      youtube: { status: 'idle', message: 'Belum dihubungkan' },
      tiktok: { status: 'idle', message: 'Belum dihubungkan' }
    };

    const viewerCounts = {
      twitch: (session.twitch && this.twitchPool.get(session.twitch)?.viewerCount) || 0,
      youtube: (session.youtube && this.youtubePool.get(session.youtube)?.viewerCount) || 0,
      tiktok: (session.tiktok && this.tiktokPool.get(session.tiktok)?.viewerCount) || 0
    };

    if (session.twitch && this.twitchPool.has(session.twitch)) {
      statuses.twitch = this.twitchPool.get(session.twitch).status;
    }
    if (session.youtube && this.youtubePool.has(session.youtube)) {
      statuses.youtube = this.youtubePool.get(session.youtube).status;
    }
    if (session.tiktok && this.tiktokPool.has(session.tiktok)) {
      statuses.tiktok = this.tiktokPool.get(session.tiktok).status;
    }

    let channelEmotes = {};
    if (session.twitch && this.twitchPool.has(session.twitch)) {
      channelEmotes = this.twitchPool.get(session.twitch).emotes || {};
    }

    const effectiveChannels = {
      twitch: activeTwitch,
      twitchToken: session.twitchToken,
      youtube: activeYoutube,
      tiktok: activeTiktok
    };

    const hasTwitchAuth = !!(session.twitchToken || (activeTwitch && this.twitchPool.get(activeTwitch)?.token));

    return {
      channels: effectiveChannels,
      statuses: statuses,
      viewerCounts: viewerCounts,
      hasTwitchAuth: hasTwitchAuth,
      emotes: channelEmotes
    };
  }

  getInitialState() {
    return {
      channels: { twitch: '', twitchToken: '', youtube: '', tiktok: '' },
      statuses: {
        twitch: { status: 'idle', message: 'Belum dihubungkan' },
        youtube: { status: 'idle', message: 'Belum dihubungkan' },
        tiktok: { status: 'idle', message: 'Belum dihubungkan' }
      }
    };
  }

  // ==========================================
  // MULTI-CLIENT SESSION MANAGEMENT
  // ==========================================
  async updateClientChannels(socket, data) {
    const { twitch, twitchToken, youtube, tiktok, tiktokSessionId, force } = data || {};
    const isForce = Boolean(force);
    let session = this.clientSessions.get(socket.id);
    if (!session) {
      session = { twitch: '', twitchToken: '', youtube: '', tiktok: '', tiktokSessionId: '' };
      this.clientSessions.set(socket.id, session);
    }

    if (tiktokSessionId !== undefined) {
      session.tiktokSessionId = tiktokSessionId ? String(tiktokSessionId).trim() : '';
      if (session.tiktokSessionId) {
        globalThis._activeTikTokSessionId = session.tiktokSessionId;
      }
    }

    // 1. Twitch Channel Update
    if (twitch !== undefined) {
      const cleanTwitch = (twitch || '').trim().toLowerCase().replace(/^#/, '');
      const cleanToken = (twitchToken || '').trim().replace(/^oauth:/i, '');
      const isTwitchChanged = isForce || cleanTwitch !== session.twitch || cleanToken !== session.twitchToken;

      if (isTwitchChanged) {
        if (session.twitch) {
          socket.leave(`twitch:${session.twitch}`);
          await this.unsubscribeTwitch(socket.id, session.twitch);
        }
        if (socket.rooms) {
          for (const room of socket.rooms) {
            if (typeof room === 'string' && room.startsWith('twitch:') && room !== `twitch:${cleanTwitch}`) {
              socket.leave(room);
            }
          }
        }
        session.twitch = cleanTwitch;
        session.twitchToken = cleanToken;
        if (cleanTwitch) {
          socket.join(`twitch:${cleanTwitch}`);
          await this.subscribeTwitch(socket, cleanTwitch, cleanToken);
        } else {
          socket.emit('platform_status', { platform: 'twitch', status: 'idle', message: 'Belum dihubungkan' });
        }
      }
    }

    // 2. YouTube Channel Update
    if (youtube !== undefined) {
      const cleanYt = (youtube || '').trim();
      const isYtChanged = isForce || cleanYt !== session.youtube;

      if (isYtChanged) {
        if (session.youtube) {
          socket.leave(`youtube:${session.youtube}`);
          await this.unsubscribeYouTube(socket.id, session.youtube);
        }
        if (socket.rooms) {
          for (const room of socket.rooms) {
            if (typeof room === 'string' && room.startsWith('youtube:') && room !== `youtube:${cleanYt}`) {
              socket.leave(room);
            }
          }
        }
        session.youtube = cleanYt;
        if (cleanYt) {
          socket.join(`youtube:${cleanYt}`);
          await this.subscribeYouTube(socket, cleanYt, isForce);
        } else {
          socket.emit('platform_status', { platform: 'youtube', status: 'idle', message: 'Belum dihubungkan' });
        }
      }
    }

    // 3. TikTok Channel Update
    if (tiktok !== undefined) {
      const cleanTt = this.parseTikTokInput(tiktok);
      const isTtChanged = isForce || cleanTt !== session.tiktok || (session.tiktokSessionId && isForce);

      if (isTtChanged) {
        if (session.tiktok) {
          socket.leave(`tiktok:${session.tiktok}`);
          await this.unsubscribeTikTok(socket.id, session.tiktok);
        }
        if (socket.rooms) {
          for (const room of socket.rooms) {
            if (typeof room === 'string' && room.startsWith('tiktok:') && room !== `tiktok:${cleanTt}`) {
              socket.leave(room);
            }
          }
        }
        session.tiktok = cleanTt;
        if (cleanTt) {
          socket.join(`tiktok:${cleanTt}`);
          await this.subscribeTikTok(socket, cleanTt, isForce, session.tiktokSessionId);
        } else {
          socket.emit('platform_status', { platform: 'tiktok', status: 'idle', message: 'Belum dihubungkan' });
        }
      }
    }
  }

  async disconnectClientPlatform(socket, platform) {
    const session = this.clientSessions.get(socket.id);
    if (!session) return;

    if (platform === 'twitch' && session.twitch) {
      socket.leave(`twitch:${session.twitch}`);
      await this.unsubscribeTwitch(socket.id, session.twitch);
      session.twitch = '';
      session.twitchToken = '';
      socket.emit('platform_status', { platform: 'twitch', status: 'idle', message: 'Belum dihubungkan' });
    } else if (platform === 'youtube' && session.youtube) {
      socket.leave(`youtube:${session.youtube}`);
      await this.unsubscribeYouTube(socket.id, session.youtube);
      session.youtube = '';
      socket.emit('platform_status', { platform: 'youtube', status: 'idle', message: 'Belum dihubungkan' });
    } else if (platform === 'tiktok' && session.tiktok) {
      socket.leave(`tiktok:${session.tiktok}`);
      clearTikTokRoomIdCache(session.tiktok);
      await this.unsubscribeTikTok(socket.id, session.tiktok);
      session.tiktok = '';
      socket.emit('platform_status', { platform: 'tiktok', status: 'idle', message: 'Belum dihubungkan' });
    }
  }

  async handleClientDisconnect(socket) {
    const session = this.clientSessions.get(socket.id);
    if (!session) return;

    if (session.twitch) {
      await this.unsubscribeTwitch(socket.id, session.twitch);
    }
    if (session.youtube) {
      await this.unsubscribeYouTube(socket.id, session.youtube);
    }
    if (session.tiktok) {
      await this.unsubscribeTikTok(socket.id, session.tiktok);
    }
    this.clientSessions.delete(socket.id);
  }

  // ==========================================
  // TWITCH SUBSCRIPTION & POOLING
  // ==========================================
  async subscribeTwitch(socket, cleanChannel, cleanToken = '') {
    let poolItem = this.twitchPool.get(cleanChannel);

    if (poolItem) {
      poolItem.listeners.add(socket.id);

      // Jika socket baru tidak bawa token (misal OBS overlay), gunakan token yang sudah aktif di pool
      if (!cleanToken && poolItem.token) {
        cleanToken = poolItem.token;
      }

      // PENTING: Jika token OAuth baru diberikan dan EventSub belum aktif/terputus, hubungkan sekarang!
      const wsIsActiveOrConnecting = poolItem.ws && (poolItem.ws.readyState === 0 || poolItem.ws.readyState === 1);
      const tokenChanged = cleanToken && poolItem.token !== cleanToken;
      if (cleanToken && (!wsIsActiveOrConnecting || tokenChanged)) {
        poolItem.token = cleanToken;
        if (poolItem.ws) {
          try { poolItem.ws.close(); } catch (e) {}
          poolItem.ws = null;
        }
        this.connectTwitchEventSub(cleanChannel, cleanToken, poolItem);
      }

      // Kirim status saat ini ke socket yang baru bergabung
      socket.emit('platform_status', {
        platform: 'twitch',
        channel: cleanChannel,
        status: poolItem.status.status,
        message: poolItem.status.message
      });
      // Kirim viewer count saat ini jika sudah tersedia
      if (typeof poolItem.viewerCount === 'number') {
        socket.emit('viewer_count', {
          platform: 'twitch',
          channel: cleanChannel,
          count: poolItem.viewerCount,
          timestamp: Date.now()
        });
      }
      // Refresh viewer count terkini secara real-time
      this.fetchRealTwitchViewerCount(cleanChannel).then(count => {
        if (poolItem) {
          poolItem.viewerCount = count;
          socket.emit('viewer_count', {
            platform: 'twitch',
            channel: cleanChannel,
            count: count,
            timestamp: Date.now()
          });
        }
      }).catch(() => {});
      // Kirim 7TV emote dictionary yang sudah ada
      if (poolItem.emotes) {
        socket.emit('twitch_emotes', { channel: cleanChannel, emotes: poolItem.emotes });
      }
      return;
    }

    // Buat listener Twitch baru di pool
    poolItem = {
      channel: cleanChannel,
      client: null,
      ws: null,
      listeners: new Set([socket.id]),
      status: { status: 'connecting', message: `Menghubungkan ke Twitch #${cleanChannel}...` },
      emotes: {},
      token: cleanToken
    };
    this.twitchPool.set(cleanChannel, poolItem);
    this.broadcastStatus('twitch', cleanChannel, 'connecting', `Menghubungkan ke Twitch #${cleanChannel}...`);

    // Ambil 7TV Emotes & Custom Channel Badges secara asinkron
    emoteManager.getChannelEmotes(cleanChannel).then((emotes) => {
      poolItem.emotes = emotes;
      this.io.to(`twitch:${cleanChannel}`).emit('twitch_emotes', { channel: cleanChannel, emotes });
    }).catch(err => console.warn('[7TV] Error:', err.message));

    this.loadChannelTwitchBadges(cleanChannel);

    try {
      const client = new tmi.Client({
        options: { debug: false },
        connection: { reconnect: true, secure: true },
        channels: [cleanChannel]
      });
      poolItem.client = client;

      client.on('connected', () => {
        poolItem.status = { status: 'connected', message: `Terhubung ke #${cleanChannel}` };
        this.broadcastStatus('twitch', cleanChannel, 'connected', `Terhubung ke #${cleanChannel}`);
      });

      client.on('disconnected', (reason) => {
        poolItem.status = { status: 'disconnected', message: `Terputus: ${reason || 'Disconnected'}` };
        this.broadcastStatus('twitch', cleanChannel, 'disconnected', `Terputus: ${reason || 'Disconnected'}`);
      });

      // 1. Channel Points Redeem via IRC
      client.on('redeem', (channel, username, rewardType, tags, message) => {
        const displayName = tags?.['display-name'] || username || 'Viewer';
        const msgId = tags?.['msg-id'] || rewardType;
        const msgText = message || '';
        const dedupeKey = tags?.id || `${username}_${rewardType}_${msgText}`;

        if (this.isDuplicateRedeem(dedupeKey)) return;

        let detail = 'Reward Channel Points Ditukar';
        if (msgId === 'highlighted-message') detail = 'Pesan Sorotan (Highlighted)';
        else if (msgId === 'skip-subs-mode-message') detail = 'Kirim Pesan Sub-Only Mode';
        else if (msgId === 'gigantified-emote-message') detail = 'Emote Raksasa (Gigantified)';
        else if (msgId === 'animated-message') detail = 'Pesan Animasi (Poin Saluran)';

        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'redeem',
          title: 'Twitch Channel Points Redeem!',
          author: displayName,
          detail: detail,
          message: msgText,
          badge: '💠 REDEEM'
        });
      });

      // 2. Chat Masuk (Mendukung Emote Twitch & 7TV)
      client.on('chat', async (channel, userstate, message, self) => {
        if (self) return;

        // Cegah pesan bits cheer diproses sebagai chat biasa (karena ditangani oleh listener 'cheer')
        if (userstate.bits) return;

        // Cegah pesan chat ganda (Twitch Shared Chat source-id, mirroring, atau IRC duplicate)
        const msgId = userstate['source-id'] || userstate.id || userstate['msg-id'];
        const dedupeKey = msgId || `${cleanChannel}_${(userstate.username || '').toLowerCase()}_${message}`;
        if (this.isDuplicateChat(dedupeKey)) return;

        const isCustomReward = !!userstate['custom-reward-id'];
        const isHighlighted = userstate['msg-id'] === 'highlighted-message';
        const isSkipSub = userstate['msg-id'] === 'skip-subs-mode-message';
        const isGigantified = userstate['msg-id'] === 'gigantified-emote-message';
        const isAnimated = userstate['msg-id'] === 'animated-message';
        const isRedeem = isCustomReward || isHighlighted || isSkipSub || isGigantified || isAnimated;

        const avatar = await this.getTwitchAvatar(userstate.username, userstate['user-id']);

        const isBroadcaster = !!(userstate.badges && userstate.badges.broadcaster) || (userstate.username && userstate.username.toLowerCase() === cleanChannel.toLowerCase());
        const isMod = !!userstate.mod || !!(userstate.badges && userstate.badges.moderator);
        const isSub = !!userstate.subscriber || !!(userstate.badges && userstate.badges.subscriber);
        const isVip = !!(userstate.badges && userstate.badges.vip);
        const badgesList = this.resolveTwitchUserBadges(cleanChannel, userstate.badges, { isBroadcaster, isMod, isSub, isVip });
        const userColor = this.getTwitchUserColor(userstate['display-name'] || userstate.username, userstate.color);

        let redeemDetail = '';
        if (isRedeem) {
          redeemDetail = isHighlighted ? 'Pesan Sorotan (Highlighted)' : 'Reward Channel Points Ditukar';
          const dedupeKey = userstate.id || `${userstate.username}_${userstate['custom-reward-id'] || userstate['msg-id']}_${message}`;
          if (!this.isDuplicateRedeem(dedupeKey)) {
            this.broadcastEvent('twitch', cleanChannel, {
              id: dedupeKey,
              platform: 'twitch',
              type: 'event',
              eventType: 'redeem',
              title: 'Twitch Channel Points Redeem!',
              author: userstate['display-name'] || userstate.username,
              authorColor: userColor,
              badges: userstate.badges || {},
              badgesList: badgesList,
              avatar: avatar,
              detail: redeemDetail,
              message: message,
              badge: '💠 REDEEM'
            });
          }
        }

        const reply = userstate['reply-parent-msg-body'] ? {
          parentAuthor: userstate['reply-parent-display-name'] || userstate['reply-parent-user-login'] || 'User',
          parentText: userstate['reply-parent-msg-body'].replace(/\\s/g, ' ')
        } : null;

        this.broadcastChat('twitch', cleanChannel, {
          id: msgId || userstate.id,
          platform: 'twitch',
          type: 'chat',
          isRedeem: isRedeem,
          redeemDetail: redeemDetail,
          reply: reply,
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            avatar: avatar,
            color: userColor,
            badges: userstate.badges || {},
            badgesList: badgesList,
            isBroadcaster: isBroadcaster,
            isMod: isMod,
            isSub: isSub,
            isVip: isVip
          },
          emotes: userstate.emotes || null,
          text: message
        });
      });

      // 3. Action (/me)
      client.on('action', async (channel, userstate, message, self) => {
        if (self) return;
        const msgId = userstate['source-id'] || userstate.id || userstate['msg-id'];
        const dedupeKey = msgId || `${cleanChannel}_${(userstate.username || '').toLowerCase()}_act_${message}`;
        if (this.isDuplicateChat(dedupeKey)) return;
        const avatar = await this.getTwitchAvatar(userstate.username, userstate['user-id']);
        const isBroadcaster = !!(userstate.badges && userstate.badges.broadcaster) || (userstate.username && userstate.username.toLowerCase() === cleanChannel.toLowerCase());
        const isMod = !!userstate.mod || !!(userstate.badges && userstate.badges.moderator);
        const isSub = !!userstate.subscriber || !!(userstate.badges && userstate.badges.subscriber);
        const isVip = !!(userstate.badges && userstate.badges.vip);
        const badgesList = this.resolveTwitchUserBadges(cleanChannel, userstate.badges, { isBroadcaster, isMod, isSub, isVip });
        const userColor = this.getTwitchUserColor(userstate['display-name'] || userstate.username, userstate.color);

        this.broadcastChat('twitch', cleanChannel, {
          id: msgId || userstate.id,
          platform: 'twitch',
          type: 'chat',
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            avatar: avatar,
            color: userColor,
            badges: userstate.badges || {},
            badgesList: badgesList,
            isBroadcaster: isBroadcaster,
            isMod: isMod,
            isSub: isSub,
            isVip: isVip
          },
          emotes: userstate.emotes || null,
          text: `* ${message}`
        });
      });

      // 4. Subscriptions
      client.on('subscription', async (channel, username, method, message, userstate) => {
        const plan = method?.plan ? `Tier ${method.plan === '1000' ? '1' : method.plan === '2000' ? '2' : '3'}` : 'Sub';
        const avatar = await this.getTwitchAvatar(username, userstate?.['user-id']);
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'subscription',
          title: 'Twitch New Subscriber!',
          author: userstate?.['display-name'] || username,
          avatar: avatar,
          detail: `Langganan (${plan})`,
          message: message || '',
          badge: '⭐ SUB'
        });
      });

      client.on('resub', async (channel, username, months, message, userstate) => {
        const avatar = await this.getTwitchAvatar(username, userstate?.['user-id']);
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'resub',
          title: 'Twitch Re-Subscriber!',
          author: userstate?.['display-name'] || username,
          avatar: avatar,
          detail: `Resub ${months} bulan!`,
          message: message || '',
          badge: '⭐ RESUB'
        });
      });

      client.on('subgift', async (channel, username, streakMonths, recipient, methods, userstate) => {
        const avatar = await this.getTwitchAvatar(username, userstate?.['user-id']);
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'subgift',
          title: 'Twitch Gift Sub!',
          author: userstate?.['display-name'] || username,
          avatar: avatar,
          detail: `Menghadiahkan sub untuk ${recipient}!`,
          badge: '🎁 GIFT SUB'
        });
      });

      client.on('submysterygift', async (channel, username, numbOfSubs, methods, userstate) => {
        const avatar = await this.getTwitchAvatar(username, userstate?.['user-id']);
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'submysterygift',
          title: 'Twitch Community Gift Subs!',
          author: username,
          avatar: avatar,
          detail: `Menghadiahkan ${numbOfSubs} Sub untuk Komunitas! 🎉`,
          badge: `🎁 ${numbOfSubs} GIFT SUBS`
        });
      });

      client.on('cheer', async (channel, userstate, message) => {
        const bits = userstate.bits || 0;
        const avatar = await this.getTwitchAvatar(userstate.username, userstate['user-id']);
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'cheer',
          title: 'Twitch Bits Cheer!',
          author: userstate['display-name'] || userstate.username,
          avatar: avatar,
          detail: `${bits} Bits 💎`,
          message: message,
          badge: '💎 BITS'
        });

        const isBroadcaster = !!(userstate.badges && userstate.badges.broadcaster) || (userstate.username && userstate.username.toLowerCase() === cleanChannel.toLowerCase());
        const isMod = !!userstate.mod || !!(userstate.badges && userstate.badges.moderator);
        const isSub = !!userstate.subscriber || !!(userstate.badges && userstate.badges.subscriber);
        const isVip = !!(userstate.badges && userstate.badges.vip);
        const badgesList = this.resolveTwitchUserBadges(cleanChannel, userstate.badges, { isBroadcaster, isMod, isSub, isVip });

        const userColor = this.getTwitchUserColor(userstate['display-name'] || userstate.username, userstate.color);
        const msgId = userstate['source-id'] || userstate.id || userstate['msg-id'];
        const dedupeKey = msgId || `${cleanChannel}_${(userstate.username || '').toLowerCase()}_cheer_${message}`;
        if (this.isDuplicateChat(dedupeKey)) return;

        this.broadcastChat('twitch', cleanChannel, {
          id: msgId || userstate.id,
          platform: 'twitch',
          type: 'chat',
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            avatar: avatar,
            color: userColor,
            badges: userstate.badges || {},
            badgesList: badgesList,
            isBroadcaster: isBroadcaster,
            isMod: isMod,
            isSub: isSub,
            isVip: isVip,
            isBits: true
          },
          emotes: userstate.emotes || null,
          text: `[${bits} Bits] ${message}`
        });
      });

      client.on('raided', async (channel, username, viewers) => {
        const avatar = await this.getTwitchAvatar(username);
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'raid',
          title: 'Twitch Incoming Raid!',
          author: username,
          avatar: avatar,
          detail: `Raid bersama ${viewers} penonton! 🔥`,
          badge: '🚀 RAID'
        });
      });

      // 6. Twitch Watch Streak & Viewer Milestones
      client.on('usernotice', async (msgid, channel, tags, message) => {
        const category = tags?.['msg-param-category'] || msgid;
        if (msgid === 'viewermilestone' || category === 'watch-streak') {
          const streakCount = tags?.['msg-param-value'] || tags?.['msg-param-streak-count'] || tags?.['msg-param-streak'] || '1';
          const authorName = tags?.['display-name'] || tags?.login || tags?.username || 'Viewer';
          const avatar = await this.getTwitchAvatar(tags?.login || tags?.username || authorName, tags?.['user-id']);
          const userColor = this.getTwitchUserColor(authorName, tags?.color);
          const sysMsg = tags?.['system-msg'] ? tags['system-msg'].replace(/\\s/g, ' ') : `${authorName} menonton ${streakCount} stream berturut-turut!`;
          const userMsg = (message || '').trim();

          const dedupeKey = tags?.id || `streak_${cleanChannel}_${tags?.['user-id'] || authorName}_${streakCount}`;
          if (this.isDuplicateChat(dedupeKey)) return;

          this.broadcastEvent('twitch', cleanChannel, {
            id: dedupeKey,
            platform: 'twitch',
            type: 'event',
            eventType: 'watch_streak',
            title: 'Twitch Watch Streak!',
            author: authorName,
            authorColor: userColor,
            avatar: avatar,
            streak: parseInt(streakCount, 10) || 1,
            detail: `Watch Streak: ${streakCount} Stream Berturut-turut! 🔥`,
            message: userMsg || sysMsg,
            badge: `🔥 ${streakCount} STREAK`
          });

          if (userMsg) {
            this.broadcastChat('twitch', cleanChannel, {
              id: `${dedupeKey}_chat`,
              platform: 'twitch',
              type: 'chat',
              author: {
                name: authorName,
                username: tags?.login || authorName,
                avatar: avatar,
                color: userColor,
                badges: tags?.badges || {}
              },
              text: `[🔥 Watch Streak ${streakCount}] ${userMsg}`
            });
          }
        }
      });

      await client.connect();

      // Cek jumlah viewer real-time langsung saat pertama connect
      this.fetchRealTwitchViewerCount(cleanChannel).then(count => {
        if (poolItem) {
          poolItem.viewerCount = count;
          this.broadcastViewerCount('twitch', cleanChannel, count);
        }
      }).catch(() => {});

      // EventSub jika token disediakan
      if (cleanToken) {
        this.connectTwitchEventSub(cleanChannel, cleanToken, poolItem);
      }
    } catch (err) {
      console.error(`[Twitch #${cleanChannel}] Connection error:`, err);
      poolItem.status = { status: 'error', message: `Gagal: ${err.message}` };
      this.broadcastStatus('twitch', cleanChannel, 'error', `Gagal: ${err.message}`);
    }
  }

  async unsubscribeTwitch(socketId, cleanChannel) {
    const poolItem = this.twitchPool.get(cleanChannel);
    if (!poolItem) return;

    poolItem.listeners.delete(socketId);
    if (poolItem.listeners.size === 0) {
      // Hapus subscription EventSub jika ada sebelum menutup koneksi
      if (poolItem.subscriptionId && poolItem.clientId && poolItem.token) {
        try {
          await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(poolItem.subscriptionId)}`, {
            method: 'DELETE',
            headers: {
              'Client-Id': poolItem.clientId,
              'Authorization': `Bearer ${poolItem.token}`
            }
          });
          console.log(`[Twitch EventSub] Subscription ${poolItem.subscriptionId} berhasil dibersihkan saat pool ditutup.`);
        } catch (e) {}
        poolItem.subscriptionId = null;
      }
      if (poolItem.followSubId && poolItem.clientId && poolItem.token) {
        try {
          await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(poolItem.followSubId)}`, {
            method: 'DELETE',
            headers: {
              'Client-Id': poolItem.clientId,
              'Authorization': `Bearer ${poolItem.token}`
            }
          });
          console.log(`[Twitch EventSub] Follow Subscription ${poolItem.followSubId} berhasil dibersihkan saat pool ditutup.`);
        } catch (e) {}
        poolItem.followSubId = null;
      }
      if (poolItem.ws) {
        try { poolItem.ws.close(); } catch (e) {}
      }
      if (poolItem.client) {
        try { await poolItem.client.disconnect(); } catch (e) {}
      }
      this.twitchPool.delete(cleanChannel);
      console.log(`[StreamManager] Twitch #${cleanChannel} pool closed (no listeners).`);
    }
  }

  // ==========================================
  // TWITCH EVENTSUB SUBSCRIPTION CLEANUP HELPERS
  // ==========================================
  async cleanupStaleTwitchEventSubs(clientId, token, broadcasterId, currentSessionId) {
    try {
      let res = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${encodeURIComponent(broadcasterId)}`, {
        headers: {
          'Client-Id': clientId,
          'Authorization': `Bearer ${token}`
        },
        signal: AbortSignal.timeout(4500)
      });

      if (!res.ok) {
        res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(4500)
        });
      }

      if (!res.ok) {
        return { isCurrentSessionActive: false, activeSubId: null };
      }

      const listData = await res.json().catch(() => ({}));
      const subs = Array.isArray(listData.data) ? listData.data : [];
      let isCurrentSessionActive = false;
      let activeSubId = null;
      let activeFollowSubId = null;
      let deletedCount = 0;

      for (const sub of subs) {
        const isHandledType = sub.type === 'channel.channel_points_custom_reward_redemption.add' || sub.type === 'channel.follow';
        const isTargetBroadcaster = !sub.condition?.broadcaster_user_id || String(sub.condition?.broadcaster_user_id) === String(broadcasterId);

        if (isHandledType && isTargetBroadcaster) {
          const subSession = sub.transport?.session_id;
          const subStatus = sub.status;

          // Jika subscription ini sudah aktif untuk WebSocket session saat ini
          if (subSession && subSession === currentSessionId && subStatus === 'enabled') {
            if (sub.type === 'channel.channel_points_custom_reward_redemption.add') {
              isCurrentSessionActive = true;
              activeSubId = sub.id;
            } else if (sub.type === 'channel.follow') {
              activeFollowSubId = sub.id;
            }
            continue;
          }

          // Jika subscription ini stale (beda session_id, atau status websocket_disconnected/failed, dsb)
          if (subStatus !== 'enabled' || (subSession && subSession !== currentSessionId) || !subSession) {
            console.log(`[Twitch EventSub] 🧹 Membersihkan subscription stale: ID ${sub.id} (Type: ${sub.type}, Status: ${subStatus}, Session: ${subSession || 'none'})...`);
            try {
              const delRes = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(sub.id)}`, {
                method: 'DELETE',
                headers: {
                  'Client-Id': clientId,
                  'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(3000)
              });
              if (delRes.ok || delRes.status === 204) deletedCount++;
            } catch (delErr) {
              console.warn(`[Twitch EventSub] Gagal menghapus sub ${sub.id}:`, delErr.message);
            }
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`[Twitch EventSub] ✅ Berhasil menghapus ${deletedCount} subscription EventSub stale.`);
      }

      return { isCurrentSessionActive, activeSubId, activeFollowSubId };
    } catch (err) {
      console.warn('[Twitch EventSub] Error pembersihan subscription:', err.message);
      return { isCurrentSessionActive: false, activeSubId: null, activeFollowSubId: null };
    }
  }

  async forceDeleteAllBroadcasterEventSubs(clientId, token, broadcasterId, currentSessionId) {
    try {
      const endpoints = [
        `https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${encodeURIComponent(broadcasterId)}`,
        `https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.channel_points_custom_reward_redemption.add`,
        `https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.follow`,
        `https://api.twitch.tv/helix/eventsub/subscriptions`
      ];

      const seenIds = new Set();
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            headers: {
              'Client-Id': clientId,
              'Authorization': `Bearer ${token}`
            },
            signal: AbortSignal.timeout(4000)
          });
          if (!res.ok) continue;

          const json = await res.json().catch(() => ({}));
          const subs = Array.isArray(json.data) ? json.data : [];

          for (const sub of subs) {
            if (seenIds.has(sub.id)) continue;
            seenIds.add(sub.id);

            const isRedeem = sub.type === 'channel.channel_points_custom_reward_redemption.add';
            const isFollow = sub.type === 'channel.follow';
            const isMatchBroadcaster = !sub.condition?.broadcaster_user_id || String(sub.condition?.broadcaster_user_id) === String(broadcasterId);

            if ((isRedeem || isFollow) && isMatchBroadcaster) {
              if (sub.transport?.session_id === currentSessionId && sub.status === 'enabled') {
                continue;
              }

              console.log(`[Twitch EventSub] 🧹 Force delete lingering sub: ${sub.id}...`);
              await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(sub.id)}`, {
                method: 'DELETE',
                headers: {
                  'Client-Id': clientId,
                  'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(3000)
              }).catch(() => {});
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Twitch EventSub] Error forceDeleteAllBroadcasterEventSubs:', err.message);
    }
  }

  // ==========================================
  // TWITCH EVENTSUB WEBSOCKET (TOKEN BASED)
  // ==========================================
  async connectTwitchEventSub(channelName, rawToken, poolItem) {
    const cleanToken = (rawToken || '').trim().replace(/^(oauth:|bearer\s*)/i, '').trim();
    const cleanChannel = (channelName || '').trim().toLowerCase().replace(/^[#@]/, '');
    if (!cleanToken || !cleanChannel) return;

    if (poolItem._isConnectingEventSub) {
      console.log(`[Twitch EventSub] Koneksi EventSub untuk #${cleanChannel} sedang berjalan, lewati duplikasi.`);
      return;
    }
    poolItem._isConnectingEventSub = true;

    console.log(`[Twitch EventSub] Memvalidasi token OAuth untuk #${cleanChannel}...`);

    try {
      const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${cleanToken}` },
        signal: AbortSignal.timeout(4500)
      });

      if (!validateRes.ok) {
        if (validateRes.status === 401 && typeof this.tokenRefreshHandler === 'function' && !poolItem._isRetryingRefresh) {
          poolItem._isRetryingRefresh = true;
          console.log(`[Twitch EventSub] Token kedaluwarsa (401), mencoba auto-refresh token Twitch untuk #${cleanChannel}...`);
          poolItem._isConnectingEventSub = false;
          const newToken = await this.tokenRefreshHandler(cleanChannel);
          poolItem._isRetryingRefresh = false;
          if (newToken) {
            poolItem.token = newToken;
            return this.connectTwitchEventSub(cleanChannel, newToken, poolItem);
          }
        }

        const errText = await validateRes.text();
        console.error(`[Twitch EventSub] ❌ Token validation gagal (Status ${validateRes.status}):`, errText);
        const isChatActive = poolItem.client && poolItem.status?.status === 'connected';
        if (!isChatActive) {
          this.broadcastStatus('twitch', cleanChannel, 'warning', `Token Twitch tidak valid (${validateRes.status})`);
        }
        return;
      }

      const tokenInfo = await validateRes.json();
      const clientId = tokenInfo.client_id || process.env.TWITCH_CLIENT_ID || 'sea3yunko17ptmjkwf98imtypufch4';
      const tokenUserLogin = (tokenInfo.login || '').toLowerCase();
      const tokenUserId = tokenInfo.user_id;

      console.log(`[Twitch EventSub] ✅ Token valid: User "${tokenUserLogin}" (ID: ${tokenUserId}), Client ID: ${clientId}`);

      poolItem.clientId = clientId;
      poolItem.tokenUserId = tokenUserId;
      poolItem.token = cleanToken;

      // Cek scope izin channel points & followers
      const scopes = Array.isArray(tokenInfo.scopes) ? tokenInfo.scopes : [];
      const hasRedeemScope = scopes.includes('channel:read:redemptions') || scopes.includes('channel:manage:redemptions');
      const hasFollowScope = scopes.includes('moderator:read:followers');
      if (!hasRedeemScope) {
        console.warn(`[Twitch EventSub] ⚠️ Token tidak memiliki scope "channel:read:redemptions"! Scope saat ini:`, scopes);
      }
      if (!hasFollowScope) {
        console.warn(`[Twitch EventSub] ⚠️ Token tidak memiliki scope "moderator:read:followers" untuk Follow alerts! Scope saat ini:`, scopes);
      }

      // Pastikan broadcaster ID sesuai channel yang dimonitor
      let broadcasterId = tokenUserId;
      if (tokenUserLogin !== cleanChannel) {
        try {
          const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(cleanChannel)}`, {
            headers: { 'Client-Id': clientId, Authorization: `Bearer ${cleanToken}` },
            signal: AbortSignal.timeout(4000)
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.data?.[0]?.id) {
              broadcasterId = userData.data[0].id;
              console.log(`[Twitch EventSub] Channel #${cleanChannel} resolved to Broadcaster ID: ${broadcasterId}`);
            }
          }
        } catch (e) {
          console.warn(`[Twitch EventSub] Gagal mencari user ID untuk #${cleanChannel}:`, e.message);
        }
      }
      poolItem.broadcasterId = broadcasterId;

      // Tutup WebSocket lama jika ada dan bersihkan subscription lama
      if (poolItem.subscriptionId) {
        try {
          await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(poolItem.subscriptionId)}`, {
            method: 'DELETE',
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${cleanToken}` },
            signal: AbortSignal.timeout(3000)
          });
        } catch (e) {}
        poolItem.subscriptionId = null;
      }
      if (poolItem.followSubId) {
        try {
          await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(poolItem.followSubId)}`, {
            method: 'DELETE',
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${cleanToken}` },
            signal: AbortSignal.timeout(3000)
          });
        } catch (e) {}
        poolItem.followSubId = null;
      }

      if (poolItem.ws) {
        try { poolItem.ws.close(); } catch (e) {}
        poolItem.ws = null;
      }

      const connectWs = (wsUrl = 'wss://eventsub.wss.twitch.tv/ws', isReconnect = false) => {
        console.log(`[Twitch EventSub] Membuka koneksi WebSocket ke ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);
        poolItem.ws = ws;

        ws.on('open', () => {
          console.log(`[Twitch EventSub] WebSocket terhubung untuk #${cleanChannel}`);
        });

        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            const msgType = message.metadata?.message_type;

            if (msgType === 'session_welcome') {
              const sessionId = message.payload?.session?.id;
              console.log(`[Twitch EventSub] Welcome diterima! Session ID: ${sessionId}`);

              if (isReconnect) {
                console.log(`[Twitch EventSub] Reconnect berhasil, subscriptions dipindahkan otomatis oleh Twitch.`);
                const statusFeatures = ['Chat Aktif'];
                if (poolItem.subscriptionId) statusFeatures.push('Channel Points 💠');
                if (poolItem.followSubId) statusFeatures.push('Follow Alerts ➕');
                const reconMsg = `Terhubung ke #${cleanChannel} (${statusFeatures.join(' • ')})`;
                poolItem.status = { status: 'connected', message: reconMsg };
                this.broadcastStatus('twitch', cleanChannel, 'connected', reconMsg);
                return;
              }

              // 1. Bersihkan subscription lama yang stale agar tidak menabrak batas kuota maks
              const { isCurrentSessionActive, activeSubId, activeFollowSubId } = await this.cleanupStaleTwitchEventSubs(
                clientId,
                cleanToken,
                broadcasterId,
                sessionId
              );

              // Setup Subscription Channel Points
              if (isCurrentSessionActive && activeSubId) {
                poolItem.subscriptionId = activeSubId;
                console.log(`[Twitch EventSub] ✅ Subscription Channel Points SUDAH AKTIF untuk #${cleanChannel} (ID: ${activeSubId})`);
              } else {
                const createSubscription = async () => {
                  return await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                    method: 'POST',
                    headers: {
                      'Client-Id': clientId,
                      Authorization: `Bearer ${cleanToken}`,
                      'Content-Type': 'application/json'
                    },
                    signal: AbortSignal.timeout(5000),
                    body: JSON.stringify({
                      type: 'channel.channel_points_custom_reward_redemption.add',
                      version: '1',
                      condition: { broadcaster_user_id: broadcasterId },
                      transport: { method: 'websocket', session_id: sessionId }
                    })
                  });
                };

                let subRes = await createSubscription();
                let subData = await subRes.json().catch(() => ({}));

                const errMsg = (subData.message || '').toLowerCase();
                if (!subRes.ok && (errMsg.includes('maximum subscription') || subRes.status === 400 || subRes.status === 409)) {
                  console.warn(`[Twitch EventSub] Kuota EventSub penuh (${subData.message || subRes.status}). Menjalankan pembersihan menyeluruh...`);
                  await this.forceDeleteAllBroadcasterEventSubs(clientId, cleanToken, broadcasterId, sessionId);
                  await new Promise(resolve => setTimeout(resolve, 600));

                  subRes = await createSubscription();
                  subData = await subRes.json().catch(() => ({}));
                }

                if (subRes.ok || subRes.status === 202) {
                  poolItem.subscriptionId = subData.data?.[0]?.id;
                  console.log(`[Twitch EventSub] ✅ Subscription Channel Points BERHASIL aktif untuk #${cleanChannel} (ID: ${poolItem.subscriptionId}, Broadcaster: ${broadcasterId})`);
                } else {
                  console.warn(`[Twitch EventSub] ⚠️ Tidak dapat mengaktifkan EventSub Channel Points (Status ${subRes.status}):`, subData);
                }
              }

              // 2. Setup Subscription Follow jika memiliki scope moderator:read:followers
              if (hasFollowScope) {
                if (activeFollowSubId) {
                  poolItem.followSubId = activeFollowSubId;
                  console.log(`[Twitch EventSub] ✅ Subscription Follow SUDAH AKTIF untuk #${cleanChannel} (ID: ${activeFollowSubId})`);
                } else {
                  const createFollowSubscription = async () => {
                    return await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                      method: 'POST',
                      headers: {
                        'Client-Id': clientId,
                        Authorization: `Bearer ${cleanToken}`,
                        'Content-Type': 'application/json'
                      },
                      signal: AbortSignal.timeout(5000),
                      body: JSON.stringify({
                        type: 'channel.follow',
                        version: '2',
                        condition: {
                          broadcaster_user_id: broadcasterId,
                          moderator_user_id: tokenUserId
                        },
                        transport: { method: 'websocket', session_id: sessionId }
                      })
                    });
                  };

                  let followRes = await createFollowSubscription();
                  let followData = await followRes.json().catch(() => ({}));
                  if (followRes.ok || followRes.status === 202) {
                    poolItem.followSubId = followData.data?.[0]?.id;
                    console.log(`[Twitch EventSub] ✅ Subscription Follow BERHASIL aktif untuk #${cleanChannel} (ID: ${poolItem.followSubId})`);
                  } else {
                    console.warn(`[Twitch EventSub] ⚠️ Tidak dapat mengaktifkan EventSub Follow (Status ${followRes.status}):`, followData);
                  }
                }
              }

              const activeFeatures = ['Chat Aktif'];
              if (poolItem.subscriptionId) activeFeatures.push('Channel Points 💠');
              if (poolItem.followSubId) activeFeatures.push('Follow Alerts ➕');
              const finalStatusMsg = `Terhubung ke #${cleanChannel} (${activeFeatures.join(' • ')})`;
              poolItem.status = { status: 'connected', message: finalStatusMsg };
              this.broadcastStatus('twitch', cleanChannel, 'connected', finalStatusMsg);
            } else if (msgType === 'session_reconnect') {
              const reconnectUrl = message.payload?.session?.reconnect_url;
              console.log(`[Twitch EventSub] Reconnecting ke: ${reconnectUrl}`);
              if (reconnectUrl) {
                connectWs(reconnectUrl, true);
              }
            } else if (msgType === 'session_keepalive') {
              // Heartbeat keepalive dari Twitch
            } else if (msgType === 'notification') {
              const subType = message.metadata?.subscription_type;
              const event = message.payload?.event;
              if (!event) return;

              if (subType === 'channel.channel_points_custom_reward_redemption.add') {
                const authorName = event.user_name || event.user_login || 'Viewer';
                const rewardTitle = event.reward?.title || 'Reward';
                const rewardCost = event.reward?.cost || 0;
                const userInput = (event.user_input || '').trim();
                const dedupeKey = `eventsub_${event.id || `${authorName}_${rewardTitle}_${userInput}`}`;

                if (this.isDuplicateRedeem(dedupeKey)) return;

                console.log(`[Twitch EventSub] 💠 REDEEM DETECTED: ${authorName} menukar "${rewardTitle}" (${rewardCost} Points)${userInput ? ` - Pesan: "${userInput}"` : ''}`);

                this.broadcastEvent('twitch', cleanChannel, {
                  id: dedupeKey,
                  platform: 'twitch',
                  type: 'event',
                  eventType: 'redeem',
                  title: 'Twitch Channel Points Redeem!',
                  author: authorName,
                  detail: `${rewardTitle} (${rewardCost.toLocaleString('en-US')} Points)`,
                  message: userInput,
                  badge: '💠 REDEEM'
                });
              } else if (subType === 'channel.follow') {
                const authorName = event.user_name || event.user_login || 'Viewer';
                const dedupeKey = `twitch_follow_${event.user_id || authorName}_${event.followed_at || Date.now()}`;

                if (this.isDuplicateEvent(dedupeKey)) return;

                console.log(`[Twitch EventSub] ➕ NEW FOLLOWER: ${authorName} baru saja follow #${cleanChannel}!`);

                this.broadcastEvent('twitch', cleanChannel, {
                  id: dedupeKey,
                  platform: 'twitch',
                  type: 'event',
                  eventType: 'follow',
                  title: 'New Twitch Follower!',
                  author: authorName,
                  detail: `${authorName} baru saja mengikuti (follow) channel Anda! 🎉`,
                  message: 'is now following!',
                  badge: '➕ TWITCH FOLLOW'
                });
              }
            }
          } catch (err) {
            console.error('[Twitch EventSub] Error memproses pesan WS:', err);
          }
        });

        ws.on('close', (code, reason) => {
          console.warn(`[Twitch EventSub] WebSocket terputus (${code}): ${reason || 'Closed'}`);
          // Auto-reconnect jika channel masih aktif di pool dan socket ini adalah yang aktif
          if (poolItem.ws === ws && this.twitchPool.has(cleanChannel)) {
            const currentItem = this.twitchPool.get(cleanChannel);
            if (currentItem && currentItem.token === cleanToken && currentItem.listeners && currentItem.listeners.size > 0) {
              console.log(`[Twitch EventSub] Mencoba menghubungkan kembali dalam 5 detik...`);
              setTimeout(() => {
                if (this.twitchPool.has(cleanChannel) && poolItem.ws === ws) {
                  connectWs();
                }
              }, 5000);
            }
          }
        });

        ws.on('error', (err) => {
          console.error('[Twitch EventSub] WebSocket error:', err.message);
        });
      };

      connectWs();
    } catch (err) {
      console.error('[Twitch EventSub] Exception:', err);
    } finally {
      poolItem._isConnectingEventSub = false;
    }
  }

  // ==========================================
  // YOUTUBE SUBSCRIPTION & POOLING
  // ==========================================
  parseYouTubeInput(input) {
    let str = (input || '').trim();
    // 1. Live video URL (e.g. watch?v=..., youtu.be/..., /live/...)
    const vMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (vMatch && vMatch[1]) return { liveId: vMatch[1] };

    // 2. Handle (@channel) extracted from URL or direct input
    const handleMatch = str.match(/@([a-zA-Z0-9_.-]+)/i);
    if (handleMatch && handleMatch[1]) return { handle: `@${handleMatch[1]}` };

    // 3. Channel ID (UC...) from URL or direct input
    const chMatch = str.match(/(UC[a-zA-Z0-9_-]{20,})/);
    if (chMatch && chMatch[1]) return { channelId: chMatch[1] };

    // 4. Standalone 11-char video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return { liveId: str };

    // 5. Default: treat as clean handle
    const clean = str.replace(/^[#@]/, '').trim();
    return { handle: `@${clean}` };
  }

  async subscribeYouTube(socket, input, force = false) {
    const cleanYt = input.trim();
    let poolItem = this.youtubePool.get(cleanYt);

    if (poolItem) {
      poolItem.listeners.add(socket.id);
      if (!force && (poolItem.status.status === 'connected' || poolItem.status.status === 'connecting')) {
        socket.emit('platform_status', {
          platform: 'youtube',
          channel: cleanYt,
          status: poolItem.status.status,
          message: poolItem.status.message
        });
        return;
      }
      console.log(`[YouTube ${cleanYt}] Menyambungkan ulang sesi YouTube${force ? ' (Force Refresh)' : ''}...`);
      if (poolItem.liveChat) {
        try { poolItem.liveChat.stop('Reconnecting'); } catch (e) {}
        poolItem.liveChat = null;
      }
    } else {
      poolItem = {
        channel: cleanYt,
        liveChat: null,
        listeners: new Set([socket.id]),
        status: { status: 'connecting', message: `Mencari live stream YouTube: ${cleanYt}...` }
      };
      this.youtubePool.set(cleanYt, poolItem);
    }

    poolItem.status = { status: 'connecting', message: `Mencari live stream YouTube: ${cleanYt}...` };
    this.broadcastStatus('youtube', cleanYt, 'connecting', `Mencari live stream YouTube: ${cleanYt}...`);

    try {
      const target = this.parseYouTubeInput(cleanYt);
      const liveChat = new LiveChat(target);
      poolItem.liveChat = liveChat;

      liveChat.on('start', (liveId) => {
        poolItem.liveId = liveId;
        poolItem.status = { status: 'connected', message: `Terhubung ke YouTube Live (ID: ${liveId})` };
        this.broadcastStatus('youtube', cleanYt, 'connected', `Terhubung ke YouTube Live (ID: ${liveId})`, { liveId });

        // Langsung ambil jumlah viewer real-time seketika saat connect
        this.fetchRealYouTubeViewerCount(liveId).then(count => {
          if (poolItem) {
            poolItem.viewerCount = count;
            this.broadcastViewerCount('youtube', cleanYt, count);
          }
        }).catch(() => {});
      });

      liveChat.on('end', (reason) => {
        poolItem.status = { status: 'disconnected', message: `Live chat berakhir: ${reason || 'Selesai'}` };
        this.broadcastStatus('youtube', cleanYt, 'disconnected', `Live chat berakhir: ${reason || 'Selesai'}`);
      });

      liveChat.on('error', (err) => {
        let rawMsg = err.message || 'Stream offline';
        let msg = rawMsg;
        if (rawMsg.includes('503')) {
          msg = 'YouTube Error 503 (IP Diblokir): Masukkan link/URL video live streaming langsung (contoh: https://youtube.com/watch?v=...) atau coba lagi beberapa saat.';
        } else if (rawMsg.toLowerCase().includes('not found') || rawMsg.toLowerCase().includes('offline')) {
          msg = `YouTube Offline: Live stream untuk "${cleanYt}" tidak ditemukan atau belum live. Klik "Segarkan Koneksi" jika stream baru dimulai.`;
        }
        poolItem.status = { status: 'error', message: msg };
        this.broadcastStatus('youtube', cleanYt, 'error', msg);
      });

      liveChat.on('chat', (chatItem) => {
        if (chatItem.id && this.isDuplicateChat(chatItem.id)) return;
        const text = (chatItem.message || []).map((m) => {
          if ('text' in m) return m.text;
          if ('emojiText' in m) return m.emojiText;
          return '';
        }).join('');

        if (chatItem.isGiftMembership) {
          this.broadcastEvent('youtube', cleanYt, {
            platform: 'youtube',
            type: 'event',
            eventType: 'gift_member',
            title: 'YouTube Gift Memberships!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: text || 'Menghadiahkan langganan Membership!',
            badge: '🎁 GIFT MEMBER'
          });
        } else if (chatItem.superchat && chatItem.superchat.sticker) {
          this.broadcastEvent('youtube', cleanYt, {
            platform: 'youtube',
            type: 'event',
            eventType: 'supersticker',
            title: 'YouTube Super Sticker!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: `${chatItem.superchat.amount} • ${chatItem.superchat.sticker.alt || 'Super Sticker'}`,
            stickerUrl: chatItem.superchat.sticker.url,
            color: chatItem.superchat.color || '#ffb300',
            badge: `⭐ STICKER ${chatItem.superchat.amount}`
          });
        } else if (chatItem.superchat) {
          const isJewels = text.toLowerCase().includes('jewel') || chatItem.superchat.amount.toLowerCase().includes('jewel');
          this.broadcastEvent('youtube', cleanYt, {
            platform: 'youtube',
            type: 'event',
            eventType: isJewels ? 'jewels' : 'superchat',
            title: isJewels ? 'YouTube Jewels Gift!' : 'YouTube Super Chat!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: chatItem.superchat.amount,
            message: text,
            color: chatItem.superchat.color || '#ff0000',
            badge: isJewels ? `💎 ${chatItem.superchat.amount}` : `💰 ${chatItem.superchat.amount}`
          });
        } else if (chatItem.isMembership && /^(welcome to|member for|joined|baru bergabung|anggota selama|selamat bergabung)/i.test(text.trim())) {
          this.broadcastEvent('youtube', cleanYt, {
            platform: 'youtube',
            type: 'event',
            eventType: 'member',
            title: 'YouTube Member Milestone / Join!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: text,
            badge: '⭐ MEMBER'
          });
        }

        const messageParts = (chatItem.message || []).map((m) => {
          if ('text' in m) {
            return { type: 'text', text: m.text };
          }
          if ('url' in m && m.url) {
            return {
              type: 'emoji',
              url: m.url,
              alt: m.alt || m.emojiText || '',
              emojiText: m.emojiText || ''
            };
          }
          return { type: 'text', text: m.emojiText || '' };
        });

        this.broadcastChat('youtube', cleanYt, {
          platform: 'youtube',
          type: 'chat',
          id: chatItem.id,
          author: {
            name: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            isOwner: chatItem.isOwner,
            isMod: chatItem.isModerator,
            isSub: chatItem.isMembership,
            memberBadge: chatItem.author.badge?.thumbnail?.url || null
          },
          text: text,
          messageParts: messageParts,
          superchat: chatItem.superchat ? { amount: chatItem.superchat.amount, color: chatItem.superchat.color } : null,
          timestamp: chatItem.timestamp ? new Date(chatItem.timestamp).getTime() : Date.now()
        });
      });

      const ok = await liveChat.start();
      if (!ok) {
        this.broadcastStatus('youtube', cleanYt, 'error', 'Tidak dapat menemukan live stream aktif.');
      }
    } catch (err) {
      console.error(`[YouTube ${cleanYt}] Exception:`, err);
      let errMsg = `Gagal: ${err.message}`;
      if (err.message && err.message.includes('503')) {
        errMsg = `YouTube Error 503 (IP Diblokir): Masukkan link/URL video live streaming langsung (contoh: https://youtube.com/watch?v=...) atau coba lagi beberapa saat.`;
      }
      poolItem.status = { status: 'error', message: errMsg };
      this.broadcastStatus('youtube', cleanYt, 'error', errMsg);
    }
  }

  async unsubscribeYouTube(socketId, cleanYt) {
    const poolItem = this.youtubePool.get(cleanYt);
    if (!poolItem) return;

    poolItem.listeners.delete(socketId);
    if (poolItem.listeners.size === 0) {
      if (poolItem.liveChat) {
        try { poolItem.liveChat.stop('No listeners'); } catch (e) {}
      }
      this.youtubePool.delete(cleanYt);
      console.log(`[StreamManager] YouTube ${cleanYt} pool closed (no listeners).`);
    }
  }

  // ==========================================
  // TIKTOK SUBSCRIPTION & POOLING
  // ==========================================
  async resolveTikTokRoomId(uniqueId) {
    if (!uniqueId || /^\d{15,22}$/.test(uniqueId)) return uniqueId;
    try {
      const res = await axios.get(`https://www.tiktok.com/api-live/user/room/?uniqueId=${encodeURIComponent(uniqueId)}&sourceType=54&aid=1988`, {
        timeout: 4500,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': `https://www.tiktok.com/@${uniqueId}/live`
        }
      });
      const roomId = res.data?.data?.user?.roomId || res.data?.data?.liveRoom?.roomId;
      if (roomId && /^\d{15,22}$/.test(String(roomId))) {
        return String(roomId);
      }
    } catch (e) {}

    try {
      const res = await axios.get(`https://www.tiktok.com/@${encodeURIComponent(uniqueId)}/live`, {
        timeout: 4500,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      });
      const html = typeof res.data === 'string' ? res.data : '';
      const roomMatch = html.match(/"roomId"\s*:\s*"(\d{15,22})"/i) || html.match(/room[_-]?id["']?\s*[:=]\s*["']?(\d{15,22})/i);
      if (roomMatch && roomMatch[1]) {
        return roomMatch[1];
      }
    } catch (e) {}

    return null;
  }

  

  // Smart Exponential Backoff dengan Jitter acak agar tidak dicurigai bot oleh TikTok
  calculateRetryDelay(poolItem, isOffline = true) {
    poolItem.retryCount = (poolItem.retryCount || 0) + 1;
    let baseDelay = 10000;
    if (poolItem.retryCount === 1) baseDelay = 10000;
    else if (poolItem.retryCount === 2) baseDelay = 15000;
    else if (poolItem.retryCount === 3) baseDelay = 25000;
    else if (poolItem.retryCount === 4) baseDelay = 40000;
    else baseDelay = isOffline ? 60000 : 30000; // Maksimal jeda 60 detik (tidak membebani TikTok & tidak spam)

    // Jitter acak 1000 - 4000 ms agar tidak membentuk pola waktu kaku
    const jitter = Math.floor(Math.random() * 3000) + 1000;
    return baseDelay + jitter;
  }

    // Layer 2: Client-Assisted Stream Relay (OBS CEF / Browser Home IP fallback)
  handleClientRelay(socket, payload) {
    if (!payload || !payload.platform || payload.platform !== 'tiktok') return;
    const { channel, type, chat, event, viewerCount } = payload;
    const cleanUsername = this.parseTikTokInput(channel);
    if (!cleanUsername) return;

    if (type === 'chat' && chat) {
      this.broadcastChat('tiktok', cleanUsername, chat);
    } else if (type === 'event' && event) {
      this.broadcastEvent('tiktok', cleanUsername, event);
    } else if (type === 'viewer_count' && (typeof viewerCount === 'number' || typeof viewerCount === 'string')) {
      const safeCount = Number(viewerCount);
      if (!isNaN(safeCount) && safeCount >= 0) {
        this.broadcastViewerCount('tiktok', cleanUsername, safeCount);
      }
    }
  }
  async subscribeTikTok(socket, username, isForce = false, tiktokSessionId = '') {
    const cleanUsername = this.parseTikTokInput(username);
    if (!cleanUsername) return;

    let poolItem = this.tiktokPool.get(cleanUsername);

    if (poolItem) {
      poolItem.listeners.add(socket.id);
      if (tiktokSessionId) poolItem.sessionId = tiktokSessionId;

      // Gunakan pool yang ada HANYA jika bukan force refresh
      if (!isForce && poolItem.connection && (poolItem.status.status === 'connected' || poolItem.status.status === 'connecting')) {
        socket.emit('platform_status', {
          platform: 'tiktok',
          channel: cleanUsername,
          status: poolItem.status.status,
          message: poolItem.status.message
        });
        if (typeof poolItem.viewerCount === 'number') {
          socket.emit('viewer_count', {
            platform: 'tiktok',
            channel: cleanUsername,
            count: poolItem.viewerCount,
            timestamp: Date.now()
          });
        }
        return;
      }

      // Hancurkan koneksi/cache lama dan sambungkan fresh ke Room ID terbaru TikTok!
      console.log(`[TikTok @${cleanUsername}] Segarkan koneksi diminta (isForce=${isForce}): Membersihkan koneksi lama dan cache Room ID...`);
      clearTimeout(poolItem.reconnectTimer);
      clearTimeout(poolItem.likeDebounceTimer);
      clearTikTokRoomIdCache(cleanUsername);
      if (poolItem.connection) {
        try {
          poolItem.connection.removeAllListeners?.();
          poolItem.connection.disconnect();
        } catch (e) {}
        poolItem.connection = null;
      }
      poolItem.roomId = '';
      poolItem.retryCount = 0;
      poolItem.lastConnectedTime = 0;
      poolItem.status = { status: 'connecting', message: `Menghubungkan ke TikTok LIVE @${cleanUsername}...` };
      this.broadcastStatus('tiktok', cleanUsername, 'connecting', `Menghubungkan ke TikTok LIVE @${cleanUsername}...`);
    } else {
      clearTikTokRoomIdCache(cleanUsername);
      poolItem = {
        channel: cleanUsername,
        sessionId: tiktokSessionId || '',
        connection: null,
        roomId: '',
        listeners: new Set([socket.id]),
        status: { status: 'connecting', message: `Menghubungkan ke TikTok LIVE @${cleanUsername}...` },
        likeDebounceTimer: null,
        pendingLikes: {},
        reconnectTimer: null,
        lastConnectedTime: 0,
        retryCount: 0,
        isClosed: false
      };
      this.tiktokPool.set(cleanUsername, poolItem);
    }

    poolItem.isClosed = false;
    await this.startTikTokConnection(poolItem, cleanUsername);
  }

  /**
   * Jadwalkan percobaan konek ulang TikTok dengan jeda bertahap.
   * Mengembalikan delay (ms) jika dijadwalkan, atau 0 jika batas percobaan habis / tidak ada listener.
   */
  scheduleTikTokRetry(poolItem, cleanUsername) {
    if (poolItem.isClosed || poolItem.listeners.size === 0) return 0;
    poolItem.retryCount = (poolItem.retryCount || 0) + 1;
    if (poolItem.retryCount > TIKTOK_MAX_RETRIES) return 0;
    const delay = TIKTOK_RETRY_DELAYS_MS[poolItem.retryCount - 1];
    clearTimeout(poolItem.reconnectTimer);
    poolItem.reconnectTimer = setTimeout(() => {
      if (!poolItem.isClosed && poolItem.listeners.size > 0) {
        clearTikTokRoomIdCache(cleanUsername);
        this.startTikTokConnection(poolItem, cleanUsername);
      }
    }, delay);
    console.log(`[TikTok @${cleanUsername}] Auto-reconnect dijadwalkan ${Math.round(delay / 1000)} detik lagi (percobaan ${poolItem.retryCount}/${TIKTOK_MAX_RETRIES}).`);
    return delay;
  }

  async startTikTokConnection(poolItem, cleanUsername) {
    if (poolItem.isClosed || poolItem.listeners.size === 0) return;

    if (poolItem.connection) {
      try { poolItem.connection.disconnect(); } catch (e) {}
      poolItem.connection = null;
    }

    poolItem.status = { status: 'connecting', message: `Menghubungkan ke TikTok LIVE @${cleanUsername}...` };
    this.broadcastStatus('tiktok', cleanUsername, 'connecting', `Menghubungkan ke TikTok LIVE @${cleanUsername}...`);

    // =========================================================================
    // LAYER 1: PRIMARY NATIVE ENGINE (Zero signing server, direct Webcast WSS)
    // =========================================================================
    if (TikTokLiveClient) {
    try {
      const pirateClient = new TikTokLiveClient(cleanUsername);
      pirateClient.maxRetries(5); // Izinkan internal reconnect loop hingga 5x tanpa mematikan koneksi
      pirateClient.timeout(10000);  // 10 detik timeout HTTP
      pirateClient.staleTimeout(180000); // 3 menit (180.000 ms) - JANGAN 15 detik agar tidak terputus saat chat sedang hening
      pirateClient.heartbeatInterval(10000); // Kirim heartbeat ping setiap 10 detik untuk menjaga WebSocket tetap aktif
      const sId = (poolItem.sessionId || globalThis._activeTikTokSessionId || process.env.TIKTOK_SESSION_ID || '').trim();
      if (sId) {
        pirateClient.cookies(`sessionid=${sId}; sessionid_ss=${sId}; sid_tt=${sId}`);
      }
      poolItem.connection = pirateClient;

      pirateClient.on(PirateEventType.connected, (data) => {
        clearTimeout(poolItem.reconnectTimer);
        const roomId = pirateClient.roomId || data?.roomId || '';
        if (roomId && /^\d{15,22}$/.test(String(roomId))) {
          setTikTokRoomIdCache(cleanUsername, { roomId: String(roomId), timestamp: Date.now() });
        }
        poolItem.roomId = String(roomId || '');
        poolItem.retryCount = 0;
        poolItem.lastConnectedTime = Date.now();
        poolItem.status = { status: 'connected', message: `Terhubung ke TikTok @${cleanUsername}` };
        this.broadcastStatus('tiktok', cleanUsername, 'connected', `Terhubung ke TikTok @${cleanUsername}`, { roomId });
        
        this.fetchRealTikTokViewerCount(cleanUsername, poolItem.roomId).then(count => {
          if (count >= 0 && poolItem) {
            poolItem.viewerCount = count;
            this.broadcastViewerCount('tiktok', cleanUsername, count);
          }
        }).catch(() => {});
      });

      pirateClient.on(PirateEventType.chat, (data) => {
        const text = (data.content || '').trim();
        if (!text) return;
        const rawMsgId = data.msgId || data.common?.msgId || data.id;
        const cleanMsgId = rawMsgId ? String(rawMsgId).trim() : '';
        const authorName = data.user?.nickname || data.user?.displayId || 'User';
        const authorUsername = data.user?.displayId || '';
        const normalizedUser = (authorUsername || authorName).toLowerCase();
        
        // Stabilize deduplication key across TikTok reconnect replays
        const dedupeKey = cleanMsgId ? `tt_${cleanMsgId}` : `tt_${cleanUsername}_${normalizedUser}_${text.toLowerCase()}`;
        if (this.isDuplicateChat(dedupeKey)) return;

        // Generate stable, consistent chat ID for client-side caching
        const stableId = cleanMsgId ? `tt_chat_${cleanMsgId}` : `tt_chat_${cleanUsername}_${encodeURIComponent(normalizedUser)}_${encodeURIComponent(text.substring(0, 32))}`;

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          id: stableId,
          author: {
            name: authorName,
            username: authorUsername,
            avatar: data.user?.avatarThumb?.urlList?.[0] || '',
            isMod: !!(data.user?.userAttr?.isAdmin || data.user?.userAttr?.isSuperAdmin),
            isSub: !!(data.user?.userAttr?.isSubscribe)
          },
          text: text,
          timestamp: Number(data.createTime) || Date.now()
        });
      });

      pirateClient.on(PirateEventType.gift, (data) => {
        const count = data.repeatCount || 1;
        const authorName = data.user?.nickname || data.user?.displayId || 'User';
        const authorUsername = data.user?.displayId || '';
        const giftName = data.gift?.name || 'Gift';
        const totalDiamonds = (data.gift?.diamondCount || 0) * count;
        const giftPictureUrl = data.gift?.image?.urlList?.[0] || data.gift?.icon?.urlList?.[0] || data.gift?.giftPictureUrl || '';
        const giftId = data.gift?.id || data.gift?.giftId || 0;

        this.broadcastEvent('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'event',
          eventType: 'gift',
          title: 'TikTok Gift!',
          author: authorName,
          avatar: data.user?.avatarThumb?.urlList?.[0] || '',
          detail: `${giftName} x${count}`,
          badge: `🎁 ${giftName} x${count}`,
          giftName: giftName,
          giftPictureUrl: giftPictureUrl,
          giftId: giftId,
          count: count,
          diamonds: totalDiamonds
        });

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          isGift: true,
          author: { name: authorName, username: authorUsername, avatar: data.user?.avatarThumb?.urlList?.[0] || '' },
          text: `Mengirim Hadiah ${giftName} x${count}`
        });
      });

      pirateClient.on(PirateEventType.like, (data) => {
        const user = data.user?.nickname || data.user?.displayId || 'User';
        const avatar = data.user?.avatarThumb?.urlList?.[0] || '';
        const count = data.count || 1;
        if (!poolItem.pendingLikes[user]) {
          poolItem.pendingLikes[user] = { count: 0, avatar: '' };
        }
        poolItem.pendingLikes[user].count += count;
        if (avatar) {
          poolItem.pendingLikes[user].avatar = avatar;
        }

        if (!poolItem.likeDebounceTimer) {
          poolItem.likeDebounceTimer = setTimeout(() => {
            for (const [authorName, item] of Object.entries(poolItem.pendingLikes)) {
              const totalLiked = item.count;
              if (totalLiked >= 3) {
                this.broadcastEvent('tiktok', cleanUsername, {
                  platform: 'tiktok',
                  type: 'event',
                  eventType: 'like',
                  title: 'TikTok Likes!',
                  author: authorName,
                  avatar: item.avatar || '',
                  detail: `Mengirim ${totalLiked} likes! ❤️`,
                  badge: `❤️ +${totalLiked}`
                });
              }
            }
            poolItem.pendingLikes = {};
            poolItem.likeDebounceTimer = null;
          }, 2500);
        }
      });

      // Central handler for TikTok Follow events
      const handleTikTokFollow = (data) => {
        if (!data) return;
        const authorName = data.user?.nickname || data.user?.displayId || 'User';
        const authorUsername = data.user?.displayId || authorName;
        const avatar = data.user?.avatarThumb?.urlList?.[0] || '';
        const userId = data.user?.id || authorUsername;
        const dedupeKey = `tt_follow_${userId}_${Math.floor(Date.now() / 8000)}`;

        if (this.isDuplicateEvent(dedupeKey)) return;

        console.log(`[TikTok @${cleanUsername}] ➕ NEW FOLLOWER: ${authorName} (@${authorUsername})`);

        // 1. Broadcast event (for OBS alerts, goal widgets, overlays & chat event listener)
        this.broadcastEvent('tiktok', cleanUsername, {
          id: dedupeKey,
          platform: 'tiktok',
          type: 'event',
          eventType: 'follow',
          title: 'New TikTok Follower!',
          author: authorName,
          authorUsername: authorUsername,
          avatar: avatar,
          detail: 'Mulai mengikuti siaran live! 🌟',
          badge: '➕ FOLLOW'
        });

        // 2. Broadcast to chat feed so it immediately appears in the live chat stream & OBS dock
        this.broadcastChat('tiktok', cleanUsername, {
          id: `chat_${dedupeKey}`,
          platform: 'tiktok',
          type: 'chat',
          isFollow: true,
          author: { name: authorName, username: authorUsername, avatar: avatar },
          text: 'Mulai mengikuti siaran live! 🌟'
        });
      };

      // Central handler for TikTok Share events
      const handleTikTokShare = (data) => {
        if (!data) return;
        const authorName = data.user?.nickname || data.user?.displayId || 'User';
        const authorUsername = data.user?.displayId || authorName;
        const avatar = data.user?.avatarThumb?.urlList?.[0] || '';
        const dedupeKey = `tt_share_${authorUsername}_${Math.floor(Date.now() / 8000)}`;

        if (this.isDuplicateEvent(dedupeKey)) return;

        console.log(`[TikTok @${cleanUsername}] 📢 SHARE: ${authorName} (@${authorUsername})`);

        this.broadcastEvent('tiktok', cleanUsername, {
          id: dedupeKey,
          platform: 'tiktok',
          type: 'event',
          eventType: 'share',
          title: 'TikTok Share!',
          author: authorName,
          authorUsername: authorUsername,
          avatar: avatar,
          detail: 'Membagikan LIVE streaming! 📢',
          badge: '📢 SHARE'
        });

        this.broadcastChat('tiktok', cleanUsername, {
          id: `chat_${dedupeKey}`,
          platform: 'tiktok',
          type: 'chat',
          isShare: true,
          author: { name: authorName, username: authorUsername, avatar: avatar },
          text: 'Membagikan siaran live ke teman! 📢'
        });
      };

      // Direct listener for PirateEventType.follow ('follow')
      if (PirateEventType.follow) {
        pirateClient.on(PirateEventType.follow, (data) => {
          handleTikTokFollow(data);
        });
      }

      // Direct listener for PirateEventType.share ('share')
      if (PirateEventType.share) {
        pirateClient.on(PirateEventType.share, (data) => {
          handleTikTokShare(data);
        });
      }

      // Social messages (WebcastSocialMessage) - action === 1 is follow, 2..5 is share
      pirateClient.on(PirateEventType.social, (data) => {
        const action = Number(data.action ?? 0);
        const displayType = String(data.displayType || '').toLowerCase();
        const content = String(data.content || '').toLowerCase();

        const isFollow = action === 1 ||
                         data.action === 'follow' ||
                         displayType.includes('follow') ||
                         content.includes('follow');

        if (isFollow) {
          handleTikTokFollow(data);
        } else if (action >= 2 && action <= 5 || data.action === 'share' || displayType.includes('share') || content.includes('share')) {
          handleTikTokShare(data);
        }
      });

      // Member messages (WebcastMemberMessage) - check if action or displayType indicates follow
      if (PirateEventType.member) {
        pirateClient.on(PirateEventType.member, (data) => {
          const action = Number(data.action ?? 0);
          const displayType = String(data.displayType || '').toLowerCase();
          if (displayType.includes('follow') || action === 3) {
            handleTikTokFollow(data);
          }
        });
      }

      pirateClient.on(PirateEventType.roomUserSeq, (data) => {
        const rawCount = data.viewerCount ?? data.totalUser ?? data.current ?? data.total;
        const count = Number(rawCount);
        if (!isNaN(count) && count >= 0) {
          poolItem.viewerCount = count;
          this.broadcastViewerCount('tiktok', cleanUsername, count);
        }
      });

      pirateClient.on(PirateEventType.liveEnded, () => {
        clearTimeout(poolItem.reconnectTimer);
        poolItem.reconnectTimer = null;
        console.log(`[TikTok @${cleanUsername}] Live stream berakhir. Membersihkan sesi & standby.`);
        clearTikTokRoomIdCache(cleanUsername);
        poolItem.roomId = '';
        poolItem.viewerCount = 0;
        this.broadcastViewerCount('tiktok', cleanUsername, 0);
        if (poolItem.connection) {
          try {
            poolItem.connection.removeAllListeners?.();
            poolItem.connection.disconnect();
          } catch (e) {}
          poolItem.connection = null;
        }
        const endMsg = `TikTok LIVE @${cleanUsername} telah berakhir. Klik 'Segarkan Koneksi' saat Anda mulai siaran berikutnya.`;
        poolItem.status = { status: 'idle', message: endMsg };
        this.broadcastStatus('tiktok', cleanUsername, 'idle', endMsg);
      });

      pirateClient.on(PirateEventType.disconnected, () => {
        console.warn(`[TikTok @${cleanUsername}] WebSocket terputus.`);
        poolItem.viewerCount = 0;
        this.broadcastViewerCount('tiktok', cleanUsername, 0);
        clearTimeout(poolItem.reconnectTimer);
        const retryDelay = this.scheduleTikTokRetry(poolItem, cleanUsername);
        if (retryDelay) {
          poolItem.status = { status: 'connecting', message: `TikTok @${cleanUsername} terputus. Reconnect otomatis dalam ${Math.round(retryDelay / 1000)} detik (${poolItem.retryCount}/${TIKTOK_MAX_RETRIES})...` };
          this.broadcastStatus('tiktok', cleanUsername, 'connecting', poolItem.status.message);
        } else {
          clearTikTokRoomIdCache(cleanUsername);
          poolItem.roomId = '';
          poolItem.reconnectTimer = null;
          if (poolItem.connection) {
            try {
              poolItem.connection.removeAllListeners?.();
              poolItem.connection.disconnect();
            } catch (e) {}
            poolItem.connection = null;
          }
          const discMsg = `TikTok @${cleanUsername} terputus / offline. Klik 'Segarkan Koneksi' untuk menghubungkan kembali.`;
          poolItem.status = { status: 'idle', message: discMsg };
          this.broadcastStatus('tiktok', cleanUsername, 'idle', discMsg);
        }
      });

      // Batasi waktu koneksi maksimal 30 detik agar UI tidak stuck.
      // Library punya retry internal (maxRetries) sehingga 15 detik terlalu pendek dan
      // menyamarkan penolakan asli TikTok (403/blocked) menjadi "offline".
      const CONNECT_TIMEOUT_MS = 30000;
      let connectTimer = null;
      const connectPromise = pirateClient.connect();
      // Cegah unhandled rejection kalau connect() gagal SETELAH timeout kita sudah menang
      connectPromise.catch((e) => {
        console.warn(`[TikTok @${cleanUsername}] connect() asli gagal (detail): ${e?.name || 'Error'}: ${e?.message || e}`);
      });
      const timeoutPromise = new Promise((_, reject) => {
        connectTimer = setTimeout(() => {
          const te = new Error(`CONNECT_TIMEOUT ${CONNECT_TIMEOUT_MS / 1000}s`);
          te.name = 'TikTokConnectTimeout';
          reject(te);
        }, CONNECT_TIMEOUT_MS);
      });
      let roomId;
      try {
        roomId = await Promise.race([connectPromise, timeoutPromise]);
      } finally {
        clearTimeout(connectTimer);
      }
      console.log(`[TikTok @${cleanUsername}] Native PirateTok connected! Room ID:`, roomId);
      return; // Berhasil terhubung via native engine!
    } catch (pirateErr) {
      if (poolItem.connection) {
        try {
          poolItem.connection.removeAllListeners?.();
          poolItem.connection.disconnect();
        } catch (e) {}
        poolItem.connection = null;
      }
      clearTimeout(poolItem.reconnectTimer);
      poolItem.reconnectTimer = null;
      clearTikTokRoomIdCache(cleanUsername);
      poolItem.roomId = '';

      const errMsg = pirateErr?.message || String(pirateErr);
      const errName = pirateErr?.name || 'Error';
      const hasSession = !!(poolItem.sessionId || globalThis._activeTikTokSessionId || process.env.TIKTOK_SESSION_ID);
      // Selalu catat error asli agar penyebab sebenarnya terlihat di log server/VPS
      console.warn(`[TikTok @${cleanUsername}] Koneksi gagal -> name=${errName} | message=${errMsg} | sessionId=${hasSession ? 'ADA' : 'KOSONG'}`);
      if (pirateErr?.cause) console.warn(`[TikTok @${cleanUsername}] cause:`, pirateErr.cause?.message || pirateErr.cause);

      const isTimeout = errName === 'TikTokConnectTimeout';
      // Timeout TIDAK lagi dianggap offline: bisa jadi TikTok menahan/menolak IP server.
      const isOffline = !isTimeout && (
                        pirateErr?.name === 'HostNotOnlineError' ||
                        pirateErr instanceof PirateHostNotOnlineError ||
                        errMsg.includes('not currently live') ||
                        errMsg.includes('UserOfflineError') ||
                        errMsg.includes('is offline') ||
                        errMsg.includes('disconnected before the WSS handshake'));

      if (isTimeout) {
        let tmsg = `Koneksi ke TikTok @${cleanUsername} timeout. Jika channel sedang LIVE, kemungkinan IP server dibatasi TikTok${hasSession ? '' : ' (Session ID belum terkirim ke server)'}.`;
        const tRetry = this.scheduleTikTokRetry(poolItem, cleanUsername);
        tmsg += tRetry
          ? ` Mencoba lagi otomatis dalam ${Math.round(tRetry / 1000)} detik (${poolItem.retryCount}/${TIKTOK_MAX_RETRIES}).`
          : ` Percobaan otomatis habis, cek log server lalu klik 'Segarkan Koneksi'.`;
        poolItem.status = { status: 'error', message: tmsg };
        this.broadcastStatus('tiktok', cleanUsername, 'error', tmsg);
        return;
      }

      if (isOffline) {
        const msg = `@${cleanUsername} sedang offline / belum LIVE di TikTok. Klik 'Segarkan Koneksi' saat Anda mulai siaran.`;
        console.log(`[TikTok @${cleanUsername}] Offline terdeteksi (${errMsg}). Standby (0% auto-poll).`);
        poolItem.status = { status: 'idle', message: msg };
        this.broadcastStatus('tiktok', cleanUsername, 'idle', msg);
        return;
      }

      let formattedErrMsg = `Gagal menghubungkan ke TikTok: ${errMsg}`;
      if (/blocked|403|challenge/i.test(errMsg)) {
        formattedErrMsg = hasSession
          ? `TikTok menolak koneksi dari server ini (Session ID sudah terkirim, kemungkinan IP server/VPS dibatasi atau sessionid kedaluwarsa). Coba ambil sessionid baru.`
          : `TikTok membatasi akses cloud sementara. Session ID belum terkirim ke server: isi di menu 'Atur Saluran' atau set TIKTOK_SESSION_ID di .env.`;
      }
      const gRetry = this.scheduleTikTokRetry(poolItem, cleanUsername);
      formattedErrMsg += gRetry
        ? ` Mencoba lagi otomatis dalam ${Math.round(gRetry / 1000)} detik (${poolItem.retryCount}/${TIKTOK_MAX_RETRIES}).`
        : ` Percobaan otomatis habis, klik 'Segarkan Koneksi'.`;
      poolItem.status = { status: 'error', message: formattedErrMsg };
      this.broadcastStatus('tiktok', cleanUsername, 'error', formattedErrMsg);
    }
  } else {
    const errMsg = 'Engine TikTok LIVE native belum terpasang atau tidak aktif. Periksa log server.';
    console.error(`[TikTok @${cleanUsername}] ${errMsg}`);
    poolItem.status = { status: 'error', message: errMsg };
    this.broadcastStatus('tiktok', cleanUsername, 'error', errMsg);
  }
}

  async unsubscribeTikTok(socketId, username) {
    const cleanUsername = this.parseTikTokInput(username);
    if (!cleanUsername) return;
    const poolItem = this.tiktokPool.get(cleanUsername);
    if (!poolItem) return;

    poolItem.listeners.delete(socketId);
    if (poolItem.listeners.size === 0) {
      poolItem.isClosed = true;
      clearTimeout(poolItem.reconnectTimer);
      clearTimeout(poolItem.likeDebounceTimer);
      clearTikTokRoomIdCache(cleanUsername);
      if (poolItem.connection) {
        try {
          poolItem.connection.removeAllListeners?.();
          poolItem.connection.disconnect();
        } catch (e) {}
        poolItem.connection = null;
      }
      poolItem.roomId = '';
      this.tiktokPool.delete(cleanUsername);
      console.log(`[StreamManager] TikTok @${cleanUsername} pool closed (no listeners).`);
    }
  }

  // ==========================================
  // DEMO SIMULATION (ISOLATED TO CLIENT)
  // ==========================================
  sendTestEvent(platform, type, socket = null) {
    const demoUsers = {
      twitch: ['ProGamer_ID', 'SarahTwitch', 'NinjaFan99', 'PixelKnight'],
      youtube: ['BudiGamingYT', 'StreamerKeren', 'AldoSuperfan', 'YouTubeVIP'],
      tiktok: ['SitiCantik01', 'RizkyDance', 'TikTokKing_ID', 'ViralStar99']
    };

    const randomUser = (plat) => {
      const list = demoUsers[plat] || demoUsers.twitch;
      return list[Math.floor(Math.random() * list.length)];
    };

    const session = socket && socket.id ? this.clientSessions.get(socket.id) : null;
    const channelKey = session ? session[platform] : null;

    const target = {
      emit: (eventName, data) => {
        if (socket) socket.emit(eventName, data);
        else this.io.emit(eventName, data);

        if (channelKey) {
          this.io.to(`${platform}:${channelKey}`).emit(eventName, data);
        }
      }
    };

    if (platform === 'twitch') {
      if (type === 'chat') {
        const sampleMsgs = [
          'Halo bang! GG gameplay-nya barusan OMEGALUL 🔥',
          'Keren banget live hari ini! catJAM',
          'Kapan mabar lagi bang? PepePls',
          'Lanjut game berikutnya dong! Kappa'
        ];
        const chosenMsg = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        let demoEmotes = null;
        if (chosenMsg.includes('Kappa')) {
          const kIdx = chosenMsg.indexOf('Kappa');
          demoEmotes = { "25": [`${kIdx}-${kIdx + 4}`] };
        }
        target.emit('new_chat', {
          id: `demo_${Date.now()}`,
          platform: 'twitch',
          type: 'chat',
          author: {
            name: randomUser('twitch'),
            color: '#9146FF',
            isSub: true,
            isMod: Math.random() > 0.7
          },
          emotes: demoEmotes,
          text: chosenMsg,
          timestamp: Date.now()
        });
      } else if (type === 'sub') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'subscription',
          title: 'Twitch New Subscriber!',
          author: randomUser('twitch'),
          detail: 'Berlangganan Tier 1 Sub! ⭐',
          badge: '⭐ TIER 1 SUB',
          timestamp: Date.now()
        });
      } else if (type === 'bits') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'cheer',
          title: 'Twitch Bits Cheer!',
          author: randomUser('twitch'),
          detail: `500 Bits 💎`,
          message: 'Semangat terus bang streamingnya!',
          badge: `💎 500 BITS`,
          timestamp: Date.now()
        });
      } else if (type === 'redeem') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'redeem',
          title: 'Twitch Channel Points Redeem!',
          author: randomUser('twitch'),
          detail: 'Hydrate / Minum Air (500 Points)',
          message: 'Tolong diminum airnya bang!',
          badge: '💠 REDEEM',
          timestamp: Date.now()
        });
      } else if (type === 'redeem_notext') {
        target.emit('new_event', {
          id: `demo_notext_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'redeem',
          title: 'Twitch Channel Points Redeem!',
          author: randomUser('twitch'),
          detail: 'Hydrate / Minum Air (500 Points)',
          message: '',
          badge: '💠 REDEEM',
          timestamp: Date.now()
        });
      } else if (type === 'submysterygift') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'submysterygift',
          title: 'Twitch Community Gift Subs!',
          author: randomUser('twitch'),
          detail: 'Membagikan 5 Tier 1 Sub untuk komunitas! 🎉',
          badge: '🎁 5 GIFT SUBS',
          timestamp: Date.now()
        });
      } else if (type === 'streak' || type === 'watch_streak') {
        const streakCount = Math.floor(Math.random() * 8) + 3;
        const authorName = randomUser('twitch');
        target.emit('new_event', {
          id: `demo_streak_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'watch_streak',
          title: 'Twitch Watch Streak!',
          author: authorName,
          authorColor: '#9146FF',
          streak: streakCount,
          detail: `Watch Streak: ${streakCount} Stream Berturut-turut! 🔥`,
          message: 'Hadir terus setiap live bang!',
          badge: `🔥 ${streakCount} STREAK`,
          timestamp: Date.now()
        });
      } else if (type === 'follow') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'twitch',
          type: 'event',
          eventType: 'follow',
          title: 'New Twitch Follower!',
          author: randomUser('twitch'),
          detail: 'Baru saja mengikuti (follow) channel Anda! 🎉',
          message: 'is now following!',
          badge: '➕ TWITCH FOLLOW',
          timestamp: Date.now()
        });
      }
    } else if (platform === 'youtube') {
      if (type === 'chat') {
        target.emit('new_chat', {
          id: `demo_${Date.now()}`,
          platform: 'youtube',
          type: 'chat',
          author: { name: randomUser('youtube'), isSub: true, isMod: false },
          text: 'Halo dari YouTube! Audio & videonya jernih banget 👍',
          timestamp: Date.now()
        });
      } else if (type === 'superchat') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'youtube',
          type: 'event',
          eventType: 'superchat',
          title: 'YouTube Super Chat!',
          author: randomUser('youtube'),
          detail: 'Rp 50.000',
          message: 'Buat beli kopi bang! Kontennya selalu menghibur!',
          color: '#00bfa5',
          badge: '💰 Rp 50.000',
          timestamp: Date.now()
        });
      } else if (type === 'supersticker') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'youtube',
          type: 'event',
          eventType: 'supersticker',
          title: 'YouTube Super Sticker!',
          author: randomUser('youtube'),
          detail: 'Rp 25.000 • Super Sticker',
          badge: '⭐ STICKER Rp 25.000',
          timestamp: Date.now()
        });
      } else if (type === 'member') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'youtube',
          type: 'event',
          eventType: 'member',
          title: 'YouTube New Member!',
          author: randomUser('youtube'),
          detail: 'Selamat bergabung sebagai Member VIP! 🌟',
          badge: '⭐ MEMBER',
          timestamp: Date.now()
        });
      } else if (type === 'gift_member') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'youtube',
          type: 'event',
          eventType: 'gift_member',
          title: 'YouTube Gift Memberships!',
          author: randomUser('youtube'),
          detail: 'Membagikan 5 Gift Memberships! 🎁',
          badge: '🎁 5 GIFT MEMBERS',
          timestamp: Date.now()
        });
      } else if (type === 'jewels') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'youtube',
          type: 'event',
          eventType: 'jewels',
          title: 'YouTube Jewels Gift!',
          author: randomUser('youtube'),
          detail: '200 Jewels 💎',
          badge: '💎 200 JEWELS',
          timestamp: Date.now()
        });
      }
    } else if (platform === 'tiktok') {
      if (type === 'chat') {
        target.emit('new_chat', {
          id: `demo_${Date.now()}`,
          platform: 'tiktok',
          type: 'chat',
          author: { name: randomUser('tiktok') },
          text: 'Halo kak! Salam kenal dari Surabaya hadir 🙌',
          timestamp: Date.now()
        });
      } else if (type === 'gift') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'tiktok',
          type: 'event',
          eventType: 'gift',
          title: 'TikTok Gift!',
          author: randomUser('tiktok'),
          detail: 'Paus Menyelam (Whale) x1',
          badge: '🐳 Paus x1',
          diamonds: 1000,
          timestamp: Date.now()
        });
      } else if (type === 'subscribe') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'tiktok',
          type: 'event',
          eventType: 'subscribe',
          title: 'New TikTok Subscriber!',
          author: randomUser('tiktok'),
          detail: 'Berlangganan TikTok LIVE Subscription! ⭐',
          badge: '⭐ TIKTOK SUB',
          timestamp: Date.now()
        });
      } else if (type === 'like') {
        target.emit('new_event', {
          id: `demo_${Date.now()}`,
          platform: 'tiktok',
          type: 'event',
          eventType: 'like',
          title: 'TikTok Likes!',
          author: randomUser('tiktok'),
          detail: 'Mengirim 50 likes! ❤️',
          badge: '❤️ +50 Likes',
          timestamp: Date.now()
        });
      }
    }
  }

  clearEventHistory() {
    this.eventHistory = [];
    this.io.emit('events_cleared');
  }

  getTikTokTopGifters(username = '') {
    const cleanUsername = this.parseTikTokInput(username);
    let gifters = [];
    if (cleanUsername && this.tiktokTopGifters.has(cleanUsername)) {
      gifters = Array.from(this.tiktokTopGifters.get(cleanUsername).values());
    } else {
      const all = [];
      for (const map of this.tiktokTopGifters.values()) {
        for (const item of map.values()) {
          all.push(item);
        }
      }
      gifters = all;
    }
    return gifters.sort((a, b) => b.diamonds - a.diamonds);
  }

  clearTikTokTopGifters(username = '') {
    const cleanUsername = this.parseTikTokInput(username);
    if (cleanUsername && this.tiktokTopGifters.has(cleanUsername)) {
      this.tiktokTopGifters.delete(cleanUsername);
    } else {
      this.tiktokTopGifters.clear();
    }
    this.io.emit('tiktok_gifters_cleared');
  }
}
