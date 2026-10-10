/**
 * app.js - StreamPulse MultiChat Pro Max
 * Enhanced with UI/UX Pro Max Design Intelligence:
 * Particle FX, OBS Overlay Mode, Density Toggle, Latency HUD & Accessible Micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io({ transports: ['websocket', 'polling'] });

  // Header Elements
  const wakelockBtn = document.getElementById('wakelockBtn');
  const wakelockText = document.getElementById('wakelockText');
  const wakelockSub = document.getElementById('wakelockSub');
  const latencyDot = document.getElementById('latencyDot');
  const latencyText = document.getElementById('latencyText');
  const chipTwitch = document.getElementById('chipTwitch');
  const chipYouTube = document.getElementById('chipYouTube');
  const chipTikTok = document.getElementById('chipTikTok');
  const btnSetupModal = document.getElementById('btnSetupModal');
  const btnDemoModal = document.getElementById('btnDemoModal');
  const btnObsMode = document.getElementById('btnObsMode');
  const exitObsBtn = document.getElementById('exitObsBtn');
  const btnLiteMode = document.getElementById('btnLiteMode');
  const liteLabel = document.getElementById('liteLabel');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnInstallPwa = document.getElementById('btnInstallPwa');

  // Chat Elements
  const chatSection = document.getElementById('chatSection');
  const chatMessages = document.getElementById('chatMessages');
  const chatSearch = document.getElementById('chatSearch');
  const scrollPausePill = document.getElementById('scrollPausePill');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const densityBtns = document.querySelectorAll('.density-btn');
  const btnOrderToggle = document.getElementById('btnOrderToggle');
  const orderLabel = document.getElementById('orderLabel');
  const orderIcon = document.getElementById('orderIcon');
  const selectChatLimit = document.getElementById('selectChatLimit');
  const btnClearChatScreen = document.getElementById('btnClearChatScreen');

  // Sidebar Elements
  const sidebarSection = document.getElementById('sidebarSection');
  const statTotalChats = document.getElementById('statTotalChats');
  const statTotalEvents = document.getElementById('statTotalEvents');
  const statTotalGifts = document.getElementById('statTotalGifts');
  const recorderList = document.getElementById('recorderList');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnClearEvents = document.getElementById('btnClearEvents');

  // Modals
  const setupModal = document.getElementById('setupModal');
  const demoModal = document.getElementById('demoModal');
  const donateModal = document.getElementById('donateModal');
  const closeSetupModal = document.getElementById('closeSetupModal');
  const closeDemoModal = document.getElementById('closeDemoModal');
  const closeDonateModal = document.getElementById('closeDonateModal');
  const btnFinishDemo = document.getElementById('btnFinishDemo');
  const btnCancelSetup = document.getElementById('btnCancelSetup');
  const btnCancelDonate = document.getElementById('btnCancelDonate');
  const btnSaveChannels = document.getElementById('btnSaveChannels');
  const btnDonateModal = document.getElementById('btnDonateModal');

  // Channel Inputs
  const inputTwitch = document.getElementById('inputTwitch');
  const inputTwitchToken = document.getElementById('inputTwitchToken');
  const inputYouTube = document.getElementById('inputYouTube');
  const inputTikTok = document.getElementById('inputTikTok');

  // Mobile navigation
  const mobNavChat = document.getElementById('mobNavChat');
  const mobNavEvents = document.getElementById('mobNavEvents');
  const mobNavSetup = document.getElementById('mobNavSetup');
  const mobNavDonate = document.getElementById('mobNavDonate');

  // Particle Canvas
  const fxCanvas = document.getElementById('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');
  let particles = [];

  const urlParams = new URLSearchParams(window.location.search);
  const isUrlLite = urlParams.get('lite') === '1' || urlParams.get('lite') === 'true' || urlParams.get('mode') === 'lite';

  // Application State
  const state = {
    activeFilter: 'all',
    searchQuery: '',
    autoScroll: true,
    totalChats: 0,
    totalEvents: 0,
    totalGiftsCount: 0,
    eventsList: [],
    density: localStorage.getItem('chat_density') || 'comfortable',
    chatOrder: localStorage.getItem('chat_order') || 'top', // 'top' (newest on top) or 'bottom'
    maxChatLimit: parseInt(localStorage.getItem('max_chat_limit') || '50', 10),
    liteMode: isUrlLite || localStorage.getItem('lite_mode') === 'true',
    obsMode: false,
    statuses: {
      twitch: 'idle',
      youtube: 'idle',
      tiktok: 'idle'
    },
    twitchEmotes: {
      'OMEGALUL': 'https://cdn.7tv.app/emote/603cb1364d2bf5000d024628/1x.webp',
      'KEKW': 'https://cdn.7tv.app/emote/60b00d8299aa123b3a62ea2e/1x.webp',
      'catJAM': 'https://cdn.7tv.app/emote/60ae3e512496a798b671a525/1x.webp',
      'PepePls': 'https://cdn.7tv.app/emote/60ae3ec62496a798b671a539/1x.webp',
      'monkaS': 'https://cdn.7tv.app/emote/603cb1354d2bf5000d024606/1x.webp',
      'Pog': 'https://cdn.7tv.app/emote/6041074e548231000d41865c/1x.webp',
      'pepeJAM': 'https://cdn.7tv.app/emote/60ae3ec62496a798b671a539/1x.webp'
    }
  };

  // ==========================================
  // CONFETTI & PARTICLE FX ENGINE
  // ==========================================
  function resizeFxCanvas() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeFxCanvas);
  resizeFxCanvas();

  let fxAnimationId = null;

  function triggerConfetti(colorPalette = ['#6366f1', '#a855f7', '#ec4899', '#00f2fe', '#ffd700']) {
    if (state.liteMode) return; // Skip partikel saat mode lite aktif
    const count = 35;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: fxCanvas.width * (0.2 + Math.random() * 0.6),
        y: fxCanvas.height * 0.4,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 8 + 4,
        color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        life: 1.0,
        decay: Math.random() * 0.018 + 0.012
      });
    }
    if (!fxAnimationId) {
      fxAnimationId = requestAnimationFrame(updateParticles);
    }
  }

  function updateParticles() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.vRot;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      fxCtx.save();
      fxCtx.globalAlpha = Math.max(0, p.life);
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate((p.rotation * Math.PI) / 180);
      fxCtx.fillStyle = p.color;
      fxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      fxCtx.restore();
    }
    
    // Hanya terus looping bila ada partikel aktif (0% idle CPU)
    if (particles.length > 0) {
      fxAnimationId = requestAnimationFrame(updateParticles);
    } else {
      fxAnimationId = null;
      fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    }
  }

  // ==========================================
  // LATENCY & CONNECTION HEALTH PING
  // ==========================================
  let pingInterval = setInterval(() => {
    const start = Date.now();
    socket.emit('ping_check', () => {
      const latency = Date.now() - start;
      latencyText.textContent = `${latency}ms • WSS Live`;
      if (latency < 100) {
        latencyDot.style.background = 'var(--status-active)';
        latencyDot.style.boxShadow = '0 0 8px var(--status-active)';
      } else if (latency < 250) {
        latencyDot.style.background = 'var(--status-warning)';
      } else {
        latencyDot.style.background = 'var(--status-danger)';
      }
    });
  }, 10000);

  // ==========================================
  // WAKE LOCK INTEGRATION
  // ==========================================
  if (window.screenKeepAlive) {
    window.screenKeepAlive.onStatusChange((status) => {
      if (status === 'active' || status === 'fallback') {
        wakelockBtn.classList.remove('inactive');
        wakelockText.textContent = 'LAYAR AKTIF (Anti-Sleep ON)';
        if (wakelockSub) wakelockSub.textContent = 'Layar Dicegah Mati';
        wakelockBtn.title = 'Layar HP / Monitor Anda dicegah tidur atau mati otomatis';
      } else {
        wakelockBtn.classList.add('inactive');
        wakelockText.textContent = 'Layar Tidur Normal';
        if (wakelockSub) wakelockSub.textContent = 'Fitur Anti-Mati Nonaktif';
        wakelockBtn.title = 'Klik untuk mengaktifkan mode Layar Selalu Menyala';
      }
    });

    wakelockBtn.addEventListener('click', async () => {
      await window.screenKeepAlive.toggle();
    });
  }

  // ==========================================
  // OBS OVERLAY MODE
  // ==========================================
  const toggleObsMode = () => {
    state.obsMode = !state.obsMode;
    document.body.classList.toggle('obs-mode', state.obsMode);
    if (state.obsMode) {
      btnObsMode.classList.add('active');
    } else {
      btnObsMode.classList.remove('active');
    }
  };

  btnObsMode.addEventListener('click', toggleObsMode);
  exitObsBtn.addEventListener('click', toggleObsMode);

  // ==========================================
  // DENSITY SWITCHER
  // ==========================================
  const applyDensity = (mode) => {
    state.density = mode;
    localStorage.setItem('chat_density', mode);
    densityBtns.forEach(btn => {
      if (btn.dataset.density === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (mode === 'compact') {
      chatSection.classList.add('density-compact');
    } else {
      chatSection.classList.remove('density-compact');
    }
  };

  densityBtns.forEach(btn => {
    btn.addEventListener('click', () => applyDensity(btn.dataset.density));
  });
  applyDensity(state.density);

  // Chat Order (Terbaru di Atas vs Bawah)
  const updateOrderUI = () => {
    if (!btnOrderToggle) return;
    if (state.chatOrder === 'top') {
      btnOrderToggle.classList.add('active');
      orderLabel.textContent = 'Terbaru di Atas';
      orderIcon.innerHTML = '<path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>';
    } else {
      btnOrderToggle.classList.remove('active');
      orderLabel.textContent = 'Terbaru di Bawah';
      orderIcon.innerHTML = '<path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>';
    }
  };

  if (btnOrderToggle) {
    btnOrderToggle.addEventListener('click', () => {
      state.chatOrder = state.chatOrder === 'top' ? 'bottom' : 'top';
      localStorage.setItem('chat_order', state.chatOrder);
      updateOrderUI();
      // Reverse current visible chats
      const items = Array.from(chatMessages.querySelectorAll('.chat-item'));
      items.reverse().forEach(el => chatMessages.appendChild(el));
      if (state.chatOrder === 'top') {
        chatMessages.scrollTop = 0;
      } else {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });
    updateOrderUI();
  }

  // ==========================================
  // PERFORMANCE: MAX CHAT LIMIT & CLEAR PURGE
  // ==========================================
  function trimExcessChats() {
    const chatItems = chatMessages.querySelectorAll('.chat-item');
    if (chatItems.length > state.maxChatLimit) {
      const removeCount = chatItems.length - state.maxChatLimit;
      if (state.chatOrder === 'top') {
        // Chat terlama berada di baris paling bawah
        for (let i = 0; i < removeCount; i++) {
          const last = chatMessages.querySelector('.chat-item:last-child');
          if (last) last.remove();
        }
      } else {
        // Chat terlama berada di baris paling atas
        for (let i = 0; i < removeCount; i++) {
          const first = chatMessages.querySelector('.chat-item:first-child');
          if (first) first.remove();
        }
      }
    }
  }

  if (selectChatLimit) {
    selectChatLimit.value = state.maxChatLimit.toString();
    selectChatLimit.addEventListener('change', (e) => {
      state.maxChatLimit = parseInt(e.target.value, 10);
      localStorage.setItem('max_chat_limit', state.maxChatLimit);
      trimExcessChats();
    });
  }

  if (btnClearChatScreen) {
    btnClearChatScreen.addEventListener('click', () => {
      chatMessages.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
          </div>
          <h3>Layar Chat Dibersihkan</h3>
          <p>Semua chat lama telah dihapus dari layar agar performa HP/Browser tetap super ringan & hemat RAM. Pesan baru akan otomatis masuk ke sini.</p>
        </div>
      `;
      scrollPausePill.style.display = 'none';
    });
  }

  // Fullscreen button
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      window.screenKeepAlive.toggleFullscreen();
    });
  }

  // ==========================================
  // LITE MODE (ULTRA RINGAN & HEMAT DAYA - PERMANENT DEFAULT)
  // ==========================================
  state.liteMode = true;
  document.body.classList.add('lite-mode');
  if (state.maxChatLimit > 50) {
    state.maxChatLimit = 40;
    if (selectChatLimit) selectChatLimit.value = '40';
  }



  // ==========================================
  // SOCKET.IO EVENT LISTENERS
  // ==========================================
  socket.on('connect', () => {
    latencyText.textContent = 'WSS Live';
    latencyDot.style.background = 'var(--status-active)';

    // Multi-User Session: Otomatis daftarkan channel yang disimpan di browser/HP pengguna ini
    const savedChannelsJson = localStorage.getItem('streampulse_my_channels');
    if (savedChannelsJson) {
      try {
        const saved = JSON.parse(savedChannelsJson);
        if (saved.twitch !== undefined) inputTwitch.value = saved.twitch;
        if (saved.twitchToken !== undefined && inputTwitchToken) inputTwitchToken.value = saved.twitchToken;
        if (saved.youtube !== undefined) inputYouTube.value = saved.youtube;
        if (saved.tiktok !== undefined) inputTikTok.value = saved.tiktok;

        socket.emit('update_channels', {
          twitch: saved.twitch || '',
          twitchToken: saved.twitchToken || '',
          youtube: saved.youtube || '',
          tiktok: saved.tiktok || ''
        });
      } catch (err) {
        console.warn('Gagal membaca saved channels:', err);
      }
    }
  });

  socket.on('initial_state', (initial) => {
    const hasLocal = localStorage.getItem('streampulse_my_channels');
    if (!hasLocal && initial.channels) {
      inputTwitch.value = initial.channels.twitch || '';
      if (inputTwitchToken) {
        inputTwitchToken.value = initial.channels.twitchToken || localStorage.getItem('streampulse_twitch_token') || '';
      }
      inputYouTube.value = initial.channels.youtube || '';
      inputTikTok.value = initial.channels.tiktok || '';
    }

    if (initial.statuses) {
      for (const [plat, data] of Object.entries(initial.statuses)) {
        updatePlatformStatus(plat, data.status, data.message);
      }
    }

    if (initial.recentEvents && initial.recentEvents.length > 0) {
      initial.recentEvents.forEach(evt => addEventToRecorder(evt, false));
    }

    if (initial.emotes && typeof initial.emotes === 'object') {
      state.twitchEmotes = { ...state.twitchEmotes, ...initial.emotes };
    }
  });

  // Pre-load global 7TV & BetterTTV emotes segera saat boot
  fetch('/api/emotes/global')
    .then(r => r.json())
    .then(emotes => {
      if (emotes && typeof emotes === 'object') {
        state.twitchEmotes = { ...emotes, ...state.twitchEmotes };
      }
    })
    .catch(() => {});

  socket.on('twitch_emotes', ({ channel, emotes }) => {
    if (emotes && typeof emotes === 'object') {
      state.twitchEmotes = { ...state.twitchEmotes, ...emotes };
    }
  });

  socket.on('platform_status', ({ platform, status, message }) => {
    updatePlatformStatus(platform, status, message);
  });

  socket.on('new_chat', (chatItem) => {
    state.totalChats++;
    statTotalChats.textContent = state.totalChats;

    addChatMessage(chatItem);
  });

  socket.on('new_event', (eventItem) => {
    state.totalEvents++;
    statTotalEvents.textContent = state.totalEvents;

    const isHighTier = 
      (eventItem.diamonds && eventItem.diamonds >= 1000) ||
      (eventItem.detail && (
        eventItem.detail.includes('100.000') ||
        eventItem.detail.includes('250.000') ||
        eventItem.detail.includes('1000 Bits') ||
        eventItem.detail.includes('Singa') ||
        eventItem.detail.includes('Paus') ||
        eventItem.detail.includes('5 Gift')
      ));

    if (['gift', 'superchat', 'supersticker', 'jewels', 'cheer', 'gift_member', 'submysterygift', 'redeem'].includes(eventItem.eventType)) {
      state.totalGiftsCount++;
      statTotalGifts.textContent = state.totalGiftsCount;

      if (isHighTier) {
        triggerConfetti(['#00f2fe', '#fe2c55', '#ffd700', '#a970ff', '#ffffff']);
      }
    }

    addEventMessageToChat(eventItem, isHighTier);
    addEventToRecorder(eventItem, true);
  });

  socket.on('events_cleared', () => {
    state.eventsList = [];
    state.totalEvents = 0;
    state.totalGiftsCount = 0;
    statTotalEvents.textContent = '0';
    statTotalGifts.textContent = '0';
    recorderList.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p>Belum ada event tercatat.</p>
      </div>
    `;
  });

  // ==========================================
  // STATUS BADGE HANDLER
  // ==========================================
  function updatePlatformStatus(platform, status, message) {
    state.statuses[platform] = status;
    let chip = null;
    let label = '';

    if (platform === 'twitch') {
      chip = chipTwitch;
      label = 'Twitch';
    } else if (platform === 'youtube') {
      chip = chipYouTube;
      label = 'YouTube';
    } else if (platform === 'tiktok') {
      chip = chipTikTok;
      label = 'TikTok';
    }

    if (!chip) return;

    chip.className = `platform-chip ${platform} ${status}`;
    chip.title = message || status;

    const nameSpan = chip.querySelector('span:last-child');
    if (nameSpan) {
      if (status === 'connected') {
        nameSpan.textContent = `${label} (Live)`;
      } else if (status === 'connecting') {
        nameSpan.textContent = `${label} (...)`;
      } else {
        nameSpan.textContent = label;
      }
    }
  }

  // ==========================================
  // UNIFIED CHAT RENDERING
  // ==========================================
  function formatTime(timestamp) {
    const d = new Date(timestamp || Date.now());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // TWITCH & 7TV EMOTE PARSER
  // ==========================================
  function parse7tvTextTokens(rawText, emotesMap) {
    if (!rawText) return '';
    const tokens = rawText.split(/(\s+)/);
    return tokens.map(token => {
      if (!token) return '';
      if (/^\s+$/.test(token)) return token;

      const cleanToken = token.trim();
      const emoteUrl = (emotesMap && emotesMap[cleanToken]) || state.twitchEmotes[cleanToken];
      if (emoteUrl) {
        return `<img class="chat-emote seventv-emote" src="${escapeHtml(emoteUrl)}" alt="${escapeHtml(cleanToken)}" title="${escapeHtml(cleanToken)}" referrerpolicy="no-referrer" loading="lazy">`;
      }
      return escapeHtml(token);
    }).join('');
  }

  function formatTwitchMessageWithEmotes(rawText, twitchEmotes, channel7tvEmotes = null) {
    if (!rawText) return '';

    // Bila tidak ada emote native Twitch, parse 7TV langsung
    if (!twitchEmotes || typeof twitchEmotes !== 'object' || Object.keys(twitchEmotes).length === 0) {
      return parse7tvTextTokens(rawText, channel7tvEmotes);
    }

    // Ambil rentang index karakter emote Twitch
    const ranges = [];
    for (const emoteId in twitchEmotes) {
      const occurrences = twitchEmotes[emoteId];
      if (Array.isArray(occurrences)) {
        for (const occ of occurrences) {
          const parts = occ.split('-');
          const start = parseInt(parts[0], 10);
          const end = parseInt(parts[1], 10);
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            ranges.push({
              start,
              end: end + 1, // slice end index
              id: emoteId
            });
          }
        }
      }
    }

    // Urutkan rentang index dari depan ke belakang
    ranges.sort((a, b) => a.start - b.start);

    let html = '';
    let lastIndex = 0;

    for (const r of ranges) {
      if (r.start < lastIndex) continue; // Skip overlap jika ada rentang corrupt

      // Teks biasa sebelum emote (bisa mengandung 7TV emotes)
      if (r.start > lastIndex) {
        const textChunk = rawText.substring(lastIndex, r.start);
        html += parse7tvTextTokens(textChunk, channel7tvEmotes);
      }

      // Emote native Twitch
      const emoteName = rawText.substring(r.start, r.end);
      const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/1.0`;
      html += `<img class="chat-emote" src="${emoteUrl}" alt="${escapeHtml(emoteName)}" title="${escapeHtml(emoteName)}" referrerpolicy="no-referrer" loading="lazy">`;

      lastIndex = r.end;
    }

    // Sisa teks setelah emote terakhir
    if (lastIndex < rawText.length) {
      const remaining = rawText.substring(lastIndex);
      html += parse7tvTextTokens(remaining, channel7tvEmotes);
    }

    return html;
  }

  function formatYouTubeMessage(chat) {
    if (Array.isArray(chat.messageParts) && chat.messageParts.length > 0) {
      return chat.messageParts.map(part => {
        if (!part) return '';
        if (part.type === 'emoji' || part.url) {
          const emoteAlt = escapeHtml(part.alt || part.emojiText || 'emote');
          const emoteUrl = escapeHtml(part.url);
          return `<img class="chat-emote yt-custom-emote" src="${emoteUrl}" alt="${emoteAlt}" title="${emoteAlt}" referrerpolicy="no-referrer" loading="lazy">`;
        }
        return parse7tvTextTokens(part.text || '', state.twitchEmotes);
      }).join('');
    }
    return parse7tvTextTokens(chat.text, state.twitchEmotes);
  }

  function shouldDisplayMessage(platform, isEvent, text, authorName) {
    if (state.activeFilter !== 'all') {
      if (state.activeFilter === 'events' && !isEvent) return false;
      if (state.activeFilter !== 'events' && platform !== state.activeFilter) return false;
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchText = (text || '').toLowerCase().includes(q);
      const matchAuthor = (authorName || '').toLowerCase().includes(q);
      if (!matchText && !matchAuthor) return false;
    }

    return true;
  }

  // Official Twitch Badges CDN Registry
  const TWITCH_OFFICIAL_BADGES = {
    broadcaster: {
      url: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1',
      title: 'Broadcaster'
    },
    moderator: {
      url: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
      title: 'Moderator'
    },
    vip: {
      url: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1',
      title: 'VIP'
    },
    subscriber: {
      url: 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1',
      title: 'Subscriber'
    },
    partner: {
      url: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1',
      title: 'Verified Partner'
    },
    premium: {
      url: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/1',
      title: 'Prime Gaming'
    }
  };

  function getOfficialBadgesHtml(chat) {
    const author = chat.author || {};
    let html = '';

    if (chat.platform === 'twitch') {
      // Prioritaskan custom badges dari channel (tier sub kustom, bits, founder, dsb, max 3 badge)
      if (Array.isArray(author.badgesList) && author.badgesList.length > 0) {
        author.badgesList.slice(0, 3).forEach(b => {
          if (b && b.url) {
            html += `<img src="${escapeHtml(b.url)}" class="platform-official-badge twitch-badge" alt="${escapeHtml(b.title || 'Badge')}" title="${escapeHtml(b.title || 'Badge')}" referrerpolicy="no-referrer" loading="lazy">`;
          }
        });
        return html;
      }

      const badges = author.badges || {};
      if (badges.broadcaster || author.isBroadcaster) {
        const b = TWITCH_OFFICIAL_BADGES.broadcaster;
        html += `<img src="${b.url}" class="platform-official-badge twitch-badge" alt="${b.title}" title="${b.title}" referrerpolicy="no-referrer" loading="lazy">`;
      }
      if (badges.moderator || author.isMod) {
        const b = TWITCH_OFFICIAL_BADGES.moderator;
        html += `<img src="${b.url}" class="platform-official-badge twitch-badge" alt="${b.title}" title="${b.title}" referrerpolicy="no-referrer" loading="lazy">`;
      }
      if (badges.vip) {
        const b = TWITCH_OFFICIAL_BADGES.vip;
        html += `<img src="${b.url}" class="platform-official-badge twitch-badge" alt="${b.title}" title="${b.title}" referrerpolicy="no-referrer" loading="lazy">`;
      }
      if (badges.subscriber || author.isSub) {
        const b = TWITCH_OFFICIAL_BADGES.subscriber;
        html += `<img src="${b.url}" class="platform-official-badge twitch-badge" alt="${b.title}" title="${b.title}" referrerpolicy="no-referrer" loading="lazy">`;
      }
      if (badges.partner) {
        const b = TWITCH_OFFICIAL_BADGES.partner;
        html += `<img src="${b.url}" class="platform-official-badge twitch-badge" alt="${b.title}" title="${b.title}" referrerpolicy="no-referrer" loading="lazy">`;
      }
      if (badges.premium || badges.turbo) {
        const b = TWITCH_OFFICIAL_BADGES.premium;
        html += `<img src="${b.url}" class="platform-official-badge twitch-badge" alt="${b.title}" title="${b.title}" referrerpolicy="no-referrer" loading="lazy">`;
      }
    } else if (chat.platform === 'youtube') {
      // 1. YouTube Official Owner Badge
      if (author.isOwner) {
        html += `
          <span class="yt-official-badge yt-owner-badge" title="Channel Owner / Host">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="#ffffff" aria-hidden="true"><path d="M8 1l2.3 4.7 5.2.8-3.8 3.7.9 5.2L8 12.9l-4.6 2.5.9-5.2-3.8-3.7 5.2-.8L8 1z"/></svg>
            <span>Owner</span>
          </span>`;
      }
      // 2. YouTube Official Moderator Blue Wrench
      if (author.isMod) {
        html += `
          <span class="yt-official-badge yt-mod-badge" title="Moderator">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="#5e84f1" aria-hidden="true"><path d="M9.64 5.64l-1.28-1.28a3.16 3.16 0 0 0-4.41.22 3.16 3.16 0 0 0 .22 4.41l1.28 1.28 7.37 7.37a1.05 1.05 0 0 0 1.49 0l1.49-1.49a1.05 1.05 0 0 0 0-1.49L9.64 5.64zM3.48 4.97a1.77 1.77 0 0 1 2.5 0l.75.75-1.5 1.5-.75-.75a1.77 1.77 0 0 1 0-2.5z"/></svg>
          </span>`;
      }
      // 3. YouTube Member (Official channel custom loyalty badge or icon)
      if (author.memberBadge) {
        html += `<img src="${escapeHtml(author.memberBadge)}" class="platform-official-badge yt-member-badge" alt="Member" title="Channel Member" referrerpolicy="no-referrer" loading="lazy">`;
      } else if (author.isSub) {
        html += `
          <span class="yt-official-badge yt-member-badge-pill" title="Member">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="#00bfa5" aria-hidden="true"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.7 6.3l-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l1.47 1.47 3.97-3.97a.75.75 0 0 1 1.06 1.06z"/></svg>
          </span>`;
      }
    } else if (chat.platform === 'tiktok') {
      if (author.isMod) html += `<span class="badge-user mod">MOD</span>`;
      if (author.isSub) html += `<span class="badge-user sub">SUB</span>`;
    }

    return html;
  }

  // Platform Badges with SVG Icons (UI/UX Pro Max rule: avoid raw emojis in UI chrome)
  function getPlatformBadge(platform) {
    if (platform === 'twitch') {
      return `
        <span class="badge-plat twitch">
          <svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>
          Twitch
        </span>`;
    } else if (platform === 'youtube') {
      return `
        <span class="badge-plat youtube">
          <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          YouTube
        </span>`;
    } else if (platform === 'tiktok') {
      return `
        <span class="badge-plat tiktok">
          <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.4a6.33 6.33 0 0 0-.86-.06A6.34 6.34 0 0 0 3.1 15.68a6.34 6.34 0 0 0 10.82 4.48c.03-.03.06-.06.09-.1V10.74a8.27 8.27 0 0 0 5.58 2.18V9.47a4.86 4.86 0 0 1-3.77-2.78z"/></svg>
          TikTok
        </span>`;
    }
    return '';
  }

  function addChatMessage(chat) {
    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.className = 'chat-item';
    item.dataset.platform = chat.platform;
    item.dataset.isEvent = 'false';

    const author = chat.author || {};
    const authorName = author.name || 'Anonymous';
    const authorColor = author.color || '#f8fafc';
    const initial = (authorName[0] || '?').toUpperCase();
    const avatarImg = author.avatar
      ? `<img src="${escapeHtml(author.avatar)}" class="chat-avatar" alt="${escapeHtml(authorName)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="this.onerror=null; this.outerHTML='<div class=\\'chat-avatar\\'>${initial}</div>'">`
      : `<div class="chat-avatar">${initial}</div>`;

    const badgesHtml = getPlatformBadge(chat.platform) + getOfficialBadgesHtml(chat);

    let chatTextHtml = '';
    if (chat.platform === 'twitch') {
      chatTextHtml = formatTwitchMessageWithEmotes(chat.text, chat.emotes);
    } else if (chat.platform === 'youtube') {
      chatTextHtml = formatYouTubeMessage(chat);
    } else {
      chatTextHtml = parse7tvTextTokens(chat.text, state.twitchEmotes);
    }

    item.innerHTML = `
      ${avatarImg}
      <div class="chat-content">
        <div class="chat-meta">
          ${badgesHtml}
          <span class="author-name" style="color: ${escapeHtml(authorColor)}">${escapeHtml(authorName)}</span>
          <span class="chat-time">${formatTime(chat.timestamp)}</span>
        </div>
        <div class="chat-text">${chatTextHtml}</div>
      </div>
    `;

    if (!shouldDisplayMessage(chat.platform, false, chat.text, authorName)) {
      item.style.display = 'none';
    }

    if (state.chatOrder === 'top') {
      chatMessages.prepend(item);
    } else {
      chatMessages.appendChild(item);
    }

    trimExcessChats();
    handleAutoScroll();
  }

  function addEventMessageToChat(evt, isHighTier = false) {
    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.dataset.platform = evt.platform;
    item.dataset.isEvent = 'true';

    let extraClass = '';
    if (evt.platform === 'youtube') {
      if (evt.eventType === 'superchat') extraClass = 'youtube-superchat';
      else if (evt.eventType === 'supersticker') extraClass = 'youtube-supersticker';
      else if (evt.eventType === 'member') extraClass = 'youtube-member';
      else if (evt.eventType === 'gift_member') extraClass = 'youtube-gift-member';
      else if (evt.eventType === 'jewels') extraClass = 'youtube-jewels';
      else extraClass = 'youtube-superchat';
    } else if (evt.platform === 'tiktok') {
      if (evt.eventType === 'gift') extraClass = 'tiktok-gift';
      else if (evt.eventType === 'subscribe') extraClass = 'tiktok-sub';
      else extraClass = 'tiktok-gift';
    } else if (evt.platform === 'twitch') {
      if (evt.eventType === 'redeem') extraClass = 'twitch-redeem';
      else extraClass = 'twitch-sub';
    }

    if (isHighTier) {
      extraClass += ' tier-epic';
    }

    item.className = `chat-item event-item ${extraClass}`;

    const authorName = evt.author || 'Viewer';
    const initial = (authorName[0] || '★').toUpperCase();
    // Pada Lite Mode: Jangan render avatar/profile pic pada pesan event
    const avatarImg = state.liteMode
      ? ''
      : (evt.avatar
          ? `<img src="${escapeHtml(evt.avatar)}" class="chat-avatar" alt="${escapeHtml(authorName)}" onerror="this.onerror=null; this.outerHTML='<div class=\\'chat-avatar\\'>${initial}</div>'">`
          : `<div class="chat-avatar" style="background: linear-gradient(135deg, #6366f1, #ec4899);">${initial}</div>`);

    const platBadge = getPlatformBadge(evt.platform);
    const badgePill = evt.badge ? `<span class="badge-user" style="background: rgba(59, 130, 246, 0.25); border: 1px solid rgba(59, 130, 246, 0.5); font-weight:800;">${escapeHtml(evt.badge)}</span>` : '';

    const stickerHtml = evt.stickerUrl ? `<div style="margin-top: 6px;"><img src="${escapeHtml(evt.stickerUrl)}" alt="Super Sticker" style="max-height: 70px; border-radius: 8px;"></div>` : '';
    const iconHtml = evt.icon ? `<div style="margin-top: 4px;"><img src="${escapeHtml(evt.icon)}" alt="Gift Icon" style="max-height: 48px; border-radius: 6px;"></div>` : '';

    item.innerHTML = `
      ${avatarImg}
      <div class="chat-content">
        <div class="chat-meta">
          ${platBadge}
          ${badgePill}
          <span class="author-name" style="color: #67e8f9; font-weight:800;">${escapeHtml(authorName)}</span>
          <span class="chat-time">${formatTime(evt.timestamp)}</span>
        </div>
        <div class="event-highlight-text">
          <span>${escapeHtml(evt.title)}</span>
          <span>•</span>
          <span style="color:#ffffff;">${escapeHtml(evt.detail || '')}</span>
        </div>
        ${stickerHtml}
        ${iconHtml}
        ${evt.message ? `<div class="chat-text" style="margin-top: 5px; color: #fff; font-weight: 500;">"${evt.platform === 'twitch' ? formatTwitchMessageWithEmotes(evt.message, evt.emotes) : parse7tvTextTokens(evt.message, state.twitchEmotes)}"</div>` : ''}
      </div>
    `;

    if (!shouldDisplayMessage(evt.platform, true, (evt.title + ' ' + (evt.detail || '') + ' ' + (evt.message || '')), authorName)) {
      item.style.display = 'none';
    }

    if (state.chatOrder === 'top') {
      chatMessages.prepend(item);
    } else {
      chatMessages.appendChild(item);
    }

    trimExcessChats();
    handleAutoScroll();
  }

  // ==========================================
  // EVENT RECORDER LIST
  // ==========================================
  function addEventToRecorder(evt, isNew = true) {
    state.eventsList.push(evt);

    const emptyState = recorderList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const recItem = document.createElement('div');
    recItem.className = `recorder-item ${evt.platform}`;

    let platName = 'TWITCH';
    if (evt.platform === 'youtube') platName = 'YOUTUBE';
    else if (evt.platform === 'tiktok') platName = 'TIKTOK';

    const stickerPreview = evt.stickerUrl ? `<div style="margin-top: 4px;"><img src="${escapeHtml(evt.stickerUrl)}" alt="Sticker" style="max-height: 42px; border-radius: 6px;"></div>` : '';

    recItem.innerHTML = `
      <div class="rec-top">
        <span class="rec-title"><strong>[${platName}]</strong> ${escapeHtml(evt.author || 'User')}</span>
        <span style="font-size:0.65rem; color:var(--text-tertiary); font-family:var(--font-mono);">${formatTime(evt.timestamp)}</span>
      </div>
      <div class="rec-detail">${escapeHtml(evt.detail || evt.title)}</div>
      ${stickerPreview}
      ${evt.message ? `<div class="rec-msg">"${escapeHtml(evt.message)}"</div>` : ''}
    `;

    recorderList.insertBefore(recItem, recorderList.firstChild);

    // Batasi jumlah elemen riwayat di DOM agar RAM HP tidak penuh
    if (recorderList.children.length > 50) {
      recorderList.removeChild(recorderList.lastChild);
    }
  }

  // ==========================================
  // AUTO SCROLL HANDLER (TOP & BOTTOM ADAPTIVE)
  // ==========================================
  function handleAutoScroll() {
    if (!state.autoScroll) return;
    if (state.chatOrder === 'top') {
      chatMessages.scrollTop = 0;
    } else {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  chatMessages.addEventListener('scroll', () => {
    if (state.chatOrder === 'top') {
      const isAtTop = chatMessages.scrollTop <= 60;
      if (isAtTop) {
        state.autoScroll = true;
        scrollPausePill.style.display = 'none';
      } else {
        state.autoScroll = false;
        scrollPausePill.innerHTML = `<span>⬆️ Chat Baru di Atas — Ketuk untuk ke Paling Baru</span>`;
        scrollPausePill.style.display = 'flex';
      }
    } else {
      const isAtBottom = (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) < 70;
      if (isAtBottom) {
        state.autoScroll = true;
        scrollPausePill.style.display = 'none';
      } else {
        state.autoScroll = false;
        scrollPausePill.innerHTML = `<span>⬇️ Scroll Dijeda (Ada Chat Baru) — Ketuk untuk Mengikuti</span>`;
        scrollPausePill.style.display = 'flex';
      }
    }
  });

  scrollPausePill.addEventListener('click', () => {
    state.autoScroll = true;
    if (state.chatOrder === 'top') {
      chatMessages.scrollTop = 0;
    } else {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    scrollPausePill.style.display = 'none';
  });

  // ==========================================
  // FILTERING & SEARCH
  // ==========================================
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      applyAllFilters();
    });
  });

  chatSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    applyAllFilters();
  });

  function applyAllFilters() {
    const items = chatMessages.querySelectorAll('.chat-item');
    items.forEach(item => {
      const plat = item.dataset.platform;
      const isEvt = item.dataset.isEvent === 'true';
      const text = item.innerText;

      if (shouldDisplayMessage(plat, isEvt, text, '')) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });

    if (state.autoScroll) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // ==========================================
  // MODALS MANAGEMENT & ACCESSIBILITY
  // ==========================================
  const openModal = (m) => {
    m.classList.add('show');
    const firstInput = m.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  };
  const closeModal = (m) => m.classList.remove('show');

  btnSetupModal.addEventListener('click', () => openModal(setupModal));
  closeSetupModal.addEventListener('click', () => closeModal(setupModal));
  btnCancelSetup.addEventListener('click', () => closeModal(setupModal));

  btnSaveChannels.addEventListener('click', () => {
    const twitch = inputTwitch.value.trim();
    const twitchToken = inputTwitchToken ? inputTwitchToken.value.trim() : '';
    const youtube = inputYouTube.value.trim();
    const tiktok = inputTikTok.value.trim();

    if (twitchToken) {
      localStorage.setItem('streampulse_twitch_token', twitchToken);
    } else {
      localStorage.removeItem('streampulse_twitch_token');
    }

    // Simpan saluran milik pengguna ini agar setiap pengguna/browser membuka salurannya masing-masing
    localStorage.setItem('streampulse_my_channels', JSON.stringify({
      twitch,
      twitchToken,
      youtube,
      tiktok
    }));

    socket.emit('update_channels', { twitch, twitchToken, youtube, tiktok });
    closeModal(setupModal);
  });

  [chipTwitch, chipYouTube, chipTikTok].forEach(chip => {
    chip.addEventListener('click', () => openModal(setupModal));
  });

  btnDemoModal.addEventListener('click', () => openModal(demoModal));
  closeDemoModal.addEventListener('click', () => closeModal(demoModal));
  btnFinishDemo.addEventListener('click', () => closeModal(demoModal));

  // Donate Modal Listeners
  if (btnDonateModal) btnDonateModal.addEventListener('click', () => openModal(donateModal));
  if (closeDonateModal) closeDonateModal.addEventListener('click', () => closeModal(donateModal));
  if (btnCancelDonate) btnCancelDonate.addEventListener('click', () => closeModal(donateModal));
  if (mobNavDonate) mobNavDonate.addEventListener('click', () => openModal(donateModal));

  // Dismiss modal on background click
  [setupModal, demoModal, donateModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  // ESC key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.obsMode) toggleObsMode();
      closeModal(setupModal);
      closeModal(demoModal);
      if (donateModal) closeModal(donateModal);
    }
  });

  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 200);
      const plat = btn.dataset.plat;
      const type = btn.dataset.type;
      socket.emit('send_test_event', { platform: plat, type: type });
    });
  });

  // ==========================================
  // RECORDER EXPORT
  // ==========================================
  btnExportJson.addEventListener('click', () => {
    if (state.eventsList.length === 0) {
      alert('Belum ada event untuk di-export.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.eventsList, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `streampulse_events_${Date.now()}.json`);
    dlAnchor.click();
  });

  btnExportCsv.addEventListener('click', () => {
    if (state.eventsList.length === 0) {
      alert('Belum ada event untuk di-export.');
      return;
    }
    let csv = 'Timestamp,Platform,Event Type,Title,Author,Detail,Message\n';
    state.eventsList.forEach(e => {
      const row = [
        new Date(e.timestamp).toISOString(),
        e.platform,
        e.eventType || '',
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.author || '').replace(/"/g, '""')}"`,
        `"${(e.detail || '').replace(/"/g, '""')}"`,
        `"${(e.message || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `streampulse_events_${Date.now()}.csv`);
    dlAnchor.click();
  });

  btnClearEvents.addEventListener('click', () => {
    if (confirm('Bersihkan semua riwayat event tercatat?')) {
      socket.emit('clear_events');
    }
  });

  // ==========================================
  // MOBILE NAVIGATION TABS
  // ==========================================
  if (mobNavChat && mobNavEvents && mobNavSetup) {
    mobNavChat.addEventListener('click', () => {
      mobNavChat.classList.add('active');
      mobNavEvents.classList.remove('active');
      chatSection.style.display = 'flex';
      sidebarSection.style.display = 'none';
    });

    mobNavEvents.addEventListener('click', () => {
      mobNavEvents.classList.add('active');
      mobNavChat.classList.remove('active');
      chatSection.style.display = 'none';
      sidebarSection.style.display = 'flex';
    });

    mobNavSetup.addEventListener('click', () => {
      openModal(setupModal);
    });
  }

  // ==========================================
  // PWA SERVICE WORKER & INSTALLATION
  // ==========================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('PWA ServiceWorker registered'))
        .catch((err) => console.log('PWA ServiceWorker error:', err));
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstallPwa) {
      btnInstallPwa.style.display = 'inline-flex';
      btnInstallPwa.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            btnInstallPwa.style.display = 'none';
          }
          deferredPrompt = null;
        }
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    if (btnInstallPwa) btnInstallPwa.style.display = 'none';
    deferredPrompt = null;
  });
});
