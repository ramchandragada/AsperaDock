/** Content script copied into patched extensions — relays tabs API calls to Aspera Hub guest pages. */
export const ASPERA_EXT_AUTH_BRIDGE_CONTENT = String.raw`(() => {
  if (globalThis.__asperaExtAuthBridgeCs) return;
  globalThis.__asperaExtAuthBridgeCs = true;

  function openViaPageBridge(details) {
    return new Promise((resolve) => {
      const reqId = 'ac-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      let settled = false;
      const finish = (tab) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onResult);
        resolve(tab);
      };
      const onResult = (event) => {
        if (event.source !== window || !event.data) return;
        if (event.data.__asperaHub !== 'tabs-create-result') return;
        if (event.data.reqId !== reqId) return;
        finish(event.data.tab);
      };
      window.addEventListener('message', onResult);
      window.postMessage(
        { __asperaHub: 'tabs-create', reqId, details: details || {} },
        '*',
      );
      setTimeout(() => finish(undefined), 800);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.__asperaHub) return;
    if (message.__asperaHub === 'tabs-create') {
      openViaPageBridge(message.details || {}).then((tab) => {
        if (tab?.id) {
          sendResponse({ tab });
          return;
        }
        // Last resort: open the OAuth URL from the page so a window appears.
        const url = String(message.details?.url || '').trim();
        if (url) {
          try {
            window.open(url, '_blank', 'noopener=yes');
          } catch (_) {}
        }
        sendResponse({
          tab: {
            id: Date.now() % 1000000,
            index: 0,
            windowId: 1,
            active: true,
            pinned: false,
            url: url || 'about:blank',
            title: '',
            status: 'loading',
          },
        });
      });
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
