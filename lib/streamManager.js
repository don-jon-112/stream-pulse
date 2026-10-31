import tmi from 'tmi.js';
import { LiveChat } from 'youtube-chat';
import axios from 'axios';
import { TikTokLiveConnection, RoomIdRouteConfig, IsLiveRouteConfig } from 'tiktok-live-connector';

if (RoomIdRouteConfig) {
  RoomIdRouteConfig.skipFetchRoomIdFromEulerRoute = true;
}
if (IsLiveRouteConfig) {
  IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
}
import WebSocket from 'ws';
import { emoteManager } from './emoteManager.js';

// Konfigurasi default axios dengan Browser User-Agent nyata agar tidak diblokir YouTube (HTTP 503 Bot Protection)
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
axios.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.9,id;q=0.8';
axios.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';


export class StreamManager {
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

    // Inisialisasi global Twitch badges & viewer count poller saat server boot
    this.twitchAppToken = null;
    this.twitchAppTokenExpires = 0;
    this.initGlobalTwitchBadges();
    this.viewerPollerInterval = null;
    this.startViewerCountPoller();
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
    try {
      const res = await fetch('https://api.ivr.fi/v2/twitch/badges/global', {
        headers: { 'User-Agent': 'StreamPulse/1.0' },
        signal: AbortSignal.timeout(5000)
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
          console.log(`[Badges] Global Twitch badges loaded: ${this.globalTwitchBadges.size} badges.`);
        }
      }
    } catch (e) {
      console.warn('[Badges] Failed to load global Twitch badges:', e.message);
    }
  }

  async loadChannelTwitchBadges(cleanChannel) {
    if (!cleanChannel) return;
    const lower = cleanChannel.toLowerCase();
    if (this.channelTwitchBadges.has(lower)) return;

    try {
      const idRes = await fetch(`https://decapi.me/twitch/id/${encodeURIComponent(lower)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (idRes.ok) {
        const twitchId = (await idRes.text()).trim();
        if (/^\d+$/.test(twitchId)) {
          const badgeRes = await fetch(`https://api.ivr.fi/v2/twitch/badges/channel?id=${twitchId}`, {
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
              console.log(`[Badges] Loaded ${chMap.size} custom channel badges for #${cleanChannel}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[Badges] Failed to load badges for #${cleanChannel}:`, e.message);
    }
  }

  resolveTwitchUserBadges(cleanChannel, badgesObj) {
    if (!badgesObj || typeof badgesObj !== 'object') return [];
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
      turbo: { url: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/1', title: 'Turbo' }
    };

    const entries = Object.entries(badgesObj);
    for (const [key, ver] of entries) {
      if (resolved.length >= 3) break; // Maksimal 3 badge seperti resmi di Twitch

      const badgeKey = `${key}/${ver}`;
      const found = (chMap && chMap.get(badgeKey)) || this.globalTwitchBadges.get(badgeKey);

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

  async getTwitchAvatar(username) {
    if (!username) return null;
    const lower = username.toLowerCase();
    if (this.twitchAvatars.has(lower)) {
      return this.twitchAvatars.get(lower);
    }
    try {
      const res = await fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(lower)}`, {
        headers: { 'User-Agent': 'StreamPulse/1.0' },
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const url = (await res.text()).trim();
        if (url.startsWith('http')) {
          this.twitchAvatars.set(lower, url);
          return url;
        }
      }
    } catch (e) {}

    // Fallback official Twitch avatar
    const fallback = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517eb-aca7-43a1-9ab3-55928d3ef778-profile_image-300x300.png';
    this.twitchAvatars.set(lower, fallback);
    return fallback;
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

  // Cek dan cegah pesan chat ganda (Twitch Shared Chat, mirroring, atau IRC packet duplicate)
  isDuplicateChat(key) {
    if (!key) return false;
    const now = Date.now();
    for (const [k, time] of this.processedChats.entries()) {
      if (now - time > 45000) {
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
          headers: { Authorization: `OAuth ${token}` }
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

    const clientId = process.env.TWITCH_CLIENT_ID;
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

    // Fallback ke decapi jika API resmi Twitch sedang terkendala
    try {
      const res = await fetch(`https://decapi.me/twitch/viewercount/${encodeURIComponent(cleanCh)}`, {
        signal: AbortSignal.timeout(3000)
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
          if (uv && uv.originalViewCount) {
            return parseInt(uv.originalViewCount, 10) || 0;
          }
        }
      }
    } catch (err) {
      console.warn(`[YouTube Live] Gagal mengambil viewer count liveId ${liveId}:`, err.message);
    }
    return 0;
  }

  // Ambil jumlah penonton live TikTok secara real-time langsung dari data liveRoom
  async fetchRealTikTokViewerCount(username) {
    if (!username) return 0;
    const cleanUser = username.trim().replace(/^@/, '');
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

  // Poller berkala untuk viewer count Twitch & YouTube
  startViewerCountPoller() {
    if (this.viewerPollerInterval) return;
    this.viewerPollerInterval = setInterval(async () => {
      // 1. Twitch (Real Helix API)
      for (const [ch, poolItem] of this.twitchPool.entries()) {
        try {
          const count = await this.fetchRealTwitchViewerCount(ch);
          poolItem.viewerCount = count;
          this.broadcastViewerCount('twitch', ch, count);
        } catch (e) {}
      }

      // 2. YouTube (Real Innertube API - Tanpa OAuth)
      for (const [yt, poolItem] of this.youtubePool.entries()) {
        if (poolItem.liveId) {
          try {
            const count = await this.fetchRealYouTubeViewerCount(poolItem.liveId);
            poolItem.viewerCount = count;
            this.broadcastViewerCount('youtube', yt, count);
          } catch (e) {}
        }
      }

      // 3. TikTok (Real Concurrent Viewers)
      for (const [tt, poolItem] of this.tiktokPool.entries()) {
        if (poolItem.connection && poolItem.connection.isConnected) {
          try {
            const count = await this.fetchRealTikTokViewerCount(tt);
            if (count > 0) {
              poolItem.viewerCount = count;
              this.broadcastViewerCount('tiktok', tt, count);
              continue;
            }
            const info = await poolItem.connection.fetchRoomInfo().catch(() => null);
            const rawCount = info?.data?.user_count ?? info?.user_count ?? info?.data?.room_info?.user_count ?? info?.room_info?.user_count;
            if (rawCount !== undefined && rawCount !== null && rawCount !== '') {
              const count = parseInt(rawCount, 10);
              if (!isNaN(count) && count >= 0) {
                poolItem.viewerCount = count;
                this.broadcastViewerCount('tiktok', tt, count);
              }
            }
          } catch (e) {}
        }
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

    // Auto-inherit active stream pool channels for new connecting clients (like Mini HUD Overlay)
    const activeTwitch = session.twitch || Array.from(this.twitchPool.keys())[0] || '';
    const activeYoutube = session.youtube || Array.from(this.youtubePool.keys())[0] || '';
    const activeTiktok = session.tiktok || Array.from(this.tiktokPool.keys())[0] || '';

    // Auto-join socket to active stream rooms so live chat streams immediately
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
    const globalEmotes = emoteManager.getGlobalEmotes ? emoteManager.getGlobalEmotes() : {};

    const effectiveChannels = {
      twitch: activeTwitch,
      twitchToken: session.twitchToken,
      youtube: activeYoutube,
      tiktok: activeTiktok
    };

    return {
      channels: effectiveChannels,
      statuses: statuses,
      viewerCounts: viewerCounts,
      emotes: { ...globalEmotes, ...channelEmotes }
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
    const { twitch, twitchToken, youtube, tiktok, force } = data || {};
    const isForce = Boolean(force);
    let session = this.clientSessions.get(socket.id);
    if (!session) {
      session = { twitch: '', twitchToken: '', youtube: '', tiktok: '' };
      this.clientSessions.set(socket.id, session);
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
      let cleanTt = (tiktok || '').trim().replace(/^@/, '');
      if (cleanTt.includes('tiktok.com/')) {
        const roomMatch = cleanTt.match(/room_id=(\d{15,22})/);
        if (roomMatch) {
          cleanTt = roomMatch[1];
        } else {
          const userMatch = cleanTt.match(/tiktok\.com\/@([a-zA-Z0-9_\.]{2,30})/);
          if (userMatch) cleanTt = userMatch[1];
        }
      }
      if (!/^\d{15,22}$/.test(cleanTt)) {
        cleanTt = cleanTt.toLowerCase();
      }
      const isTtChanged = isForce || cleanTt !== session.tiktok;

      if (isTtChanged) {
        if (session.tiktok) {
          socket.leave(`tiktok:${session.tiktok}`);
          await this.unsubscribeTikTok(socket.id, session.tiktok);
        }
        session.tiktok = cleanTt;
        if (cleanTt) {
          socket.join(`tiktok:${cleanTt}`);
          await this.subscribeTikTok(socket, cleanTt);
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

        const avatar = await this.getTwitchAvatar(userstate.username);

        const isBroadcaster = !!(userstate.badges && userstate.badges.broadcaster) || (userstate.username && userstate.username.toLowerCase() === cleanChannel.toLowerCase());
        const isMod = !!userstate.mod || !!(userstate.badges && userstate.badges.moderator);
        const isSub = !!userstate.subscriber || !!(userstate.badges && userstate.badges.subscriber);
        const badgesList = this.resolveTwitchUserBadges(cleanChannel, userstate.badges);
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
            isSub: isSub
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
        const avatar = await this.getTwitchAvatar(userstate.username);
        const isBroadcaster = !!(userstate.badges && userstate.badges.broadcaster) || (userstate.username && userstate.username.toLowerCase() === cleanChannel.toLowerCase());
        const isMod = !!userstate.mod || !!(userstate.badges && userstate.badges.moderator);
        const isSub = !!userstate.subscriber || !!(userstate.badges && userstate.badges.subscriber);
        const badgesList = this.resolveTwitchUserBadges(cleanChannel, userstate.badges);
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
            isSub: isSub
          },
          emotes: userstate.emotes || null,
          text: `* ${message}`
        });
      });

      // 4. Subscriptions
      client.on('subscription', async (channel, username, method, message, userstate) => {
        const plan = method?.plan ? `Tier ${method.plan === '1000' ? '1' : method.plan === '2000' ? '2' : '3'}` : 'Sub';
        const avatar = await this.getTwitchAvatar(username);
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
        const avatar = await this.getTwitchAvatar(username);
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
        const avatar = await this.getTwitchAvatar(username);
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

      client.on('submysterygift', async (channel, username, numbOfSubs) => {
        const avatar = await this.getTwitchAvatar(username);
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
        const avatar = await this.getTwitchAvatar(userstate.username);
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
          const avatar = await this.getTwitchAvatar(tags?.login || tags?.username || authorName);
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
        }
      });

      if (!res.ok) {
        res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          headers: {
            'Client-Id': clientId,
            'Authorization': `Bearer ${token}`
          }
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
                }
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
            }
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
                }
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
        headers: { Authorization: `OAuth ${cleanToken}` }
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
            headers: { 'Client-Id': clientId, Authorization: `Bearer ${cleanToken}` }
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
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${cleanToken}` }
          });
        } catch (e) {}
        poolItem.subscriptionId = null;
      }
      if (poolItem.followSubId) {
        try {
          await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(poolItem.followSubId)}`, {
            method: 'DELETE',
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${cleanToken}` }
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

  async subscribeTikTok(socket, username) {
    let cleanUsername = (username || '').trim().replace(/^@/, '');
    if (cleanUsername.includes('tiktok.com/')) {
      const roomMatch = cleanUsername.match(/room_id=(\d{15,22})/);
      if (roomMatch) {
        cleanUsername = roomMatch[1];
      } else {
        const userMatch = cleanUsername.match(/tiktok\.com\/@([a-zA-Z0-9_\.]{2,30})/);
        if (userMatch) cleanUsername = userMatch[1];
      }
    }
    if (!/^\d{15,22}$/.test(cleanUsername)) {
      cleanUsername = cleanUsername.toLowerCase();
    }

    let poolItem = this.tiktokPool.get(cleanUsername);

    if (poolItem) {
      poolItem.listeners.add(socket.id);
      socket.emit('platform_status', {
        platform: 'tiktok',
        channel: cleanUsername,
        status: poolItem.status.status,
        message: poolItem.status.message
      });
      // Jika sudah terhubung aktif atau sedang menghubungkan, gunakan koneksi yang ada
      if (poolItem.status.status === 'connected' || poolItem.status.status === 'connecting') {
        return;
      }
      // Jika statusnya sebelumnya terputus/error, coba sambungkan ulang!
      console.log(`[TikTok @${cleanUsername}] Menghubungkan ulang sesi yang sebelumnya terputus...`);
    } else {
      poolItem = {
        channel: cleanUsername,
        connection: null,
        listeners: new Set([socket.id]),
        status: { status: 'connecting', message: `Menghubungkan ke TikTok LIVE @${cleanUsername}...` },
        likeDebounceTimer: null,
        pendingLikes: {},
        reconnectTimer: null,
        isClosed: false
      };
      this.tiktokPool.set(cleanUsername, poolItem);
    }

    poolItem.isClosed = false;
    await this.startTikTokConnection(poolItem, cleanUsername);
  }

  async startTikTokConnection(poolItem, cleanUsername) {
    if (poolItem.isClosed || poolItem.listeners.size === 0) return;

    if (poolItem.connection) {
      try { poolItem.connection.disconnect(); } catch (e) {}
      poolItem.connection = null;
    }

    poolItem.status = { status: 'connecting', message: `Menghubungkan ke TikTok LIVE @${cleanUsername}...` };
    this.broadcastStatus('tiktok', cleanUsername, 'connecting', `Menghubungkan ke TikTok LIVE @${cleanUsername}...`);

    try {
      const isNumericRoomId = /^\d{15,22}$/.test(cleanUsername);

      const tiktokOptions = {
        processInitialData: true,
        fetchRoomInfoOnConnect: false
      };

      if (process.env.TIKTOK_SIGN_API_KEY) {
        tiktokOptions.signApiKey = process.env.TIKTOK_SIGN_API_KEY.trim();
      }

      if (process.env.TIKTOK_SESSION_ID) {
        process.env.WHITELIST_AUTHENTICATED_SESSION_ID_HOST = 'tiktok.eulerstream.com';
        tiktokOptions.authenticateWs = true;
        tiktokOptions.session = {
          cookie: {
            type: 'cookie',
            value: {
              sessionId: process.env.TIKTOK_SESSION_ID.trim(),
              ttTargetIdc: (process.env.TIKTOK_TARGET_IDC || 'useast1a').trim()
            }
          }
        };
      }

      const tiktok = new TikTokLiveConnection(cleanUsername, tiktokOptions);
      poolItem.connection = tiktok;

      tiktok.on('connected', async (state) => {
        clearTimeout(poolItem.reconnectTimer);
        poolItem.status = { status: 'connected', message: `Terhubung ke TikTok @${cleanUsername}` };
        this.broadcastStatus('tiktok', cleanUsername, 'connected', `Terhubung ke TikTok @${cleanUsername}`, { roomId: state?.roomId });
        
        // Ambil viewer count live real-time seketika saat connect
        this.fetchRealTikTokViewerCount(cleanUsername).then(count => {
          if (count > 0 && poolItem) {
            poolItem.viewerCount = count;
            this.broadcastViewerCount('tiktok', cleanUsername, count);
          }
        }).catch(() => {});
      });

      tiktok.on('roomUser', (data) => {
        if (!data) return;
        // PENTING: data.total / data.viewerCount adalah penonton live saat ini (concurrent viewers)
        // data.totalUser adalah akumulasi total pengunjung sejak awal live (cumulative / total views)
        const rawCount = data.viewerCount ?? data.total ?? data.userCount ?? data.roomUserCount;
        if (rawCount !== undefined && rawCount !== null && rawCount !== '') {
          const count = parseInt(rawCount, 10);
          if (!isNaN(count) && count >= 0) {
            poolItem.viewerCount = count;
            this.broadcastViewerCount('tiktok', cleanUsername, count);
          }
        }
      });

      tiktok.on('disconnected', () => {
        console.warn(`[TikTok @${cleanUsername}] WebSocket terputus.`);
        poolItem.viewerCount = 0;
        this.broadcastViewerCount('tiktok', cleanUsername, 0);

        if (!poolItem.isClosed && poolItem.listeners.size > 0) {
          poolItem.status = { status: 'connecting', message: `TikTok @${cleanUsername} terputus. Mencoba menghubungkan kembali dalam 5 detik...` };
          this.broadcastStatus('tiktok', cleanUsername, 'connecting', `TikTok @${cleanUsername} terputus. Mencoba menghubungkan kembali dalam 5 detik...`);
          clearTimeout(poolItem.reconnectTimer);
          poolItem.reconnectTimer = setTimeout(() => {
            if (!poolItem.isClosed && poolItem.listeners.size > 0) {
              this.startTikTokConnection(poolItem, cleanUsername);
            }
          }, 5000);
        } else {
          poolItem.status = { status: 'disconnected', message: `TikTok @${cleanUsername} terputus` };
          this.broadcastStatus('tiktok', cleanUsername, 'disconnected', `TikTok @${cleanUsername} terputus`);
        }
      });

      tiktok.on('streamEnd', () => {
        clearTimeout(poolItem.reconnectTimer);
        console.log(`[TikTok @${cleanUsername}] Live stream berakhir. Memantau kembali dalam 10 detik...`);
        poolItem.status = { status: 'connecting', message: `TikTok LIVE @${cleanUsername} telah berakhir. Memantau stream berikutnya...` };
        poolItem.viewerCount = 0;
        this.broadcastViewerCount('tiktok', cleanUsername, 0);
        this.broadcastStatus('tiktok', cleanUsername, 'connecting', `TikTok LIVE @${cleanUsername} telah berakhir. Memantau stream berikutnya...`);

        // Otomatis cek kembali jika streamer memulai live baru
        poolItem.reconnectTimer = setTimeout(() => {
          if (!poolItem.isClosed && poolItem.listeners.size > 0) {
            this.startTikTokConnection(poolItem, cleanUsername);
          }
        }, 10000);
      });

      // Regular text comments (WebcastChatMessage)
      tiktok.on('chat', (data) => {
        const text = (data.content || data.comment || '').trim();
        if (!text) return;

        const msgId = data.common?.msgId || data.msgId;
        const authorName = data.user?.nickname || data.nickname || data.user?.displayId || data.uniqueId || 'User';
        const authorUsername = data.user?.displayId || data.uniqueId || data.user?.uniqueId || '';
        const dedupeKey = msgId ? `tt_${msgId}` : `${cleanUsername}_${authorUsername || authorName}_${text}`;
        if (this.isDuplicateChat(dedupeKey)) return;

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          id: msgId ? `tt_chat_${msgId}` : `tt_chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          author: {
            name: authorName,
            username: authorUsername,
            avatar: data.user?.avatarThumb?.urlList?.[0] || data.user?.avatarMedium?.urlList?.[0] || data.profilePictureUrl || '',
            isMod: !!(data.user?.userAttr?.isAdmin || data.isModerator || data.user?.userAttr?.isSuperAdmin),
            isSub: !!(data.user?.userAttr?.isSubscribe || data.isSubscriber || data.user?.fansClub?.fansClubData?.status)
          },
          text: text,
          timestamp: Number(data.common?.createTime || data.createTime) || Date.now()
        });
      });

      // Emote / Sticker comments (WebcastEmoteChatMessage)
      tiktok.on('emote', (data) => {
        const emoteUrl = data.emote?.image?.urlList?.[0] || data.emote?.image?.url || '';
        const emoteName = data.emote?.emoteId || 'Emote';
        const text = emoteUrl ? `<img class="chat-emote" src="${emoteUrl}" alt="${emoteName}" title="${emoteName}">` : (data.content || emoteName);
        const msgId = data.common?.msgId || data.msgId;
        const authorName = data.user?.nickname || data.nickname || data.user?.displayId || data.uniqueId || 'User';
        const authorUsername = data.user?.displayId || data.uniqueId || data.user?.uniqueId || '';
        const dedupeKey = msgId ? `tt_emote_${msgId}` : `${cleanUsername}_${authorUsername || authorName}_${text}`;
        if (this.isDuplicateChat(dedupeKey)) return;

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          id: msgId ? `tt_chat_${msgId}` : `tt_emote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          author: {
            name: authorName,
            username: authorUsername,
            avatar: data.user?.avatarThumb?.urlList?.[0] || data.user?.avatarMedium?.urlList?.[0] || data.profilePictureUrl || '',
            isMod: !!(data.user?.userAttr?.isAdmin || data.isModerator),
            isSub: !!(data.user?.userAttr?.isSubscribe || data.isSubscriber)
          },
          text: text,
          timestamp: Number(data.common?.createTime || data.createTime) || Date.now()
        });
      });

      tiktok.on('gift', (data) => {
        const count = data.repeatCount || data.comboCount || data.count || 1;
        if (data.giftType === 1 && data.repeatEnd === false && count > 1) return;

        const authorName = data.user?.nickname || data.nickname || data.user?.displayId || data.uniqueId || 'User';
        const authorUsername = data.user?.displayId || data.uniqueId || '';
        const giftName = data.extendedGiftInfo?.name || data.gift?.name || data.giftName || 'Gift';
        const totalDiamonds = (data.diamondCount || data.extendedGiftInfo?.diamond_count || data.gift?.diamondCount || 0) * count;

        this.broadcastEvent('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'event',
          eventType: 'gift',
          title: 'TikTok Gift!',
          author: authorName,
          detail: `${giftName} x${count}`,
          badge: `🎁 ${giftName} x${count}`,
          diamonds: totalDiamonds
        });

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          isGift: true,
          author: { name: authorName, username: authorUsername },
          text: `Mengirim Hadiah ${giftName} x${count}`
        });
      });

      tiktok.on('subscribe', (data) => {
        const authorName = data.user?.nickname || data.nickname || data.user?.displayId || data.uniqueId || 'User';
        this.broadcastEvent('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'event',
          eventType: 'subscribe',
          title: 'New TikTok Subscriber!',
          author: authorName,
          detail: 'Berlangganan LIVE Subscription! ⭐',
          badge: '⭐ TIKTOK SUB'
        });
      });

      tiktok.on('like', (data) => {
        const user = data.user?.nickname || data.nickname || data.user?.displayId || data.uniqueId || 'User';
        const avatar = data.user?.avatarThumb?.urlList?.[0] || data.user?.avatarMedium?.urlList?.[0] || data.profilePictureUrl || '';
        const count = data.likeCount || data.count || 1;
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

      tiktok.on('follow', (data) => {
        this.broadcastEvent('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'event',
          eventType: 'follow',
          title: 'New TikTok Follower!',
          author: data.user?.nickname || data.nickname || data.user?.displayId || data.uniqueId || 'User',
          avatar: data.user?.avatarThumb?.urlList?.[0] || data.user?.avatarMedium?.urlList?.[0] || data.profilePictureUrl || '',
          detail: 'Mulai mengikuti streamer! 🌟',
          badge: '➕ FOLLOW'
        });
      });

      if (!isNumericRoomId) {
        // Lewati pre-flight fetchIsLive karena SE.Live / RTMP stream sering mengembalikan status 4 pada API web
        const isLive = true;
        if (!isLive) {
          console.log(`[TikTok @${cleanUsername}] Streamer belum live di TikTok. Menunggu stream dimulai...`);
          const waitMsg = `@${cleanUsername} belum LIVE di TikTok (memantau otomatis)...`;
          poolItem.status = { status: 'connecting', message: waitMsg };
          this.broadcastStatus('tiktok', cleanUsername, 'connecting', waitMsg);
          if (!poolItem.isClosed && poolItem.listeners.size > 0) {
            clearTimeout(poolItem.reconnectTimer);
            poolItem.reconnectTimer = setTimeout(() => {
              if (!poolItem.isClosed && poolItem.listeners.size > 0) {
                this.startTikTokConnection(poolItem, cleanUsername);
              }
            }, 10000);
          }
          return;
        }
      }

      if (isNumericRoomId) {
        // Resolve Room ID untuk mendukung live non-Studio (SE.Live, OBS, dll)
        let targetRoomId = cleanUsername;
        await tiktok.connect(targetRoomId);
      } else {
        const targetRoomId = await this.resolveTikTokRoomId(cleanUsername);
        if (targetRoomId) {
          await tiktok.connect(targetRoomId);
        } else {
          await tiktok.connect();
        }
      }
    } catch (err) {
      console.error(`[TikTok @${cleanUsername}] Connection error:`, err);
      let errMsg = `Gagal: ${err.message}`;
      const isOffline = err.message && (
        err.message.includes('LIVE has ended') ||
        err.message.includes('not currently live') ||
        err.message.includes('is offline') ||
        err.message.includes("isn't online") ||
        err.message.includes('Failed to retrieve Room ID') ||
        err.message.includes('UserOfflineError') ||
        err.name === 'UserOfflineError' ||
        err.name === 'HostNotOnlineError'
      );

      if (isOffline) {
        errMsg = `@${cleanUsername} saat ini sedang belum LIVE di TikTok (otomatis memantau)...`;
        poolItem.status = { status: 'connecting', message: errMsg };
        this.broadcastStatus('tiktok', cleanUsername, 'connecting', errMsg);
      } else if (err.message && (err.message.includes('illegal secret key') || err.message.includes('WebSocket with message'))) {
        errMsg = `TikTok memblokir koneksi bot/IP (illegal secret key). Tambahkan TIKTOK_SIGN_API_KEY atau TIKTOK_SESSION_ID di .env`;
        poolItem.status = { status: 'error', message: errMsg };
        this.broadcastStatus('tiktok', cleanUsername, 'error', errMsg);
      } else {
        poolItem.status = { status: 'error', message: errMsg };
        this.broadcastStatus('tiktok', cleanUsername, 'error', errMsg);
      }

      // Jadwalkan pengecekan ulang berkala jika listener masih ada
      if (!poolItem.isClosed && poolItem.listeners.size > 0) {
        clearTimeout(poolItem.reconnectTimer);
        const retryDelay = isOffline ? 10000 : 15000;
        poolItem.reconnectTimer = setTimeout(() => {
          if (!poolItem.isClosed && poolItem.listeners.size > 0) {
            this.startTikTokConnection(poolItem, cleanUsername);
          }
        }, retryDelay);
      }
    }
  }

  async unsubscribeTikTok(socketId, username) {
    let cleanUsername = (username || '').trim().replace(/^@/, '');
    if (cleanUsername.includes('tiktok.com/')) {
      const roomMatch = cleanUsername.match(/room_id=(\d{15,22})/);
      if (roomMatch) {
        cleanUsername = roomMatch[1];
      } else {
        const userMatch = cleanUsername.match(/tiktok\.com\/@([a-zA-Z0-9_\.]{2,30})/);
        if (userMatch) cleanUsername = userMatch[1];
      }
    }
    if (!/^\d{15,22}$/.test(cleanUsername)) {
      cleanUsername = cleanUsername.toLowerCase();
    }
    const poolItem = this.tiktokPool.get(cleanUsername);
    if (!poolItem) return;

    poolItem.listeners.delete(socketId);
    if (poolItem.listeners.size === 0) {
      poolItem.isClosed = true;
      clearTimeout(poolItem.reconnectTimer);
      clearTimeout(poolItem.likeDebounceTimer);
      if (poolItem.connection) {
        try { poolItem.connection.disconnect(); } catch (e) {}
        poolItem.connection = null;
      }
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
    this.io.emit('events_cleared');
  }
}
