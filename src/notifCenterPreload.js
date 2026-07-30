import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('notifCenterApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('notif-center:init', listener);
    return () => ipcRenderer.removeListener('notif-center:init', listener);
  },
  action: (type, value) => ipcRenderer.invoke('notif-center:action', type, value),
  close: () => ipcRenderer.invoke('notif-center:close'),
});
