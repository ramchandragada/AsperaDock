/**
 * Session preload: patch chrome.tabs.create in extension contexts so Grammarly
 * and similar extensions can open sign-in windows inside Aspera Hub.
 *
 * Runs only on chrome-extension:// pages and extension service workers.
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
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const base = chrome.tabs;
    const invoke = (details, callback) => {
      const run = globalThis.__asperaExtBridge?.tabsCreate?.(details || {}) ||
        Promise.reject(new Error('extension bridge unavailable'));
      run
        .then((tab) => {
          if (typeof callback === 'function') callback(tab);
        })
        .catch(() => {
          if (typeof callback === 'function') callback(undefined);
        });
    };
    Object.defineProperty(chrome, 'tabs', {
      configurable: true,
      enumerable: true,
      value: {
        ...base,
        create: (details, callback) => {
          if (typeof callback === 'function') {
            invoke(details, callback);
            return;
          }
          return globalThis.__asperaExtBridge.tabsCreate(details || {});
        },
      },
    });
  };

  try {
    contextBridge.exposeInMainWorld('__asperaExtBridge', bridge);
    if (typeof contextBridge.executeInMainWorld === 'function') {
      contextBridge.executeInMainWorld({ func: patchTabsCreate });
    }
  } catch (error) {
    console.error('[aspera-ext-preload] failed', error);
  }
}
