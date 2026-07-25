import {
  app,
  BrowserWindow,
  BrowserView,
  session,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  Notification,
  dialog,
  powerMonitor,
} from 'electron';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  APP_CATALOG,
  MAX_INSTANCES_PER_APP,
  MAX_WARM_VIEWS_DEFAULT,
  INTERNAL_HOSTS,
  getChromeMetrics,
  getAppCatalogEntry,
  defaultInstanceName,
  defaultInstanceTitle,
} from './services.js';
import {
  loadSettings,
  saveSettings,
  hashPassword,
  verifyPassword,
} from './store.js';
import { mergeAppConfig, MOBILE_USER_AGENT } from './appConfig.js';

const require = createRequire(import.meta.url);
if (require('electron-squirrel-startup')) {
  app.quit();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const CHROME_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let quitting = false;

/** @type {Map<string, { view: BrowserView, lastUsed: number }>} */
const views = new Map();
/** @type {Map<string, number>} */
const unreadCounts = new Map();
/** Recent unread activity shown in the notification center. */
/** @type {{ id: string, serviceId: string, title: string, body: string, at: number }[]} */
let notificationLog = [];
const NOTIFICATION_LOG_MAX = 40;
/** Renderer-measured chrome size — keeps BrowserView aligned with wrapped rows. */
let chromeSize = null;
/** @type {Record<string, number>} */
let appMemory = {};
let memoryTimer = null;

let activeServiceId = null;
let locked = false;
let overlayOpen = false;
let settings = loadSettings();

if (settings.hardwareAcceleration === false) {
  app.disableHardwareAcceleration();
}
if (settings.hiDpiSupport === false) {
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}
if (settings.mediaKeys === false) {
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
}

function getAppConfig(id) {
  return mergeAppConfig((settings.serviceConfigs || {})[id] || {});
}

function saveAppConfig(id, patch) {
  const prev = getAppConfig(id);
  const next = mergeAppConfig({ ...prev, ...patch });
  const serviceConfigs = { ...(settings.serviceConfigs || {}), [id]: next };
  settings = saveSettings({ serviceConfigs });
  return next;
}

function resolveInstance(inst) {
  const entry = getAppCatalogEntry(inst.appId);
  if (!entry) return null;
  const slot = Math.max(1, Number(inst.slot) || 1);
  const name = defaultInstanceName(entry, slot);
  const title = defaultInstanceTitle(entry, slot);
  const config = getAppConfig(inst.id);
  return {
    id: inst.id,
    appId: entry.appId,
    name,
    title,
    url: entry.url,
    partition: inst.partition,
    color: entry.color,
    logo: entry.logo,
    keepWarm: !!entry.keepWarm && slot === 1 && config.enabled,
    slot,
    config,
  };
}

function orderedServices() {
  const instances = settings.serviceInstances || [];
  const order = settings.serviceOrder || [];
  const labels = settings.serviceLabels || {};

  const decorate = (s) => {
    if (!s) return null;
    const custom = labels[s.id] || {};
    const name = (custom.name && String(custom.name).trim()) || s.name;
    const title =
      (custom.title && String(custom.title).trim()) ||
      (custom.name && String(custom.name).trim()) ||
      s.title ||
      s.name;
    return {
      ...s,
      name,
      title: String(title).trim() || name,
      defaultName: s.name,
      defaultTitle: s.title || s.name,
      config: getAppConfig(s.id),
    };
  };

  const resolved = instances.map(resolveInstance).filter(Boolean);
  if (!order.length) return resolved.map(decorate);

  const map = new Map(resolved.map((s) => [s.id, s]));
  const result = [];
  for (const id of order) {
    if (map.has(id)) {
      result.push(decorate(map.get(id)));
      map.delete(id);
    }
  }
  for (const s of map.values()) result.push(decorate(s));
  return result;
}

function getService(id) {
  return orderedServices().find((s) => s.id === id) || null;
}

function countInstances(appId) {
  return (settings.serviceInstances || []).filter((i) => i.appId === appId)
    .length;
}

function nextSlot(appId) {
  const used = new Set(
    (settings.serviceInstances || [])
      .filter((i) => i.appId === appId)
      .map((i) => Number(i.slot) || 1),
  );
  for (let n = 1; n <= MAX_INSTANCES_PER_APP; n += 1) {
    if (!used.has(n)) return n;
  }
  return null;
}

function addService(appId) {
  const entry = getAppCatalogEntry(appId);
  if (!entry) return { ok: false, error: 'Unknown app' };
  if (countInstances(appId) >= MAX_INSTANCES_PER_APP) {
    return { ok: false, error: `Max ${MAX_INSTANCES_PER_APP} ${entry.name} apps` };
  }
  const slot = nextSlot(appId);
  if (!slot) {
    return { ok: false, error: `Max ${MAX_INSTANCES_PER_APP} ${entry.name} apps` };
  }
  const id = `${appId}-${slot}-${Date.now().toString(36)}`;
  const partition = `persist:${id}`;
  const instances = [...(settings.serviceInstances || []), { id, appId, partition, slot }];
  const serviceOrder = [...(settings.serviceOrder || []), id];
  settings = saveSettings({ serviceInstances: instances, serviceOrder });
  broadcastState();
  activateService(id);
  return { ok: true, id };
}

function removeService(id) {
  const service = getService(id);
  if (!service) return { ok: false, error: 'Not found' };

  hibernateService(id);
  unreadCounts.delete(id);

  const instances = (settings.serviceInstances || []).filter((i) => i.id !== id);
  const serviceOrder = (settings.serviceOrder || []).filter((x) => x !== id);
  const serviceLabels = { ...(settings.serviceLabels || {}) };
  delete serviceLabels[id];
  const serviceConfigs = { ...(settings.serviceConfigs || {}) };
  delete serviceConfigs[id];

  const patch = { serviceInstances: instances, serviceOrder, serviceLabels, serviceConfigs };
  if (settings.lastActiveServiceId === id) patch.lastActiveServiceId = null;
  settings = saveSettings(patch);

  if (activeServiceId === id) {
    activeServiceId = null;
    const next = orderedServices()[0];
    if (next) activateService(next.id);
    else {
      detachAllViews();
      broadcastState();
    }
  } else {
    broadcastState();
  }
  return { ok: true };
}

function hibernateMs() {
  return Math.max(1, Number(settings.hibernateMinutes) || 5) * 60_000;
}

function maxWarm() {
  return Math.max(1, Number(settings.maxWarmViews) || MAX_WARM_VIEWS_DEFAULT);
}

function baseDomain(hostname) {
  return hostname.split('.').slice(-2).join('.');
}

function isInternalUrl(url, service) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return true;
  }
  const allowed = [baseDomain(new URL(service.url).hostname), ...INTERNAL_HOSTS];
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

