import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('aiResultApi', {
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ai-result:init', listener);
    return () => ipcRenderer.removeListener('ai-result:init', listener);
  },
  copy: (text) => ipcRenderer.invoke('ai-result:copy', text),
  close: () => ipcRenderer.invoke('ai-result:close'),
  readClipboard: () => ipcRenderer.invoke('ai-result:read-clipboard'),
  pasteClipboard: () => ipcRenderer.invoke('ai-result:paste-clipboard'),
  runClipboard: (payload) => ipcRenderer.invoke('ai-result:run-clipboard', payload),
  attachFile: (payload) => ipcRenderer.invoke('ai-result:attach-file', payload),
  clearAttachment: () => ipcRenderer.invoke('ai-result:clear-attachment'),
  attachmentMeta: () => ipcRenderer.invoke('ai-result:attachment-meta'),
  newPaste: () => ipcRenderer.invoke('ai-result:new-paste'),
  suggestReply: () => ipcRenderer.invoke('ai-result:suggest-reply'),
  syncReplies: (text) => ipcRenderer.invoke('ai-result:sync-replies', text),
  reviseReply: (payload) => ipcRenderer.invoke('ai-result:revise-reply', payload),
  refineAgain: (payload) => ipcRenderer.invoke('ai-result:refine-again', payload),
  useInCompose: (payload) => ipcRenderer.invoke('ai-result:use-in-compose', payload),
  syncRefine: (text) => ipcRenderer.invoke('ai-result:sync-refine', text),
  transcribeVoice: (payload) =>
    ipcRenderer.invoke('ai-result:transcribe-voice', payload),
});
