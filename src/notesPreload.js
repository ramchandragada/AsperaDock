import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('notesApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('notes:init', listener);
    return () => ipcRenderer.removeListener('notes:init', listener);
  },
  save: (note) => ipcRenderer.invoke('notes:save', note),
  delete: (id) => ipcRenderer.invoke('notes:delete', id),
  copy: (text) => ipcRenderer.invoke('notes:copy', text),
  close: () => ipcRenderer.invoke('notes:close'),
});