function dockIsUserFocused() {
  return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
}

/** Only focus guest content when the user already has Aspera Dock focused. */
function focusActiveContents() {
  if (!dockIsUserFocused() || overlayOpen || locked || !activeServiceId) return;
  const entry = views.get(activeServiceId);
  if (!entry) return;
  try {
    entry.view.webContents.focus();
  } catch {
    // ignore
  }
}

/** Bring the dock to the front — only from explicit user actions. */
function raiseDockWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Chrome offsets for the active view. The renderer reports its measured bar
 * size so wrapped tab rows and density changes stay in sync with the CSS.
 */
function effectiveMetrics() {
  const m = getChromeMetrics(settings);
  if (!chromeSize) return m;
  const top = Number(chromeSize.top);
  const left = Number(chromeSize.left);
  const right = Number(chromeSize.right);
  return {
    ...m,
    top: Number.isFinite(top) && top > 0 ? Math.round(top) : m.top,
    left: Number.isFinite(left) && left >= 0 ? Math.round(left) : m.left,
    right: Number.isFinite(right) && right >= 0 ? Math.round(right) : m.right || 0,
  };
}

function layoutActiveView() {
  if (!mainWindow || !activeServiceId || locked || overlayOpen) return;
  const entry = views.get(activeServiceId);
  if (!entry) return;

  const [width, height] = mainWindow.getContentSize();
  const m = effectiveMetrics();
  const right = m.right || 0;
  entry.view.setBounds({
    x: m.left,
    y: m.top,
    width: Math.max(0, width - m.left - right),
    height: Math.max(0, height - m.top),
  });
  entry.view.setAutoResize({ width: true, height: true });
}

function detachAllViews() {
  if (!mainWindow) return;
  for (const entry of views.values()) {
    try {
      mainWindow.removeBrowserView(entry.view);
    } catch {
      // ignore
    }
  }
}

/** BrowserView always paints above HTML — hide it while modals are open. */
function setOverlayOpen(open) {
  overlayOpen = !!open;
  if (!mainWindow) return;

  if (overlayOpen) {
    detachAllViews();
    return;
  }

  if (locked || !activeServiceId) return;
  const entry = views.get(activeServiceId);
  if (!entry) return;
  mainWindow.addBrowserView(entry.view);
  layoutActiveView();
  focusActiveContents();
}

function hideViewsForLock() {
  detachAllViews();
}

function applyFocusMode(webContents, serviceId) {
  const cfg = serviceId ? getAppConfig(serviceId) : mergeAppConfig();
  // Always suppress in-page Notification — guest notifications raise the
  // Electron window on Linux. Unread is handled in main via page title.
  const hideBody =
    settings.hideNotificationContent || cfg.hideNotificationContent
      ? 'true'
      : 'false';
  webContents
    .executeJavaScript(
      `(() => {
        window.__asperaDockHideBody = ${hideBody};
        // Pages calling window.focus() will otherwise steal the desktop focus.
        try { window.focus = function () {}; } catch (e) {}
        if (window.__asperaDockPatched) {
          window.__asperaDockSilenced = true;
          return;
        }
        window.__asperaDockPatched = true;
        window.__asperaDockSilenced = true;
        const Original = window.Notification;
        if (!Original) return;
        function Patched(title, options) {
          // No-op: never create a real OS notification from the guest page.
          return {
            close() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; },
          };
        }
        Patched.prototype = Original.prototype;
        Object.defineProperty(Patched, 'permission', {
          get: () => 'granted',
        });
        Patched.requestPermission = () => Promise.resolve('granted');
        window.Notification = Patched;
      })();`,
      true,
    )
    .catch(() => {});
}

