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
      tip_chat_density: "Kerapatan Tampilan Chat",
      order_newest_top: "Terbaru di Atas",
      order_newest_bottom: "Terbaru di Bawah",
      tip_order_toggle: "Ubah urutan chat: Terbaru di Atas atau Terbaru di Bawah",
      tip_chat_limit: "Batas maksimal chat di layar untuk mencegah web lag / boros RAM",
      limit_30: "30 (Super Ringan)",
      limit_50: "50 (Hemat RAM)",
      limit_100: "100 (Standar)",
      limit_200: "200 (Banyak)",
      tip_clear_screen: "Bersihkan chat lama dari layar agar enteng",
      ph_search_chat: "Cari chat...",

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
      tip_redeem_desc: "<div style=\"font-weight: 700; color: #c084fc; margin-bottom: 2px;\">💠 Tips Deteksi Channel Points Redeem:</div>Secara bawaan Twitch IRC hanya menyiarkan redeem yang disertai pesan. Agar reward Anda (seperti <em>Minum Air, Sound Alert, dll.</em>) terdeteksi otomatis, aktifkan opsi <strong>\"Require viewer to enter text\" (Wajibkan penonton memasukkan teks)</strong> di Twitch Dashboard saat membuat reward.",
      oauth_summary: "⚙️ Opsi Lanjutan: Twitch OAuth Token (Deteksi Redeem Tanpa Teks)",
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
      demo_twitch_title: "🟣 TWITCH SIMULATION",
      demo_youtube_title: "🔴 YOUTUBE SIMULATION",
      demo_tiktok_title: "🎵 TIKTOK LIVE SIMULATION",
      demo_badge_5: "5 Event",
      demo_badge_6: "6 Event",
      demo_test_chat: "Test Chat",
      demo_tier1_sub: "Tier 1 Sub",
      demo_500_bits: "500 Bits",
      demo_points_redeem: "Points Redeem",
      demo_5_gift_subs: "5 Gift Subs",
      demo_superchat: "Super Chat 50k",
      demo_supersticker: "Super Sticker",
      demo_new_member: "New Member",
      demo_5_gift_members: "5 Gift Members",
      demo_200_jewels: "200 Jewels",
      demo_gift_rose: "Gift Mawar x50",
      demo_lion_whale: "Singa / Paus 💎",
      demo_live_sub: "LIVE Sub",
      demo_50_likes: "Tap 50 Likes",
      btn_done: "Selesai",

      // Modal Donate & Donate Page
      donate_modal_title: "Dukung StreamPulse (100% Gratis)",
      donate_h1: "Dukung StreamPulse",
      donate_h2: "Suka Menggunakan StreamPulse?",
      donate_desc_modal: "Aplikasi ini bebas digunakan secara <strong>gratis, tanpa batas, dan tanpa iklan</strong> untuk semua streamer. Jika web ini bermanfaat bagi siaran livestream Anda, Anda dapat membantu mendukung biaya sewa server VPS agar tetap aktif 24/7.",
      donate_desc_page: "StreamPulse adalah aplikasi monitor livestream multi-platform yang disediakan secara <strong>100% gratis & tanpa iklan</strong>. Dukungan Anda membantu membayar sewa server VPS agar aplikasi ini selalu online 24/7 untuk semua streamer.",
      donate_modal_perk1: "Membantu biaya operasional server VPS & tunnel agar selalu online",
      donate_modal_perk2: "Mendukung pengembangan fitur baru (emotes, overlay OBS, alert)",
      donate_modal_perk3: "Dukungan Anda berapapun sangat berarti bagi kreator",
      donate_perk_1: "Biaya sewa VPS cloud, traffic tunnel, & domain",
      donate_perk_2: "Pengembangan fitur emote Twitch, 7TV, alert, & OBS overlay",
      donate_perk_3: "Donasi berapapun (mulai dari Rp 1.000) sangat berarti!",
      donate_cta_btn: "Traktir Kopi di SociaBuzz (joo_nathan)",
      donate_payment_note: "Mendukung QRIS, GoPay, OVO, Dana, ShopeePay, & Transfer Bank",
      donate_back_link: "← Kembali ke Dashboard StreamPulse",
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
      studio_guest_lock_desc: "Anda saat ini berada dalam mode <strong>Tamu (Guest)</strong>. Anda dapat mencoba kustomisasi visual & live preview, namun untuk <strong>menyimpan konfigurasi</strong>, <strong>mengelola 3 slot cloud</strong>, dan <strong>menyalin URL OBS</strong>, silakan masuk ke akun Anda.",
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
      desc_custom_css: "Ubah warna font, shadow, border radius, atau animasi sesuai gaya streaming Anda:",
      ph_custom_css: "/* Masukkan CSS kustom Anda di sini */\n.overlay-item {\n  border-radius: 12px;\n}",
      sec_custom_js: "⚡ Custom JavaScript (Opsional)",
      ph_custom_js: "// Kode JS kustom yang dieksekusi saat overlay dimuat",
      sec_theme: "Tema Overlay",
      opt_theme_glass: "💎 Glassmorphism Dark (Default)",
      opt_theme_minimal: "⬛ Minimalist Semi-Transparent",
      opt_theme_cyberpunk: "⚡ Cyberpunk Neon Glow",
      opt_theme_light: "⚪ Clean Light Paper",
      sec_font_size: "Ukuran Font",
      sec_hide_delay: "Durasi Pesan Menghilang (Auto-Hide)",
      sec_max_messages: "Batas Maksimal Bubble Chat di Layar OBS",
      sec_mask_links: "Sensor Link Otomatis",
      sec_mask_links_sub: "Ubah URL di chat menjadi <code>[LINK]</code> di layar OBS",
      sec_show_badges: "Tampilkan Badge Twitch & YouTube (👑 Mod, VIP, Sub)",
      sec_show_avatars: "Tampilkan Foto Profil / Avatar Viewer",
      sec_show_emotes: "Tampilkan Emote 7TV & Twitch",
      sec_show_alerts: "Tampilkan Banner Alert (Raid, Cheer, Sub, Super Chat)",

      // Studio OBS Link & Live Preview
      obs_link_title: "🔗 Link OBS Browser Source Anda",
      obs_help_text: "💡 <em>Di OBS Studio: Tambah Source → pilih <strong>Browser</strong> → tempel link di atas → atur Width: 600, Height: 800.</em>",
      live_preview_title: "👁️ Live Preview (Transparan di OBS)",
      btn_test_normal_chat: "💬 Test Chat Biasa",
      btn_test_link_chat: "🔗 Test Chat Link",
      btn_test_twitch_vip: "💎 Test VIP Twitch",
      btn_test_alert_sub: "🎉 Test Alert Sub",
      preview_canvas_badge: "Preview OBS Canvas",

      // Studio & App Auth Modal
      auth_login_tab: "Masuk (Login)",
      auth_register_tab: "Daftar Akun Baru",
      auth_title_login: "Masuk Akun Streamer",
      auth_title_register: "Daftar Akun Baru Streamer",
      auth_desc: "Login agar overlay dan saluran streaming Anda tersimpan aman.",
      auth_user_label_login: "Username / ID",
      auth_user_label_register: "Username Baru (3-20 Karakter)",
      ph_auth_username: "Contoh: gamer_joo",
      auth_email_label: "Alamat Email Aktif",
      ph_auth_email: "streamer@gmail.com",
      auth_send_code_btn: "Kirim Kode 📨",
      auth_code_label: "Kode Verifikasi 6-Digit",
      auth_code_help: "Periksa kotak masuk/spam email Anda. Kode berlaku 15 menit.",
      auth_pass_label: "Password (Min. 4 karakter)",
      ph_auth_pass: "Password akun...",
      auth_submit_login: "Masuk ke Akun 🚀",
      auth_submit_register: "Daftar & Buat Akun 🎉",

      // Auth Cloud Notice & Guest Info
      auth_connected_to: "Tersambung ke Akun",
      auth_manage_obs: "Kelola OBS Overlay",
      auth_cloud_config_desc: "Konfigurasi saluran Anda tersimpan otomatis di cloud. Token Twitch dienkripsi dengan standar militer AES-256-GCM.",
      auth_guest_mode_title: "Mode Tamu (Belum Login)",
      auth_guest_mode_desc: "Sebagai tamu, input saluran Anda selalu default kosong dan hanya aktif di sesi ini.",
      auth_guest_login_link: "Login / Buat Akun",
      auth_guest_mode_desc_end: "untuk menyimpan channel & mengamankan token Twitch secara permanen.",

      // Studio Slots & Sliders Dynamic
      active_badge_text: "Aktif",
      studio_no_slots_msg: "Belum ada slot overlay aktif. Klik \"+ Generate URL Baru\" di atas!",
      studio_slots_used_text: "Slot Terpakai",
      studio_guest_help_text: "🔒 <em>Tombol Simpan, Salin URL, dan Kuota 3 Slot OBS hanya tersedia untuk streamer yang telah login. Silakan daftar/login untuk menggunakan fitur ini.</em>",
      btn_edit_slot_tip: "Muat dan edit konfigurasi slot ini",
      btn_overwrite_slot_tip: "Timpa (overwrite) slot ini dengan pengaturan yang sedang Anda edit saat ini",
      btn_delete_slot_tip: "Hapus slot ini untuk mengosongkan kuota",
      toast_logged_out_guest: "Telah keluar dari akun. Mode Tamu aktif.",
      slider_always_visible: "Selalu Tampil (0s)",
      slider_seconds: "detik",
      slider_messages: "Pesan",

      // Privacy Page
      privacy_h1: "Kebijakan Privasi StreamPulse",
      privacy_date: "Terakhir diperbarui: Oktober 2026",
      privacy_intro: "StreamPulse berkomitmen untuk melindungi privasi Anda. Layanan kami dirancang untuk membantu para konten kreator dan streamer memantau chat serta mengelola OBS overlay tanpa melacak atau memperjualbelikan data pribadi Anda ke pihak manapun.",
      privacy_sec1_title: "🛡️ 1. Data yang Kami Kumpulkan",
      privacy_sec1_email: "<strong>Alamat Email:</strong> Digunakan secara eksklusif untuk verifikasi kepemilikan akun saat registrasi dan pemulihan akun. Kami tidak mengirimkan email spam atau buletin promosi.",
      privacy_sec1_username: "<strong>Nama Pengguna (Username):</strong> Identitas akun Anda untuk mengelola konfigurasi saluran dan slot overlay.",
      privacy_sec1_channels: "<strong>Nama Saluran Publik:</strong> Nama channel Twitch, YouTube, dan TikTok yang Anda pilih untuk dipantau secara publik.",
      privacy_sec1_oauth: "<strong>Token OAuth Twitch (Opsional):</strong> Digunakan untuk menangkap event interaktif (Channel Points Redeem). Token ini <strong>dienkripsi secara ketat menggunakan AES-256-GCM</strong> di server kami dan tidak pernah dibocorkan ke browser.",
      privacy_sec1_pass: "<strong>Kata Sandi:</strong> Dienkripsi menggunakan algoritma hashing memori keras mutakhir <strong>Argon2id</strong> dengan salt unik. Kami tidak dapat melihat kata sandi asli Anda.",
      privacy_sec2_title: "💬 2. Pemrosesan Data Chat & Live Stream",
      privacy_sec2_desc: "Pesan chat dari penonton Twitch, YouTube, dan TikTok diproses secara <em>real-time streaming</em> di perangkat/browser Anda menggunakan protokol WebSocket. StreamPulse <strong>tidak menyimpan riwayat isi chat penonton ke database permanen</strong>. Saat sesi streaming selesai atau browser ditutup, pesan chat langsung dibersihkan dari memori.",
      privacy_sec3_title: "🍪 3. Penggunaan Cookie & Penyimpanan Lokal",
      privacy_sec3_desc: "Kami hanya menggunakan <code>localStorage</code> dan <code>sessionStorage</code> di browser Anda untuk menyimpan token sesi login Anda dan preferensi tampilan (seperti tema gelap, ukuran font overlay). Kami tidak menggunakan cookie pelacak pihak ketiga atau iklan (No Third-Party Trackers).",
      privacy_sec4_title: "🔒 4. Keamanan & Enkripsi",
      privacy_sec4_desc: "Seluruh komunikasi data antara browser, OBS Studio, dan server kami dilindungi dengan enkripsi SSL/TLS (HTTPS & WSS). Kredensial sensitif disimpan terenkripsi dan terlindung dari akses tidak sah dengan mekanisme Rate Limiting.",
      privacy_danger_title: "⚠️ Penghapusan Akun & Seluruh Data (Data Deletion)",
      privacy_danger_desc: "Sesuai dengan hak privasi pengguna (GDPR Compliance), Anda berhak menghapus akun Anda kapan saja. Jika Anda menghapus akun, seluruh data profil Anda, kredensial yang tersimpan, dan ketiga slot OBS Overlay Anda akan <strong>dihapus secara permanen dari server dan tidak dapat dipulihkan kembali</strong>.",
      privacy_active_account_label: "Akun Aktif:",
      privacy_active_note: "Seluruh slot OBS overlay milik akun ini akan langsung dimusnahkan.",
      privacy_delete_pass_label: "Masukkan Kata Sandi untuk Konfirmasi:",
      ph_current_pass: "Ketik kata sandi Anda saat ini...",
      privacy_delete_btn: "🗑️ Hapus Akun Saya Secara Permanen",
      privacy_guest_notice: "Anda sedang tidak login. Silakan <a href=\"/studio\" style=\"color:#6366f1; font-weight:700;\">Masuk ke Akun Anda</a> terlebih dahulu untuk mengakses menu penghapusan akun mandiri.",

      // Features & Roadmap
      feat_back_chat: "← Kembali ke Live Chat",
      feat_admin_btn: "⚙️ Kelola (Admin)",
      feat_donate_btn: "Dukung / Donasi ☕",
      feat_submit_btn: "Ajukan Fitur Baru",
      feat_hero_title: "Papan Kanban & Usulan Fitur",
      feat_hero_desc: "Pantau progres pengembangan StreamPulse secara transparan. Anda bebas mengusulkan fitur baru atau memberi suara (upvote 👍) pada fitur yang paling Anda inginkan!",
      feat_hero_cta: "💡 Ajukan Ide Sekarang",
      feat_col_todo: "TODO / Usulan Masuk",
      feat_col_in_progress: "Sedang Dikerjakan",
      feat_col_done: "Selesai & Rilis",
      feat_modal_title: "Ajukan Usulan Fitur",
      feat_req_title_label: "Judul Fitur *",
      feat_req_title_ph: "Contoh: Filter kata-kata kasar / Blacklist kata...",
      feat_req_cat_label: "Kategori Platform",
      feat_req_author_label: "Nama Anda / Streamer (Opsional)",
      feat_req_author_ph: "Contoh: Budi Streamer / Anonim",
      feat_req_desc_label: "Deskripsi Fitur *",
      feat_req_desc_ph: "Jelaskan bagaimana fitur ini bekerja dan mengapa berguna untuk streaming Anda...",
      feat_req_submit_btn: "Kirim Usulan 🚀",

      // Admin Portal
      admin_nav_kanban: "Lihat Kanban Publik ↗",
      admin_nav_studio: "Overlay Studio 🖥️",
      admin_btn_logout: "Keluar 🚪",
      admin_login_title: "Login Administrator",
      admin_login_desc: "Masukkan Password Admin untuk mengelola usulan fitur, memantau akun user, dan mengelola OBS Overlay.",
      ph_admin_pass: "Masukkan Password Admin...",
      admin_btn_login_submit: "Buka Panel Admin 🚀",
      admin_menu_main: "Menu Utama",
      admin_tab_roadmap: "Usulan Fitur (Roadmap)",
      admin_tab_all_overlays: "Semua OBS Overlay",
      admin_tab_users_quota: "Akun & Kuota User",
      admin_menu_security: "Sistem & Keamanan",
      admin_tab_change_pass: "Ganti Password Admin",
      admin_tab_server_status: "Status Server VPS",
      admin_side_logout: "Keluar Panel Admin",
      admin_stat_total: "Total Fitur",
      admin_stat_todo: "📋 Todo / Antrean",
      admin_stat_prog: "⚡ Sedang Dikerjakan",
      admin_stat_done: "✅ Selesai & Rilis",
      admin_stat_rej: "❌ Ditolak",
      admin_stat_votes: "👍 Total Upvotes",
      admin_opt_status_all: "Semua Status",
      admin_opt_status_todo: "📋 Todo",
      admin_opt_status_prog: "⚡ In Progress",
      admin_opt_status_done: "✅ Done",
      admin_opt_status_rej: "❌ Ditolak",
      admin_opt_cat_all: "Semua Kategori",
      ph_search_feature: "Cari judul, deskripsi, atau pembuat...",
      btn_refresh: "🔄 Segarkan",
      admin_btn_create_feature: "+ Buat Fitur Resmi",
      admin_overlays_title: "Monitoring Semua OBS Overlay",
      admin_overlays_desc: "Daftar seluruh URL overlay yang pernah dibuat di server ini.",
      th_overlay_id: "Overlay ID",
      th_owner: "Pemilik (Akun)",
      th_active_channels: "Saluran Aktif",
      th_theme: "Tema",
      th_actions: "Aksi",
      admin_users_title: "Daftar Akun Pengguna & Kuota (Batas 3 Slot)",
      admin_users_desc: "Setiap pengguna dibatasi maksimal 3 Overlay ID untuk mencegah abuse / spam server.",
      th_username: "Username",
      th_registered_at: "Terdaftar Pada",
      th_slots_used: "Jumlah Slot Terpakai",
      th_overlay_ids: "Daftar ID Overlay Milik User",
      admin_security_title: "🔐 Ganti Password Administrator",
      admin_security_desc: "Ubah password panel admin Anda. Password baru akan langsung aktif dan disimpan permanen di server.",
      admin_label_new_pass: "Password Baru (Min. 4 karakter)",
      ph_new_pass: "Ketik password baru...",
      admin_label_confirm_pass: "Konfirmasi Password Baru",
      ph_confirm_pass: "Ulangi ketik password baru...",
      admin_btn_save_pass: "💾 Simpan Password Baru",
      admin_system_title: "⚡ Status Sistem & Resource VPS",
      admin_system_desc: "Informasi performa runtime Node.js dan penggunaan memori server.",
      admin_stat_uptime: "Waktu Aktif (Uptime)",
      admin_stat_ram_rss: "RAM Node.js (RSS)",
      admin_stat_ram_heap: "RAM Heap Used",
      admin_stat_node_ver: "Versi Node.js",

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
      tip_chat_density: "Chat Display Density",
      order_newest_top: "Newest on Top",
      order_newest_bottom: "Newest at Bottom",
      tip_order_toggle: "Toggle order: Newest on Top or Newest at Bottom",
      tip_chat_limit: "Max on-screen chat count to prevent browser lag and save RAM",
      limit_30: "30 (Ultra Light)",
      limit_50: "50 (Memory Saver)",
      limit_100: "100 (Standard)",
      limit_200: "200 (Heavy)",
      tip_clear_screen: "Clear old chat messages to save memory",
      ph_search_chat: "Search chat...",

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
      tip_twitch: "e.g.: shroud or windah_basudara",
      ph_twitch_input: "Enter Twitch username...",
      tip_redeem_desc: "<div style=\"font-weight: 700; color: #c084fc; margin-bottom: 2px;\">💠 Channel Points Redeem Detection Tip:</div>By default Twitch IRC only broadcasts redemptions that include a message. For automatic detection of your rewards (e.g. <em>Hydrate, Sound Alerts, etc.</em>), check the option <strong>\"Require viewer to enter text\"</strong> in Twitch Creator Dashboard when creating rewards.",
      oauth_summary: "⚙️ Advanced Option: Twitch OAuth Token (Detect No-Text Redeems)",
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
      demo_twitch_title: "🟣 TWITCH SIMULATION",
      demo_youtube_title: "🔴 YOUTUBE SIMULATION",
      demo_tiktok_title: "🎵 TIKTOK LIVE SIMULATION",
      demo_badge_5: "5 Events",
      demo_badge_6: "6 Events",
      demo_test_chat: "Test Chat",
      demo_tier1_sub: "Tier 1 Sub",
      demo_500_bits: "500 Bits",
      demo_points_redeem: "Points Redeem",
      demo_5_gift_subs: "5 Gift Subs",
      demo_superchat: "Super Chat 50k",
      demo_supersticker: "Super Sticker",
      demo_new_member: "New Member",
      demo_5_gift_members: "5 Gift Members",
      demo_200_jewels: "200 Jewels",
      demo_gift_rose: "Gift Rose x50",
      demo_lion_whale: "Lion / Whale 💎",
      demo_live_sub: "LIVE Sub",
      demo_50_likes: "Tap 50 Likes",
      btn_done: "Done",

      // Modal Donate & Donate Page
      donate_modal_title: "Support StreamPulse (100% Free)",
      donate_h1: "Support StreamPulse",
      donate_h2: "Enjoying StreamPulse?",
      donate_desc_modal: "This app is provided <strong>100% free, unlimited, and ad-free</strong> for all streamers. If it helps your livestream broadcasts, you can support server VPS rental costs to keep it online 24/7.",
      donate_desc_page: "StreamPulse is a multi-platform livestream monitor provided <strong>100% free & without ads</strong>. Your support helps cover VPS server hosting so the service remains online 24/7 for all creators.",
      donate_modal_perk1: "Help cover 24/7 server VPS hosting and tunnel costs",
      donate_modal_perk2: "Support development of new features (emotes, OBS overlay, alerts)",
      donate_modal_perk3: "Any amount of support is immensely appreciated by the creator",
      donate_perk_1: "Cloud VPS server rental, tunnel traffic & domain costs",
      donate_perk_2: "Development of Twitch/7TV emotes, alerts & OBS overlay features",
      donate_perk_3: "Any donation amount (starting from Rp 1,000) is deeply appreciated!",
      donate_cta_btn: "Buy a Coffee on SociaBuzz (joo_nathan)",
      donate_payment_note: "Supports QRIS, GoPay, OVO, Dana, ShopeePay, & Bank Transfer",
      donate_back_link: "← Back to StreamPulse Dashboard",
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
      studio_guest_lock_desc: "You are currently in <strong>Guest Mode</strong>. Feel free to tweak visual styles and view the live canvas preview, but saving configurations, managing 3 cloud slots, and copying the OBS Browser Source URL require an account.",
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
      desc_custom_css: "Customize font colors, shadows, border radius, or animations to match your stream aesthetic:",
      ph_custom_css: "/* Enter your custom CSS here */\n.overlay-item {\n  border-radius: 12px;\n}",
      sec_custom_js: "⚡ Custom JavaScript (Optional)",
      ph_custom_js: "// Custom JavaScript executed when overlay loads",
      sec_theme: "Overlay Theme",
      opt_theme_glass: "💎 Glassmorphism Dark (Default)",
      opt_theme_minimal: "⬛ Minimalist Semi-Transparent",
      opt_theme_cyberpunk: "⚡ Cyberpunk Neon Glow",
      opt_theme_light: "⚪ Clean Light Paper",
      sec_font_size: "Font Size",
      sec_hide_delay: "Auto-Hide Delay",
      sec_max_messages: "Maximum Chat Bubbles on OBS Canvas",
      sec_mask_links: "Auto-Sensor Links",
      sec_mask_links_sub: "Replace URLs in chat messages with <code>[LINK]</code> on OBS",
      sec_show_badges: "Show Twitch & YouTube Badges (👑 Mod, VIP, Sub)",
      sec_show_avatars: "Show Viewer Profile Avatars",
      sec_show_emotes: "Show 7TV & Twitch Emotes",
      sec_show_alerts: "Show Event Alert Banners (Raid, Cheer, Sub, Super Chat)",

      // Studio OBS Link & Live Preview
      obs_link_title: "🔗 Your OBS Browser Source URL",
      obs_help_text: "💡 <em>In OBS Studio: Add Source → select <strong>Browser</strong> → paste URL above → set Width: 600, Height: 800.</em>",
      live_preview_title: "👁️ Live Preview (Transparent in OBS)",
      btn_test_normal_chat: "💬 Test Normal Chat",
      btn_test_link_chat: "🔗 Test Link Chat",
      btn_test_twitch_vip: "💎 Test Twitch VIP",
      btn_test_alert_sub: "🎉 Test Sub Alert",
      preview_canvas_badge: "Preview OBS Canvas",

      // Studio & App Auth Modal
      auth_login_tab: "Sign In (Login)",
      auth_register_tab: "Create New Account",
      auth_title_login: "Streamer Sign In",
      auth_title_register: "Create Streamer Account",
      auth_desc: "Sign in to keep your overlay presets and channel credentials securely synced.",
      auth_user_label_login: "Username / ID",
      auth_user_label_register: "New Username (3-20 chars)",
      ph_auth_username: "e.g.: gamer_joo",
      auth_email_label: "Active Email Address",
      ph_auth_email: "streamer@gmail.com",
      auth_send_code_btn: "Send Code 📨",
      auth_code_label: "6-Digit Verification Code",
      auth_code_help: "Check your email inbox or spam folder. Valid for 15 minutes.",
      auth_pass_label: "Password (Min. 4 chars)",
      ph_auth_pass: "Account password...",
      auth_submit_login: "Sign In 🚀",
      auth_submit_register: "Register & Create Account 🎉",

      // Auth Cloud Notice & Guest Info
      auth_connected_to: "Connected to Account",
      auth_manage_obs: "Manage OBS Overlay",
      auth_cloud_config_desc: "Your channel configurations are automatically saved in the cloud. Twitch tokens are encrypted with military-grade AES-256-GCM.",
      auth_guest_mode_title: "Guest Mode (Not Logged In)",
      auth_guest_mode_desc: "As a guest, channel inputs default to empty and remain active only in this session.",
      auth_guest_login_link: "Login / Register",
      auth_guest_mode_desc_end: "to save channels and secure your Twitch token permanently.",

      // Studio Slots & Sliders Dynamic
      active_badge_text: "Active",
      studio_no_slots_msg: "No active overlay slot yet. Click \"+ Generate New URL\" above!",
      studio_slots_used_text: "Slots Used",
      studio_guest_help_text: "🔒 <em>Save settings, copy URL, and 3 cloud slots are available only for logged-in streamers. Please login/register to access these features.</em>",
      btn_edit_slot_tip: "Load and edit this slot configuration",
      btn_overwrite_slot_tip: "Overwrite this slot with your current custom settings",
      btn_delete_slot_tip: "Delete this slot to free up quota",
      toast_logged_out_guest: "Logged out from account. Guest Mode is now active.",
      slider_always_visible: "Always Visible (0s)",
      slider_seconds: "seconds",
      slider_messages: "Messages",

      // Privacy Page
      privacy_h1: "StreamPulse Privacy Policy",
      privacy_date: "Last updated: October 2026",
      privacy_intro: "StreamPulse is committed to protecting your privacy. Our service is designed to help content creators and streamers monitor chat feeds and customize OBS overlays without tracking or selling your personal data to any third parties.",
      privacy_sec1_title: "🛡️ 1. Information We Collect",
      privacy_sec1_email: "<strong>Email Address:</strong> Used exclusively for account ownership verification during registration and recovery. We never send spam or promotional marketing newsletters.",
      privacy_sec1_username: "<strong>Username:</strong> Your account identifier to manage channel links and cloud overlay slots.",
      privacy_sec1_channels: "<strong>Public Channel Handles:</strong> Twitch, YouTube, and TikTok public usernames you choose to capture.",
      privacy_sec1_oauth: "<strong>Twitch OAuth Token (Optional):</strong> Used to listen for interactive events (Channel Points Redeems). This token is <strong>strictly encrypted using AES-256-GCM</strong> on our server and never exposed to client browsers.",
      privacy_sec1_pass: "<strong>Password:</strong> Hashed using state-of-the-art memory-hard <strong>Argon2id</strong> with unique salts. We can never view your plaintext password.",
      privacy_sec2_title: "💬 2. Real-Time Chat & Stream Processing",
      privacy_sec2_desc: "Chat messages from Twitch, YouTube, and TikTok viewers are processed in <em>real-time streaming</em> on your device/browser via WebSocket protocols. StreamPulse <strong>never stores viewer chat message history in a permanent database</strong>. Once the streaming session ends or the browser closes, messages are purged from memory.",
      privacy_sec3_title: "🍪 3. Cookies & Local Storage Usage",
      privacy_sec3_desc: "We only use <code>localStorage</code> and <code>sessionStorage</code> in your browser to store authentication session tokens and display preferences (such as dark theme, font sizes). We do not use third-party tracking cookies or advertisements (No Third-Party Trackers).",
      privacy_sec4_title: "🔒 4. Security & Encryption Standards",
      privacy_sec4_desc: "All data communications between browsers, OBS Studio, and our server are secured with SSL/TLS encryption (HTTPS & WSS). Sensitive credentials are encrypted at rest and protected from abuse via strict Rate Limiting.",
      privacy_danger_title: "⚠️ Account & Data Permanent Deletion",
      privacy_danger_desc: "In compliance with GDPR and user privacy rights, you have the right to delete your account at any time. When deleted, all your profile records, stored credentials, and 3 OBS Overlay slots will be <strong>permanently eradicated from the server and cannot be recovered</strong>.",
      privacy_active_account_label: "Active Account:",
      privacy_active_note: "All OBS overlay cloud slots belonging to this account will be immediately destroyed.",
      privacy_delete_pass_label: "Enter Password to Confirm Deletion:",
      ph_current_pass: "Enter your current password...",
      privacy_delete_btn: "🗑️ Permanently Delete My Account",
      privacy_guest_notice: "You are currently not logged in. Please <a href=\"/studio\" style=\"color:#6366f1; font-weight:700;\">Sign In to Your Account</a> to access self-service account deletion.",

      // Features & Roadmap
      feat_back_chat: "← Back to Live Chat",
      feat_admin_btn: "⚙️ Manage (Admin)",
      feat_donate_btn: "Support / Donate ☕",
      feat_submit_btn: "Submit Feature Request",
      feat_hero_title: "Feature Roadmap & Suggestions",
      feat_hero_desc: "Track StreamPulse development progress transparently. Feel free to suggest new ideas or upvote 👍 the features you want most!",
      feat_hero_cta: "💡 Submit Idea Now",
      feat_col_todo: "TODO / New Suggestions",
      feat_col_in_progress: "In Progress",
      feat_col_done: "Done & Released",
      feat_modal_title: "Submit Feature Request",
      feat_req_title_label: "Feature Title *",
      feat_req_title_ph: "e.g.: Profanity filter / word blacklist...",
      feat_req_cat_label: "Platform Category",
      feat_req_author_label: "Your Name / Streamer (Optional)",
      feat_req_author_ph: "e.g.: GamerStreamer / Anonymous",
      feat_req_desc_label: "Feature Description *",
      feat_req_desc_ph: "Explain how this feature works and why it helps your live broadcasts...",
      feat_req_submit_btn: "Submit Proposal 🚀",

      // Admin Portal
      admin_nav_kanban: "View Public Kanban ↗",
      admin_nav_studio: "Overlay Studio 🖥️",
      admin_btn_logout: "Logout 🚪",
      admin_login_title: "Administrator Sign In",
      admin_login_desc: "Enter the Admin Password to manage roadmap features, user quotas, and OBS overlays.",
      ph_admin_pass: "Enter Admin Password...",
      admin_btn_login_submit: "Open Admin Panel 🚀",
      admin_menu_main: "Main Menu",
      admin_tab_roadmap: "Feature Roadmap",
      admin_tab_all_overlays: "All OBS Overlays",
      admin_tab_users_quota: "Users & Slot Quotas",
      admin_menu_security: "System & Security",
      admin_tab_change_pass: "Change Admin Password",
      admin_tab_server_status: "VPS Server Status",
      admin_side_logout: "Exit Admin Panel",
      admin_stat_total: "Total Features",
      admin_stat_todo: "📋 Todo / Queue",
      admin_stat_prog: "⚡ In Progress",
      admin_stat_done: "✅ Done & Released",
      admin_stat_rej: "❌ Rejected",
      admin_stat_votes: "👍 Total Upvotes",
      admin_opt_status_all: "All Statuses",
      admin_opt_status_todo: "📋 Todo",
      admin_opt_status_prog: "⚡ In Progress",
      admin_opt_status_done: "✅ Done",
      admin_opt_status_rej: "❌ Rejected",
      admin_opt_cat_all: "All Categories",
      ph_search_feature: "Search title, description, or author...",
      btn_refresh: "🔄 Refresh",
      admin_btn_create_feature: "+ Create Official Feature",
      admin_overlays_title: "All OBS Overlays Monitoring",
      admin_overlays_desc: "List of all overlay profile URLs generated on this server.",
      th_overlay_id: "Overlay ID",
      th_owner: "Owner (Account)",
      th_active_channels: "Active Channels",
      th_theme: "Theme",
      th_actions: "Actions",
      admin_users_title: "User Accounts & Quotas (Max 3 Slots)",
      admin_users_desc: "Each streamer account is limited to 3 Overlay IDs to prevent server abuse.",
      th_username: "Username",
      th_registered_at: "Registered On",
      th_slots_used: "Used Slots",
      th_overlay_ids: "Overlay IDs Owned",
      admin_security_title: "🔐 Change Administrator Password",
      admin_security_desc: "Change your admin panel password. The new password will take effect immediately.",
      admin_label_new_pass: "New Password (Min. 4 chars)",
      ph_new_pass: "Type new password...",
      admin_label_confirm_pass: "Confirm New Password",
      ph_confirm_pass: "Repeat new password...",
      admin_btn_save_pass: "💾 Save New Password",
      admin_system_title: "⚡ VPS System & Resource Status",
      admin_system_desc: "Runtime Node.js performance metrics and server memory usage.",
      admin_stat_uptime: "Uptime",
      admin_stat_ram_rss: "Node.js RAM (RSS)",
      admin_stat_ram_heap: "RAM Heap Used",
      admin_stat_node_ver: "Node.js Version",

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
    ["Daftar & Buat Akun 🎉", "Register & Create Account 🎉"],

    // Admin & Features
    ["Lihat Kanban Publik ↗", "View Public Kanban ↗"],
    ["Keluar 🚪", "Logout 🚪"],
    ["Login Administrator", "Administrator Sign In"],
    ["Buka Panel Admin 🚀", "Open Admin Panel 🚀"],
    ["Menu Utama", "Main Menu"],
    ["Usulan Fitur (Roadmap)", "Feature Roadmap"],
    ["Semua OBS Overlay", "All OBS Overlays"],
    ["Akun & Kuota User", "Users & Slot Quotas"],
    ["Sistem & Keamanan", "System & Security"],
    ["Ganti Password Admin", "Change Admin Password"],
    ["Status Server VPS", "VPS Server Status"],
    ["Keluar Panel Admin", "Exit Admin Panel"],
    ["🔄 Segarkan", "🔄 Refresh"],
    ["+ Buat Fitur Resmi", "+ Create Official Feature"],
    ["💾 Simpan Password Baru", "💾 Save New Password"],
    ["Ajukan Fitur Baru", "Submit Feature Request"],
    ["Papan Kanban & Usulan Fitur", "Feature Roadmap & Suggestions"],
    ["💡 Ajukan Ide Sekarang", "💡 Submit Idea Now"],
    ["TODO / Usulan Masuk", "TODO / New Suggestions"],
    ["Sedang Dikerjakan", "In Progress"],
    ["Selesai & Rilis", "Done & Released"],
    ["Ajukan Usulan Fitur", "Submit Feature Request"],
    ["Kirim Usulan 🚀", "Submit Proposal 🚀"],

    // Dynamic Auth & Studio Phrases
    ["Kelola OBS Overlay", "Manage OBS Overlay"],
    ["Kelola OBS Overlay →", "Manage OBS Overlay →"],
    ["Konfigurasi saluran Anda tersimpan otomatis di cloud. Token Twitch dienkripsi dengan standar militer AES-256-GCM.", "Your channel configurations are automatically saved in the cloud. Twitch tokens are encrypted with military-grade AES-256-GCM."],
    ["Mode Tamu (Belum Login)", "Guest Mode (Not Logged In)"],
    ["Sebagai tamu, input saluran Anda selalu default kosong dan hanya aktif di sesi ini.", "As a guest, channel inputs default to empty and remain active only in this session."],
    ["untuk menyimpan channel & mengamankan token Twitch secara permanen.", "to save channels and secure your Twitch token permanently."],
    ["Tersambung ke Akun", "Connected to Account"],
    ["(Aktif)", "(Active)"],
    ["Aktif", "Active"],
    ["Di OBS Studio: Tambah Source → pilih Browser → tempel link di atas → atur Width: 600, Height: 800.", "In OBS Studio: Add Source → select Browser → paste URL above → set Width: 600, Height: 800."],
    ["Di OBS Studio: Tambah Source → pilih", "In OBS Studio: Add Source → select"],
    ["tempel link di atas → atur Width: 600, Height: 800.", "paste URL above → set Width: 600, Height: 800."],
    ["✓ Siap Digunakan di OBS", "✓ Ready for OBS Studio"],
    ["Siap Digunakan di OBS", "Ready for OBS Studio"],
    ["Slot Terpakai", "Slots Used"],
    ["Selalu Tampil (0s)", "Always Visible (0s)"],
    ["detik", "seconds"],
    ["Pesan", "Messages"]
  ];

  const placeholderPairs = [
    ["Cari chat...", "Search chat..."],
    ["Masukkan username Twitch...", "Enter Twitch username..."],
    ["@NamaChannel atau URL live...", "@ChannelName or live stream URL..."],
    ["Username TikTok live...", "TikTok LIVE username..."],
    ["Contoh: shroud (tanpa #)", "e.g.: shroud (without #)"],
    ["Contoh: @Streamer / URL Live", "e.g.: @Streamer / Live URL"],
    ["Contoh: streamer_tiktok (tanpa @)", "e.g.: streamer_tiktok (without @)"],
    ["Password akun...", "Account password..."],
    ["Masukkan Password Admin...", "Enter Admin Password..."],
    ["Ketik password baru...", "Type new password..."],
    ["Ulangi ketik password baru...", "Repeat new password..."],
    ["Cari judul, deskripsi, atau pembuat...", "Search title, description, or author..."]
  ];

  let currentLang = localStorage.getItem('streampulse_lang') || 'id';

  function t(key) {
    const langDict = translations[currentLang] || translations.id;
    return (langDict && langDict[key]) || (translations.id && translations.id[key]) || key;
  }

  // Eagerly expose window helpers so they are available immediately
  window.t = t;
  window.getCurrentLang = () => currentLang;

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

    // 1. Translate all elements with data-i18n attribute (textContent or placeholder for inputs)
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

    // 1b. Translate rich HTML elements with data-i18n-html
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        el.innerHTML = t(key);
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

    // 4. Translate raw text elements via bidirectional phrasePairs (DOM TreeWalker fallback)
    const isEn = (currentLang === 'en');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.hasAttribute('data-i18n') || parent.hasAttribute('data-i18n-html')) continue;
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

    // Export helpers on window
    window.t = t;
    window.applyLanguage = applyLanguage;
    window.getCurrentLang = () => currentLang;

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
