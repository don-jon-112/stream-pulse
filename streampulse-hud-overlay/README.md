# 🎮 StreamPulse - In-Game HUD Overlay

Aplikasi desktop mini yang ringan (*lightweight*) untuk menampilkan live chat multi-platform (Twitch, YouTube, TikTok) melayang di atas layar game secara transparan dan tembus mouse (*click-through*), mirip seperti **Discord Overlay**.

Aplikasi ini dapat berjalan secara mandiri (*standalone client*) dengan menghubungkan diri ke server StreamPulse (default: `https://joo-nathan.my.id` atau server Anda sendiri).

---

## ✨ Fitur Utama

- 🪟 **Discord-Style Transparent Overlay**: Melayang di atas game Borderless / Fullscreen tanpa mengganggu gameplay.
- 🎯 **Click-Through Mode (Tembus Mouse)**: Saat dikunci, klik mouse tembus 100% ke dalam game sehingga Anda tetap bisa menembak, mengarahkan kamera, dan bermain tanpa terganggu.
- ⌨️ **Global Hotkeys**:
  - `F8` atau `Ctrl + Shift + X`: Kunci / Buka Kunci (Mode Edit vs Mode Tembus Game).
  - `F9` atau `Ctrl + Shift + H`: Sembunyikan / Tampilkan Overlay saat bermain.
  - `Ctrl + Shift + Z`: Reset posisi dan ukuran jendela overlay ke default.
- 🟣 **Twitch Helix OAuth & EventSub**: Login akun Twitch langsung dari overlay untuk mendeteksi penukaran Custom Channel Points (Redeem), Follower baru, dan chat streamer resmi.
- 🌐 **Custom Chat Stream URL**: Ingin menggunakan tampilan chat kustom Anda sendiri? Cukup masukkan URL overlay chat Anda (misal: `/overlay?theme=compact...`, OBS Browser Source, Botrix, StreamElements, dll.).
- 🎛️ **Pengaturan Transparansi & Ukuran Teks**: Slider Opacity (0% - 95%) dan Font Size (11px - 18px).
- ⚡ **Sangat Hemat RAM**: Menggunakan switch Chromium hemat memori (~40-60 MB RAM saja), tidak akan menurunkan FPS game Anda.

---

## 🚀 Cara Menjalankan (Development)

Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (versi 18+).

```bash
# 1. Masuk ke folder aplikasi
cd streampulse-hud-overlay

# 2. Install dependensi Electron
npm install

# 3. Jalankan aplikasi overlay
npm start
```

---

## 📦 Cara Build Menjadi Aplikasi Portable (.exe)

Untuk membuat file executable tunggal (`StreamPulse HUD Overlay.exe`) yang siap dibagikan ke streamers/gamers tanpa perlu install Node.js:

```bash
npm run build:portable
```

File hasil build akan berada di dalam folder `dist/`.

---

## 🔗 Cara Membuat Repository Git Baru untuk Folder Ini

Jika Anda ingin menjadikan folder ini repository GitHub terpisah:

```bash
# 1. Buka terminal di dalam folder ini
cd streampulse-hud-overlay

# 2. Inisialisasi git repository baru
git init

# 3. Tambahkan semua file dan buat commit awal
git add .
git commit -m "feat: initial commit StreamPulse In-Game HUD Overlay"

# 4. Ganti branch utama menjadi main
git branch -M main

# 5. Sambungkan ke repository GitHub baru Anda
git remote add origin https://github.com/USERNAME/NAMA-REPO-BARU.git

# 6. Push ke GitHub
git push -u origin main
```

---

## 📁 Struktur File

```
streampulse-hud-overlay/
├── .gitignore               # Mengabaikan node_modules & dist
├── package.json             # Konfigurasi dependensi & build script
├── README.md                # Dokumentasi lengkap
├── assets/
│   └── icon.png             # Icon aplikasi
└── src/
    ├── main.js              # Electron Main Process (Hotkeys, Tray, Window Management)
    ├── preload.cjs          # Context bridge aman untuk interaksi UI & OS
    └── ui/
        ├── index.html       # UI HUD Overlay (Multi-chat, Twitch OAuth, Custom URL, Sliders)
        └── js/
            └── socket.io.min.js  # Library Socket.io offline client
```

---

## ⚙️ Konfigurasi URL Server

Secara default, aplikasi akan terhubung ke server StreamPulse di:
`https://joo-nathan.my.id`

Jika Anda ingin mengubah server URL ke server VPS atau localhost Anda:
1. Buka overlay dan klik tombol **`⚙️ Atur Channel & URL`** di header atas.
2. Anda bisa memasukkan server custom atau Custom Chat Stream URL di kolom yang tersedia.

---

## 📜 Lisensi
MIT License © StreamPulse
