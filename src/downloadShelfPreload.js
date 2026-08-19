import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('downloadShelfApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('download-shelf:init', listener);
    return () => ipcRenderer.removeListener('download-shelf:init', listener);
  },
  action: (type, value) => ipcRenderer.invoke('download-shelf:action', type, value),
  close: () => ipcRenderer.invoke('download-shelf:close'),
});
