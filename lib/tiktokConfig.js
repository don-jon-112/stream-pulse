import { AsyncLocalStorage } from 'node:async_hooks';

// Konfigurasi, cookie dan antrean koneksi TikTok (diekstrak dari streamManager.js).

// Session ID TikTok per-koneksi (bukan lagi global lintas user): hook fetch membacanya dari konteks async
const ttSessionContext = new AsyncLocalStorage();

// Auto-reconnect TikTok: jeda bertahap (ms). Tidak ada polling saat channel offline;
// retry hanya dipakai saat koneksi putus/gagal tak terduga.
const TIKTOK_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000, 180000];
const TIKTOK_MAX_RETRIES = TIKTOK_RETRY_DELAYS_MS.length;

// Cookie sesi TikTok. Opsional: TIKTOK_TT_TARGET_IDC (cookie `tt-target-idc` dari browser,
// datacenter tempat akun terdaftar) ikut dikirim bila diisi. Kosong = perilaku lama.
function buildTikTokSessionCookie(sId) {
  if (!sId) return '';
  let cookie = `sessionid=${sId}; sessionid_ss=${sId}; sid_tt=${sId}`;
  const idc = (process.env.TIKTOK_TT_TARGET_IDC || '').trim();
  if (idc) cookie += `; tt-target-idc=${idc}`;
  return cookie;
}

// ---------------------------------------------------------------------------
// Anti-lonjakan koneksi TikTok (semua user keluar dari satu IP VPS).
//  - Antrean global: maksimal N koneksi baru berjalan bersamaan, dengan jeda antar start.
//  - Force-refresh per-username digabung (cooldown) dan koneksi sehat tidak diputus.
// ---------------------------------------------------------------------------
// Bisa diatur lewat .env: TIKTOK_MAX_CONCURRENT_STARTS (default 2), TIKTOK_START_SPACING_MS (default 3000)
const _envInt = (name, def, min, max) => {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const TIKTOK_MAX_CONCURRENT_STARTS = _envInt('TIKTOK_MAX_CONCURRENT_STARTS', 2, 1, 10); // koneksi baru yang boleh berjalan bersamaan
const TIKTOK_START_SPACING_MS = _envInt('TIKTOK_START_SPACING_MS', 3000, 0, 60000);     // jeda minimum antar start koneksi baru
// Masa tenggang sebelum koneksi TikTok diputus setelah pendengar terakhir pergi (refresh dock/halaman).
// Jika pendengar kembali dalam masa ini, koneksi TikTok yang sama dipakai ulang (tidak ada putus-sambung baru).
const TIKTOK_IDLE_GRACE_MS = _envInt('TIKTOK_IDLE_GRACE_MS', 60000, 0, 600000);
const TIKTOK_FORCE_COOLDOWN_MS = 10000;      // cooldown force-refresh per username
const TIKTOK_HEALTHY_GRACE_MS = 60000;       // koneksi yang baru tersambung <60s tidak diputus oleh force

const _ttStartQueue = [];
let _ttActiveStarts = 0;
let _ttLastStartAt = 0;
let _ttPumpTimer = null;

function pumpTikTokStartQueue() {
  if (_ttPumpTimer || !_ttStartQueue.length || _ttActiveStarts >= TIKTOK_MAX_CONCURRENT_STARTS) return;
  const wait = Math.max(0, _ttLastStartAt + TIKTOK_START_SPACING_MS - Date.now());
  _ttPumpTimer = setTimeout(() => {
    _ttPumpTimer = null;
    if (!_ttStartQueue.length || _ttActiveStarts >= TIKTOK_MAX_CONCURRENT_STARTS) return;
    const grant = _ttStartQueue.shift();
    _ttActiveStarts++;
    _ttLastStartAt = Date.now();
    let released = false;
    grant(() => {
      if (released) return;
      released = true;
      _ttActiveStarts = Math.max(0, _ttActiveStarts - 1);
      pumpTikTokStartQueue();
    });
    pumpTikTokStartQueue();
  }, wait);
}

// Mengembalikan Promise<release>. Panggil release() setelah percobaan konek selesai.
function acquireTikTokStartSlot() {
  return new Promise((resolve) => {
    _ttStartQueue.push(resolve);
    pumpTikTokStartQueue();
  });
}

export function isTikTokStartQueueBusy() {
  return _ttStartQueue.length > 0 || _ttActiveStarts >= TIKTOK_MAX_CONCURRENT_STARTS;
}

export {
  ttSessionContext,
  TIKTOK_RETRY_DELAYS_MS,
  TIKTOK_MAX_RETRIES,
  buildTikTokSessionCookie,
  TIKTOK_IDLE_GRACE_MS,
  TIKTOK_FORCE_COOLDOWN_MS,
  TIKTOK_HEALTHY_GRACE_MS,
  acquireTikTokStartSlot
};
