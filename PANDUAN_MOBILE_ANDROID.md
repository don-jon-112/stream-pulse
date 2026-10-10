# 📱 Panduan Menjalankan StreamPulse MultiChat Mandiri di HP Android (Tanpa PC & Tanpa Cloud)

Panduan ini dibuat agar Anda bisa menjalankan **StreamPulse MultiChat** 100% langsung di dalam HP Android Anda tanpa perlu menyalakan PC, tanpa membuka file `.bat`, dan tanpa memerlukan server hosting cloud atau kartu kredit.

---

## 📋 Konsep Singkat
* **Termux** bertindak sebagai server Node.js di dalam HP Anda (menjalankan scraper chat TikTok, YouTube, dan Twitch).
* **Google Chrome (PWA)** bertindak sebagai tampilan layar monitor chat dengan ikon aplikasi tersendiri di layar depan HP Anda.

---

## 🛠️ Persiapan Awal
1. **HP Android** (versi Android 7.0 atau lebih baru).
2. **Koneksi Internet** (Wi-Fi atau kuota data seluler).
3. Browser **Google Chrome** di HP.

---

## 🚀 Langkah 1: Install Aplikasi Termux di HP
> ⚠️ **PENTING**: Jangan unduh Termux dari Google Play Store (versi di Play Store sudah kedaluwarsa). Gunakan versi resmi dari F-Droid:

1. Di HP Android Anda, buka browser lalu unduh installer APK Termux berikut:
   👉 **[Unduh Termux APK Resmi (F-Droid)](https://f-droid.org/repo/com.termux_1020.apk)**
2. Pasang/install file APK tersebut di HP Anda.
3. Buka aplikasi **Termux**.

---

## ⚙️ Langkah 2: Install Node.js & Git di Termux
Di dalam aplikasi Termux, ketik perintah berikut (atau copy-paste) lalu tekan **Enter**:

```bash
pkg update -y && pkg install nodejs git -y
```

*Tunggu proses instalasi selesai hingga muncul kembali tanda cursor `$` (biasanya memakan waktu 1–2 menit).*

---

## 📁 Langkah 3: Masukkan Folder StreamChat ke HP

Pilih salah satu metode berikut yang paling mudah menurut Anda:

### 🌟 Metode A: Salin Manual Lewat Kabel Data USB (Paling Mudah)
1. Sambungkan HP ke PC menggunakan kabel data USB.
2. Salin folder proyek `StreamChat` dari PC ke folder **Download** di penyimpanan internal HP Anda.
3. Di dalam aplikasi Termux, izinkan akses penyimpanan dengan perintah:
   ```bash
   termux-setup-storage
   ```
   *(Pilih **Allow/Izinkan** jika muncul popup izin penyimpanan di layar HP)*.
4. Pindahkan folder proyek ke Termux:
   ```bash
   cp -r /sdcard/Download/StreamChat ~/
   cd ~/StreamChat
   ```

---

### 🌐 Metode B: Lewat Git Clone (Jika Proyek Ada di GitHub)
Jika proyek Anda sudah di-upload ke repository GitHub:
```bash
git clone https://github.com/USERNAME-ANDA/REPO-ANDA.git ~/StreamChat
cd ~/StreamChat
```

---

## 📦 Langkah 4: Install Dependencies & Jalankan Server

1. Masuk ke folder proyek dan install modul:
   ```bash
   cd ~/StreamChat
   npm install
   ```
2. Jalankan server:
   ```bash
   node server.js
   ```

Jika berhasil, Termux akan menampilkan pesan:
```text
==================================================
🚀 StreamPulse MultiChat Server Aktif!
   - Local PC:   http://localhost:3000
   - Akses HP:   http://127.0.0.1:3000
==================================================
```

---

## 📲 Langkah 5: Pasang Ikon Aplikasi di Layar Utama HP (PWA)

1. Jangan tutup Termux (biarkan berjalan di latar belakang).
2. Buka browser **Google Chrome** di HP Anda.
3. Di bilah alamat browser, ketik:
   ```text
   http://localhost:3000
   ```
4. Dashboard StreamPulse MultiChat akan terbuka.
5. Klik **menu titik tiga (⋮)** di pojok kanan atas Google Chrome.
6. Pilih **"Tambahkan ke Layar Utama"** atau **"Install App"**.
7. Klik **Install**.

🎉 **Selesai!** Sekarang ikon aplikasi **StreamPulse** sudah muncul di layar beranda HP Anda layaknya aplikasi native Android lainnya.

---

## ⚡ Cara Menjalankan Sehari-hari Saat Mau Streaming

Setiap kali Anda ingin menggunakan aplikasi:

1. Buka aplikasi **Termux**, ketik:
   ```bash
   cd ~/StreamChat && node server.js
   ```
2. Tekan tombol **Home** di HP (biarkan Termux berjalan).
3. Buka ikon aplikasi **StreamPulse** dari layar utama HP Anda.
4. Masukkan channel live Anda di menu **Atur Channel** -> klik **Simpan & Hubungkan**.
5. Layar HP akan otomatis dicegah mati (*Anti-Sleep ON*) selama Anda memantau stream!

---

## 🛑 Cara Mematikan Server Jika Selesai Streaming
1. Buka kembali aplikasi **Termux**.
2. Tekan tombol **`Ctrl`** lalu tekan huruf **`c`** di keyboard Termux (`Ctrl + C`).
3. Server akan berhenti.

---

## 💡 Tips & Trik Agar Lancar & Tidak Mati Sendiri

### 1. Cegah Android Menutup Termux di Latar Belakang (Battery Saver)
Agar server tidak mati saat layar HP mati atau beralih aplikasi:
1. Buka **Pengaturan HP** -> **Aplikasi** -> cari **Termux**.
2. Buka bagian **Baterai** -> pilih **Tidak Dibatasi / Unrestricted**.
3. Di dalam Termux, tarik bilah notifikasi atas HP -> pada notifikasi Termux klik tombol **Acquire Wakelock**.

### 2. Buat Script 1-Baris Cepat
Anda bisa membuat shortcut agar tidak perlu mengetik panjang setiap kali buka Termux:
```bash
echo "cd ~/StreamChat && node server.js" > ~/start.sh
chmod +x ~/start.sh
```
Setelah itu, setiap kali membuka Termux cukup ketik:
```bash
./start.sh
```
Lalu tekan Enter!
