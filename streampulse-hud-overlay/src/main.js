import { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Chromium Low-Memory Optimization Switches (Game Friendly) ===
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=64');
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,CalculateNativeWinOcclusion,InterestFeedContentSuggestions');
app.commandLine.appendSwitch('renderer-process-limit', '2');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-print-preview');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('mute-audio');

let overlayWindow = null;
let isOverlayLocked = false;
let isOverlayVisible = true;
let tray = null;
let isQuitting = false;

// Config Storage Helper
function getConfigPath() {
  return path.join(app.getPath('userData'), 'hud-config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {
      serverUrl: 'https://joo-nathan.my.id',
      useRemoteUI: false, // Jika true: load dari https://joo-nathan.my.id/in-game-overlay, jika false: load local file
      width: 380,
      height: 520,
      x: 40,
      y: 80
    };
  }
}

function saveConfig(data) {
  try {
    const current = loadConfig();
    const updated = { ...current, ...data };
    fs.writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('[Config] Failed to save:', err);
  }
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }

  const config = loadConfig();
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const preloadPath = path.join(__dirname, 'preload.cjs');

  overlayWindow = new BrowserWindow({
    width: config.width || 380,
    height: config.height || 520,
    minWidth: 260,
    minHeight: 280,
    x: config.x ?? 40,
    y: config.y ?? 80,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    title: 'StreamPulse - In-Game HUD Overlay',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      devTools: false,
      backgroundThrottling: false
    }
  });

  // Always on top level tinggi agar melayang di depan Game Borderless / Fullscreen
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.webContents.setAudioMuted(true);

  // Izinkan popup OAuth (Twitch / YouTube / Google) terbuka sebagai jendela otentikasi
  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/auth/twitch') || url.includes('id.twitch.tv') || url.includes('/auth/youtube') || url.includes('accounts.google.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          alwaysOnTop: true,
          title: 'StreamPulse - Otentikasi OAuth',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Simpan posisi & ukuran saat dipindah/diubah
  overlayWindow.on('resize', () => {
    if (!overlayWindow) return;
    const [width, height] = overlayWindow.getSize();
    saveConfig({ width, height });
  });

  overlayWindow.on('move', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    saveConfig({ x, y });
  });

  // Load URL atau File Lokal
  if (config.useRemoteUI && config.serverUrl) {
    const cleanServer = config.serverUrl.replace(/\/$/, '');
    overlayWindow.loadURL(`${cleanServer}/in-game-overlay`);
  } else {
    overlayWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    isOverlayLocked = false;
    isQuitting = true;
    app.quit();
    process.exit(0);
  });
}

function toggleOverlayLock() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
    return;
  }
  isOverlayLocked = !isOverlayLocked;

  if (isOverlayLocked) {
    // Mode Lock: Mouse click 100% tembus ke game
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.webContents.send('overlay-toggle-lock', true);
  } else {
    // Mode Edit: Mouse bisa geser & ubah ukuran overlay
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.webContents.send('overlay-toggle-lock', false);
  }
  updateTrayMenu();
}

function toggleOverlayVisibility() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
    return;
  }

  isOverlayVisible = !isOverlayVisible;
  if (isOverlayVisible) {
    overlayWindow.show();
  } else {
    overlayWindow.hide();
  }
  updateTrayMenu();
}

function resetOverlayPosition() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
    return;
  }
  overlayWindow.setSize(380, 520);
  overlayWindow.setPosition(40, 80);
  saveConfig({ width: 380, height: 520, x: 40, y: 80 });
  if (isOverlayLocked) toggleOverlayLock();
}

// Global Shortcuts
function registerShortcuts() {
  globalShortcut.register('F8', toggleOverlayLock);
  globalShortcut.register('CommandOrControl+Shift+X', toggleOverlayLock);
  globalShortcut.register('F9', toggleOverlayVisibility);
  globalShortcut.register('CommandOrControl+Shift+H', toggleOverlayVisibility);
  globalShortcut.register('CommandOrControl+Shift+Z', resetOverlayPosition);
}

// System Tray
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  icon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('StreamPulse - In-Game HUD Overlay');
  updateTrayMenu();
  tray.on('double-click', () => {
    if (overlayWindow) {
      overlayWindow.show();
      overlayWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'StreamPulse In-Game HUD Overlay',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isOverlayLocked ? '🔓 Buka Kunci (Mode Edit)' : '🔒 Kunci (Tembus Mouse ke Game)',
      accelerator: 'F8',
      click: toggleOverlayLock
    },
    {
      label: isOverlayVisible ? '👁️ Sembunyikan Overlay' : '👁️ Tampilkan Overlay',
      accelerator: 'F9',
      click: toggleOverlayVisibility
    },
    {
      label: '🔄 Reset Posisi & Ukuran Jendela',
      accelerator: 'Ctrl+Shift+Z',
      click: resetOverlayPosition
    },
    { type: 'separator' },
    {
      label: 'Keluar (Quit)',
      click: () => {
        isQuitting = true;
        app.quit();
        process.exit(0);
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// IPC Handlers
ipcMain.on('overlay-ignore-mouse-events', (_event, { ignore, forward }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: !!forward });
  }
});

ipcMain.on('overlay-toggle-lock-request', toggleOverlayLock);
ipcMain.on('overlay-toggle-visibility-request', toggleOverlayVisibility);

ipcMain.on('overlay-close', () => {
  isQuitting = true;
  app.quit();
  process.exit(0);
});

ipcMain.on('overlay-minimize', () => {
  if (overlayWindow) overlayWindow.minimize();
});

ipcMain.on('overlay-set-pinned', (_event, pinned) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setAlwaysOnTop(pinned, 'screen-saver', 1);
  }
});

ipcMain.on('overlay-save-config', (_event, cfg) => {
  saveConfig(cfg);
});

ipcMain.handle('overlay-load-config', () => {
  return loadConfig();
});

ipcMain.on('overlay-set-server-url', (_event, url) => {
  saveConfig({ serverUrl: url });
});

// App Lifecycle
app.whenReady().then(() => {
  createOverlayWindow();
  registerShortcuts();
  createTray();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
  process.exit(0);
});
