/**
 * StreamPulse - OBS Custom Browser Dock
 * Client Controller: Live Chat, Twitch Sender, Viewer Counters, Persistent Storage (No Limit)
 */

(function () {
  'use strict';

  // ==========================================
  // CONFIG & STATE
  // ==========================================
  const STORAGE_KEY_HISTORY = 'streampulse_dock_history_v1';
  const STORAGE_KEY_USER_TOKEN = 'streampulse_user_token';
  const STORAGE_KEY_SAVED_CHANNELS = 'streampulse_user_channels';

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

  // DOM Elements
  const chatContainer = document.getElementById('dock-chat-container');
  const emptyState = document.getElementById('dock-empty-state');
  const connDot = document.getElementById('dock-conn-dot');
  const scrollBottomBtn = document.getElementById('btn-scroll-bottom');
  const counterLabel = document.getElementById('dock-counter-label');

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

  // Buttons & Modal
  const btnClearChat = document.getElementById('btn-clear-chat');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const modalSetup = document.getElementById('dock-modal-setup');
  const btnCloseSetup = document.getElementById('btn-close-setup');
  const btnSaveSetup = document.getElementById('btn-save-setup');
  const inputModalTwitch = document.getElementById('input-modal-twitch');
  const inputModalYt = document.getElementById('input-modal-youtube');
  const inputModalTikTok = document.getElementById('input-modal-tiktok');

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
          statusFeedback.textContent = currentChannels.twitch
            ? `Target aktif: #${currentChannels.twitch}`
            : 'Siap mengirim pesan ke Twitch';
          statusFeedback.className = 'dock-status-msg info';
        }
      }, timeoutMs);
    }
  }

  // ==========================================
  // LOCAL STORAGE PERSISTENCE (NO LIMIT)
  // ==========================================
  function getStoredHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[Dock] Gagal parse localStorage history:', e);
      return [];
    }
  }

  function saveItemToHistory(item) {
    try {
      let history = getStoredHistory();
      history.push(item);

      // Simpan ke localStorage. Jika storage browser penuh (quota 5MB tercapai), pangkas 20% item terlama secara anggun
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

  // ==========================================
  // CHANNELS RESOLUTION
  // ==========================================
  function initChannels() {
    const params = new URLSearchParams(window.location.search);
    const qTwitch = params.get('twitch');
    const qYt = params.get('youtube');
    const qTikTok = params.get('tiktok');

    let saved = null;
    try {
      saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY_SAVED_CHANNELS) ||
        localStorage.getItem('streampulse_my_channels') ||
        localStorage.getItem('streampulse_guest_channels') ||
        '{}'
      );
    } catch (e) {
      saved = {};
    }

    currentChannels.twitch = (qTwitch || saved.twitch || '').trim().toLowerCase().replace(/^[#@]/, '');
    currentChannels.youtube = (qYt || saved.youtube || '').trim();
    currentChannels.tiktok = (qTikTok || saved.tiktok || '').trim().replace(/^@/, '');

    updateChannelUI();
  }

  function updateChannelUI() {
    if (activeTwitchBadge) {
      activeTwitchBadge.textContent = currentChannels.twitch
        ? `Twitch: #${currentChannels.twitch}`
        : 'Twitch: Belum Diset';
    }
    if (inputModalTwitch) inputModalTwitch.value = currentChannels.twitch;
    if (inputModalYt) inputModalYt.value = currentChannels.youtube;
    if (inputModalTikTok) inputModalTikTok.value = currentChannels.tiktok;

    if (!currentChannels.twitch) {
      showFeedback('Atur username Twitch Anda di tombol "Atur" untuk mulai kirim chat.', 'info', 0);
    } else {
      showFeedback(`Target aktif: #${currentChannels.twitch}`, 'info', 0);
    }
  }

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
      if (author.isMod) html += `<span style="color:#60a5fa;font-weight:800;font-size:10px;">[MOD]</span> `;
      if (author.memberBadge) {
        html += `<img src="${escapeHtml(author.memberBadge)}" class="dock-badge-img" title="Member"> `;
      }
    } else if (chat.platform === 'tiktok') {
      if (author.isMod) html += `<span style="color:#00f2fe;font-weight:800;font-size:10px;">[MOD]</span> `;
      if (author.isSub) html += `<span style="color:#fe2c55;font-weight:800;font-size:10px;">[SUB]</span> `;
    }

    return html;
  }

  function parseMessageText(text, platform, emotesMap = {}) {
    if (!text) return '';
    let parsed = escapeHtml(text);

    // 1. Twitch Official Emotes
    if (platform === 'twitch' && emotesMap && typeof emotesMap === 'object') {
      const replacements = [];
      for (const [emoteId, positions] of Object.entries(emotesMap)) {
        if (!Array.isArray(positions)) continue;
        for (const pos of positions) {
          const parts = String(pos).split('-');
          if (parts.length === 2) {
            const start = parseInt(parts[0], 10);
            const end = parseInt(parts[1], 10);
            if (!isNaN(start) && !isNaN(end) && end >= start) {
              const emoteCode = text.slice(start, end + 1);
              replacements.push({
                start,
                end,
                code: emoteCode,
                url: `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`
              });
            }
          }
        }
      }

      if (replacements.length > 0) {
        replacements.sort((a, b) => b.start - a.start);
        for (const r of replacements) {
          const escCode = escapeHtml(r.code);
          const imgTag = `<img src="${r.url}" class="dock-emote" alt="${escCode}" title="${escCode}" loading="lazy">`;
          parsed = parsed.split(escCode).join(imgTag);
        }
      }
    }

    // 2. 7TV / Third-party global emotes
    if (globalEmotes && Object.keys(globalEmotes).length > 0) {
      const tokens = parsed.split(/(\s+)/);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (globalEmotes[token]) {
          const e = globalEmotes[token];
          const url = e.url || e.images?.['1x'] || e.urls?.[0];
          if (url) {
            tokens[i] = `<img src="${url}" class="dock-emote" alt="${token}" title="${token}" loading="lazy">`;
          }
        }
      }
      parsed = tokens.join('');
    }

    return parsed;
  }

  // ==========================================
  // RENDER CARDS (CHAT & EVENTS)
  // ==========================================
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
    const authorColor = author.color || '#e2e8f0';
    const initial = (authorName[0] || '?').toUpperCase();
    const avatarHtml = author.avatar
      ? `<img src="${escapeHtml(author.avatar)}" class="dock-chat-avatar" alt="${escapeHtml(authorName)}" loading="lazy" onerror="this.onerror=null; this.outerHTML='<div class=\\'dock-chat-avatar\\'>${initial}</div>'">`
      : `<div class="dock-chat-avatar">${initial}</div>`;

    const platformBadgeHtml = `<span class="platform-badge ${chat.platform}">${chat.platform}</span>`;
    const badgesHtml = getBadgesHtml(chat);
    const formattedText = parseMessageText(chat.text, chat.platform, chat.emotes);

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
  // SEND CHAT (TWITCH ONLY)
  // ==========================================
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = (chatInput.value || '').trim();
      if (!message) return;

      if (!currentChannels.twitch) {
        showFeedback('Harap masukkan nama channel Twitch Anda terlebih dahulu di tombol "Atur".', 'error');
        return;
      }

      if (!socket || !socket.connected) {
        showFeedback('Belum terhubung ke server StreamPulse.', 'error');
        return;
      }

      const userToken = localStorage.getItem(STORAGE_KEY_USER_TOKEN) || '';

      // Tampilkan feedback loading
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
  // QUICK SETTINGS MODAL
  // ==========================================
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      updateChannelUI();
      modalSetup.classList.add('open');
    });
  }
  if (btnCloseSetup) {
    btnCloseSetup.addEventListener('click', () => {
      modalSetup.classList.remove('open');
    });
  }
  if (modalSetup) {
    modalSetup.addEventListener('click', (e) => {
      if (e.target === modalSetup) modalSetup.classList.remove('open');
    });
  }

  if (btnSaveSetup) {
    btnSaveSetup.addEventListener('click', () => {
      const newTwitch = (inputModalTwitch.value || '').trim().toLowerCase().replace(/^[#@]/, '');
      const newYt = (inputModalYt.value || '').trim();
      const newTt = (inputModalTikTok.value || '').trim().replace(/^@/, '');

      currentChannels.twitch = newTwitch;
      currentChannels.youtube = newYt;
      currentChannels.tiktok = newTt;

      try {
        localStorage.setItem(STORAGE_KEY_SAVED_CHANNELS, JSON.stringify(currentChannels));
        localStorage.setItem('streampulse_guest_channels', JSON.stringify(currentChannels));
      } catch (e) {}

      updateChannelUI();
      modalSetup.classList.remove('open');

      // Join room socket baru
      if (socket && socket.connected) {
        socket.emit('set_channels', {
          twitch: newTwitch,
          youtube: newYt,
          tiktok: newTt,
          userToken: localStorage.getItem(STORAGE_KEY_USER_TOKEN) || ''
        });
      }

      showFeedback('Pengaturan channel disimpan. Menghubungkan ke stream...', 'success');
    });
  }

  // ==========================================
  // INITIALIZE SOCKET & RESTORE STORAGE
  // ==========================================
  function restorePersistedHistory() {
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

  function initSocket() {
    socket = io();

    socket.on('connect', () => {
      console.log('[Dock] Connected to StreamPulse Socket');
      if (connDot) {
        connDot.className = 'dock-status-dot connected';
        connDot.title = 'Terhubung ke Server StreamPulse';
      }

      // Daftarkan channel
      socket.emit('set_channels', {
        twitch: currentChannels.twitch,
        youtube: currentChannels.youtube,
        tiktok: currentChannels.tiktok,
        userToken: localStorage.getItem(STORAGE_KEY_USER_TOKEN) || ''
      });
    });

    socket.on('disconnect', () => {
      console.log('[Dock] Disconnected from server');
      if (connDot) {
        connDot.className = 'dock-status-dot';
        connDot.title = 'Terputus dari Server';
      }
    });

    // Inisialisasi awal saat terkoneksi
    socket.on('initial_state', (data) => {
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
      }
    });
  }

  // ==========================================
  // BOOTSTRAP
  // ==========================================
  initChannels();
  restorePersistedHistory();
  loadGlobalEmotes();
  initSocket();

})();
