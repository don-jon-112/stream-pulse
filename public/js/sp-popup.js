/**
 * StreamPulse UI Core Utilities
 * - Glassmorphism Custom Modal Popups (Replacing window.alert & window.confirm)
 * - Toast Notification Engine
 * - Password Show/Hide Visibility Toggle (Eye Icon)
 * - Multi-Language Engine (Indonesian 🇮🇩 & English 🇬🇧)
 */

(function () {
  // =========================================================================
  // 1. MULTI-LANGUAGE TRANSLATION DICTIONARY (ID & EN)
  // =========================================================================
  const translations = {
    id: {
      // Navigation & Header
      nav_dashboard: "← Dashboard Chat",
      nav_setup_channels: "Atur Channel",
      nav_obs_mode: "OBS Mode",
      nav_overlay_studio: "Overlay Studio 🎨",
      nav_roadmap: "Roadmap 💡",
      nav_donate: "Dukung ☕",
      nav_test_demo: "Test Demo",
      nav_login: "🔐 Login / Akun",
      nav_privacy: "🛡️ Privacy",
      nav_wakelock_on: "LAYAR AKTIF (Anti-Sleep ON)",
      nav_wakelock_sub: "Layar Dicegah Mati",
      nav_wakelock_off: "LAYAR NORMAL (Auto-Sleep)",
      nav_wakelock_sub_off: "Bisa Mati Otomatis",

      // Filters
      filter_all: "Semua Chat",
      filter_twitch: "Twitch",
      filter_youtube: "YouTube",
      filter_tiktok: "TikTok",

      // Overlay Studio Header & Actions
      studio_title: "StreamPulse OVERLAY STUDIO",
      studio_save: "💾 Simpan Pengaturan",
      studio_login_btn: "🔐 Login / Daftar Akun",
      studio_logout_btn: "Logout",
      studio_guest_badge: "preview (tamu)",
      studio_obs_ready: "✓ Siap Digunakan di OBS",
      studio_obs_login_req: "🔒 Memerlukan Login",
      studio_obs_copy_btn: "📋 Salin Link",
      studio_obs_copied: "✓ Tersalin!",
      studio_guest_obs_url: "🔒 Khusus Pengguna Login - Silakan Login / Daftar untuk Mendapatkan & Menyalin URL OBS",
      studio_guest_lock_title: "🔒 OBS Overlay Cloud Manager Terkunci",
      studio_guest_lock_desc: "Anda saat ini berada dalam mode Tamu (Guest). Anda bebas mencoba kustomisasi visual & live preview, namun untuk menyimpan konfigurasi, mengelola 3 slot cloud, dan menyalin URL OBS, silakan masuk ke akun Anda.",
      studio_guest_lock_btn: "🔐 Login / Daftar Akun Sekarang",

      // Studio Customizer Sections
      sec_channels: "📡 Saluran Live Stream",
      sec_visual: "🎨 Gaya & Tampilan Chat",
      sec_elements: "⚙️ Elemen Tampilan & Filter",
      sec_custom_css: "💻 Custom CSS Editor",
      sec_custom_js: "⚡ Custom JavaScript (Opsional)",
      sec_theme: "Tema Overlay",
      sec_font_size: "Ukuran Font",
      sec_hide_delay: "Durasi Pesan Menghilang (Auto-Hide)",
      sec_max_messages: "Batas Maksimal Bubble Chat di Layar OBS",
      sec_mask_links: "Sensor Link Otomatis",
      sec_mask_links_sub: "Ubah URL di chat menjadi [LINK] di layar OBS",
      sec_show_badges: "Tampilkan Badge Twitch & YouTube (👑 Mod, VIP, Sub)",
      sec_show_avatars: "Tampilkan Foto Profil / Avatar Viewer",
      sec_show_emotes: "Tampilkan Emote 7TV & Twitch",
      sec_show_alerts: "Tampilkan Banner Alert (Raid, Cheer, Sub, Super Chat)",

      // Auth Modal
      auth_login_tab: "Masuk (Login)",
      auth_register_tab: "Daftar Akun Baru",
      auth_title_login: "Masuk Akun Streamer",
      auth_title_register: "Daftar Akun Baru Streamer",
      auth_desc: "Login agar overlay dan saluran streaming Anda tersimpan aman.",
      auth_user_label_login: "Username atau Email",
      auth_user_label_register: "Username Baru (3-20 Karakter)",
      auth_email_label: "Alamat Email Aktif",
      auth_send_code_btn: "Kirim Kode 📨",
      auth_code_label: "Kode Verifikasi 6-Digit",
      auth_code_help: "Periksa kotak masuk/spam email Anda. Kode berlaku 15 menit.",
      auth_pass_label: "Password (Min. 4 karakter)",
      auth_submit_login: "Masuk ke Akun 🚀",
      auth_submit_register: "Daftar & Buat Akun 🎉",

      // Dialogs & Popups
      dialog_ok: "OK",
      dialog_cancel: "Batal",
      dialog_confirm: "Ya, Lanjutkan",
      dialog_info: "Informasi",
      dialog_success: "Berhasil",
      dialog_warning: "Perhatian",
      dialog_error: "Terjadi Kesalahan"
    },
    en: {
      // Navigation & Header
      nav_dashboard: "← Chat Dashboard",
      nav_setup_channels: "Channels Setup",
      nav_obs_mode: "OBS Mode",
      nav_overlay_studio: "Overlay Studio 🎨",
      nav_roadmap: "Roadmap 💡",
      nav_donate: "Support ☕",
      nav_test_demo: "Test Demo",
      nav_login: "🔐 Login / Account",
      nav_privacy: "🛡️ Privacy",
      nav_wakelock_on: "SCREEN AWAKE (Anti-Sleep ON)",
      nav_wakelock_sub: "Screen sleep prevented",
      nav_wakelock_off: "NORMAL SCREEN (Auto-Sleep)",
      nav_wakelock_sub_off: "Standard timeout",

      // Filters
      filter_all: "All Chats",
      filter_twitch: "Twitch",
      filter_youtube: "YouTube",
      filter_tiktok: "TikTok",

      // Overlay Studio Header & Actions
      studio_title: "StreamPulse OVERLAY STUDIO",
      studio_save: "💾 Save Settings",
      studio_login_btn: "🔐 Login / Register",
      studio_logout_btn: "Logout",
      studio_guest_badge: "preview (guest)",
      studio_obs_ready: "✓ Ready for OBS Studio",
      studio_obs_login_req: "🔒 Login Required",
      studio_obs_copy_btn: "📋 Copy Link",
      studio_obs_copied: "✓ Copied!",
      studio_guest_obs_url: "🔒 Logged-in Streamers Only - Please Login/Register to View & Copy OBS URL",
      studio_guest_lock_title: "🔒 OBS Overlay Cloud Manager Locked",
      studio_guest_lock_desc: "You are currently in Guest Mode. Feel free to tweak visual styles and view the live canvas preview, but saving configurations, managing 3 cloud slots, and copying the OBS Browser Source URL require an account.",
      studio_guest_lock_btn: "🔐 Login / Create Account Now",

      // Studio Customizer Sections
      sec_channels: "📡 Live Stream Channels",
      sec_visual: "🎨 Chat Visual Style & Theme",
      sec_elements: "⚙️ Visual Elements & Moderation",
      sec_custom_css: "💻 Custom CSS Editor",
      sec_custom_js: "⚡ Custom JavaScript (Optional)",
      sec_theme: "Overlay Theme",
      sec_font_size: "Font Size",
      sec_hide_delay: "Auto-Hide Delay",
      sec_max_messages: "Maximum Chat Bubbles on OBS Canvas",
      sec_mask_links: "Auto-Sensor Links",
      sec_mask_links_sub: "Replace URLs in chat messages with [LINK] on OBS",
      sec_show_badges: "Show Twitch & YouTube Badges (👑 Mod, VIP, Sub)",
      sec_show_avatars: "Show Viewer Profile Avatars",
      sec_show_emotes: "Show 7TV & Twitch Emotes",
      sec_show_alerts: "Show Event Alert Banners (Raid, Cheer, Sub, Super Chat)",

      // Auth Modal
      auth_login_tab: "Sign In (Login)",
      auth_register_tab: "Create New Account",
      auth_title_login: "Streamer Sign In",
      auth_title_register: "Create Streamer Account",
      auth_desc: "Sign in to keep your overlay presets and channel credentials securely synced.",
      auth_user_label_login: "Username or Email",
      auth_user_label_register: "New Username (3-20 chars)",
      auth_email_label: "Active Email Address",
      auth_send_code_btn: "Send Code 📨",
      auth_code_label: "6-Digit Verification Code",
      auth_code_help: "Check your email inbox or spam folder. Valid for 15 minutes.",
      auth_pass_label: "Password (Min. 4 chars)",
      auth_submit_login: "Sign In 🚀",
      auth_submit_register: "Register & Create Account 🎉",

      // Dialogs & Popups
      dialog_ok: "OK",
      dialog_cancel: "Cancel",
      dialog_confirm: "Yes, Continue",
      dialog_info: "Information",
      dialog_success: "Success",
      dialog_warning: "Attention",
      dialog_error: "Error Occurred"
    }
  };

  let currentLang = localStorage.getItem('streampulse_lang') || 'id';

  function t(key) {
    const langDict = translations[currentLang] || translations.id;
    return langDict[key] || translations.id[key] || key;
  }

  function applyLanguage(lang) {
    currentLang = (lang === 'en') ? 'en' : 'id';
    localStorage.setItem('streampulse_lang', currentLang);
    document.documentElement.setAttribute('lang', currentLang);

    // Update Language Toggle Button in Header
    document.querySelectorAll('.btn-lang-toggle').forEach(btn => {
      if (currentLang === 'id') {
        btn.innerHTML = `<span style="font-size:1.1rem; line-height:1;">🇮🇩</span> <span>ID</span>`;
        btn.title = "Ganti Bahasa ke English (Switch to English)";
      } else {
        btn.innerHTML = `<span style="font-size:1.1rem; line-height:1;">🇬🇧</span> <span>EN</span>`;
        btn.title = "Switch Language to Bahasa Indonesia";
      }
    });

    // Translate all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const translated = t(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          if (el.hasAttribute('placeholder')) el.setAttribute('placeholder', translated);
        } else {
          el.textContent = translated;
        }
      }
    });

    // Translate tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // Fire custom event
    window.dispatchEvent(new CustomEvent('language_changed', { detail: { lang: currentLang } }));
  }

  // =========================================================================
  // 2. GLASSMORPHISM POPUP MODAL (REPLACING BROWSER ALERT & CONFIRM)
  // =========================================================================
  let popupOverlay = null;
  let popupCard = null;
  let popupIcon = null;
  let popupTitle = null;
  let popupMsg = null;
  let popupActions = null;

  function initPopupDom() {
    if (document.getElementById('spPopupOverlay')) {
      popupOverlay = document.getElementById('spPopupOverlay');
      popupCard = document.getElementById('spPopupCard');
      popupIcon = document.getElementById('spPopupIcon');
      popupTitle = document.getElementById('spPopupTitle');
      popupMsg = document.getElementById('spPopupMsg');
      popupActions = document.getElementById('spPopupActions');
      return;
    }

    popupOverlay = document.createElement('div');
    popupOverlay.id = 'spPopupOverlay';
    popupOverlay.className = 'sp-popup-overlay';
    popupOverlay.innerHTML = `
      <div id="spPopupCard" class="sp-popup-card">
        <div id="spPopupIcon" class="sp-popup-icon-wrap">💡</div>
        <h3 id="spPopupTitle" class="sp-popup-title">Informasi</h3>
        <p id="spPopupMsg" class="sp-popup-message"></p>
        <div id="spPopupActions" class="sp-popup-actions"></div>
      </div>
    `;

    document.body.appendChild(popupOverlay);
    popupCard = document.getElementById('spPopupCard');
    popupIcon = document.getElementById('spPopupIcon');
    popupTitle = document.getElementById('spPopupTitle');
    popupMsg = document.getElementById('spPopupMsg');
    popupActions = document.getElementById('spPopupActions');
  }

  function spAlert(message, title, type = 'info') {
    return new Promise((resolve) => {
      initPopupDom();
      const defTitle = type === 'success' ? t('dialog_success') : (type === 'error' ? t('dialog_error') : (type === 'warning' ? t('dialog_warning') : t('dialog_info')));
      popupTitle.textContent = title || defTitle;
      popupMsg.innerHTML = String(message || '').replace(/\n/g, '<br>');

      popupCard.className = `sp-popup-card type-${type}`;
      const icons = {
        success: '🎉',
        error: '⚠️',
        warning: '⚡',
        info: '💡'
      };
      popupIcon.textContent = icons[type] || '💡';

      popupActions.innerHTML = `
        <button id="spPopupBtnOk" class="sp-popup-btn primary">${t('dialog_ok')}</button>
      `;

      popupOverlay.classList.add('show');

      const btnOk = document.getElementById('spPopupBtnOk');
      btnOk.focus();

      function closePopup() {
        popupOverlay.classList.remove('show');
        btnOk.removeEventListener('click', onOk);
        resolve(true);
      }

      function onOk() { closePopup(); }
      btnOk.addEventListener('click', onOk);
    });
  }

  function spConfirm(message, title, type = 'warning') {
    return new Promise((resolve) => {
      initPopupDom();
      popupTitle.textContent = title || t('dialog_warning');
      popupMsg.innerHTML = String(message || '').replace(/\n/g, '<br>');

      popupCard.className = `sp-popup-card type-${type}`;
      popupIcon.textContent = type === 'danger' ? '🗑️' : '❓';

      popupActions.innerHTML = `
        <button id="spPopupBtnCancel" class="sp-popup-btn secondary">${t('dialog_cancel')}</button>
        <button id="spPopupBtnConfirm" class="sp-popup-btn ${type === 'danger' ? 'danger' : 'primary'}">${t('dialog_confirm')}</button>
      `;

      popupOverlay.classList.add('show');

      const btnCancel = document.getElementById('spPopupBtnCancel');
      const btnConfirm = document.getElementById('spPopupBtnConfirm');
      btnConfirm.focus();

      function finish(res) {
        popupOverlay.classList.remove('show');
        resolve(res);
      }

      btnCancel.onclick = () => finish(false);
      btnConfirm.onclick = () => finish(true);
    });
  }

  // Toast Notification Engine
  let toastContainer = null;
  function spToast(message, type = 'info', duration = 3200) {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'sp-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `sp-toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `
      <span style="font-size:1.1rem; font-weight:800;">${icons[type] || '•'}</span>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  // Override browser native alert and confirm gracefully
  window.spAlert = spAlert;
  window.spConfirm = spConfirm;
  window.spToast = spToast;
  window.t = t;
  window.setLanguage = applyLanguage;

  // Seamless drop-in replacement for window.alert
  window.alert = function (msg) {
    const isSuccess = /berhasil|selamat|sukses|ready|tersalin|copied|success/i.test(String(msg));
    const isError = /gagal|salah|error|terlalu banyak|tolak|failed/i.test(String(msg));
    spAlert(msg, isSuccess ? t('dialog_success') : (isError ? t('dialog_error') : t('dialog_info')), isSuccess ? 'success' : (isError ? 'error' : 'info'));
  };

  // Seamless drop-in helper for confirm
  window.confirmAsync = spConfirm;

  // =========================================================================
  // 3. PASSWORD SHOW / HIDE VISIBILITY TOGGLE (EYE ICON)
  // =========================================================================
  function initPasswordToggles() {
    // Find all password inputs and wrap them if not wrapped yet
    document.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.dataset.pwToggleInit) return;
      input.dataset.pwToggleInit = 'true';

      let wrap = input.closest('.password-input-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'password-input-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
      }

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn-password-toggle';
      toggleBtn.title = 'Tampilkan / Sembunyikan Password';
      toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;

      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        if (isPassword) {
          // Eye Off (Sembunyikan)
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          `;
        } else {
          // Eye On (Tampilkan)
          toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          `;
        }
      });

      wrap.appendChild(toggleBtn);
    });
  }

  // Boot Initialization on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initPopupDom();
    initPasswordToggles();

    // Attach click listener for any language switch buttons
    document.querySelectorAll('.btn-lang-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = currentLang === 'id' ? 'en' : 'id';
        applyLanguage(next);
        spToast(next === 'en' ? 'Language switched to English 🇬🇧' : 'Bahasa dialihkan ke Indonesia 🇮🇩', 'info');
      });
    });

    applyLanguage(currentLang);
  });

  // Re-scan for dynamic inputs
  window.initPasswordToggles = initPasswordToggles;
})();
