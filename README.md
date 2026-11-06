<div align="center">

# ⚡ StreamPulse PRO MAX
### All-in-One MultiChat & Live Stream Overlays Suite for OBS Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![OBS Studio](https://img.shields.io/badge/OBS-Compatible-302E31?logo=obs-studio&logoColor=white)](https://obsproject.com/)
[![Platform Support](https://img.shields.io/badge/Platforms-Twitch%20%7C%20YouTube%20%7C%20TikTok-FE2C55)](https://github.com/don-jon-112/stream-pulse)

*StreamPulse adalah platform dashboard dan overlay open-source serbaguna yang menghubungkan obrolan langsung (live chat), penghitung penonton, interaksi gift/like TikTok, dan widget animasi media sosial ke dalam OBS Studio secara real-time dengan latensi ultra rendah.*

[Fitur Utama](#-fitur-utama) •
[Daftar Overlay OBS](#-daftar-overlay--widget-obs) •
[Panduan Instalasi](#-panduan-instalasi--menjalankan) •
[Konfigurasi .env](#-konfigurasi-lingkungan-env) •
[Struktur Proyek](#-arsitektur--struktur-proyek) •
[Lisensi](#-lisensi)

</div>

---

## 🚀 Fitur Utama

- 💬 **Multi-Platform Chat Aggregator**: Menggabungkan obrolan langsung dari **Twitch**, **YouTube Live**, dan **TikTok LIVE** ke dalam satu feed live chat terpadu secara real-time.
- 📱 **OBS Custom Dock (`/dock`)**: Panel khusus untuk disematkan langsung di jendela samping OBS Studio (Docks $\rightarrow$ Custom Browser Docks). Dilengkapi monitor latensi ms, total viewers aktif, filter platform, anti-sleep (*screen wake lock*), dan tombol kirim balasan chat Twitch.
- 👥 **Real-Time Live Viewers Counter (`/viewers`)**: Widget penghitung jumlah penonton siaran gabungan maupun per platform dengan 5 pilihan tema modern (*Frost Glass, Cyberpunk Neon, Translucent, dll.*).
- 🎁 **TikTok LIVE Suite & Gamification (`/tiktok-widgets`)**:
  - **Top Gifter Leaderboard**: Peringkat penonton penyumbang koin/gift terbesar.
  - **Top Likes Counter**: Peringkat penyumbang like terbanyak dalam siaran.
  - **Physics Gift Jar**: Toples interaktif dengan efek gravitasi fisika saat gift masuk.
  - **Like Waterfall**: Partikel hati meluncur dinamis saat penonton mengetuk layar.
  - **Interactive Alerts & Goal Bars**: Notifikasi pop-up suara dan target gift/follower.
- 📱 **Social Media Rotator Overlay (`/social-rotator`)**:
  - Menampilkan akun-akun media sosial (*TikTok, YouTube, Twitch, Instagram, Discord, X, Kick, Facebook, Threads, Spotify, Steam, Website*) secara berputar dan estetik.
  - **9 Pilihan Tema Eksklusif**: *Frost Glass, Cyberpunk Neon, Gaming RGB Chroma, Minimal Obsidian, Minimal Porcelain, Retro 8-Bit Arcade, Pop Sunset Gradient, Neo-Brutalism, Esports Stealth*.
  - 5 transisi animasi (*Slide Up, Slide Right, Fade, 3D Flip, Bounce Pop*) dengan kontrol durasi dan jeda sembunyi (*hide interval*).
- 🎨 **Overlay Studio & Custom CSS (`/studio`)**: Kustomisasi penuh gaya chat overlay OBS, ukuran font, arah scroll, efek animasi masuk/keluar, hingga injeksi Custom CSS dan JS.
- 🌓 **Tema Terang & Gelap Universal (Dark/Light Mode)**: Desain responsif di semua perangkat (Desktop, Laptop, Tablet, & HP) dengan pergantian tema instan.
- 🔒 **Privasi & Keamanan Enkripsi**: Token kredensial OAuth streamer dilindungi dengan enkripsi AES-256-GCM dan hashing Argon2id.

---

## 📺 Daftar Overlay & Widget OBS

Setiap widget dapat langsung ditambahkan ke OBS Studio melalui menu **Sources** $\rightarrow$ **Browser Source**:

| Halaman Widget | URL OBS Browser Source | Rekomendasi Resolusi | Deskripsi |
|---|---|---|---|
| **MultiChat Overlay** | `/overlay` | `450 x 700` | Tampilan chat transparan di layar siaran |
| **OBS Custom Dock** | `/dock` | `400 x 650` | Panel kontrol obrolan untuk dock OBS Studio |
| **Live Viewers Counter** | `/viewers-overlay` | `480 x 120` | Widget hitung jumlah penonton real-time |
| **Social Media Rotator** | `/social-rotator-overlay` | `480 x 120` | Rotator animasi akun sosial media |
| **TikTok Top Gifter** | `/tiktok-overlay?widget=top-gifter` | `380 x 480` | Papan peringkat gifter TikTok live |
| **TikTok Top Likes** | `/tiktok-overlay?widget=top-likes` | `340 x 420` | Peringkat penonton penyumbang tap like |
| **TikTok Gift Jar** | `/tiktok-overlay?widget=gift-jar` | `400 x 500` | Toples fisika koin dan hadiah gift jatuh |
| **TikTok Alerts** | `/tiktok-overlay?widget=alerts` | `500 x 200` | Notifikasi pop-up gift & follow beranimasi |
| **TikTok Goals Bar** | `/tiktok-overlay?widget=goals` | `500 x 120` | Progress bar target gift / followers |

> [!TIP]
> Pada setiap sumber browser OBS, centang opsi **"Shutdown source when not visible"** untuk menghemat penggunaan resource GPU / CPU Anda saat adegan (*scene*) tidak aktif.

---

## 🛠️ Panduan Instalasi & Menjalankan

### Persyaratan Sistem:
- **Node.js**: Versi 18.0.0 atau yang lebih baru
- **NPM** atau **PNPM**
- Koneksi Internet stabil untuk menghubungkan WebSocket Twitch, YouTube, & TikTok

### 1. Kloning Repositori
```bash
git clone https://github.com/don-jon-112/stream-pulse.git
cd stream-pulse
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file konfigurasi contoh (jika belum ada) dan sesuaikan pengaturannya:
```bash
cp .env.example .env
```

### 4. Jalankan Aplikasi
```bash
# Menjalankan server aplikasi
npm start

# Mode pengembangan (auto-reload saat file diedit)
npm run dev
```

Buka peramban (*browser*) Anda dan akses:
👉 **`http://localhost:3000`**

---

## ⚙️ Konfigurasi Lingkungan (`.env`)

Konfigurasi opsional dapat ditentukan di dalam file `.env`:

```env
# Port Server (Default: 3000)
PORT=3000

# Kunci Enkripsi Data Pengguna (AES-256)
SESSION_SECRET=ganti-dengan-kunci-rahasia-panjang-anda

# Twitch Developer API (Opsional untuk integrasi channel points & status siaran)
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback

# YouTube Live API (Opsional)
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback
```

---

## 📂 Arsitektur & Struktur Proyek

```text
stream-pulse/
├── electron/               # Konfigurasi aplikasi desktop Electron
├── lib/
│   ├── streamManager.js    # Pengelola koneksi WebSocket (Twitch, YT, TikTok)
│   ├── twitchClient.js     # Handler TMI.js Twitch chat & events
│   ├── youtubeClient.js    # Handler YouTube live chat stream
│   └── tikTokClient.js     # Handler PirateTok protobuf reverse socket
├── public/                 # Antarmuka Web Frontend & Assets
│   ├── css/
│   │   └── style.css       # Design system, layout, & styling universal
│   ├── js/
│   │   ├── app.js          # Logika frontend utama MultiChat dashboard
│   │   ├── dock.js         # Logika panel OBS Custom Dock
│   │   ├── drawer.js       # Universal side navigation drawer & dialogs
│   │   └── wakelock.js     # Screen Keep-Alive (Anti-Sleep API)
│   ├── index.html          # Dashboard MultiChat StreamPulse
│   ├── dock.html           # OBS Custom Dock Panel
│   ├── viewers.html        # Live Viewers Counter Hub & Settings
│   ├── viewers-overlay.html# Transparent Viewers OBS Browser Source
│   ├── social-rotator.html # Social Media Rotator Studio Hub
│   ├── social-rotator-overlay.html # Transparent Social Rotator Browser Source
│   ├── tiktok-widgets.html # TikTok LIVE Hub (Top Gifter, Jar, Alerts)
│   ├── tiktok-overlay.html # Transparent TikTok Overlay Browser Source
│   ├── studio.html         # Custom CSS & Overlay Styling Studio
│   ├── features.html       # Roadmap & Community Feedback Board
│   └── privacy.html        # Privacy Policy & Data Security
├── data/                   # Penyimpanan konfigurasi JSON lokal
├── server.js               # Entry point Express.js, Socket.IO, & REST API
├── package.json            # Informasi paket dan dependencies
├── LICENSE                 # Lisensi Open Source (MIT)
└── README.md               # Dokumentasi proyek
```

---

## 🛡️ Teknologi yang Digunakan

* **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
* **Web Framework**: [Express.js](https://expressjs.com/)
* **Real-Time Communication**: [Socket.IO](https://socket.io/) & Native WebSockets
* **Live Stream Protocols**:
  * Twitch: [tmi.js](https://github.com/tmijs/tmi.js)
  * YouTube: [youtube-chat](https://github.com/LuanRT/YouTube.js)
  * TikTok LIVE: [piratetok-live-js](https://github.com/teocns/piratetok-live-js) (Protobuf Webcast reverse client)
* **Security & Auth**: AES-256-GCM, Argon2id Password Hashing, CSRF Defense
* **Audio Synthesis**: Native Web Audio API (tanpa ketergantungan file audio eksternal)

---

## 🤝 Kontribusi

Kontribusi dari komunitas streamer dan pengembang selalu terbuka lebar!
1. Lakukan **Fork** pada repositori ini.
2. Buat branch fitur baru (`git checkout -b feature/FiturKeren`).
3. Commit perubahan Anda (`git commit -m 'feat: menambahkan fitur keren'`).
4. Push branch ke remote (`git push origin feature/FiturKeren`).
5. Buat **Pull Request**.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **[MIT License](LICENSE)** - bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan personal maupun komersial oleh siapa saja.

---

<div align="center">
Dibuat dengan ❤️ untuk seluruh livestreamer oleh <a href="https://github.com/don-jon-112">don-jon-112</a>
</div>
