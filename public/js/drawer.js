/**
 * StreamPulse - Shared Side Navigation Drawer
 * Digunakan di semua halaman StreamPulse (Homepage, Studio, Features, Privacy, Viewers Counter)
 */
(function () {
  'use strict';

  function initDrawer() {
    const btnOpen = document.getElementById('btnSideDrawerOpen');
    const btnClose = document.getElementById('btnCloseSideDrawer');
    const backdrop = document.getElementById('sideDrawerBackdrop');
    const drawer = document.getElementById('sideDrawer');
    const drawerBtnSetup = document.getElementById('drawerBtnSetup');
    const drawerBtnDonate = document.getElementById('drawerBtnDonate') || document.getElementById('btnDonateModal');

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

    // Keyboard shortcut: Escape to close, M to toggle
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
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

    // Drawer Donate CTA
    if (drawerBtnDonate) {
      drawerBtnDonate.addEventListener('click', () => {
        closeDrawer();
        const donateModal = document.getElementById('donateModal');
        if (donateModal && typeof window.openModal === 'function') {
          window.openModal(donateModal);
        } else if (donateModal) {
          donateModal.classList.add('active');
        } else {
          window.location.href = '/?donate=1';
        }
      });
    }

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
  } else {
    initDrawer();
  }
})();
