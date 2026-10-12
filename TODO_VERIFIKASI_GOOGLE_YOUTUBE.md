# Panduan & Checklist Verifikasi Google OAuth (YouTube Data API v3)
**Domain:** `https://joo-nathan.my.id`  
**Aplikasi:** StreamPulse MultiChat

---

## 📌 Mengapa Butuh Verifikasi Google?
Saat aplikasi meminta izin akses YouTube (*Sensitive Scope* seperti `youtube.readonly`), Google akan memunculkan layar peringatan:
> *"Google belum memverifikasi aplikasi ini"*

Agar layar peringatan tersebut hilang dan langsung muncul layar otorisasi resmi Google bersertifikat, Anda perlu menyelesaikan checklist verifikasi di bawah ini.

---

## ✅ Checklist Langkah-Langkah Verifikasi

### 1. Verifikasi Kepemilikan Domain di Google Search Console
Google mewajibkan Anda membuktikan bahwa domain `joo-nathan.my.id` adalah milik Anda:
- [ ] Buka [Google Search Console](https://search.google.com/search-console).
- [ ] Pilih **Domain** dan masukkan: `joo-nathan.my.id`.
- [ ] Salin **TXT Record** yang diberikan oleh Google (contoh: `google-site-verification=xxxx`).
- [ ] Buka Dashboard DNS Cloudflare domain Anda, tambahkan record:
  - **Type:** `TXT`
  - **Name:** `@` (atau `joo-nathan.my.id`)
  - **Content:** Teks verifikasi Google tadi
- [ ] Kembali ke Google Search Console dan klik **Verify (Verifikasi)** sampai muncul tanda hijau *"Ownership verified"*.

---

### 2. Buat Video Rekaman Layar (Demo YouTube)
Google mewajibkan 1 video pendek rekaman layar (durasi 1 menit) untuk membuktikan cara kerja aplikasi:
- [ ] Buka software perekam layar (misal OBS Studio / Windows Game Bar `Win + G`).
- [ ] Rekam layar Anda saat membuka web: `https://joo-nathan.my.id`.
- [ ] Tunjukkan Client ID aplikasi di URL bar atau klik tombol **Login YouTube** di menu *Atur Channel*.
- [ ] Tunjukkan layar pop-up izin Google yang meminta akses YouTube.
- [ ] Klik izinkan / login, dan tunjukkan bahwa nama channel YouTube Anda berhasil muncul di web untuk membaca chat live stream.
- [ ] Upload video tersebut ke YouTube Anda:
  - **Visibilitas:** Pilih **Tidak Publik (Unlisted)**.
  - Salin URL video tersebut (contoh: `https://youtu.be/xxxx`).

---

### 3. Lengkapi Data Branding di Google Cloud Console
- [ ] Buka [Google Cloud Console - Branding](https://console.cloud.google.com/apis/credentials/consent).
- [ ] Pastikan data berikut sudah terisi:
  - **App name:** `StreamPulse`
  - **User support email:** `exzone45@gmail.com`
  - **Application home page:** `https://joo-nathan.my.id`
  - **Application privacy policy link:** `https://joo-nathan.my.id/privacy`
  - **Authorized domains:** `joo-nathan.my.id`
  - **Developer contact email:** `exzone45@gmail.com`
  - *(Catatan: Biarkan App Logo kosong agar tidak menambah audit grafis terpisah).*

---

### 4. Kirim Pengajuan Verifikasi ke Google
- [ ] Di halaman [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent), klik tombol **Submit for verification (Kirim untuk verifikasi)**.
- [ ] Pada formulir yang muncul:
  - Jelaskan kegunaan scope: *"Aplikasi StreamPulse menggunakan scope youtube.readonly untuk mendeteksi channel streamer dan membaca live chat siaran langsung di overlay pemantau multi-chat."*
  - Tempel link video YouTube demo Unlisted yang Anda buat di Langkah 2.
- [ ] Klik **Submit (Kirim)**.

---

## ⏳ Proses Peninjauan
- Tim Google Trust & Safety akan meninjau pengajuan Anda dalam waktu **2 hingga 3 hari kerja**.
- Pemberitahuan hasil audit atau pertanyaan tambahan dari tim Google akan dikirimkan langsung ke email Anda: `exzone45@gmail.com`.
- Setelah disetujui, layar *"Google belum memverifikasi aplikasi ini"* akan hilang selamanya!
