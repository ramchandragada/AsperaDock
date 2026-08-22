import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('extensionsApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('extensions:init', listener);
    return () => ipcRenderer.removeListener('extensions:init', listener);
  },
  loadUnpacked: () => ipcRenderer.invoke('extensions:load-unpacked'),
  installWebStore: (input) =>
    ipcRenderer.invoke('extensions:install-webstore', input),
  installPackage: () => ipcRenderer.invoke('extensions:install-package'),
  openWebStore: (input) => ipcRenderer.invoke('extensions:open-webstore', input),
  setEnabled: (id, enabled) =>
    ipcRenderer.invoke('extensions:set-enabled', id, enabled),
  remove: (id) => ipcRenderer.invoke('extensions:remove', id),
  reloadGuests: () => ipcRenderer.invoke('extensions:reload-guests'),
  open: (id) => ipcRenderer.invoke('extensions:open', id),
  close: () => ipcRenderer.invoke('extensions:close'),
});
