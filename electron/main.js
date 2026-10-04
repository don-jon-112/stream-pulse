import { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the Express & Socket.io backend server
import '../server.js';

// === Chromium & V8 Low-Memory Optimization Switches ===
// Batasi V8 Heap agar agresif membersihkan memori dan tidak menahan RAM ratusan MB
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=64');

// Nonaktifkan proses renderer cadangan Chromium (menghemat 40-60MB RAM)
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,CalculateNativeWinOcclusion,InterestFeedContentSuggestions');
app.commandLine.appendSwitch('renderer-process-limit', '1');

// Matikan modul-modul Chromium yang tidak dipakai
app.commandLine.appendSwitch('disable-breakpad');                  // Crash reporter
app.commandLine.appendSwitch('disable-component-update');          // Updater internal
app.commandLine.appendSwitch('disable-print-preview');             // Modul print
app.commandLine.appendSwitch('disable-speech-api');                // Speech recognition
app.commandLine.appendSwitch('disable-background-networking');     // Background network sync
app.commandLine.appendSwitch('disable-sync');                      // Chrome sync
app.commandLine.appendSwitch('disable-domain-reliability');        // Telemetry
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('disable-dev-shm-usage');

// Matikan proses GPU terpisah Chromium (menghemat 70-100MB RAM!)
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-d3d11');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
// Nonaktifkan audio hardware sepenuhnya (Mode Hening)
app.commandLine.appendSwitch('mute-audio');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const PORT = process.env.PORT || 3000;
const APP_URL = `http://localhost:${PORT}`;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'public', 'icons', 'icon-512.png');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: '#06080d',
    title: 'StreamPulse MultiChat - Livestream Monitor',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,             // Nonaktifkan kamus spellcheck (menghemat 30-50MB RAM!)
      devTools: false,
      backgroundThrottling: true,     // Turunkan penggunaan CPU/RAM saat window diminimize
      enableWebSQL: false
    }
  });

  // Mute audio di level browser webContents
  mainWindow.webContents.setAudioMuted(true);

  // Bersihkan cache storage Electron agar selalu memuat versi bersih terbaru
  try {
    mainWindow.webContents.session.clearCache();
    mainWindow.webContents.session.clearStorageData();
  } catch (_) {}

  // Load the web app
  mainWindow.loadURL(APP_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setAudioMuted(true);
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray on close if user prefers, or quit
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'public', 'icons', 'icon-192.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);
    tray.setToolTip('StreamPulse MultiChat - Aktif di Background');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Tampilkan StreamPulse',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Pin Always on Top (Tetap di Atas)',
        type: 'checkbox',
        checked: false,
        click: (item) => {
          if (mainWindow) {
            mainWindow.setAlwaysOnTop(item.checked);
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Buka di Browser',
        click: () => {
          shell.openExternal(APP_URL);
        }
      },
      { type: 'separator' },
      {
        label: 'Keluar (Quit)',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
        }
      }
    });
  } catch (err) {
    console.warn('Tray creation warning:', err);
  }
}

// Single instance lock (prevent multiple instances opening)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // Jalankan Garbage Collector berkala (tiap 60 detik) untuk membebaskan memori yang tidak dipakai
    setInterval(() => {
      if (typeof global.gc === 'function') {
        try {
          global.gc();
        } catch (_) {}
      }
    }, 60000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Keep running in tray or quit if isQuitting
      if (isQuitting) {
        app.quit();
      }
    }
  });
}
