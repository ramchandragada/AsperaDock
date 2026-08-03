import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('forwardPickerApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('forward-picker:init', listener);
    return () => ipcRenderer.removeListener('forward-picker:init', listener);
  },
  pick: (serviceId) => ipcRenderer.invoke('forward-picker:pick', serviceId),
  close: () => ipcRenderer.invoke('forward-picker:close'),
});