function applyMuteState() {
  for (const [id, entry] of views.entries()) {
    const cfg = getAppConfig(id);
    entry.view.webContents.setAudioMuted(settings.muted || !cfg.allowSounds);
  }
}

function logNotification(service, body) {
  notificationLog = [
    {
      id: `${service.id}-${Date.now().toString(36)}`,
      serviceId: service.id,
      title: service.title || service.name,
      body,
      at: Date.now(),
    },
    ...notificationLog,
  ].slice(0, NOTIFICATION_LOG_MAX);
  broadcastState();
}

/** Map each app's renderer process to its memory footprint (MB). */
function sampleAppMemory() {
  if (!settings.consumptionMonitor) {
    if (Object.keys(appMemory).length) {
      appMemory = {};
      broadcastState();
    }
    return;
  }
  const byPid = new Map();
  for (const metric of app.getAppMetrics()) {
    byPid.set(metric.pid, metric);
  }
  const next = {};
  for (const [id, entry] of views.entries()) {
    let pid = null;
    try {
      pid = entry.view.webContents.getOSProcessId();
    } catch {
      pid = null;
    }
    const metric = pid ? byPid.get(pid) : null;
    if (metric?.memory?.workingSetSize) {
      next[id] = Math.round(metric.memory.workingSetSize / 1024);
    }
  }
  appMemory = next;
  broadcastState();
}

function startMemoryTimer() {
  if (memoryTimer) clearInterval(memoryTimer);
  memoryTimer = setInterval(sampleAppMemory, 5000);
}

function parseUnread(title) {
  const match = title.match(/\((\d+)\+?\)/);
  if (!match) return 0;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : 0;
}

function totalUnread() {
  if (settings.focusMode && settings.focusClearsBadges) return 0;
  let total = 0;
  for (const [id, n] of unreadCounts.entries()) {
    if (!getAppConfig(id).includeUnreadInGlobal) continue;
    total += n;
  }
  return total;
}

function refreshBadge() {
  const total = totalUnread();
  try {
    app.setBadgeCount(total);
  } catch {
    // unsupported
  }
  if (mainWindow) {
    // Avoid constant title thrash while unfocused — some Linux WMs raise the window.
    if (dockIsUserFocused() || settings.showActiveInTitle) {
      if (settings.showActiveInTitle && activeServiceId) {
        const svc = getService(activeServiceId);
        mainWindow.setTitle(
          total > 0
            ? `Aspera Dock — ${svc?.title || svc?.name} (${total})`
            : `Aspera Dock — ${svc?.title || svc?.name || ''}`,
        );
      } else if (dockIsUserFocused()) {
        mainWindow.setTitle(total > 0 ? `Aspera Dock (${total})` : 'Aspera Dock');
      }
    }
    // Never flash/raise while the user is in another app unless they opted in —
    // and even then only flashFrame (no show/focus).
    if (settings.flashTaskbar && total > 0 && !dockIsUserFocused()) {
      try {
        mainWindow.flashFrame(true);
      } catch {
        // ignore
      }
    }
  }
  updateTray();
}

function applyProxy(partitionSession) {
  const mode = settings.proxyMode || 'none';
  if (mode === 'manual' && String(settings.proxyRules || '').trim()) {
    partitionSession
      .setProxy({
        proxyRules: String(settings.proxyRules).trim(),
        proxyBypassRules: String(settings.proxyBypass || '<local>').trim(),
      })
      .catch(() => {});
    return;
  }
  partitionSession
    .setProxy({ mode: mode === 'system' ? 'system' : 'direct' })
    .catch(() => {});
}

function applyProxyToAllSessions() {
  for (const item of settings.serviceInstances || []) {
    if (!item.partition) continue;
    applyProxy(session.fromPartition(item.partition));
  }
}

function configureSession(partitionSession) {
  partitionSession.setUserAgent(CHROME_USER_AGENT);
  applyProxy(partitionSession);
  partitionSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(
      [
        'notifications',
        'media',
        'clipboard-read',
        'clipboard-sanitized-write',
        'fullscreen',
        'background-sync',
      ].includes(permission),
    );
  });

  partitionSession.on('will-download', (_event, item) => {
    const dir =
      settings.downloadPath ||
      app.getPath('downloads');
    if (settings.downloadPath) {
      item.setSavePath(path.join(dir, item.getFilename()));
    }
    item.once('done', (_e, state) => {
      if (state !== 'completed') return;
      if (settings.openFolderOnDownload) shell.showItemInFolder(item.getSavePath());
      if (settings.openFileOnDownload) shell.openPath(item.getSavePath());
    });
  });
}

