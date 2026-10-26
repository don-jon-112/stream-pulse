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

  // Buttons
  const btnClearChat = document.getElementById('btn-clear-chat');

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
        const hasToken = !!(u?.channels?.hasTwitchToken && u?.channels?.twitch);
        if (hasToken) {
          if (!currentChannels.twitch && u.channels.twitch) {
            currentChannels.twitch = u.channels.twitch.toLowerCase();
            updateChannelUI();
          }
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

  // ==========================================
  // CHANNELS RESOLUTION (SINKRON HOMEPAGE)
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

  function initChannels() {
    const params = new URLSearchParams(window.location.search);
    const qTwitch = params.get('twitch');
    const qYt = params.get('youtube');
    const qTikTok = params.get('tiktok');

    const homepageChannels = readHomepageChannels();

    currentChannels.twitch = (qTwitch || homepageChannels.twitch || '').trim().toLowerCase().replace(/^[#@]/, '');
    currentChannels.youtube = (qYt || homepageChannels.youtube || '').trim();
    currentChannels.tiktok = (qTikTok || homepageChannels.tiktok || '').trim().replace(/^@/, '');

    updateChannelUI();
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
    const payload = {
      twitch: currentChannels.twitch,
      youtube: currentChannels.youtube,
      tiktok: currentChannels.tiktok,
      userToken: localStorage.getItem(STORAGE_KEY_USER_TOKEN) || ''
    };
    // Kirim event update_channels dan set_channels untuk kompatibilitas penuh
    socket.emit('update_channels', payload);
  }

  function initSocket() {
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      console.log('[Dock] Connected to StreamPulse Socket');
      if (connDot) {
        connDot.className = 'dock-status-dot connected';
        connDot.title = 'Terhubung ke Server StreamPulse';
      }

      syncChannelsWithSocket();
    });

    socket.on('disconnect', () => {
      console.log('[Dock] Disconnected from server');
      if (connDot) {
        connDot.className = 'dock-status-dot';
        connDot.title = 'Terputus dari Server';
      }
    });

    // Menerima konfirmasi status otorisasi dari server
    socket.on('auth_status', (data) => {
      if (data && typeof data.hasTwitchAuth === 'boolean') {
        if (data.hasTwitchAuth) {
          setChatSendPermission(true);
        } else {
          setChatSendPermission(false, '🔒 Akun Twitch belum login di Homepage (Atur Channel > Login Twitch)');
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
        if (changed) updateChannelUI();
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
