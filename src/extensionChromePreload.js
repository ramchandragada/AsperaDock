/**
 * Session preload: patch chrome.tabs / identity in extension contexts and
 * forward auth-tab events into the service worker main world.
 */
const { ipcRenderer, contextBridge } = require('electron');

const isExtensionContext =
  process.type === 'service-worker' ||
  (typeof location !== 'undefined' &&
    String(location.href || '').startsWith('chrome-extension://'));

if (isExtensionContext) {
  const bridge = {
    tabsCreate: (details) =>
      ipcRenderer.invoke('aspera-ext:tabs-create', details || {}),
  };

  const patchTabsCreate = () => {
    const root = typeof chrome !== 'undefined' ? chrome : undefined;
    if (!root) return false;
    root.tabs = root.tabs || {};
    const base = root.tabs;
    if (base.__asperaTabsCreatePatched) return true;

    const invoke = (details, callback) => {
      const run =
        globalThis.__asperaExtBridge?.tabsCreate?.(details || {}) ||
        Promise.reject(new Error('extension bridge unavailable'));
      run
        .then((tab) => {
          if (typeof callback === 'function') callback(tab);
        })
        .catch(() => {
          if (typeof callback === 'function') callback(undefined);
        });
    };

    Object.defineProperty(root, 'tabs', {
      configurable: true,
      enumerable: true,
      value: {
        ...base,
        __asperaTabsCreatePatched: true,
        create: (details, callback) => {
          if (typeof callback === 'function') {
            invoke(details, callback);
            return;
          }
          return globalThis.__asperaExtBridge.tabsCreate(details || {});
        },
      },
    });
    return true;
  };

  const patchWhenReady = () => {
    if (patchTabsCreate()) return;
    const timer = setInterval(() => {
      if (patchTabsCreate()) clearInterval(timer);
    }, 25);
    setTimeout(() => clearInterval(timer), 15000);
  };

  const dispatchTabEvent = (payload) => {
    try {
      if (typeof contextBridge.executeInMainWorld === 'function') {
        contextBridge.executeInMainWorld({
          func: (message) => {
            try {
              globalThis.__asperaDispatchTabEvent?.(message);
            } catch (_) {}
          },
          args: [payload || {}],
        });
      }
    } catch (_) {}
  };

  try {
    contextBridge.exposeInMainWorld('__asperaExtBridge', bridge);
    if (typeof contextBridge.executeInMainWorld === 'function') {
      contextBridge.executeInMainWorld({ func: patchWhenReady });
    }
    ipcRenderer.on('aspera-ext:tab-event', (_event, payload) => {
      dispatchTabEvent(payload);
    });
    ipcRenderer.on('aspera-ext:tab-updated', (_event, payload) => {
      dispatchTabEvent(payload);
    });
    ipcRenderer.on('aspera-ext:tab-removed', (_event, payload) => {
      dispatchTabEvent(payload);
    });
  } catch (error) {
    console.error('[aspera-ext-preload] failed', error);
  }
}
