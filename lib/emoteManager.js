/**
 * emoteManager.js - Twitch & 7TV Emote Resolver
 * Fetches and caches Twitch channel & global 7TV emotes (including animated WebP)
 */

class EmoteManager {
  constructor() {
    this.global7tv = new Map();
    this.channelCache = new Map(); // channelName -> { emotes: Map, timestamp: number }
    this.cacheTtlMs = 60 * 60 * 1000; // 1 hour TTL
    this.isFetchingGlobal = false;
  }

  async initGlobal() {
    if (this.global7tv.size > 0 || this.isFetchingGlobal) return;
    this.isFetchingGlobal = true;

    try {
      const res = await fetch('https://7tv.io/v3/emote-sets/global');
      if (res.ok) {
        const data = await res.json();
        const emotes = data?.emotes || [];
        for (const e of emotes) {
          if (e.name && e.data?.host?.url) {
            this.global7tv.set(e.name, `https:${e.data.host.url}/1x.webp`);
          }
        }
        console.log(`[EmoteManager] 7TV Global loaded: ${this.global7tv.size} emotes.`);
      }
    } catch (err) {
      console.warn('[EmoteManager] Failed to load 7TV Global emotes:', err.message);
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

    // Ensure global emotes are loaded
    if (this.global7tv.size === 0) {
      await this.initGlobal();
    }

    const emoteMap = {};
    // Seed with global 7TV emotes
    for (const [name, url] of this.global7tv.entries()) {
      emoteMap[name] = url;
    }

    try {
      // 1. Dapatkan Twitch User ID via DecAPI
      const idRes = await fetch(`https://decapi.me/twitch/id/${encodeURIComponent(cleanChannel)}`);
      if (idRes.ok) {
        const twitchId = (await idRes.text()).trim();
        if (/^\d+$/.test(twitchId)) {
          // 2. Ambil 7TV Channel Emote Set
          const userRes = await fetch(`https://7tv.io/v3/users/twitch/${twitchId}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            const channelEmotes = userData?.emote_set?.emotes || [];
            for (const e of channelEmotes) {
              if (e.name && e.data?.host?.url) {
                emoteMap[e.name] = `https:${e.data.host.url}/1x.webp`;
              }
            }
            console.log(`[EmoteManager] 7TV #${cleanChannel} loaded: ${channelEmotes.length} channel emotes.`);
          }
        }
      }
    } catch (err) {
      console.warn(`[EmoteManager] Gagal mengambil 7TV untuk #${cleanChannel}:`, err.message);
    }

    // Cache the result
    this.channelCache.set(cleanChannel, {
      emotes: emoteMap,
      timestamp: now
    });

    return emoteMap;
  }
}

export const emoteManager = new EmoteManager();
