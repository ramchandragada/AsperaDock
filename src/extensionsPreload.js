import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('extensionsApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('extensions:init', listener);
    return () => ipcRenderer.removeListener('extensions:init', listener);
  },
  loadUnpacked: () => ipcRenderer.invoke('extensions:load-unpacked'),
  setEnabled: (id, enabled) =>
    ipcRenderer.invoke('extensions:set-enabled', id, enabled),
  remove: (id) => ipcRenderer.invoke('extensions:remove', id),
  reloadGuests: () => ipcRenderer.invoke('extensions:reload-guests'),
  close: () => ipcRenderer.invoke('extensions:close'),
});
