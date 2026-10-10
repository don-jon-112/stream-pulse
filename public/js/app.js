/**
 * app.js - StreamPulse MultiChat Pro Max
 * Enhanced with UI/UX Pro Max Design Intelligence:
 * Particle FX, OBS Overlay Mode, Density Toggle, Latency HUD & Accessible Micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const socket = io();

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
  const closeSetupModal = document.getElementById('closeSetupModal');
  const closeDemoModal = document.getElementById('closeDemoModal');
  const btnFinishDemo = document.getElementById('btnFinishDemo');
  const btnCancelSetup = document.getElementById('btnCancelSetup');
  const btnSaveChannels = document.getElementById('btnSaveChannels');

  // Channel Inputs
  const inputTwitch = document.getElementById('inputTwitch');
  const inputTwitchToken = document.getElementById('inputTwitchToken');
  const inputYouTube = document.getElementById('inputYouTube');
  const inputTikTok = document.getElementById('inputTikTok');

  // Mobile navigation
  const mobNavChat = document.getElementById('mobNavChat');
  const mobNavEvents = document.getElementById('mobNavEvents');
  const mobNavSetup = document.getElementById('mobNavSetup');

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
  // LITE MODE (ULTRA RINGAN & HEMAT DAYA)
  // ==========================================
  const applyLiteMode = (isLite) => {
    state.liteMode = isLite;
    localStorage.setItem('lite_mode', isLite);
    document.body.classList.toggle('lite-mode', isLite);
    if (btnLiteMode) {
      if (isLite) {
        btnLiteMode.classList.add('active');
        liteLabel.textContent = 'Lite: ON';
      } else {
        btnLiteMode.classList.remove('active');
        liteLabel.textContent = 'Lite: OFF';
      }
    }
    // Jika lite mode diaktifkan, langsung hapus elemen avatar yang sudah ada untuk membebaskan memori
    if (isLite) {
      document.querySelectorAll('.chat-avatar').forEach(el => el.remove());
    }
    if (isLite && state.maxChatLimit > 50) {
      state.maxChatLimit = 30;
      if (selectChatLimit) selectChatLimit.value = '30';
      localStorage.setItem('max_chat_limit', '30');
      trimExcessChats();
    }
  };

  if (btnLiteMode) {
    btnLiteMode.addEventListener('click', () => {
      applyLiteMode(!state.liteMode);
    });
    applyLiteMode(state.liteMode);
  }



  // ==========================================
  // SOCKET.IO EVENT LISTENERS
  // ==========================================
  socket.on('connect', () => {
    latencyText.textContent = 'WSS Live';
    latencyDot.style.background = 'var(--status-active)';
  });

  socket.on('initial_state', (initial) => {
    if (initial.channels) {
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
    // Pada Lite Mode: Jangan render avatar/profile pic sama sekali (hemat bandwidth, CPU decode & RAM)
    const avatarImg = state.liteMode
      ? ''
      : (author.avatar
          ? `<img src="${escapeHtml(author.avatar)}" class="chat-avatar" alt="${escapeHtml(authorName)}" loading="lazy" decoding="async" onerror="this.onerror=null; this.outerHTML='<div class=\\'chat-avatar\\'>${initial}</div>'">`
          : `<div class="chat-avatar">${initial}</div>`);

    let badgesHtml = getPlatformBadge(chat.platform);
    if (chat.platform === 'twitch') {
      if (author.isMod) badgesHtml += `<span class="badge-user mod">MOD</span>`;
      if (author.isSub) badgesHtml += `<span class="badge-user sub">SUB</span>`;
    } else if (chat.platform === 'youtube') {
      if (author.isOwner) badgesHtml += `<span class="badge-user mod">OWNER</span>`;
      if (author.isMod) badgesHtml += `<span class="badge-user mod">MOD</span>`;
      if (author.isSub) badgesHtml += `<span class="badge-user sub">MEMBER</span>`;
    } else if (chat.platform === 'tiktok') {
      if (author.isMod) badgesHtml += `<span class="badge-user mod">MOD</span>`;
      if (author.isSub) badgesHtml += `<span class="badge-user sub">SUB</span>`;
    }

    item.innerHTML = `
      ${avatarImg}
      <div class="chat-content">
        <div class="chat-meta">
          ${badgesHtml}
          <span class="author-name" style="color: ${escapeHtml(authorColor)}">${escapeHtml(authorName)}</span>
          <span class="chat-time">${formatTime(chat.timestamp)}</span>
        </div>
        <div class="chat-text">${escapeHtml(chat.text)}</div>
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
        ${evt.message ? `<div class="chat-text" style="margin-top: 5px; color: #fff; font-weight: 500;">"${escapeHtml(evt.message)}"</div>` : ''}
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

    socket.emit('update_channels', { twitch, twitchToken, youtube, tiktok });
    closeModal(setupModal);
  });

  [chipTwitch, chipYouTube, chipTikTok].forEach(chip => {
    chip.addEventListener('click', () => openModal(setupModal));
  });

  btnDemoModal.addEventListener('click', () => openModal(demoModal));
  closeDemoModal.addEventListener('click', () => closeModal(demoModal));
  btnFinishDemo.addEventListener('click', () => closeModal(demoModal));

  // Dismiss modal on background click
  [setupModal, demoModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // ESC key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.obsMode) toggleObsMode();
      closeModal(setupModal);
      closeModal(demoModal);
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
  // BERSIHKAN CACHE & SERVICE WORKER LAMA
  // ==========================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstallPwa) {
      btnInstallPwa.style.display = 'flex';
      btnInstallPwa.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          btnInstallPwa.style.display = 'none';
        }
      });
    }
  });
});
