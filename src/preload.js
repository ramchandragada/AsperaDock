import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('asperadock', {
  getState: () => ipcRenderer.invoke('dock:get-state'),
  activate: (id) => ipcRenderer.invoke('dock:activate', id),
  addService: (appId) => ipcRenderer.invoke('dock:add-service', appId),
  removeService: (id) => ipcRenderer.invoke('dock:remove-service', id),
  saveAppConfig: (id, patch) => ipcRenderer.invoke('dock:save-app-config', id, patch),
  appNavigate: (id, action) => ipcRenderer.invoke('dock:app-navigate', id, action),
  hibernate: (id) => ipcRenderer.invoke('dock:hibernate', id),
  hibernateBackground: () => ipcRenderer.invoke('dock:hibernate-background'),
  reloadActive: () => ipcRenderer.invoke('dock:reload-active'),
  toggleFocus: () => ipcRenderer.invoke('dock:toggle-focus'),
  toggleMute: () => ipcRenderer.invoke('dock:toggle-mute'),
  saveSettings: (patch) => ipcRenderer.invoke('dock:save-settings', patch),
  lock: () => ipcRenderer.invoke('dock:lock'),
  unlock: (password) => ipcRenderer.invoke('dock:unlock', password),
  clearSession: (id) => ipcRenderer.invoke('dock:clear-session', id),
  reorder: (order) => ipcRenderer.invoke('dock:reorder', order),
  pickDownloadDir: () => ipcRenderer.invoke('dock:pick-download-dir'),
  setOverlay: (open) => ipcRenderer.invoke('dock:set-overlay', open),
  setChromeSize: (size) => ipcRenderer.invoke('dock:set-chrome-size', size),
  clearNotifications: () => ipcRenderer.invoke('dock:clear-notifications'),
  markAllRead: () => ipcRenderer.invoke('dock:mark-all-read'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('dock:state', listener);
    return () => ipcRenderer.removeListener('dock:state', listener);
  },
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-settings', listener);
    return () => ipcRenderer.removeListener('dock:open-settings', listener);
  },
  onOpenAppsSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-apps-settings', listener);
    return () => ipcRenderer.removeListener('dock:open-apps-settings', listener);
  },
  onOpenSearch: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-search', listener);
    return () => ipcRenderer.removeListener('dock:open-search', listener);
  },
});
