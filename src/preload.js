import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('asperadock', {
  getState: () => ipcRenderer.invoke('dock:get-state'),
  activate: (id) => ipcRenderer.invoke('dock:activate', id),
  addService: (appId, profileId) =>
    ipcRenderer.invoke('dock:add-service', appId, profileId),
  findInPage: (text, options) =>
    ipcRenderer.invoke('dock:find-in-page', text, options),
  stopFind: () => ipcRenderer.invoke('dock:stop-find'),
  printActive: () => ipcRenderer.invoke('dock:print-active'),
  removeService: (id) => ipcRenderer.invoke('dock:remove-service', id),
  createProfile: (name) => ipcRenderer.invoke('dock:create-profile', name),
  renameProfile: (id, name) => ipcRenderer.invoke('dock:rename-profile', id, name),
  deleteProfile: (id) => ipcRenderer.invoke('dock:delete-profile', id),
  setInstanceProfile: (serviceId, profileId) =>
    ipcRenderer.invoke('dock:set-instance-profile', serviceId, profileId),
  toggleKeepWarm: (id) => ipcRenderer.invoke('dock:toggle-keep-warm', id),
  prefetch: (id) => ipcRenderer.invoke('dock:prefetch', id),
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
  openDownloads: () => ipcRenderer.invoke('dock:open-downloads'),
  openAppMenu: (payload) => ipcRenderer.invoke('dock:open-app-menu', payload),
  closeAppMenu: () => ipcRenderer.invoke('dock:close-app-menu'),
  openChromeMenu: (payload) => ipcRenderer.invoke('dock:open-chrome-menu', payload),
  closeChromeMenu: () => ipcRenderer.invoke('dock:close-chrome-menu'),
  toggleChromeMenu: (payload) => ipcRenderer.invoke('dock:toggle-chrome-menu', payload),
  openNotifCenter: (payload) => ipcRenderer.invoke('dock:open-notif-center', payload),
  closeNotifCenter: () => ipcRenderer.invoke('dock:close-notif-center'),
  toggleNotifCenter: (payload) => ipcRenderer.invoke('dock:toggle-notif-center', payload),
  aiStatus: () => ipcRenderer.invoke('dock:ai-status'),
  aiSetKey: (providerId, apiKey) =>
    ipcRenderer.invoke('dock:ai-set-key', providerId, apiKey),
  aiClearKey: (providerId) => ipcRenderer.invoke('dock:ai-clear-key', providerId),
  aiCatchUp: (opts) => ipcRenderer.invoke('dock:ai-catch-up', opts),
  aiSummarize: (opts) => ipcRenderer.invoke('dock:ai-summarize', opts),
  setOverlay: (open) => ipcRenderer.invoke('dock:set-overlay', open),
  setChromeSize: (size) => ipcRenderer.invoke('dock:set-chrome-size', size),
  clearNotifications: () => ipcRenderer.invoke('dock:clear-notifications'),
  markAllRead: () => ipcRenderer.invoke('dock:mark-all-read'),
  heartbeat: () => ipcRenderer.invoke('dock:heartbeat'),
  reportError: (payload) => ipcRenderer.invoke('dock:report-error', payload),
  listErrorReports: () => ipcRenderer.invoke('dock:list-error-reports'),
  openErrorReports: () => ipcRenderer.invoke('dock:open-error-reports'),
  updateStatus: () => ipcRenderer.invoke('dock:update-status'),
  updateCheck: () => ipcRenderer.invoke('dock:update-check'),
  updateDownload: () => ipcRenderer.invoke('dock:update-download'),
  updateInstall: () => ipcRenderer.invoke('dock:update-install'),
  showAbout: () => ipcRenderer.invoke('dock:show-about'),
  onUpdateEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('dock:update-event', listener);
    return () => ipcRenderer.removeListener('dock:update-event', listener);
  },
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
  onOpenProfiles: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-profiles', listener);
    return () => ipcRenderer.removeListener('dock:open-profiles', listener);
  },
  onOpenSearch: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-search', listener);
    return () => ipcRenderer.removeListener('dock:open-search', listener);
  },
  onOpenEditApp: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('dock:open-edit-app', listener);
    return () => ipcRenderer.removeListener('dock:open-edit-app', listener);
  },
  onChromeAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('dock:chrome-action', listener);
    return () => ipcRenderer.removeListener('dock:chrome-action', listener);
  },
  onOpenAiSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-ai-settings', listener);
    return () => ipcRenderer.removeListener('dock:open-ai-settings', listener);
  },
  onOpenFind: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:open-find', listener);
    return () => ipcRenderer.removeListener('dock:open-find', listener);
  },
  onFindResult: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('dock:find-result', listener);
    return () => ipcRenderer.removeListener('dock:find-result', listener);
  },
  onSyncOverlay: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('dock:sync-overlay', listener);
    return () => ipcRenderer.removeListener('dock:sync-overlay', listener);
  },
});
