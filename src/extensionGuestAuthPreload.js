/**
 * Guest-page preload: relays extension auth tab requests between the page
 * (extension content script) and the main-process auth tab manager.
 */
const { ipcRenderer, contextBridge } = require('electron');

const bridge = {
  tabsCreate: (details) =>
    ipcRenderer.invoke('aspera-ext:tabs-create', details || {}),
};

try {
  contextBridge.exposeInMainWorld('__asperaExtBridge', bridge);
} catch {
  // ignore
}

const relayToPage = (_event, payload) => {
  try {
    window.postMessage(payload || {}, '*');
  } catch {
    // ignore
  }
};

ipcRenderer.on('aspera-ext:tab-updated', relayToPage);
ipcRenderer.on('aspera-ext:tab-removed', relayToPage);

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.__asperaHub !== 'tabs-create') return;
  const reqId = event.data.reqId;
  bridge
    .tabsCreate(event.data.details || {})
    .then((tab) => {
      window.postMessage(
        { __asperaHub: 'tabs-create-result', reqId, tab },
        '*',
      );
    })
    .catch(() => {
      window.postMessage(
        { __asperaHub: 'tabs-create-result', reqId, tab: undefined },
        '*',
      );
    });
});