function createViewForService(service) {
  const cfg = getAppConfig(service.id);
  const partitionSession = session.fromPartition(service.partition);
  configureSession(partitionSession);

  const ua =
    (cfg.userAgent && cfg.userAgent.trim()) ||
    (cfg.forceMobile ? MOBILE_USER_AGENT : CHROME_USER_AGENT);
  partitionSession.setUserAgent(ua);

  const view = new BrowserView({
    webPreferences: {
      session: partitionSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  const { webContents } = view;
  webContents.setUserAgent(ua);
  webContents.setAudioMuted(settings.muted || !cfg.allowSounds);
  const langs = cfg.spellChecker || settings.spellChecker || ['en-US'];
  webContents.session.setSpellCheckerLanguages(
    Array.isArray(langs) && langs.length ? langs : ['en-US'],
  );

  const linkMode = cfg.linkHandling || settings.linkHandling || 'block';
  webContents.setWindowOpenHandler(({ url }) => {
    if (linkMode === 'external' || !isInternalUrl(url, service)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http')) return;
    if (isInternalUrl(url, service)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  webContents.on('page-title-updated', (_event, title) => {
    const previous = unreadCounts.get(service.id) || 0;
    const next = parseUnread(title);
    if (previous === next) return;
    unreadCounts.set(service.id, next);
    refreshBadge();
    broadcastState();

    const liveCfg = getAppConfig(service.id);
    if (
      next > previous &&
      !settings.focusMode &&
      liveCfg.allowNotifications &&
      service.id !== activeServiceId
    ) {
      const body =
        settings.hideNotificationContent || liveCfg.hideNotificationContent
          ? 'New notification'
          : `${next} unread`;
      logNotification(service, body);
    }
    if (
      next > previous &&
      !settings.focusMode &&
      liveCfg.allowNotifications &&
      service.id !== activeServiceId &&
      Notification.isSupported()
    ) {
      const n = new Notification({
        title: service.title || service.name,
        body:
          settings.hideNotificationContent || liveCfg.hideNotificationContent
            ? 'New notification'
            : `${next} unread`,
        silent: settings.muted || !liveCfg.allowSounds,
      });
      n.on('click', () => {
        // Explicit user action — OK to raise.
        raiseDockWindow();
        activateService(service.id);
      });
      n.show();
    }
  });

  webContents.on('dom-ready', async () => {
    applyFocusMode(webContents, service.id);
    const live = getAppConfig(service.id);
    if (live.injectCss && live.injectCss.trim()) {
      try {
        await webContents.insertCSS(live.injectCss);
      } catch {
        // ignore
      }
    }
    if (live.stylishUrl && /^https?:\/\//i.test(live.stylishUrl.trim())) {
      try {
        const res = await fetch(live.stylishUrl.trim());
        if (res.ok) await webContents.insertCSS(await res.text());
      } catch {
        // ignore
      }
    }
    if (live.injectJs && live.injectJs.trim()) {
      try {
        await webContents.executeJavaScript(live.injectJs, true);
      } catch {
        // ignore
      }
    }
  });

  if (cfg.preventBasicAuth) {
    webContents.on('login', (event) => {
      event.preventDefault();
    });
  }

  attachShortcuts(webContents);
  webContents.loadURL(service.url);

  views.set(service.id, { view, lastUsed: Date.now() });
  return views.get(service.id);
}

function hibernateService(id) {
  const entry = views.get(id);
  if (!entry || id === activeServiceId) return;
  if (mainWindow) {
    try {
      mainWindow.removeBrowserView(entry.view);
    } catch {
      // ignore
    }
  }
  entry.view.webContents.close();
  views.delete(id);
  unreadCounts.delete(id);
}

function enforceWarmLimit() {
  const evictable = [...views.entries()]
    .filter(([id]) => id !== activeServiceId && !getService(id)?.keepWarm)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  const pinned = [...views.keys()].filter((id) => getService(id)?.keepWarm).length;
  const budget = Math.max(0, maxWarm() - 1 - pinned);
  while (evictable.length > budget) {
    const [id] = evictable.shift();
    hibernateService(id);
  }
}

function activateService(id) {
  const service = getService(id);
  if (!service || !mainWindow || locked) return;
  const cfg = getAppConfig(id);
  if (!cfg.enabled) {
    broadcastState();
    return;
  }

  detachAllViews();
  const entry = views.get(id) || createViewForService(service);
  entry.lastUsed = Date.now();
  activeServiceId = id;
  settings = saveSettings({ lastActiveServiceId: id });

  if (!overlayOpen) {
    mainWindow.addBrowserView(entry.view);
    layoutActiveView();
    focusActiveContents();
  }

  unreadCounts.set(id, 0);
  enforceWarmLimit();
  refreshBadge();
  broadcastState();
}

function activateByOffset(offset) {
  const list = orderedServices();
  if (!list.length) return;
  const idx = list.findIndex((s) => s.id === activeServiceId);
  const next = (idx + offset + list.length) % list.length;
  activateService(list[next].id);
}

function toggleFocusMode() {
  settings = saveSettings({ focusMode: !settings.focusMode });
  for (const [id, entry] of views.entries()) {
    applyFocusMode(entry.view.webContents, id);
  }
  refreshBadge();
  broadcastState();
}

function toggleMute() {
  settings = saveSettings({ muted: !settings.muted });
  applyMuteState();
  broadcastState();
}

function hibernateBackground() {
  for (const id of [...views.keys()]) {
    if (id === activeServiceId) continue;
    if (getService(id)?.keepWarm) continue;
    hibernateService(id);
  }
  broadcastState();
}

function reloadActive() {
  if (!activeServiceId) return;
  views.get(activeServiceId)?.view.webContents.reload();
}

function applyWindowPrefs() {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(!!settings.alwaysOnTop);
  mainWindow.setAutoHideMenuBar(settings.autoHideMenuBar !== false);
  mainWindow.setMenuBarVisibility(settings.autoHideMenuBar === false);
  app.setLoginItemSettings({ openAtLogin: !!settings.autoStart });
}

function currentState() {
  const unreadForUi = {};
  for (const [id, n] of unreadCounts) {
    const cfg = getAppConfig(id);
    if (!cfg.displayUnreadInTab) {
      unreadForUi[id] = 0;
      continue;
    }
    unreadForUi[id] =
      settings.focusMode && settings.focusClearsBadges ? 0 : n;
  }
  return {
    activeServiceId,
    warmIds: [...views.keys()],
    services: orderedServices(),
    catalog: APP_CATALOG.map((a) => ({
      ...a,
      count: countInstances(a.appId),
      max: MAX_INSTANCES_PER_APP,
      canAdd: countInstances(a.appId) < MAX_INSTANCES_PER_APP,
    })),
    unread: unreadForUi,
    totalUnread: totalUnread(),
    notifications: notificationLog,
    appMemory,
    settings: { ...settings, lockPasswordHash: undefined },
    locked,
  };
}

function broadcastState() {
  mainWindow?.webContents.send('dock:state', currentState());
}

function shortcutOn(id) {
  const map = settings.shortcuts || {};
  return map[id] !== false;
}

function attachShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (locked) {
      if (input.key === 'Escape') event.preventDefault();
      return;
    }

    const key = input.key.toLowerCase();

    if (input.alt && !input.control && shortcutOn('backForward')) {
      if (key === 'arrowleft' || key === 'left') {
        event.preventDefault();
        if (activeServiceId) {
          const wc = views.get(activeServiceId)?.view.webContents;
          if (wc?.canGoBack()) wc.goBack();
        }
        return;
      }
      if (key === 'arrowright' || key === 'right') {
        event.preventDefault();
        if (activeServiceId) {
          const wc = views.get(activeServiceId)?.view.webContents;
          if (wc?.canGoForward()) wc.goForward();
        }
        return;
      }
    }

    if (!input.control) return;

    if (!input.shift && /^[1-9]$/.test(key) && shortcutOn('switchTab')) {
      const service = orderedServices()[Number.parseInt(key, 10) - 1];
      if (service) {
        event.preventDefault();
        activateService(service.id);
      }
      return;
    }

    if ((key === 'tab' || key === 'pagedown') && shortcutOn('nextTab')) {
      event.preventDefault();
      activateByOffset(key === 'tab' && input.shift ? -1 : 1);
      return;
    }
    if (key === 'pageup' && shortcutOn('nextTab')) {
      event.preventDefault();
      activateByOffset(-1);
      return;
    }
    if (key === 'r' && !input.shift) {
      event.preventDefault();
      reloadActive();
      return;
    }
    if (key === ',' && shortcutOn('settings')) {
      event.preventDefault();
      mainWindow?.webContents.send('dock:open-settings');
      return;
    }
    if (key === '/' && shortcutOn('search')) {
      event.preventDefault();
      mainWindow?.webContents.send('dock:open-search');
      return;
    }
    if (input.shift && key === 'd' && shortcutOn('focusMode')) {
      event.preventDefault();
      toggleFocusMode();
      return;
    }
    if (input.shift && key === 'm' && shortcutOn('mute')) {
      event.preventDefault();
      toggleMute();
      return;
    }
    if (input.shift && key === 'h' && shortcutOn('hibernate')) {
      event.preventDefault();
      hibernateBackground();
      return;
    }
    if (input.shift && key === 'l' && settings.lockEnabled && shortcutOn('lock')) {
      event.preventDefault();
      lockApp();
    }
  });
}

function lockApp() {
  if (!settings.lockEnabled || !settings.lockPasswordHash) return;
  locked = true;
  hideViewsForLock();
  broadcastState();
}

function unlockApp(password) {
  if (!verifyPassword(password, settings.lockPasswordHash)) {
    return { ok: false, error: 'Wrong password' };
  }
  locked = false;
  if (activeServiceId) activateService(activeServiceId);
  else broadcastState();
  return { ok: true };
}

function createTrayIcon(badge) {
  const size = 16;
  const canvas = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="3" fill="#4f8cff"/>
      <text x="8" y="12" text-anchor="middle" font-size="9" font-family="sans-serif" fill="white">AD</text>
      ${
        badge && settings.trayUnreadIndicator
          ? `<circle cx="12" cy="4" r="4" fill="#e5484d"/>`
          : ''
      }
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(canvas).toString('base64')}`,
  );
}

function updateTray() {
  if (!tray) return;
  const total = totalUnread();
  tray.setImage(createTrayIcon(total > 0));
  tray.setToolTip(
    total > 0 ? `Aspera Dock (${total} unread)` : 'Aspera Dock',
  );
}

function ensureTray() {
  const wantTray =
    settings.displayBehaviour === 'tray' ||
    settings.displayBehaviour === 'both' ||
    settings.closeBehaviour === 'tray' ||
    settings.trayUnreadIndicator;

  if (!wantTray) {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }

  if (!tray) {
    tray = new Tray(createTrayIcon(false));
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && dockIsUserFocused()) {
        mainWindow.hide();
      } else {
        raiseDockWindow();
      }
    });
  }

  const context = Menu.buildFromTemplate([
    {
      label: 'Show Aspera Dock',
      click: () => raiseDockWindow(),
    },
    {
      label: settings.focusMode ? 'Exit Focus Mode' : 'Focus Mode',
      click: () => toggleFocusMode(),
    },
    {
      label: settings.muted ? 'Unmute' : 'Mute',
      click: () => toggleMute(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(context);
  updateTray();
}

function activeWebContents() {
  return views.get(activeServiceId)?.view.webContents || mainWindow?.webContents;
}

function changeZoom(delta = 0, exact = null) {
  const webContents = activeWebContents();
  if (!webContents || webContents.isDestroyed()) return;
  const next = exact ?? webContents.getZoomFactor() + delta;
  webContents.setZoomFactor(Math.min(2, Math.max(0.5, next)));
}

async function requestQuit() {
  if (settings.confirmQuit && mainWindow) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Quit Aspera Dock?',
      message: 'Quit Aspera Dock?',
      detail: 'Your app sessions will be saved.',
      buttons: ['Cancel', 'Quit'],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return;
  }
  quitting = true;
  app.quit();
}

function allAppSessions() {
  const partitions = new Set(
    (settings.serviceInstances || []).map((item) => item.partition).filter(Boolean),
  );
  return [...partitions].map((partition) => session.fromPartition(partition));
}

async function clearAppCaches() {
  await Promise.all(allAppSessions().map((appSession) => appSession.clearCache()));
  if (mainWindow) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Cache cleared',
      message: 'App caches were cleared successfully.',
    });
  }
}

async function clearAppLocalStorage() {
  if (mainWindow) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Clear local storage?',
      message: 'Clear local storage for all apps?',
      detail: 'This can reset app preferences and may sign you out.',
      buttons: ['Cancel', 'Clear'],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return;
  }
  await Promise.all(
    allAppSessions().map((appSession) =>
      appSession.clearStorageData({ storages: ['localstorage'] }),
    ),
  );
  if (mainWindow) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Local storage cleared',
      message: 'Local storage was cleared for all apps.',
    });
  }
}

async function clearAppsHistory() {
  for (const entry of views.values()) {
    entry.view.webContents.navigationHistory?.clear();
  }
  if (mainWindow) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'History cleared',
      message: 'Navigation history was cleared for running apps.',
    });
  }
}

async function showTroubleshooting() {
  if (!mainWindow) return;
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Aspera Dock troubleshooting',
    message: 'Troubleshooting information',
    detail: [
      `Aspera Dock ${app.getVersion()}`,
      `Electron ${process.versions.electron}`,
      `Chrome ${process.versions.chrome}`,
      `Platform ${process.platform} ${process.arch}`,
      `Data folder: ${app.getPath('userData')}`,
    ].join('\n'),
    buttons: ['Close', 'Open Developer Tools'],
    defaultId: 0,
    cancelId: 0,
  });
  if (result.response === 1) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function installApplicationMenu() {
  const zoomPresets = [0.8, 0.9, 1, 1.1, 1.25].map((factor) => ({
    label: `${Math.round(factor * 100)}%`,
    click: () => changeZoom(0, factor),
  }));

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CommandOrControl+,',
          click: () => mainWindow?.webContents.send('dock:open-settings'),
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CommandOrControl+Q',
          click: () => requestQuit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Apps manager',
          click: () => mainWindow?.webContents.send('dock:open-apps-settings'),
        },
        { type: 'separator' },
        { label: 'Zoom Aspera Dock', submenu: zoomPresets },
        {
          label: 'Actual Size',
          accelerator: 'CommandOrControl+0',
          click: () => changeZoom(0, 1),
        },
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+Plus',
          click: () => changeZoom(0.1),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: () => changeZoom(-0.1),
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: !!settings.alwaysOnTop,
          click: (item) => {
            settings = saveSettings({ alwaysOnTop: item.checked });
            applyWindowPrefs();
            broadcastState();
            installApplicationMenu();
          },
        },
        { type: 'separator' },
        {
          label: 'Minimize',
          accelerator: 'CommandOrControl+M',
          click: () => mainWindow?.minimize(),
        },
        {
          label: 'Close',
          accelerator: 'CommandOrControl+W',
          click: () => mainWindow?.close(),
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Clear Cache', click: () => clearAppCaches() },
        { label: 'Clear Local Storage', click: () => clearAppLocalStorage() },
        { label: 'Clear apps history', click: () => clearAppsHistory() },
        { type: 'separator' },
        { label: 'Troubleshooting', click: () => showTroubleshooting() },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Support',
          accelerator: 'CommandOrControl+F1',
          click: () =>
            shell.openExternal(
              'mailto:support@aspera.local?subject=Aspera%20Dock%20Support',
            ),
        },
        { type: 'separator' },
        {
          label: 'About Aspera Dock',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Aspera Dock',
              message: `Aspera Dock ${app.getVersion()}`,
              detail: 'A lightweight company workspace for messaging and business apps.',
              buttons: ['OK'],
            }),
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
  mainWindow?.setMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Aspera Dock',
    backgroundColor: '#f4f6f8',
    show: false,
    autoHideMenuBar: settings.autoHideMenuBar !== false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  installApplicationMenu();
  applyWindowPrefs();
  ensureTray();

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('resize', layoutActiveView);
  mainWindow.on('focus', () => focusActiveContents());
  attachShortcuts(mainWindow.webContents);

  mainWindow.on('close', (event) => {
    if (!quitting && settings.closeBehaviour === 'tray') {
      event.preventDefault();
      mainWindow.hide();
      ensureTray();
    }
  });

  mainWindow.on('closed', () => {
    for (const entry of views.values()) {
      try {
        entry.view.webContents.close();
      } catch {
        // ignore
      }
    }
    views.clear();
    unreadCounts.clear();
    mainWindow = null;
    activeServiceId = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastState();
    if (settings.lockEnabled && settings.lockPasswordHash) {
      locked = true;
      broadcastState();
      return;
    }
    const remembered = getService(settings.lastActiveServiceId);
    const first =
      remembered ||
      orderedServices().find((s) => s.config?.enabled !== false);
    if (first && first.config?.enabled !== false) activateService(first.id);
    for (const service of orderedServices()) {
      if (!service.config?.enabled) continue;
      if (service.config?.startHibernated) continue;
      if (service.keepWarm && !views.has(service.id)) {
        createViewForService(service);
      }
    }
  });
}

function startHibernateTimer() {
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of views.entries()) {
      if (id === activeServiceId) continue;
      if (getService(id)?.keepWarm) continue;
      const cfg = getAppConfig(id);
      const mins =
        cfg.hibernateMinutes > 0
          ? cfg.hibernateMinutes
          : Math.max(1, Number(settings.hibernateMinutes) || 5);
      if (now - entry.lastUsed >= mins * 60_000) hibernateService(id);
    }
    // Auto wake-up for startHibernated / hibernated apps
    for (const service of orderedServices()) {
      if (!service.config?.autoWakeMinutes || service.config.autoWakeMinutes <= 0) {
        continue;
      }
      if (views.has(service.id) || !service.config.enabled) continue;
      // Wake only if it was previously used (has lastActive memory) — skip cold startHibernated forever
    }
    broadcastState();
  }, 30_000);
}

// —— IPC ——
ipcMain.handle('dock:set-overlay', (_e, open) => {
  setOverlayOpen(open);
  return { ok: true };
});

ipcMain.handle('dock:set-chrome-size', (_e, size) => {
  chromeSize = size && typeof size === 'object' ? size : null;
  layoutActiveView();
  return { ok: true };
});

ipcMain.handle('dock:clear-notifications', () => {
  notificationLog = [];
  broadcastState();
  return { ok: true };
});

ipcMain.handle('dock:mark-all-read', () => {
  unreadCounts.clear();
  notificationLog = [];
  refreshBadge();
  broadcastState();
  return { ok: true };
});

ipcMain.handle('dock:get-state', () => currentState());
ipcMain.handle('dock:activate', (_e, id) => {
  activateService(id);
  return { ok: true };
});
ipcMain.handle('dock:add-service', (_e, appId) => addService(appId));
ipcMain.handle('dock:remove-service', (_e, id) => removeService(id));
ipcMain.handle('dock:save-app-config', (_e, id, patch) => {
  if (!getService(id)) return { ok: false, error: 'Not found' };
  const labels = { ...(settings.serviceLabels || {}) };
  if (patch && (patch.name != null || patch.title != null)) {
    const service = getService(id);
    const entry = {};
    const name = patch.name != null ? String(patch.name).trim() : '';
    const title = patch.title != null ? String(patch.title).trim() : '';
    if (name && name !== service.defaultName) entry.name = name;
    if (title && title !== service.defaultTitle) entry.title = title;
    if (Object.keys(entry).length) labels[id] = { ...(labels[id] || {}), ...entry };
    else delete labels[id];
    settings = saveSettings({ serviceLabels: labels });
    delete patch.name;
    delete patch.title;
  }
  const cfg = saveAppConfig(id, patch || {});
  if (!cfg.enabled) {
    if (activeServiceId === id) {
      hibernateService(id);
      activeServiceId = null;
      const next = orderedServices().find((s) => s.id !== id && s.config?.enabled);
      if (next) activateService(next.id);
      else {
        detachAllViews();
        broadcastState();
      }
    } else {
      hibernateService(id);
      broadcastState();
    }
  } else {
    applyMuteState();
    const entry = views.get(id);
    if (entry) applyFocusMode(entry.view.webContents, id);
    broadcastState();
  }
  return { ok: true, config: cfg };
});
ipcMain.handle('dock:app-navigate', (_e, id, action) => {
  const entry = views.get(id);
  if (!entry) return { ok: false };
  const wc = entry.view.webContents;
  if (action === 'back' && wc.canGoBack()) wc.goBack();
  else if (action === 'forward' && wc.canGoForward()) wc.goForward();
  else if (action === 'reload') wc.reload();
  else if (action === 'home') {
    const service = getService(id);
    if (service) wc.loadURL(service.url);
  } else if (action === 'devtools') {
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach' });
  }
  return { ok: true };
});
ipcMain.handle('dock:hibernate', (_e, id) => {
  hibernateService(id);
  broadcastState();
  return { ok: true };
});
ipcMain.handle('dock:hibernate-background', () => {
  hibernateBackground();
  return { ok: true };
});
ipcMain.handle('dock:reload-active', () => {
  reloadActive();
  return { ok: true };
});
ipcMain.handle('dock:toggle-focus', () => {
  toggleFocusMode();
  return { focusMode: settings.focusMode };
});
ipcMain.handle('dock:toggle-mute', () => {
  toggleMute();
  return { muted: settings.muted };
});
ipcMain.handle('dock:save-settings', (_e, patch) => {
  const next = { ...patch };
  if (next.lockPassword) {
    next.lockPasswordHash = hashPassword(next.lockPassword);
    delete next.lockPassword;
  }
  if (next.lockEnabled === false) {
    next.lockPasswordHash = '';
  }
  settings = saveSettings(next);
  applyWindowPrefs();
  installApplicationMenu();
  ensureTray();
  applyProxyToAllSessions();
  sampleAppMemory();
  layoutActiveView();
  for (const [id, entry] of views.entries()) {
    applyFocusMode(entry.view.webContents, id);
    const cfg = getAppConfig(id);
    const langs = cfg.spellChecker || settings.spellChecker || ['en-US'];
    entry.view.webContents.session.setSpellCheckerLanguages(
      Array.isArray(langs) && langs.length ? langs : ['en-US'],
    );
    entry.view.webContents.setAudioMuted(settings.muted || !cfg.allowSounds);
  }
  refreshBadge();
  broadcastState();
  return currentState();
});
ipcMain.handle('dock:lock', () => {
  lockApp();
  return { ok: true };
});
ipcMain.handle('dock:unlock', (_e, password) => unlockApp(password));
ipcMain.handle('dock:clear-session', async (_e, id) => {
  const service = getService(id);
  if (!service) return { ok: false };
  hibernateService(id);
  const s = session.fromPartition(service.partition);
  await s.clearStorageData();
  unreadCounts.delete(id);
  broadcastState();
  return { ok: true };
});
ipcMain.handle('dock:reorder', (_e, order) => {
  settings = saveSettings({ serviceOrder: order });
  broadcastState();
  return { ok: true };
});
ipcMain.handle('dock:pick-download-dir', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return { path: null };
  return { path: result.filePaths[0] };
});

function watchSystemIdle() {
  const lockIfEnabled = () => {
    if (settings.lockOnSystemIdle && settings.lockEnabled) lockApp();
  };
  powerMonitor.on('lock-screen', lockIfEnabled);
  powerMonitor.on('suspend', lockIfEnabled);
}

app.whenReady().then(() => {
  app.setName('Aspera Dock');
  settings = loadSettings();
  createWindow();
  startHibernateTimer();
  startMemoryTimer();
  watchSystemIdle();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  raiseDockWindow();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
