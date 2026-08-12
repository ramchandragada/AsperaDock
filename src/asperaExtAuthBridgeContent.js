/** Content script copied into patched extensions — relays tabs API calls to Aspera Hub guest pages. */
export const ASPERA_EXT_AUTH_BRIDGE_CONTENT = String.raw`(() => {
  if (globalThis.__asperaExtAuthBridgeCs) return;
  globalThis.__asperaExtAuthBridgeCs = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.__asperaHub) return;
    if (message.__asperaHub === 'tabs-create') {
      const reqId = 'ac-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const onResult = (event) => {
        if (event.source !== window || !event.data) return;
        if (event.data.__asperaHub !== 'tabs-create-result') return;
        if (event.data.reqId !== reqId) return;
        window.removeEventListener('message', onResult);
        sendResponse({ tab: event.data.tab });
      };
      window.addEventListener('message', onResult);
      window.postMessage(
        {
          __asperaHub: 'tabs-create',
          reqId,
          details: message.details || {},
        },
        '*',
      );
      return true;
    }
    if (message.__asperaHub === 'tabs-remove') {
      window.postMessage(
        { __asperaHub: 'tabs-remove', tabIds: message.tabIds },
        '*',
      );
      sendResponse({ ok: true });
      return false;
    }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (
      event.data.__asperaHub === 'tab-updated' ||
      event.data.__asperaHub === 'tab-removed'
    ) {
      chrome.runtime.sendMessage(event.data);
    }
  });
})();`;

export const ASPERA_EXT_AUTH_BRIDGE_FILENAME = 'aspera-ext-auth-bridge.js';
