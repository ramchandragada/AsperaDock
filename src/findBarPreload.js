import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('findBarApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('find-bar:init', listener);
    return () => ipcRenderer.removeListener('find-bar:init', listener);
  },
  onResult: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('find-bar:result', listener);
    return () => ipcRenderer.removeListener('find-bar:result', listener);
  },
  find: (text, options) =>
    ipcRenderer.invoke('find-bar:find', text, options || {}),
  close: () => ipcRenderer.invoke('find-bar:close'),
});
