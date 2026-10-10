/**
 * wakelock.js
 * Sistem Penjaga Layar Tetap Menyala (Screen Keep-Alive)
 * Menggabungkan Native Screen Wake Lock API + NoSleep.js (Real Video Loop Fallback)
 * Menjamin layar HP (Android Chrome & iOS Safari) TIDAK AKAN MATI saat memantau stream.
 */

class ScreenKeepAlive {
  constructor() {
    this.isEnabled = true;
    this.wakeLock = null;
    this.noSleep = null;
    this.listeners = [];
    this.status = 'inactive'; // 'active', 'inactive', 'fallback'

    this.init();
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    callback(this.status, this.getDetails());
  }

  notifyStatus(status) {
    this.status = status;
    const details = this.getDetails();
    this.listeners.forEach(cb => {
      try { cb(status, details); } catch (e) {}
    });
  }

  getDetails() {
    return {
      status: this.status,
      isEnabled: this.isEnabled,
      hasNativeApi: 'wakeLock' in navigator && window.isSecureContext,
      hasNoSleep: !!this.noSleep
    };
  }

  async init() {
    // Inisialisasi NoSleep fallback jika tersedia
    if (typeof window.NoSleep !== 'undefined') {
      try {
        this.noSleep = new window.NoSleep();
      } catch (e) {
        console.warn('[WakeLock] Gagal inisialisasi NoSleep:', e);
      }
    }

    // Aktifkan otomatis pada sentuhan / klik pertama di layar HP
    const onUserInteraction = async () => {
      if (this.isEnabled && this.status !== 'active' && this.status !== 'fallback') {
        await this.acquire();
      }
    };

    window.addEventListener('click', onUserInteraction, { passive: true });
    window.addEventListener('touchstart', onUserInteraction, { passive: true });

    // Re-acquire saat halaman kembali fokus/terlihat (misal setelah minimalkan tab)
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.isEnabled) {
        console.log('[WakeLock] Halaman kembali aktif, memperbarui wake lock...');
        await this.acquire();
      }
    });

    // Coba aktifkan langsung (di browser yang mengizinkan)
    if (this.isEnabled) {
      await this.acquire();
    }
  }

  async acquire() {
    if (!this.isEnabled) return false;

    // 1. Coba Native Screen Wake Lock API (Hanya jalan di Secure Context / HTTPS / localhost)
    if ('wakeLock' in navigator && window.isSecureContext) {
      try {
        if (this.wakeLock) {
          try { await this.wakeLock.release(); } catch(e) {}
          this.wakeLock = null;
        }

        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] ✅ Native Screen Wake Lock aktif!');
        this.notifyStatus('active');

        this.wakeLock.addEventListener('release', () => {
          console.log('[WakeLock] Native Wake Lock dilepaskan.');
          if (this.isEnabled && document.visibilityState === 'visible') {
            setTimeout(() => this.acquire(), 1000);
          } else {
            this.notifyStatus('inactive');
          }
        });

        return true;
      } catch (err) {
        console.warn('[WakeLock] Native wake lock gagal, beralih ke NoSleep fallback:', err.message);
      }
    }

    // 2. Fallback NoSleep (Video loop 100% kompatibel di Android & iOS Safari bahkan via HTTP IP lokal)
    if (this.noSleep) {
      try {
        await this.noSleep.enable();
        console.log('[WakeLock] ✅ NoSleep keep-alive aktif (Layar HP dijamin tidak tidur)!');
        this.notifyStatus('fallback');
        return true;
      } catch (err) {
        console.warn('[WakeLock] NoSleep enable gagal (menunggu interaksi layar):', err.message);
      }
    }

    this.notifyStatus('inactive');
    return false;
  }

  async release() {
    this.isEnabled = false;

    if (this.wakeLock) {
      try { await this.wakeLock.release(); } catch (e) {}
      this.wakeLock = null;
    }

    if (this.noSleep) {
      try { this.noSleep.disable(); } catch (e) {}
    }

    this.notifyStatus('inactive');
  }

  async toggle() {
    if (this.isEnabled && (this.status === 'active' || this.status === 'fallback')) {
      await this.release();
      return false;
    } else {
      this.isEnabled = true;
      return await this.acquire();
    }
  }
}

// Inisialisasi instance global
window.screenKeepAlive = new ScreenKeepAlive();
