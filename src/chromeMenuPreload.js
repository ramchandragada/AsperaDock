import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chromeMenuApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('chrome-menu:init', listener);
    return () => ipcRenderer.removeListener('chrome-menu:init', listener);
  },
  action: (type) => ipcRenderer.invoke('chrome-menu:action', type),
  close: () => ipcRenderer.invoke('chrome-menu:close'),
});
