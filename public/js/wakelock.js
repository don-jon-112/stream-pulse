/**
 * wakelock.js
 * Sistem penjaga layar selalu aktif (Screen Wake Lock API + Fallback Video Loop)
 * Menjamin layar HP / Mobile browser tidak mati atau terkunci otomatis saat memantau live stream.
 */

class ScreenKeepAlive {
  constructor() {
    this.wakeLock = null;
    this.isEnabled = true; // Default aktif demi kenyamanan pengguna
    this.fallbackVideo = null;
    this.listeners = [];
    this.status = 'initializing'; // 'active', 'inactive', 'fallback', 'unsupported'

    this.init();
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    callback(this.status, this.getDetails());
  }

  notifyStatus(status) {
    this.status = status;
    const details = this.getDetails();
    this.listeners.forEach(cb => cb(status, details));
  }

  getDetails() {
    return {
      status: this.status,
      isEnabled: this.isEnabled,
      hasNativeApi: 'wakeLock' in navigator,
      hasFallback: !!this.fallbackVideo
    };
  }

  async init() {
    this.setupFallbackVideo();

    // Re-acquire wake lock saat halaman kembali terlihat (misal setelah pindah tab/app)
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.isEnabled) {
        console.log('[WakeLock] Page visible again, re-acquiring wake lock...');
        await this.acquire();
      }
    });

    // Coba aktifkan pada interaksi pertama bila browser membatasi auto-request
    const enableOnInteraction = async () => {
      if (this.isEnabled && !this.wakeLock) {
        await this.acquire();
      }
      window.removeEventListener('click', enableOnInteraction);
      window.removeEventListener('touchstart', enableOnInteraction);
    };

    window.addEventListener('click', enableOnInteraction, { once: true });
    window.addEventListener('touchstart', enableOnInteraction, { once: true });

    // Permintaan awal
    if (this.isEnabled) {
      await this.acquire();
    }
  }

  // Setup video fallback 1x1 pixel looping silent video
  setupFallbackVideo() {
    try {
      if (!this.fallbackVideo) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('autoplay', '');
        video.muted = true;
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0.01';
        video.style.pointerEvents = 'none';

        // 1-frame blank base64 video/mp4 loop
        video.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADd2ZXJzAAAAB1ZhcmlhbnQAAAAzZGF0YQAAAAAAAAAAAGFub25vcGVuZWRfaWQAAAAAAAEAAAAiZnJtYXR5cGUAAABhbXA0AAAA';
        document.body.appendChild(video);
        this.fallbackVideo = video;
      }
    } catch (e) {
      console.warn('[WakeLock] Fallback video setup warning:', e);
    }
  }

  async acquire() {
    if (!this.isEnabled) return false;

    // 1. Coba Native Screen Wake Lock API
    if ('wakeLock' in navigator) {
      try {
        if (this.wakeLock) {
          try { await this.wakeLock.release(); } catch(e) {}
          this.wakeLock = null;
        }

        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Native Screen Wake Lock berhasil diaktifkan! 🔒');
        this.notifyStatus('active');

        this.wakeLock.addEventListener('release', () => {
          console.log('[WakeLock] Wake Lock dilepaskan.');
          if (this.isEnabled && document.visibilityState === 'visible') {
            // Coba perbarui lagi
            setTimeout(() => this.acquire(), 1000);
          } else {
            this.notifyStatus('inactive');
          }
        });

        return true;
      } catch (err) {
        console.warn('[WakeLock] Native wake lock gagal, mengaktifkan mode fallback:', err.message);
      }
    }

    // 2. Fallback untuk browser lawas / perangkat tertentu
    if (this.fallbackVideo) {
      try {
        await this.fallbackVideo.play();
        console.log('[WakeLock] Fallback video keep-alive aktif! 🔒');
        this.notifyStatus('fallback');
        return true;
      } catch (err) {
        console.warn('[WakeLock] Fallback video play gagal (menunggu interaksi user):', err.message);
      }
    }

    this.notifyStatus('unsupported');
    return false;
  }

  async release() {
    this.isEnabled = false;
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }

    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
      } catch (e) {}
    }

    this.notifyStatus('inactive');
  }

  async toggle() {
    if (this.isEnabled) {
      await this.release();
      return false;
    } else {
      this.isEnabled = true;
      return await this.acquire();
    }
  }

  // Helper untuk toggle layar penuh (Fullscreen) di HP
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error fullscreen: ${err.message}`);
      });
      return true;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        return false;
      }
    }
    return false;
  }
}

// Export singleton instance
window.screenKeepAlive = new ScreenKeepAlive();
