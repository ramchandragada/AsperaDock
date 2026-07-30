import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('aiResultApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ai-result:init', listener);
    return () => ipcRenderer.removeListener('ai-result:init', listener);
  },
  copy: (text) => ipcRenderer.invoke('ai-result:copy', text),
  close: () => ipcRenderer.invoke('ai-result:close'),
});
