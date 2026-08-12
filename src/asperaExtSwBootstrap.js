/** Injected at the top of extension service workers (before importScripts). */
export const ASPERA_EXT_SW_BOOTSTRAP = String.raw`(() => {
  if (self.__asperaExtAuthBootstrap_v3) return;
  self.__asperaExtAuthBootstrap_v3 = true;
  self.__asperaExtAuthBootstrap = true;
  const updatedListeners = [];
  const removedListeners = [];

  function patchWhenReady() {
    if (typeof chrome === 'undefined') {
      setTimeout(patchWhenReady, 5);
      return;
    }

    // Stable OAuth redirect for Chrome Web Store extensions.
    chrome.identity = chrome.identity || {};
    if (typeof chrome.identity.getRedirectURL !== 'function') {
      chrome.identity.getRedirectURL = (path) => {
        const id = chrome.runtime?.id || '';
        const suffix = path ? String(path).replace(/^\\/+/, '') : '';
        return 'https://' + id + '.chromiumapp.org/' + suffix;
      };
    }

    chrome.tabs = chrome.tabs || {};
    if (chrome.tabs.__asperaHubPatched) return;

    const nativeCreate = chrome.tabs.create?.bind?.(chrome.tabs);
    const nativeUpdated = chrome.tabs.onUpdated;
    const nativeRemoved = chrome.tabs.onRemoved;
    const nativeRemove = chrome.tabs.remove?.bind?.(chrome.tabs);

    function createViaBridge(details, done) {
      const bridge = globalThis.__asperaExtBridge?.tabsCreate;
      if (typeof bridge === 'function') {
        Promise.resolve(bridge(details || {}))
          .then((tab) => done(tab))
          .catch(() => done(undefined));
        return;
      }
      chrome.runtime.sendMessage(
        { __asperaHub: 'tabs-create', details: details || {} },
        (response) => done(response?.tab),
      );
    }

    chrome.tabs.create = function (details, callback) {
      const finish = (tab) => {
        if (typeof callback === 'function') callback(tab);
      };
      if (nativeCreate) {
        try {
          nativeCreate(details, (tab) => {
            if (tab?.id) finish(tab);
            else createViaBridge(details, finish);
          });
          return;
        } catch (_) {}
      }
      createViaBridge(details, finish);
    };

    chrome.tabs.onUpdated = {
      addListener(listener) {
        if (typeof listener === 'function') updatedListeners.push(listener);
        nativeUpdated?.addListener?.(listener);
      },
      removeListener(listener) {
        const idx = updatedListeners.indexOf(listener);
        if (idx >= 0) updatedListeners.splice(idx, 1);
        nativeUpdated?.removeListener?.(listener);
      },
      hasListener: (listener) => updatedListeners.includes(listener),
      hasListeners: () => updatedListeners.length > 0,
    };

    chrome.tabs.onRemoved = {
      addListener(listener) {
        if (typeof listener === 'function') removedListeners.push(listener);
        nativeRemoved?.addListener?.(listener);
      },
      removeListener(listener) {
        const idx = removedListeners.indexOf(listener);
        if (idx >= 0) removedListeners.splice(idx, 1);
        nativeRemoved?.removeListener?.(listener);
      },
      hasListener: (listener) => removedListeners.includes(listener),
      hasListeners: () => removedListeners.length > 0,
    };

    chrome.tabs.remove = function (tabIds, callback) {
      chrome.runtime.sendMessage(
        { __asperaHub: 'tabs-remove', tabIds },
        () => {
          try {
            if (nativeRemove) nativeRemove(tabIds, callback);
            else if (typeof callback === 'function') callback();
          } catch (_) {
            if (typeof callback === 'function') callback();
          }
        },
      );
    };

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.__asperaHub === 'tab-updated') {
        for (const listener of updatedListeners.slice()) {
          try {
            listener(message.tabId, message.changeInfo || {}, message.tab || {});
          } catch (_) {}
        }
      }
      if (message?.__asperaHub === 'tab-removed') {
        for (const listener of removedListeners.slice()) {
          try {
            listener(message.tabId, message.removeInfo || {});
          } catch (_) {}
        }
      }
    });

    self.__asperaDispatchTabEvent = (message) => {
      chrome.runtime.onMessage?.dispatch?.(message);
      if (message?.__asperaHub === 'tab-updated') {
        for (const listener of updatedListeners.slice()) {
          try {
            listener(message.tabId, message.changeInfo || {}, message.tab || {});
          } catch (_) {}
        }
      }
      if (message?.__asperaHub === 'tab-removed') {
        for (const listener of removedListeners.slice()) {
          try {
            listener(message.tabId, message.removeInfo || {});
          } catch (_) {}
        }
      }
    };

    chrome.tabs.__asperaHubPatched = true;
  }

  patchWhenReady();
})();`;

export const ASPERA_EXT_SW_MARKER = '__asperaExtAuthBootstrap';
export const ASPERA_EXT_SW_VERSION = '__asperaExtAuthBootstrap_v3';
