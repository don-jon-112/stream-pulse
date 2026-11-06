/**
 * StreamPulse - OBS Custom Browser Dock
 * Client Controller: Live Chat, Twitch Sender, Viewer Counters, Persistent Storage (No Limit)
 * Otomatis tersinkronisasi dengan konfigurasi channel di Homepage (Local Storage & Server State)
 * Hanya mengizinkan kirim chat jika terhubung/login via Twitch di Channel Setup
 */

(function () {
  'use strict';
  console.log('[StreamPulse Dock v2.2] Emote engine active');

  // ==========================================
  // CONFIG & STATE
  // ==========================================
  const STORAGE_KEY_HISTORY = 'streampulse_dock_history_v1';
  const STORAGE_KEY_HISTORY_SIG = 'streampulse_dock_history_sig_v1';
  const STORAGE_KEY_USER_TOKEN = 'streampulse_user_token';
  const STORAGE_KEY_USER_CHANNELS = 'streampulse_user_channels';
  const STORAGE_KEY_GUEST_CHANNELS = 'streampulse_guest_channels';
  const STORAGE_KEY_MY_CHANNELS = 'streampulse_my_channels';

  let currentChannels = {
    twitch: '',
    youtube: '',
    tiktok: ''
  };

  let viewerCounts = {
    twitch: 0,
    youtube: 0,
    tiktok: 0
  };

  let globalEmotes = {};
  let currentFilter = 'all';
  let isUserScrolledUp = false;
  let socket = null;
  let isTwitchAuthenticated = false;

  // DOM Elements
  const chatContainer = document.getElementById('dock-chat-container');
  const emptyState = document.getElementById('dock-empty-state');
  const connDot = document.getElementById('dock-conn-dot');
  const scrollBottomBtn = document.getElementById('btn-scroll-bottom');
  const counterLabel = document.getElementById('dock-counter-label');
  const btnCopyDockUrl = document.getElementById('btn-copy-dock-url');

  // Viewer counts
  const countTwitchEl = document.getElementById('count-twitch');
  const countYtEl = document.getElementById('count-yt');
  const countTikTokEl = document.getElementById('count-tiktok');
  const countTotalEl = document.getElementById('count-total');

  // Twitch send chat
  const chatForm = document.getElementById('dock-chat-form');
  const chatInput = document.getElementById('dock-chat-input');
  const sendBtn = document.getElementById('btn-send-dock');
  const activeTwitchBadge = document.getElementById('dock-active-channel-name');
  const statusFeedback = document.getElementById('dock-status-feedback');

  // Buttons & Controls
  const btnClearChat = document.getElementById('btn-clear-chat');
  const btnDockSettings = document.getElementById('btn-dock-settings');
  const dockSettingsModal = document.getElementById('dock-settings-modal');
  const btnCloseDockSettings = document.getElementById('btn-close-dock-settings');
  const btnCancelDockSettings = document.getElementById('btn-cancel-dock-settings');
  const btnSaveDockSettings = document.getElementById('btn-save-dock-settings');

  const dockInputTwitch = document.getElementById('dock-input-twitch');
  const dockInputYouTube = document.getElementById('dock-input-youtube');
  const dockInputTikTok = document.getElementById('dock-input-tiktok');
  const dockInputUserToken = document.getElementById('dock-input-user-token');

  // Auth warning notification banner
  const dockAuthWarning = document.getElementById('dock-auth-warning');
  const dockWarningText = document.getElementById('dock-warning-text');
  const btnDismissAuthWarning = document.getElementById('btn-dismiss-auth-warning');

  // Filter chips
  const filterChips = document.querySelectorAll('.filter-chip');

  // ==========================================
  // UTILITIES
  // ==========================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function formatCount(num) {
    const n = Math.max(0, parseInt(num, 10) || 0);
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return String(n);
  }

  function showFeedback(text, type = 'info', timeoutMs = 4000) {
    if (!statusFeedback) return;
    statusFeedback.textContent = text;
    statusFeedback.className = `dock-status-msg ${type}`;
    if (timeoutMs > 0) {
      setTimeout(() => {
        if (statusFeedback.textContent === text) {
          refreshDefaultFeedback();
        }
      }, timeoutMs);
    }
  }

  function refreshDefaultFeedback() {
    if (!statusFeedback) return;
    if (!isTwitchAuthenticated) {
      statusFeedback.textContent = '🔒 Kirim chat dinonaktifkan: Silakan Login Twitch di menu Atur Channel Homepage';
      statusFeedback.className = 'dock-status-msg error';
    } else if (currentChannels.twitch) {
      statusFeedback.textContent = `✓ Terhubung via Twitch (#${currentChannels.twitch}). Siap mengirim chat!`;
      statusFeedback.className = 'dock-status-msg success';
    } else {
      statusFeedback.textContent = 'Siap mengirim pesan ke Twitch';
      statusFeedback.className = 'dock-status-msg info';
    }
  }

  // ==========================================
  // TWITCH AUTHENTICATION PERMISSION ENFORCEMENT
  // ==========================================
  function setChatSendPermission(allowed, reason = '') {
    isTwitchAuthenticated = !!allowed;
    if (allowed) {
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.placeholder = `Ketik pesan chat ke #${currentChannels.twitch || 'Twitch'} (Enter)...`;
      sendBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Kirim
      `;
      refreshDefaultFeedback();
    } else {
      chatInput.disabled = true;
      sendBtn.disabled = true;
      chatInput.value = '';
      chatInput.placeholder = 'Login Twitch di Channel Setup Homepage untuk aktifkan chat...';
      sendBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Terkunci
      `;
      showFeedback(
        reason || '🔒 Kirim chat di Dock hanya bisa jika akun Twitch login di Channel Setup Homepage.',
        'error',
        0
      );
    }
  }

  async function verifyTwitchAuthWithServer() {
    const userToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN) || '';
    if (!userToken) {
      setChatSendPermission(false, '🔒 Anda belum login. Silakan buka Homepage & hubungkan Twitch Anda.');
      return;
    }

    try {
      const res = await fetch('/api/user/me', {
        headers: { 'x-user-token': userToken }
      });
      if (res.ok) {
        const u = await res.json();
        if (u?.channels) {
          if (u.channels.twitch) {
            currentChannels.twitch = u.channels.twitch.toLowerCase().replace(/^[#@]/, '');
          }
          if (u.channels.youtube) {
            currentChannels.youtube = u.channels.youtube;
          }
          if (u.channels.tiktok) {
            currentChannels.tiktok = u.channels.tiktok.replace(/^@/, '');
          }
          localStorage.setItem(STORAGE_KEY_USER_CHANNELS, JSON.stringify(u.channels));
          localStorage.setItem(STORAGE_KEY_MY_CHANNELS, JSON.stringify(u.channels));
          updateChannelUI();
          syncChannelsWithSocket();
        }
        const hasToken = !!(u?.channels?.hasTwitchToken && u?.channels?.twitch);
        if (hasToken) {
          setChatSendPermission(true);
        } else {
          setChatSendPermission(false, '🔒 Akun Twitch belum terhubung (Buka Homepage > Atur Channel > Login Twitch)');
        }
      } else {
        setChatSendPermission(false, '🔒 Sesi login tidak valid. Buka Homepage untuk memperbarui sesi.');
      }
    } catch (e) {
      console.warn('[Dock] Gagal verifikasi sesi user:', e);
    }
  }

  // ==========================================
  // LOCAL STORAGE PERSISTENCE (NO LIMIT)
  // ==========================================
  function getStoredHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (!data) return [];
      const list = JSON.parse(data);
      if (!Array.isArray(list)) return [];
      return list.map(item => {
        if (item && item.text && typeof item.text === 'string') {
          // Bersihkan jika riwayat lokal lama menyimpan fragmen HTML rusak
          if (item.text.includes('<img') || item.text.includes('loading="lazy"') || item.text.includes('title="')) {
            item.text = item.text
              .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1')
              .replace(/<img[^>]*>/gi, '')
              .replace(/title="[^"]*"/gi, '')
              .replace(/loading="lazy"/gi, '')
              .replace(/[">]/g, ' ')
              .trim();
          }
        }
        return item;
      });
    } catch (e) {
      console.warn('[Dock] Gagal parse localStorage history:', e);
      return [];
    }
  }

  function saveItemToHistory(item) {
    try {
      let history = getStoredHistory();
      history.push(item);

      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
      } catch (quotaErr) {
        if (history.length > 100) {
          const cutCount = Math.floor(history.length * 0.2);
          history.splice(0, cutCount);
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        }
      }

      updateHistoryCountLabel(history.length);
    } catch (e) {
      console.warn('[Dock] Gagal menyimpan ke localStorage:', e);
    }
  }

  function clearHistoryStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch (e) {}
    updateHistoryCountLabel(0);
  }

  function updateHistoryCountLabel(count) {
    if (counterLabel) {
      counterLabel.textContent = `${count} tersimpan (No Limit)`;
    }
  }

  function showAuthWarning(text) {
    if (!dockAuthWarning) return;
    if (dockWarningText) dockWarningText.textContent = text;
    dockAuthWarning.style.display = 'flex';
  }

  function hideAuthWarning() {
    if (dockAuthWarning) dockAuthWarning.style.display = 'none';
  }

  if (btnDismissAuthWarning) {
    btnDismissAuthWarning.addEventListener('click', hideAuthWarning);
  }

  // ==========================================
  // OBS DOCK IN-APP SETTINGS MODAL
  // ==========================================
  function openDockSettings() {
    if (!dockSettingsModal) return;
    if (dockInputTwitch) dockInputTwitch.value = currentChannels.twitch || '';
    if (dockInputYouTube) dockInputYouTube.value = currentChannels.youtube || '';
    if (dockInputTikTok) dockInputTikTok.value = currentChannels.tiktok || '';
    if (dockInputUserToken) {
      dockInputUserToken.value = localStorage.getItem(STORAGE_KEY_USER_TOKEN) || '';
    }
    const modalUrlInput = document.getElementById('dock-modal-url-input');
    if (modalUrlInput) {
      modalUrlInput.value = getDockShareUrl();
    }
    dockSettingsModal.style.display = 'flex';
  }

  function closeDockSettings() {
    if (dockSettingsModal) dockSettingsModal.style.display = 'none';
  }

  if (btnDockSettings) btnDockSettings.addEventListener('click', openDockSettings);
  if (btnCloseDockSettings) btnCloseDockSettings.addEventListener('click', closeDockSettings);
  if (btnCancelDockSettings) btnCancelDockSettings.addEventListener('click', closeDockSettings);

  const btnCopyModalUrl = document.getElementById('btn-copy-modal-url');
  if (btnCopyModalUrl) {
    btnCopyModalUrl.addEventListener('click', async () => {
      const fullUrl = getDockShareUrl();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullUrl);
        } else {
          const ta = document.createElement('textarea');
          ta.value = fullUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        const origText = btnCopyModalUrl.textContent;
        btnCopyModalUrl.textContent = '✓ Tersalin!';
        setTimeout(() => { btnCopyModalUrl.textContent = origText; }, 2000);
        showFeedback('✓ URL OBS Dock (dengan Token) berhasil disalin!', 'success', 3000);
      } catch (e) {
        showFeedback('Gagal menyalin URL', 'error', 2000);
      }
    });
  }

  function getDockShareUrl() {
    const origin = window.location.origin;
    const userToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN);
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get('token');

    // 1. Prioritas token akun (dari URL atau tersimpan di local storage browser)
    const effectiveToken = qToken || userToken;
    if (effectiveToken) {
      return `${origin}/dock?token=${encodeURIComponent(effectiveToken)}`;
    }

    // 2. Jika mode guest (tanpa akun/token), bawa parameter channel aktif agar OBS bisa load
    const ch = currentChannels || {};
    const chParams = new URLSearchParams();
    if (ch.twitch) chParams.set('twitch', ch.twitch);
    if (ch.youtube) chParams.set('youtube', ch.youtube);
    if (ch.tiktok) chParams.set('tiktok', ch.tiktok);

    const query = chParams.toString();
    return query ? `${origin}/dock?${query}` : `${origin}/dock`;
  }

  if (btnCopyDockUrl) {
    btnCopyDockUrl.addEventListener('click', async () => {
      try {
        const fullUrl = getDockShareUrl();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullUrl);
        } else {
          const ta = document.createElement('textarea');
          ta.value = fullUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        const hasToken = fullUrl.includes('token=');
        showFeedback(
          hasToken 
            ? '✓ URL OBS Dock (termasuk Token Akun) berhasil disalin!' 
            : '✓ URL OBS Dock berhasil disalin!',
          'success', 
          3500
        );
      } catch (err) {
        showFeedback('Gagal menyalin URL', 'error', 3000);
      }
    });
  }

  if (btnSaveDockSettings) {
    btnSaveDockSettings.addEventListener('click', async () => {
      const origText = btnSaveDockSettings.textContent;
      btnSaveDockSettings.disabled = true;
      btnSaveDockSettings.textContent = 'Menyimpan...';

      const prevSig = `${(currentChannels.twitch || '').toLowerCase()}:${currentChannels.youtube || ''}:${currentChannels.tiktok || ''}`;

      const twitch = dockInputTwitch ? dockInputTwitch.value.trim().toLowerCase().replace(/^[#@]/, '') : '';
      const youtube = dockInputYouTube ? dockInputYouTube.value.trim() : '';
      const tiktok = dockInputTikTok ? dockInputTikTok.value.trim().replace(/^@/, '') : '';
      const tokenOrUser = dockInputUserToken ? dockInputUserToken.value.trim() : '';

      currentChannels.twitch = twitch;
      currentChannels.youtube = youtube;
      currentChannels.tiktok = tiktok;

      const chData = { twitch, youtube, tiktok };
      localStorage.setItem(STORAGE_KEY_USER_CHANNELS, JSON.stringify(chData));
      localStorage.setItem(STORAGE_KEY_MY_CHANNELS, JSON.stringify(chData));

      if (tokenOrUser) {
        if (/^[a-zA-Z0-9_\.]{3,30}$/.test(tokenOrUser) && tokenOrUser.length < 32) {
          try {
            const res = await fetch(`/api/dock/config?user=${encodeURIComponent(tokenOrUser)}`);
            if (res.ok) {
              const cfg = await res.json();
              if (cfg.userToken) {
                localStorage.setItem(STORAGE_KEY_USER_TOKEN, cfg.userToken);
              }
              if (cfg.channels) {
                if (!twitch && cfg.channels.twitch) currentChannels.twitch = cfg.channels.twitch.toLowerCase().replace(/^[#@]/, '');
                if (!youtube && cfg.channels.youtube) currentChannels.youtube = cfg.channels.youtube;
                if (!tiktok && cfg.channels.tiktok) currentChannels.tiktok = cfg.channels.tiktok;
              }
            }
          } catch (e) {}
        } else {
          localStorage.setItem(STORAGE_KEY_USER_TOKEN, tokenOrUser);
        }
      }

      const savedToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN);
      if (savedToken && window.history && window.history.replaceState) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('token', savedToken);
        window.history.replaceState({}, '', currentUrl.toString());
      }

      const newSig = `${(currentChannels.twitch || '').toLowerCase()}:${currentChannels.youtube || ''}:${currentChannels.tiktok || ''}`;
      if (prevSig !== newSig && prevSig !== '::') {
        console.log(`[Dock] Saluran berubah (${prevSig} -> ${newSig}), membersihkan riwayat chat lama.`);
        clearHistoryStorage();
        if (chatContainer) {
          chatContainer.innerHTML = '';
          if (emptyState) chatContainer.appendChild(emptyState);
        }
      }
      localStorage.setItem(STORAGE_KEY_HISTORY_SIG, newSig);

      updateChannelUI();
      syncChannelsWithSocket();
      verifyTwitchAuthWithServer();
      closeDockSettings();
      btnSaveDockSettings.disabled = false;
      btnSaveDockSettings.textContent = origText;
      showFeedback('Saluran OBS Dock berhasil diperbarui!', 'success', 3500);
    });
  }

  // ==========================================
  // CHANNELS RESOLUTION (SINKRON CLOUD & HOMEPAGE)
  // ==========================================
  function readHomepageChannels() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER_CHANNELS) ||
                  localStorage.getItem(STORAGE_KEY_MY_CHANNELS) ||
                  localStorage.getItem(STORAGE_KEY_GUEST_CHANNELS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  async function initChannels() {
    const prevSig = `${(currentChannels.twitch || '').toLowerCase()}:${currentChannels.youtube || ''}:${currentChannels.tiktok || ''}`;
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get('token');
    const qUser = params.get('user') || params.get('username');
    const qTwitch = params.get('twitch');
    const qYt = params.get('youtube');
    const qTikTok = params.get('tiktok');

    const finishInit = () => {
      const newSig = `${(currentChannels.twitch || '').toLowerCase()}:${currentChannels.youtube || ''}:${currentChannels.tiktok || ''}`;
      const savedSig = localStorage.getItem(STORAGE_KEY_HISTORY_SIG);
      if (savedSig && savedSig !== newSig && newSig !== '::') {
        console.log(`[Dock] Saluran berbeda dari riwayat (${savedSig} vs ${newSig}), membersihkan riwayat lama.`);
        clearHistoryStorage();
        if (chatContainer) {
          chatContainer.innerHTML = '';
          if (emptyState) chatContainer.appendChild(emptyState);
        }
      }
      localStorage.setItem(STORAGE_KEY_HISTORY_SIG, newSig);
      updateChannelUI();
    };

    // 1. Prioritas Utama: Konfigurasi Akun dari Server jika parameter token / user ada di URL atau tersimpan di local storage
    const storedToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN);
    const effectiveToken = qToken || (!qUser ? storedToken : null);

    if (effectiveToken || qUser) {
      try {
        const queryStr = effectiveToken ? `token=${encodeURIComponent(effectiveToken)}` : `user=${encodeURIComponent(qUser)}`;
        const res = await fetch(`/api/dock/config?${queryStr}`);
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.success && cfg.channels) {
            if (cfg.userToken) {
              localStorage.setItem(STORAGE_KEY_USER_TOKEN, cfg.userToken);
            }
            localStorage.setItem(STORAGE_KEY_USER_CHANNELS, JSON.stringify(cfg.channels));
            localStorage.setItem(STORAGE_KEY_MY_CHANNELS, JSON.stringify(cfg.channels));

            currentChannels.twitch = (qTwitch || cfg.channels.twitch || '').trim().toLowerCase().replace(/^[#@]/, '');
            currentChannels.youtube = (qYt || cfg.channels.youtube || '').trim();
            currentChannels.tiktok = (qTikTok || cfg.channels.tiktok || '').trim().replace(/^@/, '');

            // Pastikan URL di address bar browser juga terisi ?token=...
            if (effectiveToken && window.history && window.history.replaceState) {
              try {
                const currentUrl = new URL(window.location.href);
                if (!currentUrl.searchParams.get('token')) {
                  currentUrl.searchParams.set('token', effectiveToken);
                  window.history.replaceState({}, '', currentUrl.toString());
                }
              } catch (e) {}
            }

            finishInit();
            syncChannelsWithSocket();
            verifyTwitchAuthWithServer();
            showFeedback(`✓ Terhubung ke akun @${cfg.username}`, 'success', 3000);
            return;
          }
        }
      } catch (e) {
        console.warn('[Dock] Gagal mengambil konfigurasi dock dari server:', e);
      }
    }

    // 2. Prioritas Kedua: Query params manual di URL
    if (qTwitch !== null || qYt !== null || qTikTok !== null) {
      if (qTwitch !== null) currentChannels.twitch = qTwitch.trim().toLowerCase().replace(/^[#@]/, '');
      if (qYt !== null) currentChannels.youtube = qYt.trim();
      if (qTikTok !== null) currentChannels.tiktok = qTikTok.trim().replace(/^@/, '');
      finishInit();
      return;
    }

    // 3. Fallback: Baca dari storage lokal OBS Dock
    const homepageChannels = readHomepageChannels();
    currentChannels.twitch = (homepageChannels.twitch || '').trim().toLowerCase().replace(/^[#@]/, '');
    currentChannels.youtube = (homepageChannels.youtube || '').trim();
    currentChannels.tiktok = (homepageChannels.tiktok || '').trim().replace(/^@/, '');
    finishInit();
  }

  function updateChannelUI() {
    if (activeTwitchBadge) {
      activeTwitchBadge.textContent = currentChannels.twitch
        ? `Twitch: #${currentChannels.twitch}`
        : 'Twitch: Belum Diset';
    }
    refreshDefaultFeedback();
  }

  // Sinkronisasi otomatis jika user mengubah channel di Homepage
  window.addEventListener('storage', (e) => {
    if (
      e.key === STORAGE_KEY_USER_CHANNELS ||
      e.key === STORAGE_KEY_MY_CHANNELS ||
      e.key === STORAGE_KEY_GUEST_CHANNELS ||
      e.key === STORAGE_KEY_USER_TOKEN
    ) {
      console.log('[Dock] Konfigurasi channel / token diperbarui dari Homepage');
      initChannels();
      verifyTwitchAuthWithServer();
      syncChannelsWithSocket();
      showFeedback(`Pengaturan diperbarui otomatis dari Homepage!`, 'success', 3000);
    }
  });

  // ==========================================
  // VIEWER COUNT MANAGER
  // ==========================================
  function updateViewerDisplay() {
    if (countTwitchEl) countTwitchEl.textContent = formatCount(viewerCounts.twitch);
    if (countYtEl) countYtEl.textContent = formatCount(viewerCounts.youtube);
    if (countTikTokEl) countTikTokEl.textContent = formatCount(viewerCounts.tiktok);

    const total = viewerCounts.twitch + viewerCounts.youtube + viewerCounts.tiktok;
    if (countTotalEl) countTotalEl.textContent = formatCount(total);
  }

  // ==========================================
  // BADGES & EMOTES
  // ==========================================
  function getBadgesHtml(chat) {
    const author = chat.author || {};
    let html = '';

    if (chat.platform === 'twitch') {
      if (Array.isArray(author.badgesList) && author.badgesList.length > 0) {
        author.badgesList.slice(0, 3).forEach(b => {
          if (b && b.url) {
            html += `<img src="${escapeHtml(b.url)}" class="dock-badge-img" alt="${escapeHtml(b.title || 'Badge')}" title="${escapeHtml(b.title || 'Badge')}" loading="lazy"> `;
          }
        });
      } else {
        const badges = author.badges || {};
        if (badges.broadcaster || author.isBroadcaster) {
          html += `<img src="https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1" class="dock-badge-img" title="Broadcaster"> `;
        }
        if (badges.moderator || author.isMod) {
          html += `<img src="https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1" class="dock-badge-img" title="Moderator"> `;
        }
        if (badges.vip) {
          html += `<img src="https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1" class="dock-badge-img" title="VIP"> `;
        }
        if (badges.subscriber || author.isSub) {
          html += `<img src="https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1" class="dock-badge-img" title="Subscriber"> `;
        }
      }
    } else if (chat.platform === 'youtube') {
      if (author.isOwner) html += `<span style="color:#f59e0b;font-weight:800;font-size:10px;">[OWNER]</span> `;
      if (author.isMod) html += `<span style="color:#2563eb;font-weight:800;font-size:10px;">[MOD]</span> `; // high contrast
      if (author.memberBadge) {
        html += `<img src="${escapeHtml(author.memberBadge)}" class="dock-badge-img" title="Member"> `;
      }
    } else if (chat.platform === 'tiktok') {
      if (author.isMod) html += `<span style="color:#0284c7;font-weight:800;font-size:10px;">[MOD]</span> `; // high contrast
      if (author.isSub) html += `<span style="color:#e11d48;font-weight:800;font-size:10px;">[SUB]</span> `; // high contrast
    }

    return html;
  }

  function parse7tvTokens(rawText) {
    if (!rawText) return '';
    if (!globalEmotes || typeof globalEmotes !== 'object' || Object.keys(globalEmotes).length === 0) {
      return escapeHtml(rawText);
    }
    const tokens = rawText.split(/(\s+)/);
    return tokens.map(token => {
      if (!token) return '';
      if (/^\s+$/.test(token)) return token;

      const clean = token.trim();
      const e = globalEmotes[clean];
      if (e) {
        const url = typeof e === 'string' ? e : (e.url || e.images?.['1x'] || e.urls?.[0]);
        if (url) {
          const esc = escapeHtml(clean);
          return `<img src="${escapeHtml(url)}" class="dock-emote" alt="${esc}" title="${esc}" loading="lazy">`;
        }
      }
      return escapeHtml(token);
    }).join('');
  }

  function parseMessageText(text, platform, emotesMap = {}) {
    if (!text) return '';

    // Sanitize jika input teks mengandung sisa fragmen HTML rusak dari riwayat lokal lama
    let cleanText = String(text);
    if (cleanText.includes('<img') || cleanText.includes('loading="lazy"') || cleanText.includes('title="')) {
      cleanText = cleanText
        .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1')
        .replace(/<img[^>]*>/gi, '')
        .replace(/title="[^"]*"/gi, '')
        .replace(/loading="lazy"/gi, '')
        .replace(/[">]/g, ' ')
        .trim();
    }

    // 1. Twitch Official Emotes
    if (platform === 'twitch' && emotesMap && typeof emotesMap === 'object' && Object.keys(emotesMap).length > 0) {
      const ranges = [];
      for (const [emoteId, positions] of Object.entries(emotesMap)) {
        if (!Array.isArray(positions)) continue;
        for (const pos of positions) {
          const parts = String(pos).split('-');
          if (parts.length === 2) {
            const start = parseInt(parts[0], 10);
            const end = parseInt(parts[1], 10);
            if (!isNaN(start) && !isNaN(end) && end >= start && end < cleanText.length) {
              ranges.push({
                start,
                end: end + 1, // End is inclusive in Twitch IRC format, slice is exclusive
                id: emoteId
              });
            }
          }
        }
      }

      if (ranges.length > 0) {
        // Sort ascending by character index
        ranges.sort((a, b) => a.start - b.start);

        let html = '';
        let lastIndex = 0;

        for (const r of ranges) {
          if (r.start < lastIndex) continue; // Skip corrupt or overlapping ranges

          // Non-emote text before this emote -> check for 7TV & HTML escape
          if (r.start > lastIndex) {
            html += parse7tvTokens(cleanText.substring(lastIndex, r.start));
          }

          const emoteName = cleanText.substring(r.start, r.end);
          const escCode = escapeHtml(emoteName);
          const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/1.0`;
          html += `<img src="${emoteUrl}" class="dock-emote" alt="${escCode}" title="${escCode}" loading="lazy">`;

          lastIndex = r.end;
        }

        // Remaining text after last emote
        if (lastIndex < cleanText.length) {
          html += parse7tvTokens(cleanText.substring(lastIndex));
        }

        return html;
      }
    }

    // 2. Default: 7TV & Plain text escaping
    return parse7tvTokens(cleanText);
  }

  function formatYouTubeMessage(chat) {
    if (Array.isArray(chat.messageParts) && chat.messageParts.length > 0) {
      return chat.messageParts.map(part => {
        if (!part) return '';
        if (part.type === 'emoji' || part.isCustomEmoji) {
          const emoteUrl = escapeHtml(part.url || part.emojiUrl || '');
          const emoteAlt = escapeHtml(part.alt || part.text || part.emojiText || 'emoji');
          if (emoteUrl) {
            return `<img class="dock-emote yt-custom-emote" src="${emoteUrl}" alt="${emoteAlt}" title="${emoteAlt}" loading="lazy">`;
          }
        }
        return parse7tvTokens(part.text || '');
      }).join('');
    }
    return parseMessageText(chat.text, 'youtube');
  }

  // ==========================================
  // RENDER CARDS (CHAT & EVENTS)
  // ==========================================
  
  // Pastikan warna teks / author selalu kontras dan jelas terbaca di atas latar belakang putih/terang
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
      if (r < 70 && g < 70 && b < 70) return '#38bdf8';
      if (L < 0.18) {
        const boost = 0.55;
        const lightR = Math.min(255, Math.floor(r + (255 - r) * boost));
        const lightG = Math.min(255, Math.floor(g + (255 - g) * boost));
        const lightB = Math.min(255, Math.floor(b + (255 - b) * boost));
        return '#' + lightR.toString(16).padStart(2, '0') + lightG.toString(16).padStart(2, '0') + lightB.toString(16).padStart(2, '0');
      }
    } else {
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
    return getContrastAuthorColor(colorHex, isDarkModeActive());
  }

  function renderChatItem(chat, shouldScroll = true) {
    if (!chat) return;
    if (emptyState && emptyState.parentElement) {
      emptyState.remove();
    }

    const item = document.createElement('div');
    item.className = 'dock-chat-item';
    item.dataset.type = 'chat';
    item.dataset.platform = chat.platform || 'general';

    const author = chat.author || {};
    const authorName = author.name || 'Penonton';
    let authorColor = ensureContrastForLightBg(author.color, '#0f172a');
    if (chat.platform === 'tiktok') {
      authorColor = isDarkModeActive() ? '#25f4ee' : '#008f9c';
    }
    const initial = (authorName[0] || '?').toUpperCase();
    const avatarHtml = author.avatar
      ? `<img src="${escapeHtml(author.avatar)}" class="dock-chat-avatar" alt="${escapeHtml(authorName)}" loading="lazy" onerror="this.onerror=null; this.outerHTML='<div class=\\'dock-chat-avatar\\'>${initial}</div>'">`
      : `<div class="dock-chat-avatar">${initial}</div>`;

    const platformBadgeHtml = `<span class="platform-badge ${chat.platform}">${chat.platform}</span>`;
    const badgesHtml = getBadgesHtml(chat);
    let formattedText = '';
    if (chat.platform === 'youtube' && Array.isArray(chat.messageParts) && chat.messageParts.length > 0) {
      formattedText = formatYouTubeMessage(chat);
    } else {
      formattedText = parseMessageText(chat.text, chat.platform, chat.emotes);
    }

    item.innerHTML = `
      ${avatarHtml}
      <div class="dock-chat-body">
        <div class="dock-chat-meta">
          ${platformBadgeHtml}
          ${badgesHtml}
          <span class="dock-author-name" style="color: ${escapeHtml(authorColor)}">${escapeHtml(authorName)}</span>
          <span class="dock-time-label">${formatTime(chat.timestamp)}</span>
        </div>
        <div class="dock-chat-text">${formattedText}</div>
      </div>
    `;

    // Filter display
    if (currentFilter === 'event') {
      item.style.display = 'none';
    }

    chatContainer.appendChild(item);

    if (shouldScroll) {
      handleAutoScroll();
    }
  }

  function renderEventItem(evt, shouldScroll = true) {
    if (!evt) return;
    if (emptyState && emptyState.parentElement) {
      emptyState.remove();
    }

    const item = document.createElement('div');
    item.className = `dock-event-item ${evt.eventType || ''}`;
    item.dataset.type = 'event';
    item.dataset.platform = evt.platform || 'general';

    const platformBadgeHtml = `<span class="platform-badge ${evt.platform}">${evt.platform}</span>`;
    const authorName = evt.author || 'Anonim';
    const detail = evt.detail || evt.message || evt.badge || '';

    item.innerHTML = `
      <div class="dock-event-header">
        ${platformBadgeHtml}
        <span>${escapeHtml(evt.title || 'Event Spesial!')}</span>
        <span class="dock-time-label">${formatTime(evt.timestamp)}</span>
      </div>
      <div class="dock-event-detail">
        <strong>${escapeHtml(authorName)}</strong>: ${escapeHtml(detail)}
      </div>
    `;

    // Filter display
    if (currentFilter === 'chat') {
      item.style.display = 'none';
    }

    chatContainer.appendChild(item);

    if (shouldScroll) {
      handleAutoScroll();
    }
  }

  // ==========================================
  // SMART AUTO SCROLL
  // ==========================================
  function handleAutoScroll() {
    if (!chatContainer) return;
    if (isUserScrolledUp) {
      if (scrollBottomBtn) scrollBottomBtn.style.display = 'inline-flex';
      return;
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  chatContainer.addEventListener('scroll', () => {
    const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
    if (distanceFromBottom > 70) {
      isUserScrolledUp = true;
      if (scrollBottomBtn) scrollBottomBtn.style.display = 'inline-flex';
    } else {
      isUserScrolledUp = false;
      if (scrollBottomBtn) scrollBottomBtn.style.display = 'none';
    }
  });

  if (scrollBottomBtn) {
    scrollBottomBtn.addEventListener('click', () => {
      isUserScrolledUp = false;
      chatContainer.scrollTop = chatContainer.scrollHeight;
      scrollBottomBtn.style.display = 'none';
    });
  }

  // ==========================================
  // FILTER TABS
  // ==========================================
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter || 'all';

      const items = chatContainer.querySelectorAll('.dock-chat-item, .dock-event-item');
      items.forEach(el => {
        const type = el.dataset.type;
        if (currentFilter === 'all') {
          el.style.display = 'flex';
        } else if (currentFilter === 'chat') {
          el.style.display = type === 'chat' ? 'flex' : 'none';
        } else if (currentFilter === 'event') {
          el.style.display = type === 'event' ? 'block' : 'none';
        }
      });

      handleAutoScroll();
    });
  });

  // ==========================================
  // CLEAR CHAT
  // ==========================================
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      if (confirm('Bersihkan semua riwayat chat dari tampilan dock dan local storage?')) {
        chatContainer.innerHTML = '';
        chatContainer.appendChild(emptyState);
        clearHistoryStorage();
        showFeedback('Riwayat chat telah dibersihkan', 'info');
      }
    });
  }

  // ==========================================
  // SEND CHAT (TWITCH ONLY - ENFORCE AUTH)
  // ==========================================
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!isTwitchAuthenticated) {
        showFeedback('Kirim chat dikunci: Anda harus Login via Twitch di Channel Setup Homepage.', 'error', 5000);
        return;
      }

      const message = (chatInput.value || '').trim();
      if (!message) return;

      if (!currentChannels.twitch) {
        showFeedback('Channel Twitch belum diatur di Homepage.', 'error');
        return;
      }

      if (!socket || !socket.connected) {
        showFeedback('Belum terhubung ke server StreamPulse.', 'error');
        return;
      }

      const userToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN) || '';

      sendBtn.disabled = true;
      showFeedback('Mengirim pesan ke Twitch...', 'info', 0);

      socket.emit('send_chat_message', {
        platform: 'twitch',
        channel: currentChannels.twitch,
        message: message,
        userToken: userToken
      }, (res) => {
        sendBtn.disabled = false;
        if (res && res.success) {
          showFeedback('Pesan berhasil terkirim ke Twitch!', 'success');
          chatInput.value = '';
          chatInput.focus();
        } else {
          const err = res?.error || 'Gagal mengirim pesan chat';
          showFeedback(`Gagal: ${err}`, 'error', 6000);
        }
      });
    });
  }

  // ==========================================
  // INITIALIZE SOCKET & RESTORE STORAGE
  // ==========================================
  function restorePersistedHistory() {
    const curSig = `${(currentChannels.twitch || '').toLowerCase()}:${currentChannels.youtube || ''}:${currentChannels.tiktok || ''}`;
    const savedSig = localStorage.getItem(STORAGE_KEY_HISTORY_SIG);
    if (savedSig && savedSig !== curSig && curSig !== '::') {
      console.log(`[Dock] Saluran berbeda dari riwayat tersimpan (${savedSig} vs ${curSig}), mengosongkan cache lama.`);
      clearHistoryStorage();
      localStorage.setItem(STORAGE_KEY_HISTORY_SIG, curSig);
      return;
    }
    localStorage.setItem(STORAGE_KEY_HISTORY_SIG, curSig);

    const list = getStoredHistory();
    if (list.length > 0 && emptyState && emptyState.parentElement) {
      emptyState.remove();
    }
    list.forEach(item => {
      if (item.kind === 'event') {
        renderEventItem(item, false);
      } else {
        renderChatItem(item, false);
      }
    });
    updateHistoryCountLabel(list.length);
    handleAutoScroll();
  }

  async function loadGlobalEmotes() {
    try {
      const res = await fetch('/api/emotes/global');
      if (res.ok) {
        globalEmotes = await res.json();
      }
    } catch (e) {
      console.warn('[Dock] Failed to load global emotes:', e);
    }
  }

  function syncChannelsWithSocket() {
    if (!socket || !socket.connected) return;
    const homepageChannels = readHomepageChannels();
    const payload = {
      twitch: currentChannels.twitch,
      youtube: currentChannels.youtube,
      tiktok: currentChannels.tiktok,
      tiktokSessionId: homepageChannels.tiktokSessionId || localStorage.getItem('streampulse_tiktok_session') || '',
      userToken: localStorage.getItem(STORAGE_KEY_USER_TOKEN) || ''
    };
    // Kirim event update_channels dan set_channels untuk kompatibilitas penuh
    socket.emit('update_channels', payload);
  }

  // Live Network Latency Ping Monitor
  const dockPingPill = document.getElementById('dock-ping-pill');
  function measureDockPing() {
    if (!socket || !socket.connected) {
      if (dockPingPill) {
        dockPingPill.textContent = 'Offline';
        dockPingPill.className = 'dock-ping-pill slow';
        dockPingPill.title = 'Terputus dari Server';
      }
      return;
    }
    const start = performance.now();
    socket.emit('ping_check', () => {
      const lat = Math.round(performance.now() - start);
      if (dockPingPill) {
        dockPingPill.textContent = `${lat}ms`;
        if (lat < 100) {
          dockPingPill.className = 'dock-ping-pill';
          dockPingPill.title = `Latensi Server: ${lat}ms (Optimal / Sangat Lancar)`;
        } else if (lat < 220) {
          dockPingPill.className = 'dock-ping-pill moderate';
          dockPingPill.title = `Latensi Server: ${lat}ms (Normal)`;
        } else {
          dockPingPill.className = 'dock-ping-pill slow';
          dockPingPill.title = `Latensi Server: ${lat}ms (Tinggi / Lambat)`;
        }
      }
    });
  }
  setInterval(measureDockPing, 7000);

  function initSocket() {
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      console.log('[Dock] Connected to StreamPulse Socket');
      if (connDot) {
        connDot.className = 'dock-status-dot connected';
        connDot.title = 'Terhubung ke Server StreamPulse';
      }

      measureDockPing();
      syncChannelsWithSocket();
    });

    socket.on('disconnect', () => {
      console.log('[Dock] Disconnected from server');
      if (connDot) {
        connDot.className = 'dock-status-dot';
        connDot.title = 'Terputus dari Server';
      }
      if (dockPingPill) {
        dockPingPill.textContent = 'Offline';
        dockPingPill.className = 'dock-ping-pill slow';
        dockPingPill.title = 'Terputus dari Server';
      }
    });

    // Menerima konfirmasi status otorisasi dari server
    socket.on('auth_status', (data) => {
      if (data && typeof data.hasTwitchAuth === 'boolean') {
        if (data.hasTwitchAuth) {
          setChatSendPermission(true);
          hideAuthWarning();
        } else {
          setChatSendPermission(false, '🔒 Akun Twitch belum login di Homepage (Atur Channel > Login Twitch)');
          if (currentChannels.twitch) {
            showAuthWarning('⚠️ Sesi otorisasi Twitch Anda kedaluwarsa atau belum terhubung. Buka Dashboard web joo-nathan.my.id > "Atur Saluran" lalu klik "Login Twitch" untuk menyambungkan kembali.');
          }
        }
      }
    });

    // Inisialisasi awal saat terkoneksi
    socket.on('initial_state', (data) => {
      if (data && data.channels) {
        let changed = false;
        if (!currentChannels.twitch && data.channels.twitch) {
          currentChannels.twitch = data.channels.twitch;
          changed = true;
        }
        if (!currentChannels.youtube && data.channels.youtube) {
          currentChannels.youtube = data.channels.youtube;
          changed = true;
        }
        if (!currentChannels.tiktok && data.channels.tiktok) {
          currentChannels.tiktok = data.channels.tiktok;
          changed = true;
        }
        if (changed) {
          const newSig = `${(currentChannels.twitch || '').toLowerCase()}:${currentChannels.youtube || ''}:${currentChannels.tiktok || ''}`;
          localStorage.setItem(STORAGE_KEY_HISTORY_SIG, newSig);
          updateChannelUI();
        }
      }

      if (data && data.viewerCounts) {
        viewerCounts.twitch = data.viewerCounts.twitch || 0;
        viewerCounts.youtube = data.viewerCounts.youtube || 0;
        viewerCounts.tiktok = data.viewerCounts.tiktok || 0;
        updateViewerDisplay();
      }
    });

    // Viewer Count real-time updates
    socket.on('viewer_count', (payload) => {
      if (!payload || !payload.platform) return;
      const count = parseInt(payload.count, 10) || 0;
      if (payload.platform === 'twitch') viewerCounts.twitch = count;
      if (payload.platform === 'youtube') viewerCounts.youtube = count;
      if (payload.platform === 'tiktok') viewerCounts.tiktok = count;
      updateViewerDisplay();
    });

    // Pesan Chat Baru
    socket.on('new_chat', (chat) => {
      if (!chat) return;
      renderChatItem(chat, true);
      saveItemToHistory({ kind: 'chat', ...chat });
    });

    // Event Baru (Gift, Subs, Bits, Follow, Likes)
    socket.on('new_event', (evt) => {
      if (!evt) return;
      renderEventItem(evt, true);
      saveItemToHistory({ kind: 'event', ...evt });
    });

    // Platform status message
    socket.on('platform_status', (data) => {
      if (data && data.message) {
        console.log(`[Dock Status ${data.platform}]`, data.message);
        if (data.platform === 'twitch' && (data.status === 'warning' || data.status === 'error')) {
          if (data.message.includes('kedaluwarsa') || data.message.includes('tidak valid') || data.message.includes('401')) {
            showAuthWarning(`⚠️ Twitch: ${data.message}. Silakan buka website untuk login ulang.`);
          }
        }
      }
    });
  }

  // ==========================================
  // BOOTSTRAP
  // ==========================================
  initChannels();
  restorePersistedHistory();
  loadGlobalEmotes();
  verifyTwitchAuthWithServer();
  initSocket();

})();


  // ==========================================
  // DOCK THEME TOGGLE
  // ==========================================
  const btnDockTheme = document.getElementById('btn-dock-theme');
  const dockThemeIcon = document.getElementById('dock-theme-icon');

  function updateDockThemeUI(theme) {
    if (dockThemeIcon) {
      dockThemeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  if (btnDockTheme) {
    btnDockTheme.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      document.body.classList.toggle('dark-mode', next === 'dark');
      localStorage.setItem('streampulse_theme', next);
      updateDockThemeUI(next);
    });

    const initialTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('streampulse_theme') || 'dark';
    updateDockThemeUI(initialTheme);
  }

  // ==========================================
  // DOCK SCREEN WAKE LOCK (ALWAYS ON / ANTI-SLEEP)
  // ==========================================
  function initDockWakeLock() {
    const wakelockBtn = document.getElementById('btn-dock-wakelock');
    const wakelockLabel = document.getElementById('dock-wakelock-label');
    if (!wakelockBtn) return;

    if (window.screenKeepAlive) {
      window.screenKeepAlive.onStatusChange((status) => {
        const isActive = (status === 'active' || status === 'fallback');
        if (isActive) {
          wakelockBtn.classList.add('active');
          wakelockBtn.classList.remove('inactive');
          if (wakelockLabel) wakelockLabel.textContent = 'Always On';
          wakelockBtn.title = 'Layar Aktif (Anti-Sleep ON) - Layar dicegah mati atau tidur otomatis';
        } else {
          wakelockBtn.classList.remove('active');
          wakelockBtn.classList.add('inactive');
          if (wakelockLabel) wakelockLabel.textContent = 'Auto-Sleep';
          wakelockBtn.title = 'Layar Normal (Auto-Sleep) - Klik untuk mengaktifkan mode Always On';
        }
      });

      wakelockBtn.addEventListener('click', async () => {
        try {
          await window.screenKeepAlive.toggle();
        } catch (e) {
          console.warn('[Dock] Gagal toggle wake lock:', e);
        }
      });
    } else {
      let nativeLock = null;
      async function acquireNative() {
        if ('wakeLock' in navigator && window.isSecureContext) {
          try {
            nativeLock = await navigator.wakeLock.request('screen');
            wakelockBtn.classList.add('active');
            wakelockBtn.classList.remove('inactive');
            if (wakelockLabel) wakelockLabel.textContent = 'Always On';
            nativeLock.addEventListener('release', () => {
              nativeLock = null;
              wakelockBtn.classList.remove('active');
              wakelockBtn.classList.add('inactive');
              if (wakelockLabel) wakelockLabel.textContent = 'Auto-Sleep';
            });
          } catch (err) {}
        }
      }
      acquireNative();
      wakelockBtn.addEventListener('click', async () => {
        if (nativeLock) {
          try { await nativeLock.release(); } catch (e) {}
          nativeLock = null;
          wakelockBtn.classList.remove('active');
          wakelockBtn.classList.add('inactive');
          if (wakelockLabel) wakelockLabel.textContent = 'Auto-Sleep';
        } else {
          await acquireNative();
        }
      });
    }
  }

  // Auto init wake lock on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDockWakeLock);
  } else {
    initDockWakeLock();
  }
