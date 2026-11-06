/**
 * app.js - StreamPulse MultiChat Pro Max
 * Enhanced with UI/UX Pro Max Design Intelligence:
 * Particle FX, OBS Overlay Mode, Density Toggle, Latency HUD & Accessible Micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // THEME MANAGEMENT (DARK MODE / LIGHT MODE)
  // ==========================================
  function initTheme() {
    const savedTheme = localStorage.getItem('streampulse_theme') || 'dark'; // Default to dark mode
    setTheme(savedTheme, false);

    const btnThemeToggle = document.getElementById('btnThemeToggle');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next, true);
      });
    }
  }

  function setTheme(theme, save = true) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }
    if (save) {
      localStorage.setItem('streampulse_theme', theme);
    }
    updateThemeToggleBtn(theme);
  }

  function updateThemeToggleBtn(theme) {
    const btn = document.getElementById('btnThemeToggle');
    if (!btn) return;
    if (theme === 'dark') {
      btn.innerHTML = '<span class="theme-icon">☀️</span> <span class="theme-text">Light</span>';
      btn.setAttribute('title', 'Beralih ke Mode Terang (Light Mode)');
    } else {
      btn.innerHTML = '<span class="theme-icon">🌙</span> <span class="theme-text">Dark</span>';
      btn.setAttribute('title', 'Beralih ke Mode Gelap (Dark Mode)');
    }
  }

  initTheme();

    // Cross-tab real-time theme synchronization
    window.addEventListener('storage', (e) => {
      if (e.key === 'streampulse_theme' && e.newValue) {
        setTheme(e.newValue, false);
      }
    });


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
  const wizardModal = document.getElementById('wizardModal');
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
  const inputTikTokSession = document.getElementById('inputTikTokSession');
  const btnToggleTikTokGuide = document.getElementById('btnToggleTikTokGuide');
  const tiktokSessionGuide = document.getElementById('tiktokSessionGuide');

  if (btnToggleTikTokGuide && tiktokSessionGuide) {
    btnToggleTikTokGuide.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = tiktokSessionGuide.style.display === 'none';
      tiktokSessionGuide.style.display = isHidden ? 'block' : 'none';
      btnToggleTikTokGuide.textContent = isHidden ? 'Tutup Panduan' : 'Panduan Ambil?';
    });
  }
  const headerUserWidget = document.getElementById('headerUserWidget');
  const channelAuthNotice = document.getElementById('channelAuthNotice');
  const btnConnectTwitch = document.getElementById('btnConnectTwitch');
  const btnDisconnectTwitch = document.getElementById('btnDisconnectTwitch');
  const twitchNotConnected = document.getElementById('twitchNotConnected');
  const twitchConnected = document.getElementById('twitchConnected');
  const twitchUserAvatar = document.getElementById('twitchUserAvatar');
  const twitchConnectedUser = document.getElementById('twitchConnectedUser');
  const twitchStatusTip = document.getElementById('twitchStatusTip');

  const btnConnectYouTube = document.getElementById('btnConnectYouTube');
  const btnDisconnectYouTube = document.getElementById('btnDisconnectYouTube');
  const youtubeNotConnected = document.getElementById('youtubeNotConnected');
  const youtubeConnected = document.getElementById('youtubeConnected');
  const youtubeUserAvatar = document.getElementById('youtubeUserAvatar');
  const youtubeConnectedUser = document.getElementById('youtubeConnectedUser');
  const youtubeStatusTip = document.getElementById('youtubeStatusTip');

  function setTwitchAuthState(isConnected, info = {}) {
    if (isConnected && info.login) {
      inputTwitch.value = info.login;
      inputTwitch.readOnly = true;
      inputTwitch.style.opacity = '0.88';
      inputTwitch.style.cursor = 'not-allowed';

      if (twitchConnected) twitchConnected.style.display = 'flex';
      if (twitchNotConnected) twitchNotConnected.style.display = 'none';
      if (twitchConnectedUser) twitchConnectedUser.textContent = `@${info.displayName || info.login}`;
      if (twitchUserAvatar) {
        if (info.avatar) {
          twitchUserAvatar.src = info.avatar;
          twitchUserAvatar.style.display = 'inline-block';
        } else {
          twitchUserAvatar.style.display = 'none';
        }
      }
      if (twitchStatusTip) {
        twitchStatusTip.textContent = '✓ Terhubung via Twitch OAuth (Input dikunci)';
        twitchStatusTip.style.color = '#10b981';
      }
    } else {
      inputTwitch.readOnly = false;
      inputTwitch.style.opacity = '1';
      inputTwitch.style.cursor = 'text';

      if (twitchConnected) twitchConnected.style.display = 'none';
      if (twitchNotConnected) twitchNotConnected.style.display = 'flex';
      if (twitchConnectedUser) twitchConnectedUser.textContent = '';
      if (twitchUserAvatar) twitchUserAvatar.style.display = 'none';
      if (twitchStatusTip) {
        twitchStatusTip.textContent = 'Username channel streamer';
        twitchStatusTip.style.color = '';
      }
    }
  }

  function setYouTubeAuthState(isConnected, info = {}) {
    // Dinonaktifkan sementara menunggu proses verifikasi Google selesai
    inputYouTube.readOnly = false;
    inputYouTube.style.opacity = '1';
    inputYouTube.style.cursor = 'text';
    if (youtubeStatusTip) {
      youtubeStatusTip.textContent = 'Handle (@channel) atau URL Live';
      youtubeStatusTip.style.color = '';
    }
    if (youtubeConnected) youtubeConnected.style.display = 'none';
    if (youtubeNotConnected) youtubeNotConnected.style.display = 'none';
    if (youtubeConnectedUser) youtubeConnectedUser.textContent = '';
    if (youtubeUserAvatar) youtubeUserAvatar.style.display = 'none';
  }

  // Handle postMessage dari popup Twitch & YouTube OAuth callback
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TWITCH_AUTH_SUCCESS') {
      const { twitch, displayName, avatar, token } = event.data;
      console.log(`[Twitch OAuth] Berhasil terhubung: ${twitch} (${displayName})`);

      // Bersihkan cache dan layar chat dari saluran lama agar tidak tercampur
      clearChatAndEventsUI();
      const newSig = `${(twitch || '').toLowerCase().replace(/^[#@]/, '')}:${(inputYouTube ? inputYouTube.value.trim() : '')}:${(inputTikTok ? inputTikTok.value.trim() : '')}`;
      localStorage.setItem(STORAGE_KEY_CHANNELS_SIG, newSig);

      const authData = { login: twitch, displayName, avatar, token };
      sessionStorage.setItem('streampulse_twitch_oauth', JSON.stringify(authData));

      if (inputTwitchToken) inputTwitchToken.value = token || '';
      setTwitchAuthState(true, authData);

      const saved = getStoredUserChannels() || {};
      saved.twitch = twitch;
      saveStoredUserChannels(saved);

      if (currentUser && currentUser.channels) {
        currentUser.channels.twitch = twitch;
        currentUser.channels.twitchDisplayName = displayName;
        currentUser.channels.twitchAvatar = avatar;
        currentUser.channels.hasTwitchToken = true;
      }

      if (userToken) {
        fetch('/api/user/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-token': userToken },
          body: JSON.stringify({
            twitch,
            youtube: inputYouTube.value.trim(),
            tiktok: inputTikTok.value.trim(),
            twitchToken: token
          })
        }).catch(() => {});
      }

      socket.emit('update_channels', {
        twitch: twitch,
        twitchToken: token,
        youtube: inputYouTube.value.trim(),
        tiktok: inputTikTok.value.trim(),
        userToken: userToken || undefined,
        force: true
      });
    } else if (event.data && event.data.type === 'TWITCH_AUTH_ERROR') {
      alert(`Gagal menghubungkan akun Twitch: ${event.data.error || 'Otentikasi dibatalkan'}`);
    } else if (event.data && event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
      const { channelId, title, customUrl, target, avatar, token } = event.data;
      console.log(`[YouTube OAuth] Berhasil terhubung: ${title} (${target})`);

      // Bersihkan cache dan layar chat dari saluran lama
      clearChatAndEventsUI();
      const newSig = `${(inputTwitch ? inputTwitch.value.trim().toLowerCase().replace(/^[#@]/, '') : '')}:${target}:${(inputTikTok ? inputTikTok.value.trim() : '')}`;
      localStorage.setItem(STORAGE_KEY_CHANNELS_SIG, newSig);

      const ytData = { channelId, title, customUrl, target, avatar, token };
      sessionStorage.setItem('streampulse_youtube_oauth', JSON.stringify(ytData));

      setYouTubeAuthState(true, ytData);

      const saved = getStoredUserChannels() || {};
      saved.youtube = target;
      saveStoredUserChannels(saved);

      if (currentUser && currentUser.channels) {
        currentUser.channels.youtube = target;
        currentUser.channels.youtubeTitle = title;
        currentUser.channels.youtubeAvatar = avatar;
        currentUser.channels.youtubeChannelId = channelId;
        currentUser.channels.hasYouTubeToken = true;
      }

      if (userToken) {
        fetch('/api/user/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-token': userToken },
          body: JSON.stringify({
            twitch: inputTwitch.value.trim(),
            youtube: target,
            tiktok: inputTikTok.value.trim(),
            twitchToken: inputTwitchToken ? inputTwitchToken.value.trim() : ''
          })
        }).catch(() => {});
      }

      socket.emit('update_channels', {
        twitch: inputTwitch.value.trim(),
        twitchToken: (inputTwitchToken ? inputTwitchToken.value.trim() : ''),
        youtube: target,
        tiktok: inputTikTok.value.trim(),
        userToken: userToken || undefined
      });
    } else if (event.data && event.data.type === 'YOUTUBE_AUTH_ERROR') {
      alert(`Gagal menghubungkan akun YouTube: ${event.data.error || 'Otentikasi dibatalkan'}`);
    }
  });

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
    hideAvatars: localStorage.getItem('hide_avatars') === 'true',
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
  function runPingCheck() {
    if (document.hidden) return; // Lewati jika tab sedang diminimize/background agar tidak kena timer throttling browser
    const start = Date.now();
    socket.emit('ping_check', () => {
      const latency = Date.now() - start;
      const transport = socket.io?.engine?.transport?.name || 'unknown';
      const isWs = transport === 'websocket';
      latencyText.textContent = `${latency}ms • ${isWs ? 'WSS' : 'HTTP Poll'}`;

      if (latency < 120 && isWs) {
        latencyDot.style.background = 'var(--status-active)';
        latencyDot.style.boxShadow = '0 0 8px var(--status-active)';
      } else if (latency < 300) {
        latencyDot.style.background = 'var(--status-warning)';
        latencyDot.style.boxShadow = 'none';
      } else {
        latencyDot.style.background = 'var(--status-danger)';
        latencyDot.style.boxShadow = 'none';
      }
    });
  }

  // Jalankan ping pertama setelah connect, lalu setiap 8 detik
  setTimeout(runPingCheck, 1500);
  let pingInterval = setInterval(runPingCheck, 8000);

  // Jika tab baru saja kembali aktif (foreground), jalankan ping ulang setelah 500ms
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(runPingCheck, 500);
    }
  });

  // ==========================================
  // WAKE LOCK INTEGRATION
  // ==========================================
  if (window.screenKeepAlive) {
    window.screenKeepAlive.onStatusChange((status) => {
      if (status === 'active' || status === 'fallback') {
        wakelockBtn.classList.remove('inactive');
        wakelockText.textContent = window.t ? window.t('nav_wakelock_on') : 'LAYAR AKTIF (Anti-Sleep ON)';
        if (wakelockSub) wakelockSub.textContent = window.t ? window.t('nav_wakelock_sub') : 'Layar Dicegah Mati';
        wakelockBtn.title = 'Layar HP / Monitor Anda dicegah tidur atau mati otomatis';
      } else {
        wakelockBtn.classList.add('inactive');
        wakelockText.textContent = window.t ? window.t('nav_wakelock_off') : 'LAYAR NORMAL (Auto-Sleep)';
        if (wakelockSub) wakelockSub.textContent = window.t ? window.t('nav_wakelock_sub_off') : 'Bisa Mati Otomatis';
        wakelockBtn.title = 'Klik untuk mengaktifkan mode Layar Selalu Menyala';
      }
    });

    wakelockBtn.addEventListener('click', async () => {
      await window.screenKeepAlive.toggle();
    });

    window.addEventListener('language_changed', () => {
      const isAct = window.screenKeepAlive.status === 'active' || window.screenKeepAlive.status === 'fallback';
      wakelockText.textContent = window.t ? (isAct ? window.t('nav_wakelock_on') : window.t('nav_wakelock_off')) : (isAct ? 'LAYAR AKTIF (Anti-Sleep ON)' : 'LAYAR NORMAL (Auto-Sleep)');
      if (wakelockSub) wakelockSub.textContent = window.t ? (isAct ? window.t('nav_wakelock_sub') : window.t('nav_wakelock_sub_off')) : (isAct ? 'Layar Dicegah Mati' : 'Bisa Mati Otomatis');
      updateOrderUI();
      updateAvatarUI();
      renderAuthNotice();
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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.obsMode) {
      toggleObsMode();
    }
  });

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
      orderLabel.textContent = window.t ? window.t('order_newest_top') : 'Terbaru di Atas';
      orderIcon.innerHTML = '<path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>';
    } else {
      btnOrderToggle.classList.remove('active');
      orderLabel.textContent = window.t ? window.t('order_newest_bottom') : 'Terbaru di Bawah';
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
  // RAM SAVER: TOGGLE HIDE AVATARS (PROFILE PIC)
  // ==========================================
  const btnToggleAvatars = document.getElementById('btnToggleAvatars');
  const avatarToggleLabel = document.getElementById('avatarToggleLabel');

  const updateAvatarUI = () => {
    if (!btnToggleAvatars) return;
    if (state.hideAvatars) {
      btnToggleAvatars.classList.add('active');
      document.body.classList.add('hide-avatars');
      if (avatarToggleLabel) {
        avatarToggleLabel.textContent = window.t ? window.t('btn_avatars_off') : 'Foto: NONAKTIF';
      }
    } else {
      btnToggleAvatars.classList.remove('active');
      document.body.classList.remove('hide-avatars');
      if (avatarToggleLabel) {
        avatarToggleLabel.textContent = window.t ? window.t('btn_avatars_on') : 'Foto: AKTIF';
      }
    }
  };

  if (btnToggleAvatars) {
    btnToggleAvatars.addEventListener('click', () => {
      state.hideAvatars = !state.hideAvatars;
      localStorage.setItem('hide_avatars', state.hideAvatars ? 'true' : 'false');
      updateAvatarUI();
      if (state.hideAvatars) {
        // Hapus langsung avatar dari chat yang ada di layar untuk bebaskan RAM seketika
        document.querySelectorAll('#chatMessages .chat-avatar').forEach(el => el.remove());
        spToast(window.t ? window.t('toast_avatars_hidden') : '⚡ Mode Hemat RAM: Foto profil disembunyikan', 'info');
      } else {
        spToast(window.t ? window.t('toast_avatars_shown') : 'Foto profil viewer diaktifkan', 'info');
      }
    });
  }
  updateAvatarUI();

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

    // Multi-User Session Authentication Check:
    // Jika tidak login, saluran selalu kosong (default). Pengguna login mengambil dari cloud.
    checkUserSession();
  });

  let userToken = localStorage.getItem('streampulse_user_token') || '';
  let currentUser = null;

  // ==========================================
  // CHANNEL SYNCHRONIZATION HELPERS (SHARED WITH OVERLAY STUDIO)
  // ==========================================
  function getStoredUserChannels() {
    return JSON.parse(
      localStorage.getItem('streampulse_user_channels') ||
      localStorage.getItem('streampulse_guest_channels') ||
      localStorage.getItem('streampulse_my_channels') ||
      '{}'
    );
  }

  function saveStoredUserChannels(chData) {
    localStorage.setItem('streampulse_user_channels', JSON.stringify(chData));
    localStorage.setItem('streampulse_guest_channels', JSON.stringify(chData));
    localStorage.setItem('streampulse_my_channels', JSON.stringify(chData));
    if (typeof updateDockShareUrl === 'function') updateDockShareUrl();
  }

  // Cross-tab real-time sync with Overlay Studio & Multi-Tab Auth
  window.addEventListener('storage', (e) => {
    if (e.key === 'streampulse_user_token') {
      checkUserSession();
    }
    if (e.key === 'streampulse_user_channels' || e.key === 'streampulse_my_channels' || e.key === 'streampulse_guest_channels') {
      try {
        const ch = JSON.parse(e.newValue || '{}');
        let changed = false;
        if (ch.twitch !== undefined && inputTwitch.value !== ch.twitch) {
          inputTwitch.value = ch.twitch;
          changed = true;
        }
        if (ch.youtube !== undefined && inputYouTube.value !== ch.youtube) {
          inputYouTube.value = ch.youtube;
          changed = true;
        }
        if (ch.tiktok !== undefined && inputTikTok.value !== ch.tiktok) {
          inputTikTok.value = ch.tiktok;
          changed = true;
        }
        if (ch.tiktokSessionId !== undefined && inputTikTokSession && inputTikTokSession.value !== ch.tiktokSessionId) {
          inputTikTokSession.value = ch.tiktokSessionId;
          changed = true;
        }
        if (changed) {
          const guestToken = sessionStorage.getItem('streampulse_guest_twitch_token') || '';
          socket.emit('update_channels', {
            twitch: inputTwitch.value.trim(),
            twitchToken: guestToken,
            youtube: inputYouTube.value.trim(),
            tiktok: inputTikTok.value.trim(),
            tiktokSessionId: inputTikTokSession ? inputTikTokSession.value.trim() : '',
            userToken: userToken || undefined
          });
        }
      } catch (err) {}
    }
  });

  // ==========================================
  // LOCAL STORAGE PERSISTENCE FOR CHAT & EVENTS
  // ==========================================
  const STORAGE_KEY_SAVED_CHATS = 'streampulse_saved_chats_v1';
  const STORAGE_KEY_SAVED_EVENTS = 'streampulse_saved_events_v1';
  const STORAGE_KEY_CHANNELS_SIG = 'streampulse_chat_channels_sig';
  const MAX_PERSISTED_CHATS = 60;
  const MAX_PERSISTED_EVENTS = 60;

  function getPersistedChats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED_CHATS) || '[]');
    } catch (e) {
      return [];
    }
  }

  function savePersistedChat(item) {
    try {
      const list = getPersistedChats();
      list.push(item);
      if (list.length > MAX_PERSISTED_CHATS) {
        list.splice(0, list.length - MAX_PERSISTED_CHATS);
      }
      localStorage.setItem(STORAGE_KEY_SAVED_CHATS, JSON.stringify(list));
    } catch (e) {}
  }

  function getPersistedEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED_EVENTS) || '[]');
    } catch (e) {
      return [];
    }
  }

  function savePersistedEvent(evt) {
    try {
      const list = getPersistedEvents();
      list.push(evt);
      if (list.length > MAX_PERSISTED_EVENTS) {
        list.splice(0, list.length - MAX_PERSISTED_EVENTS);
      }
      localStorage.setItem(STORAGE_KEY_SAVED_EVENTS, JSON.stringify(list));
    } catch (e) {}
  }

  function clearPersistedChats() {
    localStorage.removeItem(STORAGE_KEY_SAVED_CHATS);
  }

  function clearPersistedEvents() {
    localStorage.removeItem(STORAGE_KEY_SAVED_EVENTS);
  }

  function clearChatAndEventsUI() {
    clearPersistedChats();
    clearPersistedEvents();
    if (chatMessages) {
      chatMessages.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
            </svg>
          </div>
          <h3 data-i18n="empty_chat_title">${window.t ? window.t('empty_chat_title') : 'Belum Ada Pesan'}</h3>
          <p>${window.t ? window.t('empty_chat_desc') : 'Pesan chat dari semua platform yang terhubung akan muncul di sini secara real-time.'}</p>
        </div>
      `;
    }
    if (recorderList) {
      recorderList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <h3 data-i18n="empty_events_title">${window.t ? window.t('empty_events_title') : 'Belum Ada Event'}</h3>
          <p>${window.t ? window.t('empty_events_desc') : 'Gift TikTok, Super Chat YouTube, dan Sub/Bits Twitch akan tercatat di sini.'}</p>
        </div>
      `;
    }
    if (typeof processedChatMessageIds !== 'undefined' && processedChatMessageIds.clear) {
      processedChatMessageIds.clear();
    }
    if (typeof state !== 'undefined') {
      state.totalChats = 0;
      state.totalEvents = 0;
      state.totalGiftsCount = 0;
      state.autoScroll = true;
    }
    if (statTotalChats) statTotalChats.textContent = '0';
    if (statTotalEvents) statTotalEvents.textContent = '0';
    if (statTotalGifts) statTotalGifts.textContent = '0';
    if (scrollPausePill) scrollPausePill.style.display = 'none';
  }

  async function checkUserSession() {
    userToken = localStorage.getItem('streampulse_user_token') || '';
    if (!userToken) {
      currentUser = null;
      // Muat saluran sesi tamu yang disimpan lokal jika ada
      const saved = getStoredUserChannels();
      const guestTwitchOauth = sessionStorage.getItem('streampulse_twitch_oauth');
      let twitchOauthData = null;
      if (guestTwitchOauth) {
        try { twitchOauthData = JSON.parse(guestTwitchOauth); } catch (e) {}
      }

      const guestYtOauth = sessionStorage.getItem('streampulse_youtube_oauth');
      let ytOauthData = null;
      if (guestYtOauth) {
        try { ytOauthData = JSON.parse(guestYtOauth); } catch (e) {}
      }

      // 1. Twitch state
      let activeTwitch = '';
      let activeTwitchToken = '';
      if (twitchOauthData && twitchOauthData.login) {
        activeTwitch = twitchOauthData.login;
        activeTwitchToken = twitchOauthData.token || '';
        setTwitchAuthState(true, twitchOauthData);
        if (inputTwitchToken && activeTwitchToken) inputTwitchToken.value = activeTwitchToken;
      } else if (saved?.twitch) {
        activeTwitch = saved.twitch;
        inputTwitch.value = saved.twitch;
        setTwitchAuthState(false);
      } else {
        inputTwitch.value = '';
        setTwitchAuthState(false);
        if (inputTwitchToken) inputTwitchToken.value = '';
      }

      // 2. YouTube state
      let activeYoutube = '';
      if (ytOauthData && (ytOauthData.target || ytOauthData.channelId)) {
        activeYoutube = ytOauthData.target || ytOauthData.channelId;
        setYouTubeAuthState(true, ytOauthData);
      } else if (saved?.youtube) {
        activeYoutube = saved.youtube;
        inputYouTube.value = saved.youtube;
        setYouTubeAuthState(false);
      } else {
        inputYouTube.value = '';
        setYouTubeAuthState(false);
      }

      // 3. TikTok state
      const activeTiktok = saved?.tiktok || '';
      const activeTiktokSession = saved?.tiktokSessionId || localStorage.getItem('streampulse_tiktok_session') || '';
      inputTikTok.value = activeTiktok;
      if (inputTikTokSession) inputTikTokSession.value = activeTiktokSession;

      if (activeTwitch || activeYoutube || activeTiktok) {
        socket.emit('update_channels', {
          twitch: activeTwitch,
          twitchToken: activeTwitchToken,
          youtube: activeYoutube,
          tiktok: activeTiktok,
          tiktokSessionId: activeTiktokSession
        });
      }

      renderAuthNotice();
      return;
    }

    try {
      const res = await fetch('/api/user/me', {
        headers: { 'x-user-token': userToken }
      });
      if (res.ok) {
        currentUser = await res.json();
        if (currentUser.channels) {
          inputTikTok.value = currentUser.channels.tiktok || '';
          if (inputTikTokSession && currentUser.channels.tiktokSessionId) {
            inputTikTokSession.value = currentUser.channels.tiktokSessionId;
          }
          saveStoredUserChannels(currentUser.channels);

          // 1. Twitch restore
          if (currentUser.channels.hasTwitchToken && currentUser.channels.twitch) {
            setTwitchAuthState(true, {
              login: currentUser.channels.twitch,
              displayName: currentUser.channels.twitchDisplayName || currentUser.channels.twitch,
              avatar: currentUser.channels.twitchAvatar || ''
            });
            if (inputTwitchToken) {
              inputTwitchToken.value = '•••••••• (Token Twitch Tersimpan Aman & Terenkripsi AES-256)';
            }
          } else {
            inputTwitch.value = currentUser.channels.twitch || '';
            setTwitchAuthState(false);
            if (inputTwitchToken) inputTwitchToken.value = '';
          }

          // 2. YouTube restore
          if (currentUser.channels.hasYouTubeToken && currentUser.channels.youtube) {
            setYouTubeAuthState(true, {
              target: currentUser.channels.youtube,
              title: currentUser.channels.youtubeTitle,
              avatar: currentUser.channels.youtubeAvatar,
              channelId: currentUser.channels.youtubeChannelId
            });
          } else {
            inputYouTube.value = currentUser.channels.youtube || '';
            setYouTubeAuthState(false);
          }

          socket.emit('update_channels', {
            twitch: currentUser.channels.twitch || '',
            youtube: currentUser.channels.youtube || '',
            tiktok: currentUser.channels.tiktok || '',
            userToken
          });
        }
      } else {
        userToken = '';
        currentUser = null;
        localStorage.removeItem('streampulse_user_token');
        inputTwitch.value = '';
        setTwitchAuthState(false);
        if (inputTwitchToken) inputTwitchToken.value = '';
        inputYouTube.value = '';
        setYouTubeAuthState(false);
        inputTikTok.value = '';
      }
    } catch (e) {
      console.warn('Gagal memverifikasi sesi user:', e);
    }
    renderAuthNotice();
  }

  function renderAuthNotice() {
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserRole = document.getElementById('drawerUserRole');
    const drawerUserAvatar = document.getElementById('drawerUserAvatar');

    if (drawerUserName && drawerUserRole) {
      if (currentUser && userToken) {
        drawerUserName.textContent = currentUser.username || 'Streamer';
        drawerUserRole.textContent = 'Streamer Terdaftar • Cloud Sync';
        if (drawerUserAvatar) {
          drawerUserAvatar.innerHTML = currentUser.channels?.twitchAvatar
            ? `<img src="${currentUser.channels.twitchAvatar}" alt="${currentUser.username}">`
            : (currentUser.username.charAt(0).toUpperCase() || '👤');
        }
      } else {
        drawerUserName.textContent = 'Streamer Tamu';
        drawerUserRole.textContent = 'Mode Tamu • Klik untuk Login';
        if (drawerUserAvatar) drawerUserAvatar.innerHTML = '👤';
      }
    }

    if (headerUserWidget) {
      if (currentUser && userToken) {
        headerUserWidget.href = '/studio';
        headerUserWidget.innerHTML = `<span>👤 ${currentUser.username}</span>`;
      } else {
        headerUserWidget.href = '/studio?auth=1';
        headerUserWidget.innerHTML = `<span>${window.t ? window.t('nav_login') : '🔐 Login / Akun'}</span>`;
      }
    }

    if (channelAuthNotice) {
      if (currentUser && userToken) {
        channelAuthNotice.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#10b981; font-weight:700;">✓ ${window.t ? window.t('auth_connected_to') : 'Tersambung ke Akun'}: <strong style="color:#fff;">${currentUser.username}</strong></span>
            <a href="/studio" style="font-size:0.75rem; color:#a5b4fc; text-decoration:none; font-weight:700;">${window.t ? window.t('auth_manage_obs') : 'Kelola OBS Overlay'} →</a>
          </div>
          <div style="color:#94a3b8; font-size:0.72rem; margin-top:3px; line-height:1.4;">
            ${window.t ? window.t('auth_cloud_config_desc') : 'Konfigurasi saluran Anda tersimpan otomatis di cloud. Token Twitch dienkripsi dengan standar militer AES-256-GCM.'}
          </div>
        `;
      } else {
        channelAuthNotice.innerHTML = `
          <div style="color:#f59e0b; font-weight:700; margin-bottom:2px;">🔒 ${window.t ? window.t('auth_guest_mode_title') : 'Mode Tamu (Belum Login)'}</div>
          <div style="color:#94a3b8; font-size:0.72rem; line-height:1.4;">
            ${window.t ? window.t('auth_guest_mode_desc') : 'Sebagai tamu, input saluran Anda selalu default kosong dan hanya aktif di sesi ini.'} <a href="/studio?auth=1" style="color:#67e8f9; font-weight:700; text-decoration:underline;">${window.t ? window.t('auth_guest_login_link') : 'Login / Buat Akun'}</a> ${window.t ? window.t('auth_guest_mode_desc_end') : 'untuk menyimpan channel & mengamankan token Twitch secara permanen.'}
          </div>
        `;
      }
    }
  }

  // Initial user session verification on page load
  checkUserSession();

  socket.on('initial_state', (initial) => {

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
    .catch(() => { });

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
    savePersistedChat({ kind: 'chat', data: chatItem });
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
    savePersistedChat({ kind: 'event', data: eventItem, isHighTier });
    savePersistedEvent(eventItem);
  });

  socket.on('events_cleared', () => {
    state.eventsList = [];
    state.totalEvents = 0;
    state.totalGiftsCount = 0;
    statTotalEvents.textContent = '0';
    statTotalGifts.textContent = '0';
    clearPersistedEvents();
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

  // Cache ID pesan untuk mencegah tampilan duplikat di homepage
  const processedChatMessageIds = new Set();
  const recentChatContentKeys = new Map(); // [contentKey -> timestamp] mencegah replay pesan TikTok saat reconnect

  
  // ==========================================
  // ADAPTIVE AUTHOR & TEXT CONTRAST ENGINE
  // ==========================================
  function isDarkModeActive() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           document.body.classList.contains('dark-mode') ||
           document.body.classList.contains('dark-theme');
  }

  function getContrastAuthorColor(colorHex, isDark = false) {
    if (!colorHex || typeof colorHex !== 'string') {
      return isDark ? '#38bdf8' : '#0f172a';
    }
    let hex = colorHex.trim();
    if (!hex.startsWith('#')) return hex;
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    if (hex.length !== 7) return isDark ? '#38bdf8' : '#0f172a';

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return isDark ? '#38bdf8' : '#0f172a';

    const sR = r / 255, sG = g / 255, sB = b / 255;
    const R = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const G = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const B = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);
    const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;

    if (isDark) {
      // In Dark Mode: dark colors (< 0.18) blend into the dark canvas, so boost brightness
      if (r < 70 && g < 70 && b < 70) return '#38bdf8';
      if (L < 0.18) {
        const boost = 0.55;
        const lightR = Math.min(255, Math.floor(r + (255 - r) * boost));
        const lightG = Math.min(255, Math.floor(g + (255 - g) * boost));
        const lightB = Math.min(255, Math.floor(b + (255 - b) * boost));
        return '#' + lightR.toString(16).padStart(2, '0') + lightG.toString(16).padStart(2, '0') + lightB.toString(16).padStart(2, '0');
      }
    } else {
      // In Light Mode: light colors (> 0.35) blend into white cards, so darken them
      if (r > 190 && g > 190 && b > 190) return '#0f172a';
      if (L > 0.35) {
        const factor = Math.min(0.52, 0.28 / L);
        const darkR = Math.min(255, Math.floor(r * factor));
        const darkG = Math.min(255, Math.floor(g * factor));
        const darkB = Math.min(255, Math.floor(b * factor));
        return '#' + darkR.toString(16).padStart(2, '0') + darkG.toString(16).padStart(2, '0') + darkB.toString(16).padStart(2, '0');
      }
    }
    return hex;
  }

  function ensureContrastForLightBg(colorHex, defaultDark = '#0f172a') {
    const isDark = isDarkModeActive();
    return getContrastAuthorColor(colorHex, isDark);
  }

  function addChatMessage(chat) {
    if (!chat) return;

    const author = chat.author || {};
    const authorName = author.name || 'Anonymous';
    const normUser = (authorName || author.username || '').trim().toLowerCase();
    const normText = (chat.text || '').trim().toLowerCase();
    const contentKey = `${chat.platform || ''}:${normUser}:${normText}`;
    const now = Date.now();

    // Bersihkan cache lama lebih dari 60 detik
    for (const [k, t] of recentChatContentKeys.entries()) {
      if (now - t > 60000) recentChatContentKeys.delete(k);
    }

    // Cegah replay pesan ganda dari reconnect TikTok dalam 15 detik
    if (recentChatContentKeys.has(contentKey) && (now - recentChatContentKeys.get(contentKey) < 15000)) {
      return;
    }
    recentChatContentKeys.set(contentKey, now);

    // Cegah duplikasi ID pesan di chat monitoring
    const dedupeKey = chat.id || `${chat.platform || ''}_${authorName}_${chat.text || ''}`;
    if (processedChatMessageIds.has(dedupeKey)) return;
    processedChatMessageIds.add(dedupeKey);
    if (processedChatMessageIds.size > 500) {
      const first = processedChatMessageIds.values().next().value;
      processedChatMessageIds.delete(first);
    }

    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.className = 'chat-item';
    item.dataset.platform = chat.platform;
    item.dataset.isEvent = 'false';

    const isDarkTheme = isDarkModeActive();
    let authorColor = ensureContrastForLightBg(author.color, '#0f172a');
    if (chat.platform === 'tiktok') {
      authorColor = isDarkTheme ? '#25f4ee' : '#008f9c';
    }
    const initial = (authorName[0] || '?').toUpperCase();
    const showAvatar = !state.hideAvatars;
    const avatarImg = showAvatar
      ? (author.avatar
        ? `<img src="${escapeHtml(author.avatar)}" class="chat-avatar" alt="${escapeHtml(authorName)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="this.onerror=null; this.outerHTML='<div class=\\'chat-avatar\\'>${initial}</div>'">`
        : `<div class="chat-avatar">${initial}</div>`)
      : '';

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
    if (!evt) return;
    const dedupeKey = evt.id || `evt_${evt.platform || ''}_${evt.author || ''}_${evt.timestamp || ''}_${evt.title || ''}`;
    if (processedChatMessageIds.has(dedupeKey)) return;
    processedChatMessageIds.add(dedupeKey);
    if (processedChatMessageIds.size > 500) {
      const first = processedChatMessageIds.values().next().value;
      processedChatMessageIds.delete(first);
    }

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
      else if (evt.eventType === 'watch_streak') extraClass = 'twitch-streak';
      else extraClass = 'twitch-sub';
    }

    if (isHighTier) {
      extraClass += ' tier-epic';
    }

    item.className = `chat-item event-item ${extraClass}`;

    const authorName = evt.author || 'Viewer';
    const initial = (authorName[0] || '★').toUpperCase();
    // Pada Lite Mode atau mode Sembunyikan Avatar: Jangan render avatar/profile pic
    const avatarImg = (state.liteMode || state.hideAvatars)
      ? ''
      : (evt.avatar
        ? `<img src="${escapeHtml(evt.avatar)}" class="chat-avatar" alt="${escapeHtml(authorName)}" onerror="this.onerror=null; this.outerHTML='<div class=\\'chat-avatar\\'>${initial}</div>'">`
        : `<div class="chat-avatar" style="background: linear-gradient(135deg, #6366f1, #ec4899);">${initial}</div>`);

    const platBadge = getPlatformBadge(evt.platform);
    const badgePill = evt.badge ? `<span class="badge-user" style="background: rgba(59, 130, 246, 0.25); border: 1px solid rgba(59, 130, 246, 0.5); font-weight:800;">${escapeHtml(evt.badge)}</span>` : '';

    const stickerHtml = evt.stickerUrl ? `<div style="margin-top: 6px;"><img src="${escapeHtml(evt.stickerUrl)}" alt="Super Sticker" style="max-height: 70px; border-radius: 8px;"></div>` : '';
    const iconHtml = evt.icon ? `<div style="margin-top: 4px;"><img src="${escapeHtml(evt.icon)}" alt="Gift Icon" style="max-height: 48px; border-radius: 6px;"></div>` : '';

    const evtAuthorColor = evt.platform === 'tiktok' 
      ? (isDarkModeActive() ? '#25f4ee' : '#008f9c')
      : ensureContrastForLightBg(evt.authorColor || '', '#0f172a');

    item.innerHTML = `
      ${avatarImg}
      <div class="chat-content">
        <div class="chat-meta">
          ${platBadge}
          ${badgePill}
          <span class="author-name" style="color: ${escapeHtml(evtAuthorColor)}; font-weight:800;">${escapeHtml(authorName)}</span>
          <span class="chat-time">${formatTime(evt.timestamp)}</span>
        </div>
        <div class="event-highlight-text">
          <span>${escapeHtml(evt.title)}</span>
          <span>•</span>
          <span class="event-detail-badge" style="color: var(--charcoal); font-weight: 600;">${escapeHtml(evt.detail || '')}</span>
        </div>
        ${stickerHtml}
        ${iconHtml}
        ${evt.message ? `<div class="chat-text" style="margin-top: 5px; color: var(--ink); font-weight: 500;">"${evt.platform === 'twitch' ? formatTwitchMessageWithEmotes(evt.message, evt.emotes) : parse7tvTextTokens(evt.message, state.twitchEmotes)}"</div>` : ''}
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
    if (!evt) return;
    if (state.eventsList.some(e => (e.id && evt.id && e.id === evt.id) || (e.timestamp === evt.timestamp && e.author === evt.author && e.title === evt.title))) {
      return;
    }
    state.eventsList.push(evt);
    if (state.eventsList.length > 100) {
      state.eventsList.shift();
    }

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
    if (!m) return;
    m.classList.add('show');
    m.classList.add('active');
    if (m === setupModal) {
      updateDockShareUrl();
    }
    const firstInput = m.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  };
  const closeModal = (m) => {
    if (!m) return;
    m.classList.remove('show');
    m.classList.remove('active');
  };

  window.openModal = openModal;
  window.closeModal = closeModal;

  function updateDockShareUrl() {
    const dockShareUrl = document.getElementById('dockShareUrl');
    if (!dockShareUrl) return;
    const origin = window.location.origin;
    if (currentUser && currentUser.token) {
      dockShareUrl.value = `${origin}/dock?token=${encodeURIComponent(currentUser.token)}`;
    } else {
      const ch = getStoredUserChannels() || {};
      const params = new URLSearchParams();
      if (ch.twitch) params.set('twitch', ch.twitch);
      if (ch.youtube) params.set('youtube', ch.youtube);
      if (ch.tiktok) params.set('tiktok', ch.tiktok);
      const q = params.toString();
      dockShareUrl.value = q ? `${origin}/dock?${q}` : `${origin}/dock`;
    }
  }

  const btnCopyDockUrl = document.getElementById('btnCopyDockUrl');
  if (btnCopyDockUrl) {
    btnCopyDockUrl.addEventListener('click', () => {
      const dockShareUrl = document.getElementById('dockShareUrl');
      if (dockShareUrl && dockShareUrl.value) {
        navigator.clipboard.writeText(dockShareUrl.value).then(() => {
          spToast('✓ URL OBS Dock Pribadi berhasil disalin! Tempelkan ke OBS Studio > Docks > Custom Browser Docks.', 'success');
        }).catch(() => {
          dockShareUrl.select();
          document.execCommand('copy');
          spToast('✓ URL OBS Dock Pribadi berhasil disalin!', 'success');
        });
      }
    });
  }

  if (btnSetupModal) btnSetupModal.addEventListener('click', () => openModal(setupModal));
  if (closeSetupModal) closeSetupModal.addEventListener('click', () => closeModal(setupModal));
  if (btnCancelSetup) btnCancelSetup.addEventListener('click', () => closeModal(setupModal));

  // Auto-open Setup Modal if ?setup=1 or #setup in URL
  const shouldOpenSetup = urlParams.get('setup') === '1' ||
                          window.location.hash === '#setup' ||
                          window.location.hash === '#channels' ||
                          window.location.hash === '#sectionChannels';
  if (shouldOpenSetup && setupModal) {
    setTimeout(() => {
      openModal(setupModal);
    }, 200);
  }

  if (btnConnectTwitch) {
    btnConnectTwitch.addEventListener('click', () => {
      const width = 540;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const origin = window.location.origin;
      const authUrl = `/auth/twitch?redirect_origin=${encodeURIComponent(origin)}${userToken ? `&userToken=${encodeURIComponent(userToken)}` : ''}`;
      window.open(authUrl, 'twitch_auth_popup', `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0,location=1`);
    });
  }

  if (btnDisconnectTwitch) {
    btnDisconnectTwitch.addEventListener('click', async () => {
      sessionStorage.removeItem('streampulse_twitch_oauth');
      sessionStorage.removeItem('streampulse_guest_twitch_token');
      if (inputTwitchToken) inputTwitchToken.value = '';

      if (currentUser && userToken) {
        try {
          await fetch('/api/user/twitch/disconnect', {
            method: 'POST',
            headers: { 'x-user-token': userToken }
          });
          if (currentUser.channels) {
            currentUser.channels.twitch = '';
            currentUser.channels.twitchDisplayName = '';
            currentUser.channels.twitchAvatar = '';
            currentUser.channels.hasTwitchToken = false;
          }
        } catch (e) {
          console.warn('Gagal disconnect Twitch di backend:', e);
        }
      }

      inputTwitch.value = '';
      setTwitchAuthState(false);

      const saved = getStoredUserChannels() || {};
      saved.twitch = '';
      saveStoredUserChannels(saved);

      socket.emit('update_channels', {
        twitch: '',
        twitchToken: '',
        youtube: inputYouTube.value.trim(),
        tiktok: inputTikTok.value.trim(),
        userToken: userToken || undefined
      });
      socket.emit('disconnect_platform', { platform: 'twitch' });
    });
  }

  if (btnConnectYouTube) {
    btnConnectYouTube.addEventListener('click', () => {
      const width = 540;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const origin = window.location.origin;
      const authUrl = `/auth/youtube?redirect_origin=${encodeURIComponent(origin)}${userToken ? `&userToken=${encodeURIComponent(userToken)}` : ''}`;
      window.open(authUrl, 'youtube_auth_popup', `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0,location=1`);
    });
  }

  if (btnDisconnectYouTube) {
    btnDisconnectYouTube.addEventListener('click', async () => {
      sessionStorage.removeItem('streampulse_youtube_oauth');

      if (currentUser && userToken) {
        try {
          await fetch('/api/user/youtube/disconnect', {
            method: 'POST',
            headers: { 'x-user-token': userToken }
          });
          if (currentUser.channels) {
            currentUser.channels.youtube = '';
            currentUser.channels.youtubeTitle = '';
            currentUser.channels.youtubeAvatar = '';
            currentUser.channels.youtubeChannelId = '';
            currentUser.channels.hasYouTubeToken = false;
          }
        } catch (e) {
          console.warn('Gagal disconnect YouTube di backend:', e);
        }
      }

      inputYouTube.value = '';
      setYouTubeAuthState(false);

      const saved = getStoredUserChannels() || {};
      saved.youtube = '';
      saveStoredUserChannels(saved);

      socket.emit('update_channels', {
        twitch: inputTwitch.value.trim(),
        twitchToken: (inputTwitchToken ? inputTwitchToken.value.trim() : ''),
        youtube: '',
        tiktok: inputTikTok.value.trim(),
        userToken: userToken || undefined
      });
      socket.emit('disconnect_platform', { platform: 'youtube' });
    });
  }

  
  // Auto-clean TikTok input jika pengguna mem-paste URL TikTok lengkap
  if (inputTikTok) {
    const cleanTikTokInput = () => {
      const val = inputTikTok.value.trim();
      if (!val) return;
      if (/^\d{15,22}$/.test(val)) return;
      const queryRoom = val.match(/room_id=(\d{15,22})/);
      if (queryRoom) { inputTikTok.value = queryRoom[1]; return; }
      const pathRoom = val.match(/(?:\/live\/|\/room\/|\/v\/)(\d{15,22})/);
      if (pathRoom) { inputTikTok.value = pathRoom[1]; return; }
      const userMatch = val.match(/tiktok\.com\/@([a-zA-Z0-9_\.]{2,30})/i);
      if (userMatch) { inputTikTok.value = userMatch[1].toLowerCase(); return; }
      if (val.startsWith('@')) { inputTikTok.value = val.slice(1).trim(); }
    };
    inputTikTok.addEventListener('blur', cleanTikTokInput);
    inputTikTok.addEventListener('paste', () => setTimeout(cleanTikTokInput, 50));
  }

  btnSaveChannels.addEventListener('click', async () => {
    if (inputTikTok) {
      const val = inputTikTok.value.trim();
      const queryRoom = val.match(/room_id=(\d{15,22})/);
      const pathRoom = val.match(/(?:\/live\/|\/room\/|\/v\/)(\d{15,22})/);
      const userMatch = val.match(/tiktok\.com\/@([a-zA-Z0-9_\.]{2,30})/i);
      if (queryRoom) inputTikTok.value = queryRoom[1];
      else if (pathRoom) inputTikTok.value = pathRoom[1];
      else if (userMatch) inputTikTok.value = userMatch[1].toLowerCase();
      else if (val.startsWith('@')) inputTikTok.value = val.slice(1).trim();
    }
    const twitch = inputTwitch.value.trim().toLowerCase().replace(/^[#@]/, '');
    let twitchToken = inputTwitchToken ? inputTwitchToken.value.trim() : '';
    const youtube = inputYouTube.value.trim();
    const tiktok = inputTikTok.value.trim();
    const tiktokSessionId = inputTikTokSession ? inputTikTokSession.value.trim() : '';

    const prevChannels = getStoredUserChannels() || {};
    const prevSig = `${(prevChannels.twitch || '').toLowerCase().replace(/^[#@]/, '')}:${prevChannels.youtube || ''}:${prevChannels.tiktok || ''}`;
    const newSig = `${twitch}:${youtube}:${tiktok}`;

    if (prevSig !== newSig) {
      console.log(`[StreamPulse] Saluran dipantau berubah (${prevSig} -> ${newSig}). Menghapus riwayat chat lama.`);
      clearChatAndEventsUI();
    }
    localStorage.setItem(STORAGE_KEY_CHANNELS_SIG, newSig);

    const chData = { twitch, youtube, tiktok, tiktokSessionId };
    saveStoredUserChannels(chData);
    if (tiktokSessionId) {
      localStorage.setItem('streampulse_tiktok_session', tiktokSessionId);
    } else {
      localStorage.removeItem('streampulse_tiktok_session');
    }

    if (currentUser && userToken) {
      // Streamer Terdaftar: Simpan ke cloud akun dan enkripsi Twitch Token di server
      try {
        const res = await fetch('/api/user/channels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-token': userToken
          },
          body: JSON.stringify({ twitch, youtube, tiktok, tiktokSessionId, twitchToken })
        });
        const data = await res.json();
        if (data.channels && data.channels.hasTwitchToken && inputTwitchToken) {
          inputTwitchToken.value = '•••••••• (Token Twitch Tersimpan Aman & Terenkripsi AES-256)';
        }
      } catch (err) {
        console.warn('Gagal menyimpan saluran ke akun user:', err);
      }

      socket.emit('update_channels', { twitch, twitchToken, youtube, tiktok, tiktokSessionId, userToken, force: true });
    } else {
      // Mode Tamu: Sambungkan untuk sesi ini dan simpan di cache lokal
      if (twitchToken) {
        sessionStorage.setItem('streampulse_guest_twitch_token', twitchToken);
      }
      socket.emit('update_channels', { twitch, twitchToken, youtube, tiktok, tiktokSessionId, force: true });
    }

    closeModal(setupModal);
  });

  const btnRefreshChannels = document.getElementById('btnRefreshChannels');
  if (btnRefreshChannels) {
    btnRefreshChannels.addEventListener('click', async () => {
      const twitch = inputTwitch.value.trim();
      let twitchToken = inputTwitchToken ? inputTwitchToken.value.trim() : '';
      const youtube = inputYouTube.value.trim();
      const tiktok = inputTikTok.value.trim();
      const tiktokSessionId = inputTikTokSession ? inputTikTokSession.value.trim() : '';

      const origHtml = btnRefreshChannels.innerHTML;
      btnRefreshChannels.disabled = true;
      btnRefreshChannels.innerHTML = `<span>⏳ Menyambungkan Ulang...</span>`;

      // Simpan lokal terlebih dahulu
      saveStoredUserChannels({ twitch, youtube, tiktok, tiktokSessionId });
      if (tiktokSessionId) {
        localStorage.setItem('streampulse_tiktok_session', tiktokSessionId);
      }

      if (currentUser && userToken) {
        socket.emit('update_channels', { twitch, twitchToken, youtube, tiktok, tiktokSessionId, userToken, force: true });
      } else {
        socket.emit('update_channels', { twitch, twitchToken, youtube, tiktok, tiktokSessionId, force: true });
      }

      setTimeout(() => {
        btnRefreshChannels.disabled = false;
        btnRefreshChannels.innerHTML = origHtml;
        spToast(window.getCurrentLang && window.getCurrentLang() === 'en' ? 'Channels refreshed!' : 'Koneksi saluran disegarkan & dicoba ulang!', 'info');
      }, 1000);
    });
  }

  [chipTwitch, chipYouTube, chipTikTok].forEach(chip => {
    chip.addEventListener('click', () => openModal(setupModal));
  });

  if (btnDemoModal) btnDemoModal.addEventListener('click', () => openModal(demoModal));
  if (closeDemoModal) closeDemoModal.addEventListener('click', () => closeModal(demoModal));
  if (btnFinishDemo) btnFinishDemo.addEventListener('click', () => closeModal(demoModal));

  // Donate Modal Listeners
  if (btnDonateModal) btnDonateModal.addEventListener('click', () => openModal(donateModal));
  if (closeDonateModal) closeDonateModal.addEventListener('click', () => closeModal(donateModal));
  if (btnCancelDonate) btnCancelDonate.addEventListener('click', () => closeModal(donateModal));
  if (mobNavDonate) mobNavDonate.addEventListener('click', () => openModal(donateModal));

  // ==========================================
  // SLIDING SIDE DRAWER CONTROLS
  // ==========================================
  const btnSideDrawerOpen = document.getElementById('btnSideDrawerOpen');
  const btnCloseSideDrawer = document.getElementById('btnCloseSideDrawer');
  const sideDrawerBackdrop = document.getElementById('sideDrawerBackdrop');
  const sideDrawer = document.getElementById('sideDrawer');
  const drawerBtnSetup = document.getElementById('drawerBtnSetup');
  const drawerBtnDonate = document.getElementById('drawerBtnDonate');

  function openSideDrawer() {
    if (sideDrawer) sideDrawer.classList.add('active');
    if (sideDrawerBackdrop) sideDrawerBackdrop.classList.add('active');
    if (sideDrawer) sideDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeSideDrawer() {
    if (sideDrawer) sideDrawer.classList.remove('active');
    if (sideDrawerBackdrop) sideDrawerBackdrop.classList.remove('active');
    if (sideDrawer) sideDrawer.setAttribute('aria-hidden', 'true');
  }

  if (btnSideDrawerOpen) btnSideDrawerOpen.addEventListener('click', openSideDrawer);
  if (btnCloseSideDrawer) btnCloseSideDrawer.addEventListener('click', closeSideDrawer);
  if (sideDrawerBackdrop) sideDrawerBackdrop.addEventListener('click', closeSideDrawer);

  if (drawerBtnSetup) {
    drawerBtnSetup.addEventListener('click', () => {
      closeSideDrawer();
      openModal(setupModal);
    });
  }

  if (drawerBtnDonate) {
    drawerBtnDonate.addEventListener('click', () => {
      closeSideDrawer();
      if (donateModal) openModal(donateModal);
    });
  }

  // Dismiss modal on background click
  [setupModal, demoModal, donateModal, wizardModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  // ESC & Shortcut key listener (M to toggle menu)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.obsMode) toggleObsMode();
      closeModal(setupModal);
      closeModal(demoModal);
      if (donateModal) closeModal(donateModal);
      if (wizardModal) closeModal(wizardModal);
      closeSideDrawer();
    } else if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      if (sideDrawer && sideDrawer.classList.contains('active')) {
        closeSideDrawer();
      } else {
        openSideDrawer();
      }
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
      spAlert('Belum ada event yang tercatat untuk di-export.', 'Export JSON', 'info');
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
      spAlert('Belum ada event yang tercatat untuk di-export.', 'Export CSV', 'info');
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

  btnClearEvents.addEventListener('click', async () => {
    const ok = await spConfirm(
      window.getCurrentLang && window.getCurrentLang() === 'en'
        ? 'Clear all recorded events and history storage?'
        : 'Bersihkan semua riwayat event yang tercatat saat ini?',
      window.t ? window.t('dialog_confirm') : 'Bersihkan Riwayat Event',
      'warning'
    );
    if (ok) {
      clearPersistedEvents();
      socket.emit('clear_events');
      spToast(window.getCurrentLang && window.getCurrentLang() === 'en' ? 'Event history cleared' : 'Riwayat event berhasil dibersihkan', 'success');
    }
  });

  if (btnClearChatScreen) {
    btnClearChatScreen.addEventListener('click', async (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const ok = await spConfirm(
        window.getCurrentLang && window.getCurrentLang() === 'en'
          ? 'Clear all chat messages from screen and storage?'
          : 'Bersihkan semua chat dari layar dan penyimpanan lokal?',
        window.t ? window.t('dialog_confirm') : 'Bersihkan Layar Chat',
        'warning'
      );
      if (ok) {
        clearPersistedChats();
        chatMessages.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
              </svg>
            </div>
            <h3 data-i18n="empty_chat_title">Layar Chat Dibersihkan</h3>
            <p>Menunggu chat baru masuk dari stream...</p>
          </div>
        `;
        processedChatMessageIds.clear();
        state.totalChats = 0;
        if (statTotalChats) statTotalChats.textContent = '0';
        if (scrollPausePill) scrollPausePill.style.display = 'none';
        state.autoScroll = true;
        spToast(window.getCurrentLang && window.getCurrentLang() === 'en' ? 'Chat screen cleared' : 'Layar chat berhasil dibersihkan', 'success');
      }
    });
  }

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

  // ==========================================
  // RESTORE PERSISTED CHAT & EVENT LOGS ON STARTUP
  // ==========================================
  function restoreSavedChatAndEvents() {
    try {
      const stored = getStoredUserChannels() || {};
      const curTwitch = (stored.twitch || (inputTwitch ? inputTwitch.value : '') || '').toLowerCase().replace(/^[#@]/, '');
      const curYt = (stored.youtube || (inputYouTube ? inputYouTube.value : '') || '').trim();
      const curTt = (stored.tiktok || (inputTikTok ? inputTikTok.value : '') || '').trim();
      const curSig = `${curTwitch}:${curYt}:${curTt}`;
      const savedSig = localStorage.getItem(STORAGE_KEY_CHANNELS_SIG);

      // Jika saluran berbeda dari sesi cache sebelumnya, hapus cache lama agar tidak bocor
      if (savedSig && savedSig !== curSig && curSig !== '::') {
        console.log(`[StreamPulse] Saluran berbeda dari cache sebelumnya (${savedSig} vs ${curSig}). Membersihkan cache chat lama.`);
        clearPersistedChats();
        clearPersistedEvents();
        localStorage.setItem(STORAGE_KEY_CHANNELS_SIG, curSig);
        return;
      }
      localStorage.setItem(STORAGE_KEY_CHANNELS_SIG, curSig);

      const savedEvents = getPersistedEvents();
      if (Array.isArray(savedEvents) && savedEvents.length > 0) {
        savedEvents.forEach(evt => {
          try {
            addEventToRecorder(evt, false);
          } catch (e) {
            console.warn('[StreamPulse] Error restoring event item:', e);
          }
        });
        state.totalEvents = savedEvents.length;
        if (statTotalEvents) statTotalEvents.textContent = state.totalEvents;

        const giftTypes = ['gift', 'superchat', 'supersticker', 'jewels', 'cheer', 'gift_member', 'submysterygift', 'redeem'];
        state.totalGiftsCount = savedEvents.filter(e => e && giftTypes.includes(e.eventType)).length;
        if (statTotalGifts) statTotalGifts.textContent = state.totalGiftsCount;
      }

      const savedChats = getPersistedChats();
      if (Array.isArray(savedChats) && savedChats.length > 0) {
        savedChats.forEach(item => {
          try {
            if (item.kind === 'event' && item.data) {
              addEventMessageToChat(item.data, item.isHighTier);
            } else if (item.data) {
              addChatMessage(item.data);
            }
          } catch (e) {
            console.warn('[StreamPulse] Error restoring chat item:', e);
          }
        });
        state.totalChats = savedChats.filter(c => c && c.kind !== 'event').length;
        if (statTotalChats) statTotalChats.textContent = state.totalChats;
      }
    } catch (err) {
      console.warn('[StreamPulse] Failed to restore saved chat/events:', err);
    }
  }

  // ==========================================
  // QUICK-START ONBOARDING WIZARD (3 LANGKAH)
  // ==========================================
  const closeWizardModal = document.getElementById('closeWizardModal');
  const btnOpenWizard = document.getElementById('btnOpenWizard');

  const tabStep1 = document.getElementById('tabStep1');
  const tabStep2 = document.getElementById('tabStep2');
  const tabStep3 = document.getElementById('tabStep3');

  const wizardStep1 = document.getElementById('wizardStep1');
  const wizardStep2 = document.getElementById('wizardStep2');
  const wizardStep3 = document.getElementById('wizardStep3');

  const wizInputTwitch = document.getElementById('wizInputTwitch');
  const wizInputYouTube = document.getElementById('wizInputYouTube');
  const wizInputTikTok = document.getElementById('wizInputTikTok');

  const wizObsUrl = document.getElementById('wizObsUrl');
  const btnWizCopyUrl = document.getElementById('btnWizCopyUrl');
  const wizCopyIcon = document.getElementById('wizCopyIcon');
  const wizCopyLabel = document.getElementById('wizCopyLabel');

  const btnWizPrev = document.getElementById('btnWizPrev');
  const btnWizNext = document.getElementById('btnWizNext');
  const btnWizSkip = document.getElementById('btnWizSkip');
  const btnWizFinish = document.getElementById('btnWizFinish');

  let currentWizardStep = 1;
  let selectedWizardTheme = 'simple';

  function populateWizardFields() {
    const ch = getStoredUserChannels() || {};
    if (wizInputTwitch) wizInputTwitch.value = ch.twitch || (inputTwitch ? inputTwitch.value : '');
    if (wizInputYouTube) wizInputYouTube.value = ch.youtube || (inputYouTube ? inputYouTube.value : '');
    if (wizInputTikTok) wizInputTikTok.value = ch.tiktok || (inputTikTok ? inputTikTok.value : '');
  }

  function generateWizardObsUrl() {
    if (!wizObsUrl) return;
    const origin = window.location.origin;
    const tw = (wizInputTwitch ? wizInputTwitch.value.trim().toLowerCase().replace(/^[#@]/, '') : '');
    const yt = (wizInputYouTube ? wizInputYouTube.value.trim() : '');
    const tt = (wizInputTikTok ? wizInputTikTok.value.trim().toLowerCase().replace(/^@/, '') : '');

    const params = new URLSearchParams();
    if (selectedWizardTheme && selectedWizardTheme !== 'simple') {
      params.set('theme', selectedWizardTheme);
    }
    if (tw) params.set('twitch', tw);
    if (yt) params.set('youtube', yt);
    if (tt) params.set('tiktok', tt);

    const q = params.toString();
    wizObsUrl.value = `${origin}/overlay${q ? '?' + q : ''}`;
  }

  function setWizardStep(step) {
    currentWizardStep = Math.max(1, Math.min(3, step));

    // Update Steps Nav
    [tabStep1, tabStep2, tabStep3].forEach((tab, idx) => {
      if (!tab) return;
      const tabNum = idx + 1;
      tab.classList.toggle('active', tabNum === currentWizardStep);
      tab.classList.toggle('completed', tabNum < currentWizardStep);
    });

    // Update Panes
    if (wizardStep1) wizardStep1.classList.toggle('active', currentWizardStep === 1);
    if (wizardStep2) wizardStep2.classList.toggle('active', currentWizardStep === 2);
    if (wizardStep3) {
      wizardStep3.classList.toggle('active', currentWizardStep === 3);
      if (currentWizardStep === 3) generateWizardObsUrl();
    }

    // Update Buttons
    if (btnWizPrev) btnWizPrev.style.display = currentWizardStep > 1 ? 'inline-flex' : 'none';
    if (btnWizNext) {
      btnWizNext.style.display = currentWizardStep < 3 ? 'inline-flex' : 'none';
      btnWizNext.textContent = currentWizardStep === 1 ? 'Lanjut: Pilih Gaya Tema →' : 'Lanjut: Pasang di OBS →';
    }
    if (btnWizFinish) btnWizFinish.style.display = currentWizardStep === 3 ? 'inline-flex' : 'none';
  }

  // Theme selection cards in Step 2
  document.querySelectorAll('.wizard-theme-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.wizard-theme-card').forEach(c => {
        c.classList.remove('active');
        const r = c.querySelector('.wiz-theme-radio');
        if (r) r.textContent = 'Pilih Tema';
      });
      card.classList.add('active');
      const radio = card.querySelector('.wiz-theme-radio');
      if (radio) radio.textContent = '✓ Terpilih';
      selectedWizardTheme = card.dataset.theme || 'simple';
      generateWizardObsUrl();
    });
  });

  // Navigation button listeners
  if (btnWizNext) {
    btnWizNext.addEventListener('click', () => {
      if (currentWizardStep === 1) {
        if (wizInputTwitch && inputTwitch) inputTwitch.value = wizInputTwitch.value.trim();
        if (wizInputYouTube && inputYouTube) inputYouTube.value = wizInputYouTube.value.trim();
        if (wizInputTikTok && inputTikTok) inputTikTok.value = wizInputTikTok.value.trim();
      }
      setWizardStep(currentWizardStep + 1);
    });
  }

  if (btnWizPrev) {
    btnWizPrev.addEventListener('click', () => {
      setWizardStep(currentWizardStep - 1);
    });
  }

  [tabStep1, tabStep2, tabStep3].forEach((tab, idx) => {
    if (tab) {
      tab.addEventListener('click', () => {
        setWizardStep(idx + 1);
      });
    }
  });

  // Copy OBS URL in Step 3
  if (btnWizCopyUrl && wizObsUrl) {
    btnWizCopyUrl.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(wizObsUrl.value);
        if (wizCopyIcon) wizCopyIcon.textContent = '✓';
        if (wizCopyLabel) wizCopyLabel.textContent = 'Disalin!';
        btnWizCopyUrl.style.background = '#10b981';
        btnWizCopyUrl.style.borderColor = '#10b981';

        if (typeof spToast === 'function') {
          spToast('Tautan OBS Studio berhasil disalin ke clipboard!', 'success');
        }

        setTimeout(() => {
          if (wizCopyIcon) wizCopyIcon.textContent = '📋';
          if (wizCopyLabel) wizCopyLabel.textContent = 'Salin URL';
          btnWizCopyUrl.style.background = '';
          btnWizCopyUrl.style.borderColor = '';
        }, 2200);
      } catch (e) {
        wizObsUrl.select();
        document.execCommand('copy');
        if (typeof spToast === 'function') {
          spToast('Tautan OBS Studio disalin!', 'success');
        }
      }
    });
  }

  async function finishWizardWorkflow() {
    const twitch = (wizInputTwitch ? wizInputTwitch.value.trim().toLowerCase().replace(/^[#@]/, '') : '');
    const youtube = (wizInputYouTube ? wizInputYouTube.value.trim() : '');
    const tiktok = (wizInputTikTok ? wizInputTikTok.value.trim().toLowerCase().replace(/^@/, '') : '');

    // Sync to main inputs
    if (inputTwitch) inputTwitch.value = twitch;
    if (inputYouTube) inputYouTube.value = youtube;
    if (inputTikTok) inputTikTok.value = tiktok;

    const chData = { twitch, youtube, tiktok };
    saveStoredUserChannels(chData);
    socket.emit('update_channels', { twitch, youtube, tiktok, force: true });

    localStorage.setItem('sp_onboarding_completed', 'true');
    closeModal(wizardModal);
    if (typeof spToast === 'function') {
      spToast('Setup selesai! Selamat streaming dengan StreamPulse! 🚀', 'success');
    }
  }

  if (btnWizFinish) {
    btnWizFinish.addEventListener('click', finishWizardWorkflow);
  }

  if (btnWizSkip) {
    btnWizSkip.addEventListener('click', () => {
      localStorage.setItem('sp_onboarding_completed', 'true');
      closeModal(wizardModal);
    });
  }

  function openWizardModal() {
    populateWizardFields();
    setWizardStep(1);
    openModal(wizardModal);
  }

  if (btnOpenWizard) {
    btnOpenWizard.addEventListener('click', openWizardModal);
  }

  if (closeWizardModal) {
    closeWizardModal.addEventListener('click', () => {
      closeModal(wizardModal);
    });
  }

  // Auto-open on first visit for new streamers
  if (!localStorage.getItem('sp_onboarding_completed')) {
    setTimeout(() => {
      openWizardModal();
    }, 1200);
  }

  // Restore cache immediately after all components, handlers, and sets are initialized
  restoreSavedChatAndEvents();
});
