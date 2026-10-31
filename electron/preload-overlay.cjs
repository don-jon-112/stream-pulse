const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronOverlay', {
  isElectron: true,
  setIgnoreMouseEvents: (ignore, forward) => {
    ipcRenderer.send('overlay-ignore-mouse-events', { ignore, forward });
  },
  toggleLock: () => {
    ipcRenderer.send('overlay-toggle-lock-request');
  },
  toggleVisibility: () => {
    ipcRenderer.send('overlay-toggle-visibility-request');
  },
  close: () => ipcRenderer.send('overlay-close'),
  minimize: () => ipcRenderer.send('overlay-minimize'),
  togglePin: (pinned) => ipcRenderer.send('overlay-set-pinned', pinned),
  setServerUrl: (url) => ipcRenderer.send('overlay-set-server-url', url),
  saveConfig: (cfg) => ipcRenderer.send('overlay-save-config', cfg),
  loadConfig: () => ipcRenderer.invoke('overlay-load-config'),
  onToggleLock: (callback) => {
    ipcRenderer.on('overlay-toggle-lock', (_event, value) => callback(value));
  }
});
