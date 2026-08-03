import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('crmLookupApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('crm-lookup:init', listener);
    return () => ipcRenderer.removeListener('crm-lookup:init', listener);
  },
  copy: (text) => ipcRenderer.invoke('crm-lookup:copy', text),
  prepareCopy: (payload) => ipcRenderer.invoke('crm-lookup:prepare-copy', payload),
  openDeal: (url) => ipcRenderer.invoke('crm-lookup:open-deal', url),
  close: () => ipcRenderer.invoke('crm-lookup:close'),
});
