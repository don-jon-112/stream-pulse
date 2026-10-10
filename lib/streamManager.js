import tmi from 'tmi.js';
import { LiveChat } from 'youtube-chat';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import WebSocket from 'ws';
import { emoteManager } from './emoteManager.js';

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

    this.processedRedeems = new Map();
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

  // State awal untuk client baru
  getClientInitialState(socket) {
    const session = this.clientSessions.get(socket.id) || {
      twitch: '',
      twitchToken: '',
      youtube: '',
      tiktok: ''
    };

    const statuses = {
      twitch: { status: 'idle', message: 'Belum dihubungkan' },
      youtube: { status: 'idle', message: 'Belum dihubungkan' },
      tiktok: { status: 'idle', message: 'Belum dihubungkan' }
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

    return {
      channels: session,
      statuses: statuses
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
    const { twitch, twitchToken, youtube, tiktok } = data || {};
    let session = this.clientSessions.get(socket.id);
    if (!session) {
      session = { twitch: '', twitchToken: '', youtube: '', tiktok: '' };
      this.clientSessions.set(socket.id, session);
    }

    // 1. Twitch Channel Update
    if (twitch !== undefined) {
      const cleanTwitch = (twitch || '').trim().toLowerCase().replace(/^#/, '');
      const cleanToken = (twitchToken || '').trim().replace(/^oauth:/i, '');
      const isTwitchChanged = cleanTwitch !== session.twitch || cleanToken !== session.twitchToken;

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
      const isYtChanged = cleanYt !== session.youtube;

      if (isYtChanged) {
        if (session.youtube) {
          socket.leave(`youtube:${session.youtube}`);
          await this.unsubscribeYouTube(socket.id, session.youtube);
        }
        session.youtube = cleanYt;
        if (cleanYt) {
          socket.join(`youtube:${cleanYt}`);
          await this.subscribeYouTube(socket, cleanYt);
        } else {
          socket.emit('platform_status', { platform: 'youtube', status: 'idle', message: 'Belum dihubungkan' });
        }
      }
    }

    // 3. TikTok Channel Update
    if (tiktok !== undefined) {
      const cleanTt = (tiktok || '').trim().replace(/^@/, '');
      const isTtChanged = cleanTt !== session.tiktok;

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

    // Ambil 7TV Emotes secara asinkron
    emoteManager.getChannelEmotes(cleanChannel).then((emotes) => {
      poolItem.emotes = emotes;
      this.io.to(`twitch:${cleanChannel}`).emit('twitch_emotes', { channel: cleanChannel, emotes });
    }).catch(err => console.warn('[7TV] Error:', err.message));

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
      client.on('chat', (channel, userstate, message, self) => {
        if (self) return;

        const isCustomReward = !!userstate['custom-reward-id'];
        const isHighlighted = userstate['msg-id'] === 'highlighted-message';
        const isSkipSub = userstate['msg-id'] === 'skip-subs-mode-message';
        const isGigantified = userstate['msg-id'] === 'gigantified-emote-message';
        const isAnimated = userstate['msg-id'] === 'animated-message';
        const isRedeem = isCustomReward || isHighlighted || isSkipSub || isGigantified || isAnimated;

        if (isRedeem) {
          const dedupeKey = userstate.id || `${userstate.username}_${userstate['custom-reward-id'] || userstate['msg-id']}_${message}`;
          if (!this.isDuplicateRedeem(dedupeKey)) {
            let detail = 'Reward Channel Points Ditukar';
            if (isHighlighted) detail = 'Pesan Sorotan (Highlighted)';
            this.broadcastEvent('twitch', cleanChannel, {
              platform: 'twitch',
              type: 'event',
              eventType: 'redeem',
              title: 'Twitch Channel Points Redeem!',
              author: userstate['display-name'] || userstate.username,
              detail: detail,
              message: message,
              badge: '💠 REDEEM'
            });
          }
        }

        this.broadcastChat('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'chat',
          isRedeem: isRedeem,
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            color: userstate.color || '#a970ff',
            badges: userstate.badges || {},
            isMod: !!userstate.mod,
            isSub: !!userstate.subscriber
          },
          emotes: userstate.emotes || null,
          text: message
        });
      });

      // 3. Action (/me)
      client.on('action', (channel, userstate, message, self) => {
        if (self) return;
        this.broadcastChat('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'chat',
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            color: userstate.color || '#a970ff',
            badges: userstate.badges || {},
            isMod: !!userstate.mod,
            isSub: !!userstate.subscriber
          },
          emotes: userstate.emotes || null,
          text: `* ${message}`
        });
      });

      // 4. Subscriptions
      client.on('subscription', (channel, username, method, message, userstate) => {
        const plan = method?.plan ? `Tier ${method.plan === '1000' ? '1' : method.plan === '2000' ? '2' : '3'}` : 'Sub';
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'subscription',
          title: 'Twitch New Subscriber!',
          author: userstate?.['display-name'] || username,
          detail: `Langganan (${plan})`,
          message: message || '',
          badge: '⭐ SUB'
        });
      });

      client.on('resub', (channel, username, months, message, userstate) => {
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'resub',
          title: 'Twitch Re-Subscriber!',
          author: userstate?.['display-name'] || username,
          detail: `Resub ${months} bulan!`,
          message: message || '',
          badge: '⭐ RESUB'
        });
      });

      client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'subgift',
          title: 'Twitch Gift Sub!',
          author: userstate?.['display-name'] || username,
          detail: `Menghadiahkan sub untuk ${recipient}!`,
          badge: '🎁 GIFT SUB'
        });
      });

      client.on('submysterygift', (channel, username, numbOfSubs) => {
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'submysterygift',
          title: 'Twitch Community Gift Subs!',
          author: username,
          detail: `Menghadiahkan ${numbOfSubs} Sub untuk Komunitas! 🎉`,
          badge: `🎁 ${numbOfSubs} GIFT SUBS`
        });
      });

      client.on('cheer', (channel, userstate, message) => {
        const bits = userstate.bits || 0;
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'cheer',
          title: 'Twitch Bits Cheer!',
          author: userstate['display-name'] || userstate.username,
          detail: `${bits} Bits 💎`,
          message: message,
          badge: '💎 BITS'
        });

        this.broadcastChat('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'chat',
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            color: userstate.color || '#a970ff',
            isBits: true
          },
          emotes: userstate.emotes || null,
          text: `[${bits} Bits] ${message}`
        });
      });

      client.on('raided', (channel, username, viewers) => {
        this.broadcastEvent('twitch', cleanChannel, {
          platform: 'twitch',
          type: 'event',
          eventType: 'raid',
          title: 'Twitch Incoming Raid!',
          author: username,
          detail: `Raid bersama ${viewers} penonton! 🔥`,
          badge: '🚀 RAID'
        });
      });

      await client.connect();

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
  // TWITCH EVENTSUB WEBSOCKET (TOKEN BASED)
  // ==========================================
  async connectTwitchEventSub(channelName, token, poolItem) {
    try {
      const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` }
      });
      if (!validateRes.ok) return;

      const tokenInfo = await validateRes.json();
      const clientId = tokenInfo.client_id;
      let broadcasterId = tokenInfo.user_id;

      if (tokenInfo.login?.toLowerCase() !== channelName.toLowerCase()) {
        try {
          const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, {
            headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.data?.[0]?.id) broadcasterId = userData.data[0].id;
          }
        } catch (e) {}
      }

      const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
      poolItem.ws = ws;

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.metadata?.message_type === 'session_welcome') {
            const sessionId = message.payload.session.id;
            await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
              method: 'POST',
              headers: {
                'Client-Id': clientId,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'channel.channel_points_custom_reward_redemption.add',
                version: '1',
                condition: { broadcaster_user_id: broadcasterId },
                transport: { method: 'websocket', session_id: sessionId }
              })
            });
          } else if (message.metadata?.message_type === 'notification') {
            const event = message.payload.event;
            const dedupeKey = `eventsub_${event.id}`;
            if (!this.isDuplicateRedeem(dedupeKey)) {
              this.broadcastEvent('twitch', channelName, {
                platform: 'twitch',
                type: 'event',
                eventType: 'redeem',
                title: 'Twitch Channel Points Redeem!',
                author: event.user_name || event.user_login || 'Viewer',
                detail: `${event.reward?.title || 'Reward'} (${(event.reward?.cost || 0).toLocaleString('id-ID')} Poin)`,
                message: event.user_input || '',
                badge: '💠 REDEEM'
              });
            }
          }
        } catch (e) {}
      });

      ws.on('error', () => {});
    } catch (err) {}
  }

  // ==========================================
  // YOUTUBE SUBSCRIPTION & POOLING
  // ==========================================
  parseYouTubeInput(input) {
    const str = input.trim();
    const vMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (vMatch && vMatch[1]) return { liveId: vMatch[1] };
    if (str.startsWith('@')) return { handle: str };
    if (str.startsWith('UC') && str.length >= 20) return { channelId: str };
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return { liveId: str };
    return { handle: `@${str.replace(/^@/, '')}` };
  }

  async subscribeYouTube(socket, input) {
    const cleanYt = input.trim();
    let poolItem = this.youtubePool.get(cleanYt);

    if (poolItem) {
      poolItem.listeners.add(socket.id);
      socket.emit('platform_status', {
        platform: 'youtube',
        channel: cleanYt,
        status: poolItem.status.status,
        message: poolItem.status.message
      });
      return;
    }

    poolItem = {
      channel: cleanYt,
      liveChat: null,
      listeners: new Set([socket.id]),
      status: { status: 'connecting', message: `Mencari live stream YouTube: ${cleanYt}...` }
    };
    this.youtubePool.set(cleanYt, poolItem);
    this.broadcastStatus('youtube', cleanYt, 'connecting', `Mencari live stream YouTube: ${cleanYt}...`);

    try {
      const target = this.parseYouTubeInput(cleanYt);
      const liveChat = new LiveChat(target);
      poolItem.liveChat = liveChat;

      liveChat.on('start', (liveId) => {
        poolItem.status = { status: 'connected', message: `Terhubung ke YouTube Live (ID: ${liveId})` };
        this.broadcastStatus('youtube', cleanYt, 'connected', `Terhubung ke YouTube Live (ID: ${liveId})`, { liveId });
      });

      liveChat.on('end', (reason) => {
        poolItem.status = { status: 'disconnected', message: `Live chat berakhir: ${reason || 'Selesai'}` };
        this.broadcastStatus('youtube', cleanYt, 'disconnected', `Live chat berakhir: ${reason || 'Selesai'}`);
      });

      liveChat.on('error', (err) => {
        poolItem.status = { status: 'error', message: `YouTube Error: ${err.message || 'Stream offline'}` };
        this.broadcastStatus('youtube', cleanYt, 'error', `YouTube Error: ${err.message || 'Stream offline'}`);
      });

      liveChat.on('chat', (chatItem) => {
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
        } else if (chatItem.isMembership) {
          this.broadcastEvent('youtube', cleanYt, {
            platform: 'youtube',
            type: 'event',
            eventType: 'member',
            title: text ? 'YouTube Member Milestone!' : 'YouTube New Member!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: text || `Selamat bergabung sebagai Member! 🌟`,
            badge: '⭐ MEMBER'
          });
        }

        this.broadcastChat('youtube', cleanYt, {
          platform: 'youtube',
          type: 'chat',
          id: chatItem.id,
          author: {
            name: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            isOwner: chatItem.isOwner,
            isMod: chatItem.isModerator,
            isSub: chatItem.isMembership
          },
          text: text,
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
      poolItem.status = { status: 'error', message: `Gagal: ${err.message}` };
      this.broadcastStatus('youtube', cleanYt, 'error', `Gagal: ${err.message}`);
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
  async subscribeTikTok(socket, username) {
    const cleanUsername = username.trim().replace(/^@/, '');
    let poolItem = this.tiktokPool.get(cleanUsername);

    if (poolItem) {
      poolItem.listeners.add(socket.id);
      socket.emit('platform_status', {
        platform: 'tiktok',
        channel: cleanUsername,
        status: poolItem.status.status,
        message: poolItem.status.message
      });
      return;
    }

    poolItem = {
      channel: cleanUsername,
      connection: null,
      listeners: new Set([socket.id]),
      status: { status: 'connecting', message: `Menghubungkan ke TikTok LIVE @${cleanUsername}...` },
      likeDebounceTimer: null,
      pendingLikes: {}
    };
    this.tiktokPool.set(cleanUsername, poolItem);
    this.broadcastStatus('tiktok', cleanUsername, 'connecting', `Menghubungkan ke TikTok LIVE @${cleanUsername}...`);

    try {
      const tiktok = new TikTokLiveConnection(cleanUsername, { processInitialData: false });
      poolItem.connection = tiktok;

      tiktok.on('connected', (state) => {
        poolItem.status = { status: 'connected', message: `Terhubung ke TikTok @${cleanUsername}` };
        this.broadcastStatus('tiktok', cleanUsername, 'connected', `Terhubung ke TikTok @${cleanUsername}`, { roomId: state?.roomId });
      });

      tiktok.on('disconnected', () => {
        poolItem.status = { status: 'disconnected', message: `TikTok @${cleanUsername} terputus` };
        this.broadcastStatus('tiktok', cleanUsername, 'disconnected', `TikTok @${cleanUsername} terputus`);
      });

      tiktok.on('streamEnd', () => {
        poolItem.status = { status: 'disconnected', message: `TikTok LIVE @${cleanUsername} berakhir` };
        this.broadcastStatus('tiktok', cleanUsername, 'disconnected', `TikTok LIVE @${cleanUsername} berakhir`);
      });

      tiktok.on('chat', (data) => {
        const text = data.content || data.comment || '';
        if (!text) return;

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          id: data.msgId || `tt_chat_${Date.now()}_${Math.random()}`,
          author: {
            name: data.nickname || data.user?.nickname || data.uniqueId || 'User',
            username: data.uniqueId || '',
            avatar: data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || '',
            isMod: !!(data.isModerator || data.user?.userAttr?.isAdmin),
            isSub: !!(data.isSubscriber || data.user?.isSubscribe)
          },
          text: text,
          timestamp: Number(data.createTime || data.common?.createTime) || Date.now()
        });
      });

      tiktok.on('gift', (data) => {
        const count = data.repeatCount || data.comboCount || data.count || 1;
        if (data.giftType === 1 && data.repeatEnd === false && count > 1) return;

        const authorName = data.nickname || data.user?.nickname || data.uniqueId || 'User';
        const giftName = data.giftName || data.gift?.name || 'Gift';
        const totalDiamonds = (data.diamondCount || 0) * count;

        this.broadcastEvent('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'event',
          eventType: 'gift',
          title: 'TikTok Gift!',
          author: authorName,
          detail: `${giftName} x${count} (${totalDiamonds} 💎)`,
          badge: `🎁 ${giftName} x${count}`,
          diamonds: totalDiamonds
        });

        this.broadcastChat('tiktok', cleanUsername, {
          platform: 'tiktok',
          type: 'chat',
          isGift: true,
          author: { name: authorName, username: data.uniqueId || '' },
          text: `Mengirim Hadiah ${giftName} x${count} (${totalDiamonds} 💎)`
        });
      });

      tiktok.on('subscribe', (data) => {
        const authorName = data.nickname || data.user?.nickname || data.uniqueId || 'User';
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
        const user = data.nickname || data.user?.nickname || data.uniqueId || 'User';
        const count = data.likeCount || data.count || 1;
        poolItem.pendingLikes[user] = (poolItem.pendingLikes[user] || 0) + count;

        if (!poolItem.likeDebounceTimer) {
          poolItem.likeDebounceTimer = setTimeout(() => {
            for (const [authorName, totalLiked] of Object.entries(poolItem.pendingLikes)) {
              if (totalLiked >= 3) {
                this.broadcastEvent('tiktok', cleanUsername, {
                  platform: 'tiktok',
                  type: 'event',
                  eventType: 'like',
                  title: 'TikTok Likes!',
                  author: authorName,
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
          author: data.nickname || data.uniqueId,
          detail: 'Mulai mengikuti streamer! 🌟',
          badge: '➕ FOLLOW'
        });
      });

      await tiktok.connect();
    } catch (err) {
      console.error(`[TikTok @${cleanUsername}] Connection error:`, err);
      poolItem.status = { status: 'error', message: `Gagal: ${err.message}` };
      this.broadcastStatus('tiktok', cleanUsername, 'error', `Gagal: ${err.message}`);
    }
  }

  async unsubscribeTikTok(socketId, username) {
    const cleanUsername = username.trim().replace(/^@/, '');
    const poolItem = this.tiktokPool.get(cleanUsername);
    if (!poolItem) return;

    poolItem.listeners.delete(socketId);
    if (poolItem.listeners.size === 0) {
      if (poolItem.connection) {
        try { poolItem.connection.disconnect(); } catch (e) {}
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

    const target = socket || this.io;

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
          detail: 'Hydrate / Minum Air (500 Poin)',
          message: 'Tolong diminum airnya bang!',
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
          detail: 'Paus Menyelam (Whale) x1 (1000 💎)',
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
