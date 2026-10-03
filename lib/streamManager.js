import tmi from 'tmi.js';
import { LiveChat } from 'youtube-chat';
import { TikTokLiveConnection } from 'tiktok-live-connector';

export class StreamManager {
  constructor(io) {
    this.io = io;
    this.connections = {
      twitch: null,
      youtube: null,
      tiktok: null
    };
    this.activeChannels = {
      twitch: '',
      youtube: '',
      tiktok: ''
    };
    this.statuses = {
      twitch: { status: 'idle', message: 'Belum dihubungkan' },
      youtube: { status: 'idle', message: 'Belum dihubungkan' },
      tiktok: { status: 'idle', message: 'Belum dihubungkan' }
    };
    this.eventHistory = [];
    this.maxHistory = 1000;
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
  // TWITCH CONNECTION
  // ==========================================
  async connectTwitch(channelName) {
    if (!channelName || channelName.trim() === '') {
      await this.disconnectTwitch();
      return;
    }

    const cleanChannel = channelName.trim().toLowerCase().replace(/^#/, '');
    await this.disconnectTwitch();

    this.activeChannels.twitch = cleanChannel;
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
        this.broadcastStatus('twitch', 'connected', `Terhubung ke #${cleanChannel}`);
      });

      client.on('disconnected', (reason) => {
        this.broadcastStatus('twitch', 'disconnected', `Terputus: ${reason || 'Disconnected'}`);
      });

      // Chat biasa
      client.on('chat', (channel, userstate, message, self) => {
        if (self) return;
        this.broadcastChat({
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
          text: message
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

      // Gift Sub
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
    } catch (err) {
      console.error('Twitch connection error:', err);
      this.broadcastStatus('twitch', 'error', `Gagal terhubung: ${err.message}`);
    }
  }

  async disconnectTwitch() {
    if (this.connections.twitch) {
      try {
        await this.connections.twitch.disconnect();
      } catch (e) {
        // ignore
      }
      this.connections.twitch = null;
    }
    this.activeChannels.twitch = '';
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

        // Cek Super Chat
        if (chatItem.superchat) {
          const scAmount = chatItem.superchat.amount;
          const scColor = chatItem.superchat.color || '#ff0000';
          this.broadcastEvent({
            platform: 'youtube',
            type: 'event',
            eventType: 'superchat',
            title: 'YouTube Super Chat!',
            author: chatItem.author.name,
            avatar: chatItem.author.thumbnail?.url,
            detail: scAmount,
            message: text,
            color: scColor,
            badge: `💰 ${scAmount}`
          });
        }

        // Cek Membership baru
        if (chatItem.isMembership) {
          // Bila ada text atau event membership
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
            color: chatItem.superchat.color
          } : null,
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

      // Hadiah / Gift TikTok
      tiktok.on('gift', (data) => {
        if (data.giftType === 1 && !data.repeatEnd && !data.repeat_end) {
          // Streak sedang berjalan
          return;
        }

        const authorName = data.nickname || data.user?.nickname || data.uniqueId || data.user?.displayId || 'User';
        const avatarUrl = data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || '';
        const giftName = data.giftName || data.gift?.name || data.giftDetails?.giftName || data.common?.describe || 'Gift';
        const count = data.repeatCount || data.comboCount || data.repeat_count || 1;
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
          { name: 'Paus Menyelam (Diving Whale)', count: 1, diamonds: 1000, icon: '🐳' },
          { name: 'Kacamata Keren', count: 5, diamonds: 250, icon: '🕶️' },
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
