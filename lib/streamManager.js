import tmi from 'tmi.js';
import { LiveChat } from 'youtube-chat';
import { TikTokLiveConnection } from 'tiktok-live-connector';

export class StreamManager {
  constructor(io) {
    this.io = io;
    this.connections = {
      twitch: null,
      twitchWs: null,
      youtube: null,
      tiktok: null
    };
    this.activeChannels = {
      twitch: '',
      twitchToken: '',
      youtube: '',
      tiktok: ''
    };
    this.statuses = {
      twitch: { status: 'idle', message: 'Belum dihubungkan' },
      youtube: { status: 'idle', message: 'Belum dihubungkan' },
      tiktok: { status: 'idle', message: 'Belum dihubungkan' }
    };
    this.eventHistory = [];
    this.maxHistory = 200;
    this.processedRedeems = new Map();
  }

  // Cek dan cegah event redeem ganda (misal jika masuk lewat redeem dan chat sekaligus)
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

  // Kirim status platform ke semua client yang terhubung
  broadcastStatus(platform, status, message = '', extra = {}) {
    this.statuses[platform] = { status, message, ...extra };
    this.io.emit('platform_status', {
      platform,
      status,
      message,
      extra,
      timestamp: Date.now()
    });
  }

  // Kirim chat terpadu
  broadcastChat(chatData) {
    const item = {
      ...chatData,
      id: chatData.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: chatData.timestamp || Date.now()
    };
    this.io.emit('new_chat', item);
  }

  // Kirim event terpadu (gift, sub, superchat, follow, raid, dll)
  broadcastEvent(eventData) {
    const eventItem = {
      ...eventData,
      id: eventData.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: eventData.timestamp || Date.now()
    };

    // Rekam ke history
    this.eventHistory.push(eventItem);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    this.io.emit('new_event', eventItem);
  }

  // State awal untuk client baru
  getInitialState() {
    return {
      statuses: this.statuses,
      channels: this.activeChannels,
      recentEvents: this.eventHistory.slice(-50)
    };
  }

