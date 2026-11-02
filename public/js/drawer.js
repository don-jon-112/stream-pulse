/**
 * StreamPulse - Shared Side Navigation Drawer & Universal Modals
 * Digunakan di semua halaman StreamPulse (Homepage, Studio, Features, Privacy, Viewers Counter)
 */
(function () {
  'use strict';

  // Ensure Donate Modal exists on the page
  function ensureDonateModal() {
    let modal = document.getElementById('donateModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'donateModal';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-content modal-donate-content">
          <div class="modal-header">
            <div class="modal-title" style="color: #f59e0b; display:flex; align-items:center; gap:8px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>Dukung StreamPulse (100% Gratis)</span>
            </div>
            <button id="closeDonateModal" class="modal-close" aria-label="Tutup Modal">&times;</button>
          </div>

          <div class="modal-body" style="text-align: center; padding: 22px 18px;">
            <div class="donate-avatar-ring">☕</div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 8px;">Suka Menggunakan StreamPulse?</h2>
            <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.6; max-width: 480px; margin: 0 auto 16px;">
              Aplikasi ini bebas digunakan secara <strong>gratis, tanpa batas, dan tanpa iklan</strong> untuk semua streamer.
              Jika web ini bermanfaat bagi siaran livestream Anda, Anda dapat membantu mendukung biaya sewa server VPS agar tetap aktif 24/7.
            </p>

            <div class="donate-card-perks">
              <div class="perk-item">
                <span class="perk-icon">⚡</span>
                <span>Membantu biaya operasional server VPS & tunnel agar selalu online</span>
              </div>
              <div class="perk-item">
                <span class="perk-icon">🚀</span>
                <span>Mendukung pengembangan fitur baru (emotes, overlay OBS, alert)</span>
              </div>
              <div class="perk-item">
                <span class="perk-icon">❤️</span>
                <span>Dukungan Anda berapapun sangat berarti bagi kreator</span>
              </div>
            </div>

            <div style="margin-top: 22px;">
              <a href="https://sociabuzz.com/joo_nathan" target="_blank" rel="noopener noreferrer" class="btn-donate-cta">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>Traktir Kopi di SociaBuzz (joo_nathan)</span>
              </a>
              <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 10px;">
                Mendukung QRIS, GoPay, OVO, Dana, ShopeePay, & Transfer Bank
              </div>

              <!-- Discord Custom Overlay Support -->
              <div class="discord-support-card" style="margin-top: 18px; text-align: center;">
                <div class="discord-support-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span>🎮 Butuh Custom Overlay Chat?</span>
                </div>
                <p class="discord-support-desc">
                  Jika Anda membutuhkan custom overlay chat atau desain khusus, Anda dapat menghubungi saya di Discord:
                </p>
                <a href="https://discord.gg/GMrBUgwNFu" target="_blank" rel="noopener noreferrer" class="btn-discord-cta">
                  <span>Join Discord</span>
                </a>
              </div>
            </div>
          </div>

          <div class="modal-footer" style="justify-content: center;">
            <button id="btnCancelDonate" class="btn-icon" style="padding: 8px 24px;">Tutup</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Bind close handlers
      const closeBtn = modal.querySelector('#closeDonateModal');
      const cancelBtn = modal.querySelector('#btnCancelDonate');
      if (closeBtn) closeBtn.addEventListener('click', closeDonateModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeDonateModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDonateModal();
      });
    }
    return modal;
  }

  function openDonateModal() {
    const modal = ensureDonateModal();
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function initDrawer() {
    const btnOpen = document.getElementById('btnSideDrawerOpen');
    const btnClose = document.getElementById('btnCloseSideDrawer');
    const backdrop = document.getElementById('sideDrawerBackdrop');
    const drawer = document.getElementById('sideDrawer');
    const drawerBtnSetup = document.getElementById('drawerBtnSetup');

    // Profile elements in drawer
    const drawerUserAvatar = document.getElementById('drawerUserAvatar');
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserRole = document.getElementById('drawerUserRole');

    function openDrawer() {
      if (drawer) drawer.classList.add('active');
      if (backdrop) backdrop.classList.add('active');
      if (drawer) drawer.setAttribute('aria-hidden', 'false');
      syncUserProfile();
    }

    function closeDrawer() {
      if (drawer) drawer.classList.remove('active');
      if (backdrop) backdrop.classList.remove('active');
      if (drawer) drawer.setAttribute('aria-hidden', 'true');
    }

    function toggleDrawer() {
      if (drawer && drawer.classList.contains('active')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    }

    if (btnOpen) btnOpen.addEventListener('click', openDrawer);
    if (btnClose) btnClose.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Keyboard shortcut: Escape to close drawer and modal, M to toggle drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        closeDonateModal();
      } else if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        toggleDrawer();
      }
    });

    // Drawer Setup Channels CTA
    if (drawerBtnSetup) {
      drawerBtnSetup.addEventListener('click', () => {
        closeDrawer();
        const setupModal = document.getElementById('setupModal');
        if (setupModal && typeof window.openModal === 'function') {
          window.openModal(setupModal);
        } else if (setupModal) {
          setupModal.classList.add('active');
        } else {
          window.location.href = '/?setup=1';
        }
      });
    }

    // Attach click listener for any Donate button across the page
    document.addEventListener('click', (e) => {
      const donateTrigger = e.target.closest('#btnDonateModal, #drawerBtnDonate, .btn-open-donate');
      if (donateTrigger) {
        e.preventDefault();
        closeDrawer();
        openDonateModal();
      }
    });

    // Synchronize User profile from localStorage or API
    async function syncUserProfile() {
      try {
        const userToken = localStorage.getItem('streampulse_user_token');
        const rawChannels = localStorage.getItem('streampulse_user_channels') ||
                            localStorage.getItem('streampulse_my_channels') ||
                            localStorage.getItem('streampulse_guest_channels');
        const channels = rawChannels ? JSON.parse(rawChannels) : {};

        if (userToken) {
          try {
            const res = await fetch('/api/user/me', {
              headers: { 'x-user-token': userToken }
            });
            if (res.ok) {
              const u = await res.json();
              if (drawerUserName) drawerUserName.textContent = u.username || 'Streamer Terdaftar';
              if (drawerUserRole) {
                const chNames = [
                  u.channels?.twitch ? `@${u.channels.twitch}` : '',
                  u.channels?.youtube ? `${u.channels.youtube}` : '',
                  u.channels?.tiktok ? `@${u.channels.tiktok}` : ''
                ].filter(Boolean).join(' • ');
                drawerUserRole.textContent = chNames || 'Akun Streamer Aktif';
              }
              if (drawerUserAvatar) {
                drawerUserAvatar.textContent = (u.username ? u.username.charAt(0).toUpperCase() : '👤');
              }
              return;
            }
          } catch (err) {
            // fallback below
          }
        }

        // Guest / unauthenticated fallback
        const activeName = channels.twitch || channels.tiktok || channels.youtube;
        if (activeName) {
          if (drawerUserName) drawerUserName.textContent = activeName;
          if (drawerUserRole) drawerUserRole.textContent = 'Mode Tamu (Tersimpan Lokal)';
          if (drawerUserAvatar) drawerUserAvatar.textContent = activeName.charAt(0).toUpperCase();
        } else {
          if (drawerUserName) drawerUserName.textContent = 'Streamer Tamu';
          if (drawerUserRole) drawerUserRole.textContent = 'Mode Tamu • Klik untuk Login';
          if (drawerUserAvatar) drawerUserAvatar.textContent = '👤';
        }
      } catch (e) {
        console.warn('[Drawer] Failed to sync user profile:', e);
      }
    }

    syncUserProfile();

    window.StreamPulseDrawer = {
      open: openDrawer,
      close: closeDrawer,
      toggle: toggleDrawer,
      sync: syncUserProfile
    };

    window.openDonateModal = openDonateModal;
    window.closeDonateModal = closeDonateModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
  } else {
    initDrawer();
  }
})();
