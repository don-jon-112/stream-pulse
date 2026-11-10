# Changelog

All notable changes to the **StreamPulse** (StreamChat) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.1] - 2026-11-11

### Fixed
- **Old Chat Fade-Out Transparency (`chatFade`)**: Fixed broken transparency effect by switching from flaky container CSS mask gradient to reliable per-bubble opacity scaling with hardware-accelerated transitions. Old messages now smoothly and visibly fade according to the configured intensity (0% to 95%).
- **Studio Chat Fade Text Contrast**: Resolved hardcoded dark text color in Studio chat fade label to adapt seamlessly with dark mode.

---

## [2.1.0] - 2026-11-11

### Added
- **Clean Slot-ID OBS URL**: OBS Browser Source URLs are now compact and permanent (`/overlay?id=<slotId>`), removing long query parameter clutter.
- **Real-Time WebSocket Sync**: Instant broadcast of configuration changes to active OBS browser sources via Socket.IO (`overlay_updated`) when saving in Studio without requiring manual browser source re-copying or refreshing.
- **Bubble Rounded Customizer (`chatRounded`)**: Granular border-radius slider (0px to 9999px / pill) with native support across 10 chat themes.
- **Horizontal Direction Choices**: Direction control for horizontal running text (scroll from right to left vs. from left to right).
- **Avatar Size Control (`avatarSize`)**: Configurable avatar dimension (20px to 64px, or theme auto) across all themes that display viewer avatars.
- **Top-Aligned Avatar Layout**: Proper top-alignment for chatter profile pictures on multi-line messages in the `simple single-line` theme.
- **Automatic Slot Provisioning**: Seamless auto-creation of a default user slot upon new registration or first login, eliminating access denied errors when saving overlays.

### Changed
- Overlay Studio help notices updated with instructions for permanent OBS Browser Source links.
- Updated database handling in `routes/overlays.js` to dispatch Socket.IO broadcasts immediately on save.

---

## [2.0.0] - 2026-11-07

### Added
- **Modular Backend Architecture**: Decoupled monolithic `server.js` into modular routes (`routes/overlays.js`, `routes/auth.js`, `routes/spotlight.js`, `routes/socialRotator.js`, `routes/admin.js`) and core libraries (`lib/db.js`, `lib/security.js`, `lib/streamManager.js`).
- **OBS Long Stream Stability Watchdog**: Automated 60-second background maintenance cycle in overlay browser sources to prune orphaned DOM nodes, clear memory-leaking animation timers, and cap deduplication sets.
- **GPU-Accelerated CSS Masking**: Re-engineered chat fade-out animations using hardware-accelerated Chromium CSS Mask gradients for zero CPU overhead.
- **Tiered HTTP Caching & Resilience**: Implemented Stale-While-Revalidate caching and strict network fetch timeouts for third-party endpoints.
- **5-Slot Cloud Quota**: Expanded overlay slot capacity for authenticated streamers from 3 to 5 slots.

### Fixed
- Fixed Twitch GQL viewer counter race conditions and stale room ID caching in TikTok connector.
- Resolved dark/light mode surface contrast and eliminated horizontal scroll on mobile viewport.
- Fixed undefined `isSimEvt` in preview alert rendering.

---

## [1.4.0] - 2026-11-06

### Added
- **TikTok Live Interactive Widgets Suite (`/tiktok-widgets`)**:
  - *Top Gifter Leaderboard*: Dynamic top donor ranking display.
  - *Top Likes Leaderboard*: Real-time tap-like leaderboard.
  - *Gift Jar*: Interactive 2D physics-based drop animation for incoming gifts.
  - *Waterfall Gift Animation*: Full-screen visual cascade for gift events.
  - *TikTok Live Goals*: Target milestone trackers for Followers, Coins, and Likes with 5 distinct visual styles.
- **Animated Social Media Rotator (`/social-rotator`)**: Customizable rotating banner for streamer social channels (YouTube, Twitch, TikTok, Instagram, Twitter/X, Discord) with 9 animation themes.
- **Chat Spotlight Overlay (`/spotlight-overlay`)**: Capability to pin viewer chat comments to stream directly from the OBS dock, complete with automated unpin timers.
- **Real-Time Concurrent Viewers Counter (`/viewers`)**: Unified live viewer monitor for Twitch (GQL-based), YouTube, and TikTok.
- **Standardized Side Drawer**: Unified responsive side menu across all dashboard pages.

### Fixed
- Prevented sound overlap between background widgets and alert effects.
- Corrected real concurrent viewer counting and TikTok room info polling.
- Isolated preview state from production OBS instances.

---

## [1.3.0] - 2026-10-25

### Added
- **Overlay Studio (`/studio`)**: Interactive WYSIWYG configurator with live iframe preview and real-time parameter tweaking.
- **Extensive Theme Library**: Added 10+ distinct chat themes: *Simple Single-Line, Classic, Bubble, Compact, Glass, Minimal Outline, Neon, Paper, Glass v2, Paper v2, Bubbles v2*.
- **Comprehensive Visual Controls**: Custom font sizes, dynamic Google Fonts loader, background opacity, container box styling, and text/sender color palettes.
- **Authentic Twitch Chatter Colors**: Support for native Twitch chatter name colors with automatic dark/light contrast correction.
- **Unified Alert Box**: Customizable alerts for Twitch (Subscriptions, Bits/Cheers, Raids, Channel Point Redeems) and TikTok (Likes, Gifts, Follows).
- **Custom CSS & JS IDE**: In-studio editors allowing streamers to inject custom stylesheets and scripts.
- **Full Bilingual Localization (i18n)**: Instant switching between English (EN) and Indonesian (ID) across the entire platform.

### Fixed
- Prevented duplicate alert dispatches across fast reconnect cycles.
- Improved iframe background transparency in preview environments.

---

## [1.2.0] - 2026-10-15

### Added
- **User Authentication System**: Secure account registration and authentication powered by **Argon2id** password hashing.
- **Email Verification**: One-Time Password (OTP) verification powered by SMTP / Resend API.
- **Cloud Overlay Slots**: Multi-slot profile persistence allowing streamers to save and manage configurations in the cloud.
- **Administrative Portal (`/admin`)**: System dashboard with CPU/RAM statistics, user management, and connection monitors.
- **Security Hardening**:
  - **AES-256-GCM** encryption for stored Twitch OAuth tokens.
  - Anti-brute-force rate limiting on authentication routes.
  - Strict slot authorization checks to prevent unauthorized overwrites.
  - Chat link masking to shield streamers from phishing links.
- **SociaBuzz Donation Integration**: In-app donation modal and tipping support.

---

## [1.1.0] - 2026-10-10

### Added
- **Multi-Emote Support**: Integrated native Twitch/YouTube emotes alongside **7TV** and **BTTV** global registries.
- **Official Platform Badges**: Official badge rendering for Broadcaster, Moderator, VIP, Twitch Subscribers, and YouTube Members.
- **Twitch Channel Points EventSub**: Auto-authorization and live dispatch of custom reward redemptions.
- **Interactive OBS Dock**: Standalone control panel dockable inside OBS Studio.
- **Android APK Build**: Capacitor-based mobile build configuration for mobile streamer monitoring.

---

## [1.0.0] - 2026-10-04

### Added
- **Initial Release**: Core real-time multi-chat aggregation engine combining Twitch, YouTube Live, and TikTok LIVE into a unified feed.
- **WebSocket Gateway**: High-throughput Socket.IO event pipeline broadcasting chat and event streams to browser clients.
- **Basic Overlay**: Foundational OBS chat overlay browser source with basic animation and styling.

