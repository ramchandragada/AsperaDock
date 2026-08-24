import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('downloadShelfApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('download-shelf:init', listener);
    return () => ipcRenderer.removeListener('download-shelf:init', listener);
  },
  action: (type, value) => ipcRenderer.invoke('download-shelf:action', type, value),
  /** Must be sync during dragstart — main calls webContents.startDrag. */
  startFileDrag: (id) => {
    ipcRenderer.send('download-shelf:drag-start', String(id || ''));
  },
  close: () => ipcRenderer.invoke('download-shelf:close'),
});
