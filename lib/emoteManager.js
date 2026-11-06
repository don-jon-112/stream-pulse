/**
 * emoteManager.js - Twitch & 7TV Emote Resolver
 * Fetches and caches Twitch channel & global 7TV emotes (including animated WebP)
 */

class EmoteManager {
  constructor() {
    this.global7tv = new Map();
    this.channelCache = new Map(); // channelName -> { emotes: Object, timestamp: number }
    this.cacheTtlMs = 60 * 60 * 1000; // 1 hour TTL
    this.isFetchingGlobal = false;

    // Inisialisasi emote global langsung saat server boot
    this.initGlobal();
  }

  async initGlobal() {
    if (this.global7tv.size > 0 || this.isFetchingGlobal) return;
    this.isFetchingGlobal = true;

    try {
      // 1. 7TV Global Emotes
      const res = await fetch('https://7tv.io/v3/emote-sets/global', {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        const emotes = data?.emotes || [];
        for (const e of emotes) {
          if (e.name && e.data?.host?.url) {
            this.global7tv.set(e.name, `https:${e.data.host.url}/1x.webp`);
          }
        }
      }

      // 2. BetterTTV Global Emotes (KEKW, PepeHands, monkaS, LULW, etc.)
      const bttvRes = await fetch('https://api.betterttv.net/3/cached/emotes/global', {
        signal: AbortSignal.timeout(5000)
      });
      if (bttvRes.ok) {
        const bttvData = await bttvRes.json();
        if (Array.isArray(bttvData)) {
          for (const b of bttvData) {
            if (b.code && b.id) {
              this.global7tv.set(b.code, `https://cdn.betterttv.net/emote/${b.id}/1x.webp`);
            }
          }
        }
      }

      console.log(`[EmoteManager] 7TV & BTTV Global loaded: ${this.global7tv.size} emotes.`);
    } catch (err) {
      console.warn('[EmoteManager] Failed to load Global emotes:', err.message);
    } finally {
      this.isFetchingGlobal = false;
    }
  }

  async getChannelEmotes(channelName) {
    if (!channelName) return {};

    const cleanChannel = channelName.trim().toLowerCase().replace(/^#/, '');
    const now = Date.now();

    // Check memory cache
    const cached = this.channelCache.get(cleanChannel);
    if (cached && (now - cached.timestamp < this.cacheTtlMs)) {
      return cached.emotes;
    }

    // Ensure global emotes are initialized in background
    if (this.global7tv.size === 0 && !this.isFetchingGlobal) {
      this.initGlobal();
    }

    const emoteMap = {};
    // Hanya simpan emotikon kustom channel 7TV & BTTV (tanpa duplikasi global emotes agar payload websocket ringan)

    try {
      // 1. Dapatkan Twitch User ID via DecAPI
      const idRes = await fetch(`https://decapi.me/twitch/id/${encodeURIComponent(cleanChannel)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (idRes.ok) {
        const twitchId = (await idRes.text()).trim();
        if (/^\d+$/.test(twitchId)) {
          // 2. Ambil 7TV Channel Emote Set
          try {
            const userRes = await fetch(`https://7tv.io/v3/users/twitch/${twitchId}`, {
              signal: AbortSignal.timeout(4000)
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              const channelEmotes = userData?.emote_set?.emotes || [];
              for (const e of channelEmotes) {
                if (e.name && e.data?.host?.url) {
                  emoteMap[e.name] = `https:${e.data.host.url}/1x.webp`;
                }
              }
              console.log(`[EmoteManager] 7TV #${cleanChannel} loaded: ${channelEmotes.length} emotes.`);
            }
          } catch (e7) {}

          // 3. Ambil BetterTTV Channel Emote Set (jika ada)
          try {
            const bttvChRes = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${twitchId}`, {
              signal: AbortSignal.timeout(4000)
            });
            if (bttvChRes.ok) {
              const bttvChData = await bttvChRes.json();
              const bttvList = [...(bttvChData.channelEmotes || []), ...(bttvChData.sharedEmotes || [])];
              for (const b of bttvList) {
                if (b.code && b.id) {
                  emoteMap[b.code] = `https://cdn.betterttv.net/emote/${b.id}/1x.webp`;
                }
              }
            }
          } catch (eb) {}
        }
      }
    } catch (err) {
      console.warn(`[EmoteManager] Gagal mengambil channel emotes untuk #${cleanChannel}:`, err.message);
    }

    // Cache the result
    this.channelCache.set(cleanChannel, {
      emotes: emoteMap,
      timestamp: now
    });

    return emoteMap;
  }

  getGlobalEmotes() {
    const map = {};
    for (const [name, url] of this.global7tv.entries()) {
      map[name] = url;
    }
    return map;
  }
}

export const emoteManager = new EmoteManager();
