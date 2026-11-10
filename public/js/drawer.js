/**
 * StreamPulse - Shared Side Navigation Drawer & Universal Modals
 * Autonomous Component: Injects Side Drawer & Donate Modal across all pages
 */
(function () {
  'use strict';

  const DRAWER_VERSION = 'v2.1.4';

  function getDrawerHtmlTemplate() {
    return `
    <div class="drawer-header">
      <div class="drawer-brand">
        <div class="brand-logo">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div class="drawer-title-group">
          <span class="drawer-title">StreamPulse</span>
          <span class="drawer-badge">PRO MAX</span>
        </div>
      </div>
      <button id="btnCloseSideDrawer" class="btn-drawer-close" aria-label="Tutup Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- User Profile Card in Drawer -->
    <a href="/studio" class="drawer-user-hero" id="drawerUserHero" title="Buka Panel Profil & OBS Studio">
      <div class="drawer-user-avatar" id="drawerUserAvatar">👤</div>
      <div class="drawer-user-meta">
        <div class="drawer-user-name" id="drawerUserName">Streamer Tamu</div>
        <div class="drawer-user-role" id="drawerUserRole">Mode Tamu • Klik untuk Login</div>
      </div>
      <div class="drawer-user-arrow">→</div>
    </a>

    <!-- Drawer Navigation Content -->
    <div class="drawer-scroll-body">
      <!-- Section 1: Saluran & Monitor -->
      <div class="drawer-section">
        <div class="drawer-section-title">SALURAN MONITOR</div>

        <a href="/" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:var(--primary); background:rgba(99,102,241,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">MultiChat Dashboard</span>
            <span class="drawer-nav-desc">Live chat multi-platform Twitch, YT & TikTok</span>
          </div>
        </a>

        <button id="drawerBtnSetup" class="drawer-nav-item" type="button">
          <div class="drawer-icon-wrap" style="color:#a855f7; background:rgba(168,85,247,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Atur Saluran Monitor</span>
            <span class="drawer-nav-desc">Hubungkan Twitch, YouTube & TikTok</span>
          </div>
        </button>
      </div>

      <!-- Section 2: OBS Tools -->
      <div class="drawer-section">
        <div class="drawer-section-title">OBS TOOLS</div>

        <a href="/dock" target="_blank" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#06b6d4; background:rgba(6,182,212,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10z"/>
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">OBS Custom Dock</span>
            <span class="drawer-nav-desc">Panel chat interaktif untuk OBS Studio</span>
          </div>
        </a>

        <a href="/viewers" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#38bdf8; background:rgba(56,189,248,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Live Viewers Counter</span>
            <span class="drawer-nav-desc">Widget penghitung penonton siaran untuk OBS</span>
          </div>
        </a>

        <a href="/social-rotator" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#a855f7; background:rgba(168,85,247,0.14);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Social Media Rotator <span style="font-size:0.62rem; background:rgba(168,85,247,0.2); color:#a855f7; padding:1px 5px; border-radius:4px; font-weight:800; margin-left:4px;">NEW</span></span>
            <span class="drawer-nav-desc">Rotator akun sosial media animasi untuk OBS</span>
          </div>
        </a>

        <a href="/studio" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#ec4899; background:rgba(236,72,153,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.27 19.57 10.58 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-1.38 0-2.63-.47-3.64-1.26l2.35-2.35c.78.39 1.66.61 2.59.61 3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6c0 .93.22 1.81.61 2.59L5.56 19.94C4.59 18.73 4 17.2 4 15.5c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Overlay Studio & CSS</span>
            <span class="drawer-nav-desc">Kustomisasi tema & animasi browser source</span>
          </div>
        </a>
      </div>

      <!-- Section: Widget TikTok LIVE -->
      <div class="drawer-section">
        <div class="drawer-section-title" style="color:#fe2c55; display:flex; align-items:center; gap:6px;">
          <span>WIDGET TIKTOK LIVE</span>
          <span style="font-size:0.62rem; background:rgba(254,44,85,0.15); color:#fe2c55; padding:1px 6px; border-radius:4px; font-weight:800;">NEW</span>
        </div>

        <a href="/tiktok-widgets" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#fe2c55; background:rgba(254,44,85,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.4a6.33 6.33 0 0 0-.86-.06A6.34 6.34 0 0 0 3.1 15.68a6.34 6.34 0 0 0 10.82 4.48c.03-.03.06-.06.09-.1V10.74a8.27 8.27 0 0 0 5.58 2.18V9.47a4.86 4.86 0 0 1-3.77-2.78z"/>
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Widget TikTok LIVE Hub</span>
            <span class="drawer-nav-desc">Top Gifter, Top Like, Jar, Waterfall & Alert</span>
          </div>
        </a>
      </div>

      <!-- Section 3: Komunitas & Informasi -->
      <div class="drawer-section">
        <div class="drawer-section-title">KOMUNITAS & BANTUAN</div>

        <a href="/features" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#8b5cf6; background:rgba(139,92,246,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Roadmap Fitur</span>
            <span class="drawer-nav-desc">Papan progres & voting roadmap komunitas</span>
          </div>
        </a>

        <button id="btnDonateModal" class="drawer-nav-item" type="button">
          <div class="drawer-icon-wrap" style="color:#f97316; background:rgba(249,115,22,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Dukung Pengembang</span>
            <span class="drawer-nav-desc">Traktir kopi via SociaBuzz / QRIS</span>
          </div>
        </button>

        <a href="/privacy" class="drawer-nav-item">
          <div class="drawer-icon-wrap" style="color:#10b981; background:rgba(16,185,129,0.12);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
          <div class="drawer-nav-text">
            <span class="drawer-nav-label">Kebijakan Privasi</span>
            <span class="drawer-nav-desc">Keamanan enkripsi AES & data akun</span>
          </div>
        </a>
      </div>
    </div>

    <!-- Drawer Footer -->
    <div class="drawer-footer">
      <button type="button" id="drawerBtnLogout" class="btn-drawer-logout" title="Keluar dari akun">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span id="drawerLogoutLabel">Keluar Akun (Logout)</span>
      </button>
      <div class="drawer-footer-info">
        <span class="drawer-footer-title">StreamPulse MultiChat PRO</span>
        <span class="drawer-footer-sub">${DRAWER_VERSION} • All Systems Active</span>
      </div>
    </div>
    `;
  }

  // Ensure Side Drawer & Backdrop DOM elements exist on the page
  function ensureSideDrawer() {
    let backdrop = document.getElementById('sideDrawerBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sideDrawerBackdrop';
      backdrop.className = 'drawer-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.prepend(backdrop);
    }

    let drawer = document.getElementById('sideDrawer');
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'sideDrawer';
      drawer.className = 'side-drawer';
      drawer.setAttribute('aria-label', 'Menu Navigasi Samping');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.prepend(drawer);
    }

    // Populate with component template
    drawer.innerHTML = getDrawerHtmlTemplate();

    return { backdrop, drawer };
  }

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
      modal.classList.add('show');
      modal.classList.add('active');
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) {
      modal.classList.remove('show');
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function initDrawer() {
    const { backdrop, drawer } = ensureSideDrawer();
    const btnOpen = document.getElementById('btnSideDrawerOpen');
    const btnClose = document.getElementById('btnCloseSideDrawer');
    const drawerBtnSetup = document.getElementById('drawerBtnSetup');

    // Profile elements in drawer
    const drawerUserAvatar = document.getElementById('drawerUserAvatar');
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserRole = document.getElementById('drawerUserRole');
    const drawerUserHero = document.getElementById('drawerUserHero');

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

    // Highlight active link based on current path
    function highlightActiveLink() {
      if (!drawer) return;
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
      drawer.querySelectorAll('.drawer-nav-item[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          const linkPath = href.split('?')[0].replace(/\/$/, '') || '/';
          if (linkPath === currentPath) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        }
      });
    }

    if (btnOpen) btnOpen.addEventListener('click', openDrawer);
    if (btnClose) btnClose.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Global listener for open drawer trigger across all page variants
    document.addEventListener('click', (e) => {
      const openTrigger = e.target.closest('#btnSideDrawerOpen, .btn-side-drawer-open, .btn-open-drawer');
      if (openTrigger) {
        e.preventDefault();
        openDrawer();
      }
    });

    highlightActiveLink();

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
        setTimeout(() => {
          openDonateModal();
        }, 10);
      }
    });

    // Drawer Logout Button in Footer
    function initDrawerLogout() {
      const btn = document.getElementById('drawerBtnLogout');
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
          const hasToken = Boolean(localStorage.getItem('streampulse_user_token'));
          const confirmMsg = hasToken
            ? 'Apakah Anda yakin ingin keluar dari akun?'
            : 'Keluar dan bersihkan sesi saluran yang tersimpan di browser ini?';
          if (confirm(confirmMsg)) {
            localStorage.removeItem('streampulse_user_token');
            localStorage.removeItem('streampulse_user_channels');
            localStorage.removeItem('streampulse_my_channels');
            localStorage.removeItem('streampulse_guest_channels');
            closeDrawer();
            window.location.reload();
          }
        });
      }
    }

    initDrawerLogout();

    // Synchronize User profile from localStorage or API
    async function syncUserProfile() {
      try {
        initDrawerLogout();
        const drawerLogoutLabel = document.getElementById('drawerLogoutLabel');
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
              if (drawerUserHero) drawerUserHero.href = '/studio';
              if (drawerUserName) drawerUserName.textContent = u.username || 'Streamer Terdaftar';
              if (drawerLogoutLabel && u.username) {
                drawerLogoutLabel.textContent = `Keluar (${u.username})`;
              }
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
        if (drawerLogoutLabel) {
          drawerLogoutLabel.textContent = 'Keluar Akun (Logout)';
        }
        const activeName = channels.twitch || channels.tiktok || channels.youtube;
        if (activeName) {
          if (drawerUserName) drawerUserName.textContent = activeName;
          if (drawerUserRole) drawerUserRole.textContent = 'Mode Tamu (Tersimpan Lokal)';
          if (drawerUserAvatar) drawerUserAvatar.textContent = activeName.charAt(0).toUpperCase();
        } else {
          if (drawerUserHero) drawerUserHero.href = '/studio?auth=1';
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