  // ==========================================
  // TWITCH CONNECTION (IRC & EventSub WebSocket)
  // ==========================================
  async connectTwitch(channelName, oauthToken = '') {
    if (!channelName || channelName.trim() === '') {
      await this.disconnectTwitch();
      return;
    }

    const cleanChannel = channelName.trim().toLowerCase().replace(/^#/, '');
    const cleanToken = (oauthToken || '').trim().replace(/^oauth:/i, '');
    await this.disconnectTwitch();

    this.activeChannels.twitch = cleanChannel;
    this.activeChannels.twitchToken = cleanToken;
    this.broadcastStatus('twitch', 'connecting', `Menghubungkan ke Twitch channel #${cleanChannel}...`);

    try {
      const client = new tmi.Client({
        options: { debug: false },
        connection: {
          reconnect: true,
          secure: true
        },
        channels: [cleanChannel]
      });

      this.connections.twitch = client;

      client.on('connected', (address, port) => {
        const extraMsg = cleanToken ? ' (IRC + EventSub Aktif)' : '';
        this.broadcastStatus('twitch', 'connected', `Terhubung ke #${cleanChannel}${extraMsg}`);
      });

      client.on('disconnected', (reason) => {
        this.broadcastStatus('twitch', 'disconnected', `Terputus: ${reason || 'Disconnected'}`);
      });

      // 1. DEDICATED TMI.JS REDEEM LISTENER (Mendeteksi Channel Points Redeem resmi dari IRC)
      client.on('redeem', (channel, username, rewardType, tags, message) => {
        const displayName = tags?.['display-name'] || username || 'Viewer';
        const msgId = tags?.['msg-id'] || rewardType;
        const msgText = message || '';
        const dedupeKey = tags?.id || `${username}_${rewardType}_${msgText}`;

        if (this.isDuplicateRedeem(dedupeKey)) return;

        let detail = 'Reward Channel Points Ditukar';
        if (msgId === 'highlighted-message') {
          detail = 'Pesan Sorotan (Highlighted)';
        } else if (msgId === 'skip-subs-mode-message') {
          detail = 'Kirim Pesan Sub-Only Mode';
        } else if (msgId === 'gigantified-emote-message') {
          detail = 'Emote Raksasa (Gigantified)';
        } else if (msgId === 'animated-message') {
          detail = 'Pesan Animasi (Poin Saluran)';
        }

        this.broadcastEvent({
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

      // 2. CHAT BIASA & CHANNEL POINTS REDEEM
      client.on('chat', (channel, userstate, message, self) => {
        if (self) return;

        // Cek Channel Points Redeem (custom reward, highlighted message, sub-mode skip, emote animasi)
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
            else if (isSkipSub) detail = 'Kirim Pesan Sub-Only Mode';
            else if (isGigantified) detail = 'Emote Raksasa (Gigantified)';
            else if (isAnimated) detail = 'Pesan Animasi (Poin Saluran)';

            this.broadcastEvent({
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

        this.broadcastChat({
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
          text: message
        });
      });

      // 3. ACTION (/me) DENGAN REDEEM
      client.on('action', (channel, userstate, message, self) => {
        if (self) return;

        const isCustomReward = !!userstate['custom-reward-id'];
        const isRedeem = isCustomReward || userstate['msg-id'] === 'highlighted-message';
        if (isRedeem) {
          const dedupeKey = userstate.id || `${userstate.username}_${userstate['custom-reward-id'] || userstate['msg-id']}_${message}`;
          if (!this.isDuplicateRedeem(dedupeKey)) {
            this.broadcastEvent({
              platform: 'twitch',
              type: 'event',
              eventType: 'redeem',
              title: 'Twitch Channel Points Redeem!',
              author: userstate['display-name'] || userstate.username,
              detail: 'Reward Channel Points Ditukar (/me)',
              message: message,
              badge: '💠 REDEEM'
            });
          }
        }

        this.broadcastChat({
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
          text: `* ${message}`
        });
      });

      // Subscription baru
      client.on('subscription', (channel, username, method, message, userstate) => {
        const plan = method?.plan ? `Tier ${method.plan === '1000' ? '1' : method.plan === '2000' ? '2' : method.plan === '3000' ? '3' : method.plan}` : 'Sub';
        this.broadcastEvent({
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

      // Resubscription
      client.on('resub', (channel, username, months, message, userstate, methods) => {
        this.broadcastEvent({
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

      // Gift Sub individu
      client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'subgift',
          title: 'Twitch Gift Sub!',
          author: userstate?.['display-name'] || username,
          detail: `Menghadiahkan sub untuk ${recipient}!`,
          badge: '🎁 GIFT SUB'
        });
      });

      // Community Gift Subs (cth: bagi-bagi 5 sub ke chat)
      client.on('submysterygift', (channel, username, numbOfSubs, senderCount, userstate) => {
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'submysterygift',
          title: 'Twitch Community Gift Subs!',
          author: userstate?.['display-name'] || username,
          detail: `Menghadiahkan ${numbOfSubs} Sub untuk Komunitas! 🎉`,
          badge: `🎁 ${numbOfSubs} GIFT SUBS`
        });
      });

      // Anonymous Gift Sub
      client.on('anonsubgift', (channel, streakMonths, recipient, methods, userstate) => {
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'subgift',
          title: 'Twitch Anonymous Gift Sub!',
          author: 'Anonim',
          detail: `Menghadiahkan Sub untuk ${recipient}! 🎁`,
          badge: '🎁 ANON GIFT'
        });
      });

      // Sub Upgrade
      client.on('giftpaidupgrade', (channel, username, sender, userstate) => {
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'subscription',
          title: 'Twitch Sub Upgrade!',
          author: userstate?.['display-name'] || username,
          detail: `Melanjutkan sub yang dihadiahkan oleh ${sender}!`,
          badge: '⭐ SUB UPGRADE'
        });
      });

      // Usernotice IRC (Redeem rewards & Viewer Milestones)
      client.on('usernotice', (msgId, channel, tags, msg) => {
        const id = msgId || tags?.['msg-id'];
        if (id === 'rewardgift') {
          this.broadcastEvent({
            platform: 'twitch',
            type: 'event',
            eventType: 'redeem',
            title: 'Twitch Reward Gift!',
            author: tags?.['display-name'] || tags?.login || 'Viewer',
            detail: tags?.['msg-param-selected-count'] ? `Hadiah ${tags['msg-param-selected-count']} item` : 'Reward Gift',
            badge: '💠 REDEEM'
          });
        } else if (id === 'viewermilestone') {
          const category = tags?.['msg-param-category'] || 'Watch Streak';
          const val = tags?.['msg-param-value'] || '';
          this.broadcastEvent({
            platform: 'twitch',
            type: 'event',
            eventType: 'milestone',
            title: 'Twitch Viewer Milestone!',
            author: tags?.['display-name'] || tags?.login || 'Viewer',
            detail: `${category} ${val}`,
            message: msg || '',
            badge: '🏆 MILESTONE'
          });
        }
      });

      // Bits / Cheer
      client.on('cheer', (channel, userstate, message) => {
        const bits = userstate.bits || 0;
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'cheer',
          title: 'Twitch Bits Cheer!',
          author: userstate['display-name'] || userstate.username,
          detail: `${bits} Bits 💎`,
          message: message,
          badge: '💎 BITS'
        });

        // Tampilkan juga sebagai chat
        this.broadcastChat({
          platform: 'twitch',
          type: 'chat',
          author: {
            name: userstate['display-name'] || userstate.username,
            username: userstate.username,
            color: userstate.color || '#a970ff',
            isBits: true
          },
          text: `[${bits} Bits] ${message}`
        });
      });

      // Raid
      client.on('raided', (channel, username, viewers) => {
        this.broadcastEvent({
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

      // Jika streamer menyertakan token Twitch OAuth, hubungkan juga ke Twitch EventSub WebSocket
      // Ini memungkinkan deteksi 100% Channel Points bahkan yang TIDAK mewajibkan ketik teks!
      if (cleanToken) {
        this.connectTwitchEventSub(cleanChannel, cleanToken);
      }
    } catch (err) {
      console.error('Twitch connection error:', err);
      this.broadcastStatus('twitch', 'error', `Gagal terhubung: ${err.message}`);
    }
  }

  // ==========================================
  // TWITCH EVENTSUB WEBSOCKET (TOKEN BASED - FULL REDEMPTIONS)
  // ==========================================
  async connectTwitchEventSub(channelName, token) {
    try {
      // 1. Validasi token ke Twitch OAuth endpoint
      const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` }
      });

      if (!validateRes.ok) {
        console.warn('[Twitch EventSub] Token Twitch tidak valid atau expired');
        return;
      }

      const tokenInfo = await validateRes.json();
      const clientId = tokenInfo.client_id;
      let broadcasterId = tokenInfo.user_id;

      // Ambil user_id broadcaster jika channel target berbeda dengan akun token
      if (tokenInfo.login?.toLowerCase() !== channelName.toLowerCase()) {
        try {
          const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, {
            headers: {
              'Client-Id': clientId,
              Authorization: `Bearer ${token}`
            }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.data?.[0]?.id) {
              broadcasterId = userData.data[0].id;
            }
          }
        } catch (e) {
          // gunakan default broadcasterId
        }
      }

      console.log(`[Twitch EventSub] Menghubungkan WebSocket untuk Broadcaster ID: ${broadcasterId}`);

      const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
      this.connections.twitchWs = ws;

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          const messageType = data.metadata?.message_type;

          if (messageType === 'session_welcome') {
            const sessionId = data.payload.session.id;
            console.log(`[Twitch EventSub] Session ID diperoleh: ${sessionId}, mendaftarkan subscription redemptions...`);

            // Daftarkan listener Channel Points Custom Reward Redemption
            const subRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
              method: 'POST',
              headers: {
                'Client-Id': clientId,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'channel.channel_points_custom_reward_redemption.add',
                version: '1',
                condition: {
                  broadcaster_user_id: broadcasterId
                },
                transport: {
                  method: 'websocket',
                  session_id: sessionId
                }
              })
            });

            if (subRes.ok) {
              console.log('[Twitch EventSub] Berhasil berlangganan Channel Points Custom Reward Redemptions!');
            } else {
              const errData = await subRes.json();
              console.warn('[Twitch EventSub] Gagal mendaftarkan event subscription:', errData);
            }
          } else if (messageType === 'notification') {
            const subType = data.metadata?.subscription_type;
            if (subType === 'channel.channel_points_custom_reward_redemption.add') {
              const evt = data.payload.event;
              const rewardTitle = evt.reward?.title || 'Reward Channel Points';
              const rewardCost = evt.reward?.cost ? `${Number(evt.reward.cost).toLocaleString()} Poin` : '';
              const userName = evt.user_name || evt.user_login || 'Viewer';
              const userInput = evt.user_input || '';
              const dedupeKey = evt.id || `${userName}_${rewardTitle}_${userInput}`;

              if (!this.isDuplicateRedeem(dedupeKey)) {
                this.broadcastEvent({
                  platform: 'twitch',
                  type: 'event',
                  eventType: 'redeem',
                  title: 'Twitch Channel Points Redeem!',
                  author: userName,
                  detail: `${rewardTitle} (${rewardCost})`,
                  message: userInput,
                  badge: '💠 REDEEM'
                });
              }
            }
          }
        } catch (e) {
          console.error('[Twitch EventSub] Error parse WS message:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('[Twitch EventSub] WebSocket Error:', err?.message || err);
      };

      ws.onclose = () => {
        console.log('[Twitch EventSub] WebSocket Closed');
      };
    } catch (err) {
      console.warn('[Twitch EventSub] Exception:', err);
    }
  }

  async disconnectTwitch() {
    if (this.connections.twitchWs) {
      try {
        this.connections.twitchWs.close();
      } catch (e) {
        // ignore
      }
      this.connections.twitchWs = null;
    }
    if (this.connections.twitch) {
      try {
        await this.connections.twitch.disconnect();
      } catch (e) {
        // ignore
      }
      this.connections.twitch = null;
    }
    this.activeChannels.twitch = '';
    this.activeChannels.twitchToken = '';
    this.broadcastStatus('twitch', 'idle', 'Terputus');
  }

  // ==========================================
  // YOUTUBE CONNECTION
  // ==========================================
  parseYouTubeInput(input) {
    const str = input.trim();
    // Video URL check (watch?v= or youtu.be/)
    const vMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (vMatch && vMatch[1]) {
      return { liveId: vMatch[1] };
    }
    // Channel handle (@handle)
    if (str.startsWith('@')) {
      return { handle: str };
    }
    // Channel ID (UC...)
    if (str.startsWith('UC') && str.length >= 20) {
      return { channelId: str };
    }
    // 11 chars video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
      return { liveId: str };
    }
    // Default handle with @
    return { handle: `@${str.replace(/^@/, '')}` };
  }

  async connectYouTube(input) {
    if (!input || input.trim() === '') {
      await this.disconnectYouTube();
      return;
    }

    await this.disconnectYouTube();
    this.activeChannels.youtube = input.trim();
    this.broadcastStatus('youtube', 'connecting', `Mencari live stream YouTube: ${input.trim()}...`);

    try {
      const target = this.parseYouTubeInput(input);
      const liveChat = new LiveChat(target);
      this.connections.youtube = liveChat;

      liveChat.on('start', (liveId) => {
        this.broadcastStatus('youtube', 'connected', `Terhubung ke YouTube Live (ID: ${liveId})`, { liveId });
      });

      liveChat.on('end', (reason) => {
        this.broadcastStatus('youtube', 'disconnected', `Live chat YouTube berakhir: ${reason || 'Selesai'}`);
      });

      liveChat.on('error', (err) => {
        console.error('YouTube LiveChat error:', err);
        this.broadcastStatus('youtube', 'error', `YouTube Error: ${err.message || 'Stream offline / ID salah'}`);
      });

      liveChat.on('chat', (chatItem) => {
        const text = (chatItem.message || []).map((m) => {
          if ('text' in m) return m.text;
          if ('emojiText' in m) return m.emojiText;
          return '';
        }).join('');

        // 1. Cek Gift Memberships (Sponsorship Gift)
        if (chatItem.isGiftMembership) {
          this.broadcastEvent({
            platform: 'youtube',
            type: 'event',
            eventType: 'gift_member',
            title: 'YouTube Gift Memberships!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: text || 'Menghadiahkan langganan Membership!',
            badge: '🎁 GIFT MEMBER'
          });
        }
        // 2. Cek Super Sticker
        else if (chatItem.superchat && chatItem.superchat.sticker) {
          const scAmount = chatItem.superchat.amount;
          const stickerUrl = chatItem.superchat.sticker.url;
          const stickerAlt = chatItem.superchat.sticker.alt || 'Super Sticker';
          this.broadcastEvent({
            platform: 'youtube',
            type: 'event',
            eventType: 'supersticker',
            title: 'YouTube Super Sticker!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: `${scAmount} • ${stickerAlt}`,
            stickerUrl: stickerUrl,
            color: chatItem.superchat.color || '#ffb300',
            badge: `⭐ STICKER ${scAmount}`
          });
        }
        // 3. Cek Super Chat biasa / Jewels Gift
        else if (chatItem.superchat) {
          const scAmount = chatItem.superchat.amount;
          const scColor = chatItem.superchat.color || '#ff0000';
          const isJewels = text.toLowerCase().includes('jewel') || scAmount.toLowerCase().includes('jewel') || scAmount.toLowerCase().includes('💎');
          this.broadcastEvent({
            platform: 'youtube',
            type: 'event',
            eventType: isJewels ? 'jewels' : 'superchat',
            title: isJewels ? 'YouTube Jewels Gift!' : 'YouTube Super Chat!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: scAmount,
            message: text,
            color: scColor,
            badge: isJewels ? `💎 ${scAmount}` : `💰 ${scAmount}`
          });
        }
        // 4. Cek Membership baru / Milestone
        else if (chatItem.isMembership) {
          const badgeLabel = chatItem.author.badge?.label || 'Member';
          const isMilestone = text.length > 0;
          this.broadcastEvent({
            platform: 'youtube',
            type: 'event',
            eventType: 'member',
            title: isMilestone ? 'YouTube Member Milestone!' : 'YouTube New Member!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: isMilestone ? `${badgeLabel}: ${text}` : `Selamat bergabung sebagai ${badgeLabel}! 🌟`,
            message: text,
            badge: '⭐ MEMBER'
          });
        }

        // Kirim ke chat stream
        this.broadcastChat({
          platform: 'youtube',
          type: 'chat',
          id: chatItem.id,
          author: {
            name: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            isOwner: chatItem.isOwner,
            isMod: chatItem.isModerator,
            isSub: chatItem.isMembership,
            badgeText: chatItem.author.badge?.label
          },
          text: text,
          superchat: chatItem.superchat ? {
            amount: chatItem.superchat.amount,
            color: chatItem.superchat.color,
            sticker: chatItem.superchat.sticker
          } : null,
          isGiftMembership: !!chatItem.isGiftMembership,
          timestamp: chatItem.timestamp ? new Date(chatItem.timestamp).getTime() : Date.now()
        });
      });

      const ok = await liveChat.start();
      if (!ok) {
        this.broadcastStatus('youtube', 'error', 'Tidak dapat menemukan live stream aktif untuk channel tersebut.');
      }
    } catch (err) {
      console.error('YouTube connect exception:', err);
      this.broadcastStatus('youtube', 'error', `Gagal menghubungkan YouTube: ${err.message}`);
    }
  }

  async disconnectYouTube() {
    if (this.connections.youtube) {
      try {
        this.connections.youtube.stop('User disconnected');
      } catch (e) {
        // ignore
      }
      this.connections.youtube = null;
    }
    this.activeChannels.youtube = '';
    this.broadcastStatus('youtube', 'idle', 'Terputus');
  }

  // ==========================================
  // TIKTOK CONNECTION
  // ==========================================
  async connectTikTok(username) {
    if (!username || username.trim() === '') {
      await this.disconnectTikTok();
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, '');
    await this.disconnectTikTok();

    this.activeChannels.tiktok = cleanUsername;
    this.broadcastStatus('tiktok', 'connecting', `Menghubungkan ke TikTok LIVE @${cleanUsername}...`);

    try {
      const tiktok = new TikTokLiveConnection(cleanUsername, {
        processInitialData: false
      });

      this.connections.tiktok = tiktok;

      // Event connected
      tiktok.on('connected', (state) => {
        this.broadcastStatus('tiktok', 'connected', `Terhubung ke TikTok @${cleanUsername} (Room ID: ${state?.roomId || ''})`, {
          roomId: state?.roomId,
          roomInfo: state?.roomInfo
        });
      });

      tiktok.on('disconnected', () => {
        this.broadcastStatus('tiktok', 'disconnected', `TikTok @${cleanUsername} terputus`);
      });

      tiktok.on('streamEnd', () => {
        this.broadcastStatus('tiktok', 'disconnected', `TikTok LIVE @${cleanUsername} telah berakhir`);
      });

      // Chat TikTok (v2.5 & v3 Protobuf compatible)
      tiktok.on('chat', (data) => {
        const text = data.content || data.comment || '';
        if (!text) return;

        const authorName = data.nickname || data.user?.nickname || data.uniqueId || data.user?.displayId || 'User';
        const username = data.uniqueId || data.user?.displayId || '';
        const avatarUrl = data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || '';
        const isMod = !!(data.isModerator || data.user?.userAttr?.isAdmin || data.user?.userAttr?.isSuperAdmin);
        const isSub = !!(data.isSubscriber || data.user?.isSubscribe);

        this.broadcastChat({
          platform: 'tiktok',
          type: 'chat',
          id: data.msgId || data.common?.msgId || `tt_chat_${Date.now()}_${Math.random()}`,
          author: {
            name: authorName,
            username: username,
            avatar: avatarUrl,
            isMod: isMod,
            isSub: isSub
          },
          text: text,
          timestamp: Number(data.createTime || data.common?.createTime) || Date.now()
        });
      });

      // Hadiah / Gift TikTok (Semua jenis gift: Mawar, Paus, Singa, dll)
      tiktok.on('gift', (data) => {
        const count = data.repeatCount || data.comboCount || data.repeat_count || data.count || 1;
        // Hanya tahan streak intermediate jika sedang combo beruntun aktif
        if (data.giftType === 1 && data.repeatEnd === false && count > 1) {
          return;
        }

        const authorName = data.nickname || data.user?.nickname || data.uniqueId || data.user?.displayId || 'User';
        const avatarUrl = data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || '';
        const giftName = data.giftName || data.gift?.name || data.giftDetails?.giftName || data.common?.describe || 'Gift';
        const diamondUnit = data.diamondCount || data.gift?.diamondCount || 0;
        const totalDiamonds = diamondUnit * count;
        const giftIcon = data.giftPictureUrl || data.gift?.image?.urlList?.[0] || '';

        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'gift',
          title: 'TikTok Gift!',
          author: authorName,
          avatar: avatarUrl,
          detail: `${giftName} x${count} (${totalDiamonds} 💎)`,
          icon: giftIcon,
          badge: `🎁 ${giftName} x${count}`,
          diamonds: totalDiamonds
        });

        // Munculkan juga di chatbox
        this.broadcastChat({
          platform: 'tiktok',
          type: 'chat',
          isGift: true,
          author: {
            name: authorName,
            username: data.uniqueId || data.user?.displayId || '',
            avatar: avatarUrl
          },
          text: `Mengirim Hadiah ${giftName} x${count} (${totalDiamonds} 💎)`
        });
      });

      // TikTok Subscription baru
      tiktok.on('subscribe', (data) => {
        const authorName = data.nickname || data.user?.nickname || data.uniqueId || 'User';
        const avatarUrl = data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || '';
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'subscribe',
          title: 'New TikTok Subscriber!',
          author: authorName,
          avatar: avatarUrl,
          detail: 'Berlangganan LIVE Subscription! ⭐',
          badge: '⭐ TIKTOK SUB'
        });
      });

      // Peti Harta Karun / Angpau Koin TikTok (Envelope)
      tiktok.on('envelope', (data) => {
        const authorName = data.nickname || data.user?.nickname || 'Streamer / Donatur';
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'envelope',
          title: 'TikTok Peti Harta / Angpau!',
          author: authorName,
          detail: 'Peti harta karun koin dibuka! 🎁',
          badge: '🪙 TREASURE CHEST'
        });
      });

      // Suka / Like TikTok
      let likeDebounceTimer = null;
      let pendingLikes = {};

      tiktok.on('like', (data) => {
        const user = data.nickname || data.user?.nickname || data.uniqueId || data.user?.displayId || 'User';
        const count = data.likeCount || data.count || 1;
        pendingLikes[user] = (pendingLikes[user] || 0) + count;

        if (!likeDebounceTimer) {
          likeDebounceTimer = setTimeout(() => {
            for (const [authorName, totalLiked] of Object.entries(pendingLikes)) {
              if (totalLiked >= 3) {
                this.broadcastEvent({
                  platform: 'tiktok',
                  type: 'event',
                  eventType: 'like',
                  title: 'TikTok Likes!',
                  author: authorName,
                  detail: `Mengirim ${totalLiked} likes! ❤️`,
                  totalLikes: data.totalLikeCount || data.total,
                  badge: `❤️ +${totalLiked}`
                });
              }
            }
            pendingLikes = {};
            likeDebounceTimer = null;
          }, 2500);
        }
      });

      // Follow baru
      tiktok.on('follow', (data) => {
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'follow',
          title: 'New TikTok Follower!',
          author: data.nickname || data.uniqueId,
          avatar: data.profilePictureUrl || '',
          detail: 'Mulai mengikuti streamer! 🌟',
          badge: '➕ FOLLOW'
        });
      });

      // Share live
      tiktok.on('share', (data) => {
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'share',
          title: 'TikTok Stream Shared!',
          author: data.nickname || data.uniqueId,
          avatar: data.profilePictureUrl || '',
          detail: 'Membagikan live streaming! 📢',
          badge: '📢 SHARE'
        });
      });

      // Member Join
      tiktok.on('member', (data) => {
        // Opsional: hanya catat jika viewer rank tinggi atau random
      });

      // Subscribe / Langganan
      tiktok.on('subscribe', (data) => {
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'subscribe',
          title: 'TikTok Subscriber!',
          author: data.nickname || data.uniqueId,
          avatar: data.profilePictureUrl || '',
          detail: 'Berlangganan TikTok Live!',
          badge: '⭐ SUB'
        });
      });

      const state = await tiktok.connect();
      console.log(`Connected to TikTok Live Room ID: ${state?.roomId}`);
    } catch (err) {
      console.error('TikTok connect error:', err);
      this.broadcastStatus('tiktok', 'error', `Gagal menghubungkan TikTok: ${err.message || 'Stream offline atau error'}`);
    }
  }

  async disconnectTikTok() {
    if (this.connections.tiktok) {
      try {
        this.connections.tiktok.disconnect();
      } catch (e) {
        // ignore
      }
      this.connections.tiktok = null;
    }
    this.activeChannels.tiktok = '';
    this.broadcastStatus('tiktok', 'idle', 'Terputus');
  }

  // ==========================================
  // SIMULATION / TEST DEMO EVENT
  // ==========================================
  sendTestEvent(platform, type) {
    const demoUsers = {
      twitch: ['GamerNinja99', 'PokimaneFan', 'CyberSamurai', 'TwitchLegend'],
      youtube: ['BudiGamingYT', 'StreamerKeren', 'AldoSuperfan', 'YouTubeVIP'],
      tiktok: ['SitiCantik01', 'RizkyDance', 'TikTokKing_ID', 'ViralStar99']
    };

    const randomUser = (plat) => {
      const list = demoUsers[plat] || demoUsers.twitch;
      return list[Math.floor(Math.random() * list.length)];
    };

    if (platform === 'twitch') {
      if (type === 'chat') {
        const sampleMsgs = [
          'Halo bang! GG gameplay-nya barusan 🔥',
          'Keren banget live hari ini!',
          'Kapan mabar lagi bang?',
          'Lanjut game berikutnya dong!'
        ];
        this.broadcastChat({
          platform: 'twitch',
          type: 'chat',
          author: {
            name: randomUser('twitch'),
            color: '#9146FF',
            isSub: true,
            isMod: Math.random() > 0.7
          },
          text: sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)]
        });
      } else if (type === 'sub') {
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'subscription',
          title: 'Twitch New Subscriber!',
          author: randomUser('twitch'),
          detail: 'Berlangganan Tier 1 Sub! ⭐',
          badge: '⭐ TIER 1 SUB'
        });
      } else if (type === 'bits') {
      } else if (type === 'bits') {
        const bitsAmount = [100, 500, 1000, 2500][Math.floor(Math.random() * 4)];
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'cheer',
          title: 'Twitch Bits Cheer!',
          author: randomUser('twitch'),
          detail: `${bitsAmount} Bits 💎`,
          message: 'Semangat terus bang streamingnya!',
          badge: `💎 ${bitsAmount} BITS`
        });
      } else if (type === 'redeem') {
        const rewards = [
          { name: 'Hydrate / Minum Air', cost: '500 Poin' },
          { name: 'Putar Lagu Request', cost: '1.000 Poin' },
          { name: 'Highlight Chat (Pesan Emas)', cost: '250 Poin' }
        ];
        const r = rewards[Math.floor(Math.random() * rewards.length)];
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'redeem',
          title: 'Twitch Channel Points Redeem!',
          author: randomUser('twitch'),
          detail: `${r.name} (${r.cost})`,
          message: 'Tolong diminum airnya bang biar gak dehidrasi!',
          badge: '💠 REDEEM'
        });
      } else if (type === 'submysterygift') {
        this.broadcastEvent({
          platform: 'twitch',
          type: 'event',
          eventType: 'submysterygift',
          title: 'Twitch Community Gift Subs!',
          author: randomUser('twitch'),
          detail: 'Membagikan 5 Tier 1 Sub untuk komunitas! 🎉',
          badge: '🎁 5 GIFT SUBS'
        });
      }
    } else if (platform === 'youtube') {
      if (type === 'chat') {
        const sampleMsgs = [
          'Halo dari YouTube! Audio & videonya jernih banget 👍',
          'Jangan lupa like guys biar rame!',
          'Mantap sekali bang!',
          'Salam dari Surabaya hadir!'
        ];
        this.broadcastChat({
          platform: 'youtube',
          type: 'chat',
          author: {
            name: randomUser('youtube'),
            isSub: true,
            isMod: false
          },
          text: sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)]
        });
      } else if (type === 'superchat') {
        const scTiers = [
          { amount: 'Rp 20.000', color: '#1565c0' },
          { amount: 'Rp 50.000', color: '#00bfa5' },
          { amount: 'Rp 100.000', color: '#ffb300' },
          { amount: 'Rp 250.000', color: '#e53935' }
        ];
        const sc = scTiers[Math.floor(Math.random() * scTiers.length)];
        this.broadcastEvent({
          platform: 'youtube',
          type: 'event',
          eventType: 'superchat',
          title: 'YouTube Super Chat!',
          author: randomUser('youtube'),
          detail: sc.amount,
          message: 'Buat beli kopi bang! Kontennya selalu menghibur!',
          color: sc.color,
          badge: `💰 ${sc.amount}`
        });
      } else if (type === 'supersticker') {
        this.broadcastEvent({
          platform: 'youtube',
          type: 'event',
          eventType: 'supersticker',
          title: 'YouTube Super Sticker!',
          author: randomUser('youtube'),
          detail: 'Rp 25.000 • Jempol Emas Goyang',
          badge: '⭐ STICKER Rp 25rb',
          color: '#00bfa5'
        });
      } else if (type === 'member') {
        this.broadcastEvent({
          platform: 'youtube',
          type: 'event',
          eventType: 'member',
          title: 'YouTube New Member!',
          author: randomUser('youtube'),
          detail: 'Bergabung dengan Member VIP Level 1! 🌟',
          badge: '⭐ NEW MEMBER'
        });
      } else if (type === 'gift_member') {
        this.broadcastEvent({
          platform: 'youtube',
          type: 'event',
          eventType: 'gift_member',
          title: 'YouTube Gift Memberships!',
          author: randomUser('youtube'),
          detail: 'Menghadiahkan 5 Keanggotaan YouTube Membership!',
          badge: '🎁 5 GIFT MEMBERS'
        });
      } else if (type === 'jewels') {
        this.broadcastEvent({
          platform: 'youtube',
          type: 'event',
          eventType: 'jewels',
          title: 'YouTube Jewels Gift!',
          author: randomUser('youtube'),
          detail: 'Mengirimkan Hadiah 200 Jewels 💎',
          badge: '💎 200 JEWELS'
        });
      }
    } else if (platform === 'tiktok') {
      if (type === 'chat') {
        const sampleMsgs = [
          'Halo bang spill build-nya dong! ✨',
          'Tap tap layar semuanya gengs ❤️',
          'Suka banget nonton live ini!',
          'Follback bang please!'
        ];
        this.broadcastChat({
          platform: 'tiktok',
          type: 'chat',
          author: {
            name: randomUser('tiktok'),
            username: randomUser('tiktok').toLowerCase()
          },
          text: sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)]
        });
      } else if (type === 'gift') {
        const gifts = [
          { name: 'Mawar (Rose)', count: 50, diamonds: 50, icon: '🌹' },
          { name: 'Kacamata Keren', count: 5, diamonds: 250, icon: '🕶️' },
          { name: 'Paus Menyelam (Whale)', count: 1, diamonds: 1000, icon: '🐳' },
          { name: 'Singa (TikTok Lion)', count: 1, diamonds: 29999, icon: '🦁' }
        ];
        const gift = gifts[Math.floor(Math.random() * gifts.length)];
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'gift',
          title: 'TikTok Gift!',
          author: randomUser('tiktok'),
          detail: `${gift.name} x${gift.count} (${gift.diamonds} 💎)`,
          badge: `${gift.icon} ${gift.name} x${gift.count}`,
          diamonds: gift.diamonds
        });
      } else if (type === 'subscribe') {
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'subscribe',
          title: 'New TikTok Subscriber!',
          author: randomUser('tiktok'),
          detail: 'Berlangganan TikTok LIVE Subscription! ⭐',
          badge: '⭐ TIKTOK SUB'
        });
      } else if (type === 'like') {
        this.broadcastEvent({
          platform: 'tiktok',
          type: 'event',
          eventType: 'like',
          title: 'TikTok Likes!',
          author: randomUser('tiktok'),
          detail: 'Mengirim 50 likes! ❤️',
          badge: '❤️ +50 Likes'
        });
      }
    }
  }

  // Bersihkan history event
  clearEventHistory() {
    this.eventHistory = [];
    this.io.emit('events_cleared');
  }
}
