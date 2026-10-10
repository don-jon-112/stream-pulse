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
      page_title: "StreamPulse MultiChat - Livestream Monitor Terpadu",
      btn_exit_obs: "✕ Keluar OBS Mode",
      wss_live: "WSS Live",
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

      // Filters & Toolbar
      filter_all: "Semua Chat",
      filter_twitch: "Twitch",
      filter_youtube: "YouTube",
      filter_tiktok: "TikTok",
      filter_events: "Event Saja",
      density_comfortable: "STD",
      density_compact: "RAPAT",
      order_newest_top: "Terbaru di Atas",
      order_newest_bottom: "Terbaru di Bawah",
      ph_search_chat: "Cari chat...",
      tip_clear_screen: "Bersihkan chat lama dari layar agar enteng",

      // Empty State & Alerts
      empty_chat_title: "Menunggu Chat Masuk...",
      empty_chat_desc: "Klik tombol \"Atur Channel\" di pojok kanan atas untuk memasukkan username Twitch, YouTube, atau TikTok LIVE. Anda juga dapat mencoba klik \"Test Demo\" untuk simulasi event secara instan!",
      scroll_paused: "⬇️ Scroll Dijeda (Ada Chat Baru Masuk) — Ketuk untuk Mengikuti",

      // KPI & Recorder
      stat_total_chats: "Total Chat",
      stat_all_events: "Semua Event",
      stat_total_gifts: "Hadiah / Donasi",
      recorder_title: "Rekaman Event (Activity)",
      tip_export_json: "Download Data JSON",
      tip_export_csv: "Download Data CSV",
      tip_clear_history: "Hapus Riwayat",
      empty_recorder_desc: "Setiap Gift TikTok, Super Chat YouTube, Subs, dan Bits Twitch akan otomatis terekam di sini secara kronologis.",

      // Mobile Bottom Nav
      mob_live_chat: "Live Chat",
      mob_event_log: "Event Log",
      mob_channel: "Channel",
      mob_donate: "Donasi ☕",

      // Modal Setup
      setup_modal_title: "Pengaturan Channel Monitor",
      label_twitch: "🟣 Twitch Channel",
      tip_twitch: "Contoh: shroud atau windah_basudara",
      ph_twitch_input: "Masukkan username Twitch...",
      label_youtube: "🔴 YouTube Live Stream",
      tip_youtube: "Handle (@channel) atau URL Live",
      ph_youtube_input: "@NamaChannel atau URL live...",
      label_tiktok: "🎵 TikTok LIVE Username",
      tip_tiktok: "Username akun yang sedang live (tanpa @)",
      ph_tiktok_input: "Username TikTok live...",
      btn_cancel: "Batal",
      btn_save_connect: "Simpan & Hubungkan",
      setup_bottom_tip: "💡 Tips: Anda bisa memantau ketiga platform sekaligus atau hanya platform tertentu saja. Kosongkan kolom jika tidak ingin menghubungkan platform tersebut.",

      // Modal Demo
      demo_title: "Simulasi & Uji Coba Event",
      demo_desc: "Pilih salah satu event di bawah untuk menguji aliran chat, kartu event, dan animasi secara langsung:",
      btn_done: "Selesai",

      // Modal Donate
      donate_modal_title: "Dukung StreamPulse (100% Gratis)",
      donate_h2: "Suka Menggunakan StreamPulse?",
      btn_close: "Tutup",

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

      // Studio Slots & Channels
      studio_slots_title: "✨ Slot OBS Overlay Cloud",
      studio_quota_label: "Kuota Pengguna:",
      studio_btn_new_slot: "+ Generate URL Baru",
      studio_editing_badge: "Sedang Mengedit ID:",
      sec_channels: "📡 Saluran Live Stream",
      sec_channels_tip: "💡 Bebas mengisi salah satu platform saja (misal hanya Twitch) atau gabungan ketiganya. Perubahan username langsung terhubung otomatis ke live preview di sebelah kanan.",
      label_twitch_channel: "Twitch Channel",
      label_youtube_channel: "YouTube Live Stream",
      label_tiktok_channel: "TikTok LIVE Username",
      ph_twitch: "Contoh: shroud (tanpa #)",
      ph_youtube: "Contoh: @Streamer / URL Live",
      ph_tiktok: "Contoh: streamer_tiktok (tanpa @)",
      btn_save_channels: "💾 Simpan Saluran",
      status_channel_synced: "✓ Tersinkron",

      // Studio Customizer Sections
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
      page_title: "StreamPulse MultiChat - Unified Livestream Monitor",
      btn_exit_obs: "✕ Exit OBS Mode",
      wss_live: "WSS Live",
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

      // Filters & Toolbar
      filter_all: "All Chats",
      filter_twitch: "Twitch",
      filter_youtube: "YouTube",
      filter_tiktok: "TikTok",
      filter_events: "Events Only",
      density_comfortable: "STD",
      density_compact: "COMPACT",
      order_newest_top: "Newest on Top",
      order_newest_bottom: "Newest at Bottom",
      ph_search_chat: "Search chat...",
      tip_clear_screen: "Clear old chat messages to save memory",

      // Empty State & Alerts
      empty_chat_title: "Waiting for Incoming Chat...",
      empty_chat_desc: "Click \"Channels Setup\" at the top to enter your Twitch, YouTube, or TikTok LIVE username. You can also click \"Test Demo\" to simulate live events instantly!",
      scroll_paused: "⬇️ Auto-Scroll Paused (New chat arrived) — Tap to follow",

      // KPI & Recorder
      stat_total_chats: "Total Chats",
      stat_all_events: "All Events",
      stat_total_gifts: "Gifts / Donations",
      recorder_title: "Event Activity Log",
      tip_export_json: "Download JSON Data",
      tip_export_csv: "Download CSV Data",
      tip_clear_history: "Clear History",
      empty_recorder_desc: "Every TikTok Gift, YouTube Super Chat, Twitch Sub and Bits event will be recorded chronologically here.",

      // Mobile Bottom Nav
      mob_live_chat: "Live Chat",
      mob_event_log: "Event Log",
      mob_channel: "Channels",
      mob_donate: "Donate ☕",

      // Modal Setup
      setup_modal_title: "Monitor Channels Setup",
      label_twitch: "🟣 Twitch Channel",
      tip_twitch: "e.g.: shroud or streamer_name",
      ph_twitch_input: "Enter Twitch username...",
      label_youtube: "🔴 YouTube Live Stream",
      tip_youtube: "Handle (@channel) or Live URL",
      ph_youtube_input: "@ChannelName or live stream URL...",
      label_tiktok: "🎵 TikTok LIVE Username",
      tip_tiktok: "Username currently streaming live (without @)",
      ph_tiktok_input: "TikTok LIVE username...",
      btn_cancel: "Cancel",
      btn_save_connect: "Save & Connect",
      setup_bottom_tip: "💡 Tips: You can monitor all three platforms together or just a specific one (e.g. Twitch only). Leave unused fields blank.",

      // Modal Demo
      demo_title: "Event Simulation & Demo",
      demo_desc: "Select any event below to test chat feed, event cards, and animations in real-time:",
      btn_done: "Done",

      // Modal Donate
      donate_modal_title: "Support StreamPulse (100% Free)",
      donate_h2: "Enjoying StreamPulse?",
      btn_close: "Close",

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

      // Studio Slots & Channels
      studio_slots_title: "✨ OBS Overlay Cloud Slots",
      studio_quota_label: "User Quota:",
      studio_btn_new_slot: "+ Generate New URL",
      studio_editing_badge: "Currently Editing ID:",
      sec_channels: "📡 Live Stream Channels",
      sec_channels_tip: "💡 You can monitor just one platform (e.g., Twitch only) or all three together. Changes are automatically updated in the live preview on the right.",
      label_twitch_channel: "Twitch Channel",
      label_youtube_channel: "YouTube Live Stream",
      label_tiktok_channel: "TikTok LIVE Username",
      ph_twitch: "e.g.: shroud (without #)",
      ph_youtube: "e.g.: @Streamer / Live URL",
      ph_tiktok: "e.g.: streamer_tiktok (without @)",
      btn_save_channels: "💾 Save Channels",
      status_channel_synced: "✓ Synced",

      // Studio Customizer Sections
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

  // Bidirectional Text Phrase Dictionary for Universal Matching
  const phrasePairs = [
    // Header & Wakelock
    ["LAYAR AKTIF (Anti-Sleep ON)", "SCREEN AWAKE (Anti-Sleep ON)"],
    ["Layar Dicegah Mati", "Screen sleep prevented"],
    ["LAYAR NORMAL (Auto-Sleep)", "NORMAL SCREEN (Auto-Sleep)"],
    ["Bisa Mati Otomatis", "Standard timeout"],
    ["Layar Tidur Normal", "Normal Screen Sleep"],
    ["Fitur Anti-Mati Nonaktif", "Anti-Sleep Disabled"],
    ["✕ Keluar OBS Mode", "✕ Exit OBS Mode"],
    ["Atur Channel", "Channels Setup"],
    ["OBS Mode", "OBS Mode"],
    ["Overlay Studio 🎨", "Overlay Studio 🎨"],
    ["Roadmap 💡", "Roadmap 💡"],
    ["Dukung ☕", "Support ☕"],
    ["Donasi ☕", "Donate ☕"],
    ["Test Demo", "Test Demo"],
    ["Login / Akun", "Login / Account"],
    ["🔐 Login / Akun", "🔐 Login / Account"],
    ["🛡️ Privacy", "🛡️ Privacy"],

    // Toolbar & Filters
    ["Semua Chat", "All Chats"],
    ["Event Saja", "Events Only"],
    ["Terbaru di Atas", "Newest on Top"],
    ["Terbaru di Bawah", "Newest at Bottom"],
    ["Total Chat", "Total Chats"],
    ["Semua Event", "All Events"],
    ["Hadiah / Donasi", "Gifts / Donations"],
    ["Rekaman Event (Activity)", "Event Activity Log"],
    ["Download Data JSON", "Download JSON Data"],
    ["Download Data CSV", "Download CSV Data"],
    ["Hapus Riwayat", "Clear History"],
    ["Menunggu Chat Masuk...", "Waiting for Incoming Chat..."],
    ["Pengaturan Channel Monitor", "Monitor Channels Setup"],
    ["Batal", "Cancel"],
    ["Simpan & Hubungkan", "Save & Connect"],
    ["Simulasi & Uji Coba Event", "Event Simulation & Demo"],
    ["Selesai", "Done"],
    ["Tutup", "Close"],
    ["Dukung StreamPulse (100% Gratis)", "Support StreamPulse (100% Free)"],
    ["Suka Menggunakan StreamPulse?", "Enjoying StreamPulse?"],
    ["Traktir Kopi di SociaBuzz (joo_nathan)", "Buy a Coffee on SociaBuzz (joo_nathan)"],

    // Studio Customizer
    ["Simpan Pengaturan", "Save Settings"],
    ["💾 Simpan Pengaturan", "💾 Save Settings"],
    ["Login / Daftar Akun", "Login / Register"],
    ["🔐 Login / Daftar Akun", "🔐 Login / Register"],
    ["Slot OBS Overlay Cloud", "OBS Overlay Cloud Slots"],
    ["✨ Slot OBS Overlay Cloud", "✨ OBS Overlay Cloud Slots"],
    ["+ Generate URL Baru", "+ Generate New URL"],
    ["Sedang Mengedit ID:", "Currently Editing ID:"],
    ["Saluran Live Stream", "Live Stream Channels"],
    ["📡 Saluran Live Stream", "📡 Live Stream Channels"],
    ["Twitch Channel", "Twitch Channel"],
    ["YouTube Live Stream", "YouTube Live Stream"],
    ["TikTok LIVE Username", "TikTok LIVE Username"],
    ["Simpan Saluran", "Save Channels"],
    ["💾 Simpan Saluran", "💾 Save Channels"],
    ["Tersinkron", "Synced"],
    ["✓ Tersinkron", "✓ Synced"],
    ["Gaya & Tampilan Chat", "Chat Visual Style & Theme"],
    ["🎨 Gaya & Tampilan Chat", "🎨 Chat Visual Style & Theme"],
    ["Tema Overlay", "Overlay Theme"],
    ["Ukuran Font", "Font Size"],
    ["Durasi Pesan Menghilang (Auto-Hide)", "Message Auto-Hide Delay"],
    ["Selalu Tampil (0s)", "Always Visible (0s)"],
    ["Batas Maksimal Bubble Chat di Layar OBS", "Max Chat Bubbles on OBS Screen"],
    ["Elemen Tampilan & Filter", "Visual Elements & Moderation"],
    ["⚙️ Elemen Tampilan & Filter", "⚙️ Visual Elements & Moderation"],
    ["Sensor Link Otomatis", "Auto-Sensor Links"],
    ["Ubah URL di chat menjadi [LINK] di layar OBS", "Mask URLs in chat as [LINK] on OBS"],
    ["Tampilkan Badge Twitch & YouTube (👑 Mod, VIP, Sub)", "Show Twitch & YouTube Badges (👑 Mod, VIP, Sub)"],
    ["Tampilkan Foto Profil / Avatar Viewer", "Show Viewer Profile Avatars"],
    ["Tampilkan Emote 7TV & Twitch", "Show 7TV & Twitch Emotes"],
    ["Tampilkan Banner Alert (Raid, Cheer, Sub, Super Chat)", "Show Event Alert Banners (Raid, Cheer, Sub, Super Chat)"],
    ["Custom CSS Editor", "Custom CSS Editor"],
    ["💻 Custom CSS Editor", "💻 Custom CSS Editor"],
    ["Custom JavaScript (Opsional)", "Custom JavaScript (Optional)"],
    ["⚡ Custom JavaScript (Opsional)", "⚡ Custom JavaScript (Optional)"],
    ["Salin Link", "Copy Link"],
    ["📋 Salin Link", "📋 Copy Link"],
    ["Tersalin!", "Copied!"],
    ["✓ Tersalin!", "✓ Copied!"],
    ["Live Preview (Transparan di OBS)", "Live Preview (Transparent in OBS)"],
    ["👁️ Live Preview (Transparan di OBS)", "👁️ Live Preview (Transparent in OBS)"],
    ["Test Chat Biasa", "Test Normal Chat"],
    ["💬 Test Chat Biasa", "💬 Test Normal Chat"],
    ["Test Chat Link", "Test Link Chat"],
    ["🔗 Test Chat Link", "🔗 Test Link Chat"],
    ["Test VIP Twitch", "Test Twitch VIP"],
    ["💎 Test VIP Twitch", "💎 Test Twitch VIP"],
    ["Test Alert Sub", "Test Sub Alert"],
    ["🎉 Test Alert Sub", "🎉 Test Sub Alert"],
    ["Preview OBS Canvas", "Preview OBS Canvas"],
    ["Masuk (Login)", "Sign In (Login)"],
    ["Daftar Akun Baru", "Create New Account"],
    ["Masuk Akun Streamer", "Streamer Sign In"],
    ["Daftar Akun Baru Streamer", "Create Streamer Account"],
    ["Masuk ke Akun 🚀", "Sign In 🚀"],
    ["Daftar & Buat Akun 🎉", "Register & Create Account 🎉"]
  ];

  const placeholderPairs = [
    ["Cari chat...", "Search chat..."],
    ["Masukkan username Twitch...", "Enter Twitch username..."],
    ["@NamaChannel atau URL live...", "@ChannelName or live stream URL..."],
    ["Username TikTok live...", "TikTok LIVE username..."],
    ["Contoh: shroud (tanpa #)", "e.g.: shroud (without #)"],
    ["Contoh: @Streamer / URL Live", "e.g.: @Streamer / Live URL"],
    ["Contoh: streamer_tiktok (tanpa @)", "e.g.: streamer_tiktok (without @)"],
    ["Password akun...", "Account password..."]
  ];

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

    // 1. Translate all elements with data-i18n attribute
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

    // 2. Translate placeholders with data-i18n-ph
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (key) el.setAttribute('placeholder', t(key));
    });

    // 3. Translate tooltips with data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // 4. Translate raw text elements via bidirectional phrasePairs
    const isEn = (currentLang === 'en');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.hasAttribute('data-i18n')) continue;
      const text = node.nodeValue.trim();
      if (!text) continue;

      for (const [idText, enText] of phrasePairs) {
        if (isEn && text === idText) {
          node.nodeValue = node.nodeValue.replace(idText, enText);
          break;
        } else if (!isEn && text === enText) {
          node.nodeValue = node.nodeValue.replace(enText, idText);
          break;
        }
      }
    }

    // 5. Translate raw input placeholders via placeholderPairs
    document.querySelectorAll('input, textarea').forEach(input => {
      if (input.hasAttribute('data-i18n-ph')) return;
      const ph = input.getAttribute('placeholder');
      if (!ph) return;
      for (const [idPh, enPh] of placeholderPairs) {
        if (isEn && ph === idPh) {
          input.setAttribute('placeholder', enPh);
          break;
        } else if (!isEn && ph === enPh) {
          input.setAttribute('placeholder', idPh);
          break;
        }
      }
    });

    // Fire custom event for dynamic components
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
