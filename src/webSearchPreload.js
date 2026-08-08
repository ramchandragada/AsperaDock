import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('webSearchApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('web-search:init', listener);
    return () => ipcRenderer.removeListener('web-search:init', listener);
  },
  search: (text) => ipcRenderer.invoke('web-search:go', text),
  close: () => ipcRenderer.invoke('web-search:close'),
});
