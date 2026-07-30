import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('appMenuApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('app-menu:init', listener);
    return () => ipcRenderer.removeListener('app-menu:init', listener);
  },
  action: (type, value) => ipcRenderer.invoke('app-menu:action', type, value),
  close: () => ipcRenderer.invoke('app-menu:close'),
});
