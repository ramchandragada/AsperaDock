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
  MAX_APPS_TOTAL,
  MAX_APP_NAME_LENGTH,
  MAX_WARM_VIEWS_DEFAULT,
  INTERNAL_HOSTS,
  CUSTOM_APP_ID,
  isCustomAppId,
  getChromeMetrics,
  getAppCatalogEntry,
  defaultInstanceName,
  defaultInstanceTitle,
  clampAppName,
} from './services.js';
import {
  loadSettings,
  saveSettings,
  hashPassword,
  verifyPassword,
  makeProfile,
  PRIMARY_PROFILE_ID,
} from './store.js';
import { mergeAppConfig, MOBILE_USER_AGENT } from './appConfig.js';
import { APP_ICON_PNG_DATA_URL } from './appIconData.js';
import {
  installErrorReporting,
  setErrorReporterContext,
  setErrorReporterSettingsProvider,
  reportError,
  noteHeartbeat,
  logBreadcrumb,
  watchWebContents,
  showPendingCrashDialog,
  markCleanShutdown,
  listRecentReports,
  openReportsFolder,
  getReportsDir,
  pauseFreezeWatch,
  resumeFreezeWatch,
  dismissAllPendingReports,
} from './errorReporter.js';
import {
  configureUpdater,
  startAutoUpdate,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getUpdateStatus,
  updateReadyForQuit,
} from './updater.js';
import { initSentryMain } from './sentryMain.js';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
// Windows Squirrel first-run hook. Never hard-require it — Forge+Vite does not
// ship node_modules into the asar, so a bare require crashes Linux .deb installs.
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch {
    // ignore — module absent in packaged Linux builds
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// GNOME Wayland ignores BrowserWindow.setIcon for the dock/taskbar.
// It matches windows to a .desktop file via app id / StartupWMClass.
// Must be set before ready — use a stable id without spaces.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'asperadock');
  app.setName('asperadock');
  try {
    app.setDesktopName('asperadock.desktop');
  } catch {
    // older Electron
  }
}

const CHROME_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Absolute path to a PNG the Linux WM can load for the taskbar icon. */
function getAppIconPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(app.getAppPath(), 'assets', 'icon.png'),
    path.join(__dirname, '../../assets/icon.png'),
    path.join(__dirname, '../assets/icon.png'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).size > 100) return p;
    } catch {
      // try next
    }
  }

  // Last resort: materialize the embedded Aspera A PNG under userData.
  try {
    const dest = path.join(app.getPath('userData'), 'asperadock-icon.png');
    const b64 = APP_ICON_PNG_DATA_URL.split(',')[1];
    const buf = Buffer.from(b64, 'base64');
    if (!fs.existsSync(dest) || fs.statSync(dest).size !== buf.length) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    }
    return dest;
  } catch {
    return null;
  }
}

/** Cached Aspera "A" app icon for window / tray / About. */
let _appIcon = null;
function getAppIcon() {
  if (_appIcon && !_appIcon.isEmpty()) return _appIcon;
  const iconPath = getAppIconPath();
  if (iconPath) {
    _appIcon = nativeImage.createFromPath(iconPath);
  }
  if (!_appIcon || _appIcon.isEmpty()) {
    _appIcon = nativeImage.createFromDataURL(APP_ICON_PNG_DATA_URL);
  }
  return _appIcon;
}

function applyWindowIcon(win) {
  if (!win || win.isDestroyed()) return;
  try {
    // Prefer NativeImage built from the embedded PNG — most reliable on Linux.
    const img = electronNativeIcon();
    if (img && !img.isEmpty()) {
      win.setIcon(img);
      return;
    }
  } catch {
    // fall through
  }
  const iconPath = getAppIconPath();
  if (iconPath) {
    try {
      win.setIcon(iconPath);
    } catch {
      // ignore
    }
  }
}

function electronNativeIcon() {
  // Always rebuild from the embedded asset so we never hand Electron an empty image.
  const fromData = nativeImage.createFromDataURL(APP_ICON_PNG_DATA_URL);
  if (fromData && !fromData.isEmpty()) return fromData;
  const iconPath = getAppIconPath();
  if (iconPath) return nativeImage.createFromPath(iconPath);
  return nativeImage.createEmpty();
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let quitting = false;

/** @type {Map<string, { view: BrowserView, lastUsed: number }>} */
const views = new Map();
/** When a background app was hibernated — used for auto-wake. */
/** @type {Map<string, number>} */
const hibernatedAt = new Map();
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

/** Lean defaults for refurbished PCs — one warm tab, fast hibernate. */
function isLowMemoryMode() {
  return settings.lowMemoryMode !== false;
}

function applyMemorySwitches() {
  const lean = isLowMemoryMode();
  const disabled = new Set(['SpareRendererForSitePerProcess']);

  if (lean || settings.hardwareAcceleration === false) {
    app.disableHardwareAcceleration();
  }
  if (settings.hiDpiSupport === false) {
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  if (settings.mediaKeys === false) {
    disabled.add('HardwareMediaKeyHandling');
  }

  // Trim Chromium caches / spare processes (helps 8–16 GB machines a lot).
  app.commandLine.appendSwitch('disable-features', [...disabled].join(','));
  app.commandLine.appendSwitch('disk-cache-size', String((lean ? 32 : 64) * 1024 * 1024));
  app.commandLine.appendSwitch(
    'js-flags',
    lean ? '--max-old-space-size=192' : '--max-old-space-size=384',
  );
  if (lean) {
    app.commandLine.appendSwitch('renderer-process-limit', '4');
  }
}

applyMemorySwitches();
// Sentry must init before Electron's ready event (native crash + IPC hooks).
setErrorReporterSettingsProvider(() => settings);
initSentryMain(settings);

setErrorReporterSettingsProvider(() => settings);
setErrorReporterContext(() => ({
  activeServiceId,
  warmViewCount: views.size,
  locked,
  overlayOpen,
  serviceCount: (settings.serviceInstances || []).length,
}));

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

function getProfiles() {
  return Array.isArray(settings.profiles) ? settings.profiles : [];
}

function getProfile(id) {
  return getProfiles().find((p) => p.id === id) || null;
}

function partitionForInstance(inst) {
  if (inst.partition && String(inst.partition).startsWith('persist:')) {
    return String(inst.partition);
  }
  const profile = getProfile(inst.profileId) || getProfile(PRIMARY_PROFILE_ID);
  if (profile?.partition) return profile.partition;
  return `persist:profile-${PRIMARY_PROFILE_ID}`;
}

function appsUsingProfile(profileId) {
  return (settings.serviceInstances || []).filter((i) => i.profileId === profileId);
}

function ensureUniqueProfileName(base, exceptId = null) {
  const names = new Set(
    getProfiles()
      .filter((p) => p.id !== exceptId)
      .map((p) => p.name.toLowerCase()),
  );
  let name = String(base || 'Profile').trim() || 'Profile';
  if (!names.has(name.toLowerCase())) return name;
  let n = 2;
  while (names.has(`${name} ${n}`.toLowerCase())) n += 1;
  return `${name} ${n}`;
}

/** Create a fresh empty profile (new Electron partition). */
function createProfile(name) {
  const profile = makeProfile(ensureUniqueProfileName(name || 'Profile'));
  const profiles = [...getProfiles(), profile];
  settings = saveSettings({ profiles });
  broadcastState();
  return { ok: true, profile };
}

function renameProfile(id, name) {
  if (id === PRIMARY_PROFILE_ID && !String(name || '').trim()) {
    return { ok: false, error: 'Primary needs a name' };
  }
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: 'Profile not found' };
  const nextName = ensureUniqueProfileName(name, id);
  const next = profiles.map((p, i) => (i === idx ? { ...p, name: nextName } : p));
  settings = saveSettings({ profiles: next });
  broadcastState();
  return { ok: true, profile: next[idx] };
}

async function deleteProfile(id) {
  if (id === PRIMARY_PROFILE_ID) {
    return { ok: false, error: 'Cannot delete the Primary profile' };
  }
  const profile = getProfile(id);
  if (!profile) return { ok: false, error: 'Profile not found' };
  if (appsUsingProfile(id).length) {
    return {
      ok: false,
      error: 'Move or remove apps using this profile first',
    };
  }
  const profiles = getProfiles().filter((p) => p.id !== id);
  settings = saveSettings({ profiles });
  try {
    const s = session.fromPartition(profile.partition);
    await s.clearStorageData();
    await s.clearCache();
  } catch {
    // ignore clear failures
  }
  broadcastState();
  return { ok: true };
}

/**
 * Pick a profile for a newly added app.
 * First copy of an app → Primary.
 * Extra copies → brand-new profile so logins stay separate (Rambox behaviour).
 */
function profileIdForNewApp(appId, entry) {
  const existing = (settings.serviceInstances || []).filter((i) => i.appId === appId);
  if (!existing.length) {
    return getProfile(PRIMARY_PROFILE_ID)?.id || PRIMARY_PROFILE_ID;
  }
  const slot = existing.length + 1;
  const created = createProfile(`${entry.name} ${slot}`);
  return created.profile.id;
}

function resolveInstance(inst) {
  const entry = getAppCatalogEntry(inst.appId);
  if (!entry) return null;
  const slot = Math.max(1, Number(inst.slot) || 1);
  const config = getAppConfig(inst.id);
  const profileId = inst.profileId || PRIMARY_PROFILE_ID;
  const profile = getProfile(profileId) || getProfile(PRIMARY_PROFILE_ID);

  if (isCustomAppId(inst.appId)) {
    const url = String(inst.url || '').trim();
    if (!url.startsWith('http')) return null;
    const name = clampAppName(inst.name || entry.name);
    return {
      id: inst.id,
      appId: CUSTOM_APP_ID,
      name,
      title: String(inst.title || name).trim() || name,
      url,
      partition: partitionForInstance(inst),
      profileId: profile?.id || PRIMARY_PROFILE_ID,
      profileName: profile?.name || 'Primary',
      color: inst.color || entry.color,
      logo: 'custom',
      keepWarm: false,
      slot,
      config,
      isCustom: true,
    };
  }

  const name = defaultInstanceName(entry, slot);
  const title = defaultInstanceTitle(entry, slot);
  return {
    id: inst.id,
    appId: entry.appId,
    name,
    title,
    url: entry.url,
    partition: partitionForInstance(inst),
    profileId: profile?.id || PRIMARY_PROFILE_ID,
    profileName: profile?.name || 'Primary',
    color: entry.color,
    logo: entry.logo,
    keepWarm: false,
    slot,
    config,
    isCustom: false,
  };
}

function orderedServices() {
  const instances = settings.serviceInstances || [];
  const order = settings.serviceOrder || [];
  const labels = settings.serviceLabels || {};

  const decorate = (s) => {
    if (!s) return null;
    const custom = labels[s.id] || {};
    const name = clampAppName(
      (custom.name && String(custom.name).trim()) || s.name,
    );
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

function totalAppCount() {
  return (settings.serviceInstances || []).length;
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

function addService(appId, profileId = null) {
  const entry = getAppCatalogEntry(appId);
  if (!entry) return { ok: false, error: 'Unknown app' };
  if (totalAppCount() >= MAX_APPS_TOTAL) {
    return { ok: false, error: `Max ${MAX_APPS_TOTAL} apps in the dock` };
  }
  if (countInstances(appId) >= MAX_INSTANCES_PER_APP) {
    return { ok: false, error: `Max ${MAX_INSTANCES_PER_APP} ${entry.name} apps` };
  }
  const slot = nextSlot(appId);
  if (!slot) {
    return { ok: false, error: `Max ${MAX_INSTANCES_PER_APP} ${entry.name} apps` };
  }

  let resolvedProfileId = profileId;
  if (resolvedProfileId && !getProfile(resolvedProfileId)) {
    return { ok: false, error: 'Profile not found' };
  }
  if (!resolvedProfileId) {
    resolvedProfileId = profileIdForNewApp(appId, entry);
  }

  // Same app + same profile would share one WhatsApp/Gmail login — block it.
  // Custom URLs may share a profile (different sites, same cookies jar is fine).
  if (!isCustomAppId(appId)) {
    const clash = (settings.serviceInstances || []).some(
      (i) => i.appId === appId && i.profileId === resolvedProfileId,
    );
    if (clash) {
      return {
        ok: false,
        error: `Another ${entry.name} already uses this profile. Create or pick a different profile.`,
      };
    }
  }

  const id = `${appId}-${slot}-${Date.now().toString(36)}`;
  const instances = [
    ...(settings.serviceInstances || []),
    { id, appId, profileId: resolvedProfileId, slot },
  ];
  const serviceOrder = [...(settings.serviceOrder || []), id];
  settings = saveSettings({ serviceInstances: instances, serviceOrder });
  broadcastState();
  activateService(id);
  return { ok: true, id, profileId: resolvedProfileId };
}

/** Add any https URL as a dock app (intranet, HRMS, Jira, Notion, …). */
function addCustomService({ url, name, profileId = null } = {}) {
  if (totalAppCount() >= MAX_APPS_TOTAL) {
    return { ok: false, error: `Max ${MAX_APPS_TOTAL} apps in the dock` };
  }
  let parsed;
  try {
    const raw = String(url || '').trim();
    parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'Enter a valid URL' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'URL must start with http:// or https://' };
  }
  const href = parsed.toString();
  const label = clampAppName(
    name || parsed.hostname.replace(/^www\./, '') || 'Custom',
  );

  let resolvedProfileId = profileId;
  if (resolvedProfileId && !getProfile(resolvedProfileId)) {
    return { ok: false, error: 'Profile not found' };
  }
  if (!resolvedProfileId) {
    resolvedProfileId = getProfile(PRIMARY_PROFILE_ID)?.id || PRIMARY_PROFILE_ID;
  }

  const same = (settings.serviceInstances || []).some(
    (i) =>
      isCustomAppId(i.appId) &&
      i.profileId === resolvedProfileId &&
      String(i.url || '') === href,
  );
  if (same) {
    return { ok: false, error: 'That URL is already on this profile' };
  }

  const slot = nextSlot(CUSTOM_APP_ID) || countInstances(CUSTOM_APP_ID) + 1;
  const id = `custom-${slot}-${Date.now().toString(36)}`;
  const instances = [
    ...(settings.serviceInstances || []),
    {
      id,
      appId: CUSTOM_APP_ID,
      profileId: resolvedProfileId,
      slot,
      url: href,
      name: label,
      title: label,
      color: '#3D5A80',
    },
  ];
  const serviceOrder = [...(settings.serviceOrder || []), id];
  settings = saveSettings({ serviceInstances: instances, serviceOrder });
  broadcastState();
  activateService(id);
  return { ok: true, id, profileId: resolvedProfileId };
}

/** Move an app instance onto another profile (changes its Electron session). */
function setInstanceProfile(serviceId, profileId) {
  const profile = getProfile(profileId);
  if (!profile) return { ok: false, error: 'Profile not found' };
  const instances = settings.serviceInstances || [];
  const idx = instances.findIndex((i) => i.id === serviceId);
  if (idx < 0) return { ok: false, error: 'App not found' };
  const inst = instances[idx];
  if (inst.profileId === profileId) return { ok: true };

  const clash = instances.some(
    (i) =>
      i.id !== serviceId &&
      i.appId === inst.appId &&
      i.profileId === profileId &&
      !isCustomAppId(inst.appId),
  );
  if (clash) {
    const entry = getAppCatalogEntry(inst.appId);
    return {
      ok: false,
      error: `Another ${entry?.name || 'app'} already uses this profile`,
    };
  }

  // Tear down the old session view before switching partition.
  hibernateService(serviceId);
  const next = instances.map((i, n) =>
    n === idx ? { ...i, profileId } : i,
  );
  settings = saveSettings({ serviceInstances: next });
  broadcastState();
  if (activeServiceId === serviceId) activateService(serviceId);
  return { ok: true };
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
  const mins = isLowMemoryMode()
    ? Math.min(3, Math.max(1, Number(settings.hibernateMinutes) || 2))
    : Math.max(1, Number(settings.hibernateMinutes) || 2);
  return mins * 60_000;
}

function maxWarm() {
  if (isLowMemoryMode()) return 1;
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
  let serviceHost = '';
  try {
    serviceHost = baseDomain(new URL(service.url).hostname);
  } catch {
    serviceHost = '';
  }
  const allowed = [serviceHost, ...INTERNAL_HOSTS].filter(Boolean);
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
  // Never autoResize — on Linux it expands over the HTML chrome after
  // dialogs/reattach and looks like a "single app" fullscreen webview.
  entry.view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false });
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

function dockTitleBase() {
  const v = app.getVersion();
  return app.isPackaged ? `Aspera Dock ${v}` : `Aspera Dock ${v} (dev)`;
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
            ? `${dockTitleBase()} — ${svc?.title || svc?.name} (${total})`
            : `${dockTitleBase()} — ${svc?.title || svc?.name || ''}`,
        );
      } else if (dockIsUserFocused()) {
        mainWindow.setTitle(total > 0 ? `${dockTitleBase()} (${total})` : dockTitleBase());
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
  const seen = new Set();
  for (const item of settings.serviceInstances || []) {
    const partition = partitionForInstance(item);
    if (!partition || seen.has(partition)) continue;
    seen.add(partition);
    applyProxy(session.fromPartition(partition));
  }
  for (const profile of getProfiles()) {
    if (!profile.partition || seen.has(profile.partition)) continue;
    seen.add(profile.partition);
    applyProxy(session.fromPartition(profile.partition));
  }
}

/** Partitions that already had permission/download handlers attached. */
const configuredPartitions = new Set();

function configureSession(partitionSession, partitionKey) {
  applyProxy(partitionSession);
  if (configuredPartitions.has(partitionKey)) return;
  configuredPartitions.add(partitionKey);

  partitionSession.setUserAgent(CHROME_USER_AGENT);
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
    if (settings.downloadPath) {
      item.setSavePath(path.join(settings.downloadPath, item.getFilename()));
    } else {
      // "Ask every time" — blank download path in Settings.
      const picked = dialog.showSaveDialogSync(mainWindow || undefined, {
        title: 'Save download',
        defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      });
      if (!picked) {
        item.cancel();
        return;
      }
      item.setSavePath(picked);
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
  configureSession(partitionSession, service.partition);

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
  webContents.on('found-in-page', (_event, result) => {
    mainWindow?.webContents.send('dock:find-result', {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
    });
  });
  webContents.loadURL(service.url);

  const zoom = Number(cfg.zoomFactor);
  if (Number.isFinite(zoom) && zoom > 0) {
    webContents.setZoomFactor(Math.min(2, Math.max(0.5, zoom)));
  }

  views.set(service.id, { view, lastUsed: Date.now() });
  hibernatedAt.delete(service.id);
  watchWebContents(webContents, `app:${service.appId}:${service.id}`);
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
  hibernatedAt.set(id, Date.now());
}

/** Background wake for autoWakeMinutes — loads without stealing the active tab. */
function softWakeService(id) {
  if (views.has(id) || locked) return false;
  const service = getService(id);
  if (!service || service.config?.enabled === false) return false;
  if (views.size >= maxWarm()) return false;
  createViewForService(service);
  enforceWarmLimit();
  return views.has(id);
}

function enforceWarmLimit() {
  const evictable = [...views.entries()]
    .filter(([id]) => id !== activeServiceId)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  const budget = Math.max(0, maxWarm() - 1);
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
  mainWindow.setSkipTaskbar(settings.displayBehaviour === 'tray');
  app.setLoginItemSettings({ openAtLogin: !!settings.autoStart });
  ensureTray();
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
    profiles: getProfiles().map((p) => ({
      ...p,
      appCount: appsUsingProfile(p.id).length,
      locked: p.id === PRIMARY_PROFILE_ID,
    })),
    catalog: [
      ...APP_CATALOG.map((a) => ({
        ...a,
        count: countInstances(a.appId),
        max: MAX_INSTANCES_PER_APP,
        totalApps: totalAppCount(),
        maxTotal: MAX_APPS_TOTAL,
        canAdd:
          totalAppCount() < MAX_APPS_TOTAL &&
          countInstances(a.appId) < MAX_INSTANCES_PER_APP,
      })),
      {
        appId: CUSTOM_APP_ID,
        name: 'Custom',
        title: 'Custom app (any URL)',
        url: '',
        color: '#3D5A80',
        logo: 'custom',
        count: countInstances(CUSTOM_APP_ID),
        max: MAX_INSTANCES_PER_APP,
        totalApps: totalAppCount(),
        maxTotal: MAX_APPS_TOTAL,
        canAdd:
          totalAppCount() < MAX_APPS_TOTAL &&
          countInstances(CUSTOM_APP_ID) < MAX_INSTANCES_PER_APP,
        isCustom: true,
      },
    ],
    limits: {
      maxAppsTotal: MAX_APPS_TOTAL,
      maxPerApp: MAX_INSTANCES_PER_APP,
      maxNameLength: MAX_APP_NAME_LENGTH,
      totalApps: totalAppCount(),
    },
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
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
    if (key === 'f' && !input.shift) {
      event.preventDefault();
      mainWindow?.webContents.send('dock:open-find');
      return;
    }
    if (key === 'p' && !input.shift) {
      event.preventDefault();
      printActivePage();
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
  const showBadge = !!(badge && settings.trayUnreadIndicator);
  // Crisp SVG of the Aspera open-A mark (matches app icon).
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#081230"/>
      <defs>
        <linearGradient id="g" x1="14" y1="48" x2="50" y2="16" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5A6EE6"/>
          <stop offset="1" stop-color="#A0AFFF"/>
        </linearGradient>
      </defs>
      <path fill="url(#g)" d="M15.2 47.5 L29.4 18.2 H33.2 L21.5 47.5 Z"/>
      <path fill="url(#g)" d="M48.8 47.5 L34.6 18.2 H30.8 L42.5 47.5 Z"/>
      ${showBadge ? '<circle cx="52" cy="12" r="10" fill="#e5484d"/>' : ''}
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
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
  const clamped = Math.min(2, Math.max(0.5, next));
  webContents.setZoomFactor(clamped);
  if (activeServiceId) {
    saveAppConfig(activeServiceId, { zoomFactor: clamped });
  }
}

function findInActivePage(text, options = {}) {
  const webContents = views.get(activeServiceId)?.view.webContents;
  if (!webContents || webContents.isDestroyed()) return { ok: false };
  const query = String(text || '');
  if (!query) {
    webContents.stopFindInPage('clearSelection');
    return { ok: true, cleared: true };
  }
  webContents.findInPage(query, {
    forward: options.forward !== false,
    findNext: !!options.findNext,
    matchCase: !!options.matchCase,
  });
  return { ok: true };
}

function stopFindInActivePage() {
  const webContents = views.get(activeServiceId)?.view.webContents;
  if (!webContents || webContents.isDestroyed()) return { ok: false };
  webContents.stopFindInPage('clearSelection');
  return { ok: true };
}

function printActivePage() {
  const webContents = views.get(activeServiceId)?.view.webContents;
  if (!webContents || webContents.isDestroyed()) return { ok: false };
  webContents.print({});
  return { ok: true };
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
  const partitions = new Set();
  for (const item of settings.serviceInstances || []) {
    partitions.add(partitionForInstance(item));
  }
  for (const profile of getProfiles()) {
    if (profile.partition) partitions.add(profile.partition);
  }
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
        {
          label: 'Print…',
          accelerator: 'CommandOrControl+P',
          click: () => printActivePage(),
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
        { type: 'separator' },
        {
          label: 'Find…',
          accelerator: 'CommandOrControl+F',
          click: () => mainWindow?.webContents.send('dock:open-find'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Apps manager',
          click: () => mainWindow?.webContents.send('dock:open-apps-settings'),
        },
        {
          label: 'Profiles',
          click: () => mainWindow?.webContents.send('dock:open-profiles'),
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
              'https://github.com/ramchandragada/AsperaDock/issues/new',
            ),
        },
        { type: 'separator' },
        {
          label: 'Check for updates…',
          click: () => checkForUpdates({ silent: false }),
        },
        {
          label: 'Open error reports folder',
          click: () => openReportsFolder(),
        },
        {
          label: 'Send test error report',
          click: async () => {
            const result = await reportError('manual-test', {
              message: 'Manual test report from Help menu',
              reason: 'user-triggered',
            });
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Test report',
              message: result.uploaded
                ? 'Test report saved and sent (Sentry / configured target).'
                : `Test report saved locally.\n${result.file || getReportsDir()}\n\nAdd a Sentry DSN in Settings to send automatically.`,
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'About Aspera Dock',
          click: () => showAboutDialog(),
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
  mainWindow?.setMenu(menu);
}

function showAboutDialog() {
  beforeDialogSafe();
  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      title: 'About Aspera Dock',
      message: `Aspera Dock ${app.getVersion()}`,
      detail:
        'Company workspace by Aspera — messaging and business apps in one dock.\n\n' +
        `Electron ${process.versions.electron} · Chrome ${process.versions.chrome}`,
      buttons: ['OK'],
      icon: getAppIcon(),
    })
    .finally(() => afterDialogSafe());
}

function beforeDialogSafe() {
  try {
    setOverlayOpen(true);
    pauseFreezeWatch();
  } catch {
    // ignore
  }
}

function afterDialogSafe() {
  try {
    resumeFreezeWatch();
    mainWindow?.webContents.send('dock:sync-overlay');
    setOverlayOpen(false);
    setTimeout(() => layoutActiveView(), 50);
  } catch {
    // ignore
  }
}

function createWindow() {
  const icon = electronNativeIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: `Aspera Dock ${app.getVersion()}`,
    icon,
    backgroundColor: '#081230',
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
  applyWindowIcon(mainWindow);
  watchWebContents(mainWindow.webContents, 'shell');

  mainWindow.once('ready-to-show', () => {
    applyWindowIcon(mainWindow);
    mainWindow.show();
    // Some Linux panels only refresh the icon after the window is mapped.
    setTimeout(() => applyWindowIcon(mainWindow), 250);
    setTimeout(() => applyWindowIcon(mainWindow), 1000);
    setTimeout(async () => {
      // One-time clear of the restart-nag loop caused by freeze + failed update dialogs.
      try {
        const nagFlag = path.join(app.getPath('userData'), 'cleared-dialog-nags-v1');
        if (!fs.existsSync(nagFlag)) {
          dismissAllPendingReports();
          fs.writeFileSync(nagFlag, new Date().toISOString(), 'utf8');
        }
      } catch {
        // ignore
      }
      setOverlayOpen(true);
      pauseFreezeWatch();
      try {
        await showPendingCrashDialog(mainWindow);
      } finally {
        resumeFreezeWatch();
        mainWindow?.webContents.send('dock:sync-overlay');
        setOverlayOpen(false);
      }
    }, 1200);
  });
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

  loadDockChrome();

  // A dead renderer leaves the tab bar blank while app views keep painting —
  // it looks like the dock turned into a single fullscreen app. Recover instead.
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    reportError('chrome-load-failed', {
      message: `Dock chrome failed to load (${code} ${description})`,
      details: { url },
    }).catch(() => {});
    scheduleChromeReload();
  });

  mainWindow.webContents.on('render-process-gone', () => {
    scheduleChromeReload();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    chromeReloadTries = 0;
    broadcastState();
    if (activeServiceId) {
      // Reattach after a chrome reload, otherwise the window looks empty.
      setOverlayOpen(false);
    }
    if (settings.lockEnabled && settings.lockPasswordHash) {
      locked = true;
      broadcastState();
      return;
    }
    const enabled = orderedServices().filter((s) => s.config?.enabled !== false);
    const remembered = getService(settings.lastActiveServiceId);
    let first =
      remembered && remembered.config?.enabled !== false ? remembered : null;
    // Prefer an app that is not "start hibernated" for the first paint.
    if (!first || first.config?.startHibernated) {
      first =
        enabled.find((s) => !s.config?.startHibernated) ||
        first ||
        enabled[0] ||
        null;
    }
    if (!first) return;
    if (first.config?.startHibernated) {
      // Select the tab but don't load until the user clicks (or auto-wake).
      activeServiceId = first.id;
      hibernatedAt.set(first.id, Date.now());
      broadcastState();
      return;
    }
    activateService(first.id);
  });
}

function loadDockChrome() {
  if (!mainWindow) return;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

let chromeReloadTimer = null;
let chromeReloadTries = 0;

function scheduleChromeReload() {
  if (chromeReloadTimer || !mainWindow || mainWindow.isDestroyed()) return;
  chromeReloadTries += 1;
  if (chromeReloadTries > 5) {
    // Give up quietly rather than reload-looping; views still work.
    return;
  }
  chromeReloadTimer = setTimeout(() => {
    chromeReloadTimer = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Uncover the chrome so a blank bar cannot hide behind an app view.
    detachAllViews();
    loadDockChrome();
  }, 800 * chromeReloadTries);
}

function startHibernateTimer() {
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of views.entries()) {
      if (id === activeServiceId) continue;
      const cfg = getAppConfig(id);
      const mins =
        cfg.hibernateMinutes > 0
          ? cfg.hibernateMinutes
          : isLowMemoryMode()
            ? Math.min(3, Math.max(1, Number(settings.hibernateMinutes) || 2))
            : Math.max(1, Number(settings.hibernateMinutes) || 2);
      if (now - entry.lastUsed >= mins * 60_000) hibernateService(id);
    }
    // Auto wake-up: soft-load hibernated apps after autoWakeMinutes (if warm budget allows).
    for (const service of orderedServices()) {
      const mins = Number(service.config?.autoWakeMinutes) || 0;
      if (mins <= 0) continue;
      if (views.has(service.id) || service.config?.enabled === false) continue;
      const sleptAt = hibernatedAt.get(service.id);
      if (!sleptAt) continue;
      if (Date.now() - sleptAt >= mins * 60_000) {
        softWakeService(service.id);
      }
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

ipcMain.handle('dock:heartbeat', () => {
  noteHeartbeat();
  return { ok: true };
});

ipcMain.handle('dock:report-error', async (_e, payload = {}) => {
  const result = await reportError(payload.kind || 'renderer-error', {
    message: payload.message || 'Renderer error',
    error: payload.error || null,
    source: payload.source || 'renderer',
    extra: payload.extra || null,
  });
  return {
    ok: true,
    id: result.id,
    uploaded: result.uploaded,
    file: result.file,
  };
});

ipcMain.handle('dock:list-error-reports', () => listRecentReports(30));
ipcMain.handle('dock:open-error-reports', () => {
  openReportsFolder();
  return { ok: true, dir: getReportsDir() };
});

ipcMain.handle('dock:update-status', () => getUpdateStatus());
ipcMain.handle('dock:show-about', () => {
  showAboutDialog();
  return { version: app.getVersion() };
});
ipcMain.handle('dock:update-check', () => checkForUpdates({ silent: false }));
ipcMain.handle('dock:update-download', () => downloadUpdate());
ipcMain.handle('dock:update-install', () => installUpdate());

ipcMain.handle('dock:get-state', () => currentState());
ipcMain.handle('dock:activate', (_e, id) => {
  activateService(id);
  return { ok: true };
});
ipcMain.handle('dock:add-service', (_e, appId, profileId) =>
  addService(appId, profileId || null),
);
ipcMain.handle('dock:add-custom-service', (_e, payload) =>
  addCustomService(payload || {}),
);
ipcMain.handle('dock:find-in-page', (_e, text, options) =>
  findInActivePage(text, options || {}),
);
ipcMain.handle('dock:stop-find', () => stopFindInActivePage());
ipcMain.handle('dock:print-active', () => printActivePage());
ipcMain.handle('dock:remove-service', (_e, id) => removeService(id));
ipcMain.handle('dock:create-profile', (_e, name) => createProfile(name));
ipcMain.handle('dock:rename-profile', (_e, id, name) => renameProfile(id, name));
ipcMain.handle('dock:delete-profile', (_e, id) => deleteProfile(id));
ipcMain.handle('dock:set-instance-profile', (_e, serviceId, profileId) =>
  setInstanceProfile(serviceId, profileId),
);
ipcMain.handle('dock:save-app-config', (_e, id, patch) => {
  if (!getService(id)) return { ok: false, error: 'Not found' };

  if (patch && patch.profileId != null) {
    const moved = setInstanceProfile(id, patch.profileId);
    if (!moved.ok) return moved;
    delete patch.profileId;
  }

  const labels = { ...(settings.serviceLabels || {}) };
  if (patch && (patch.name != null || patch.title != null)) {
    const service = getService(id);
    const entry = {};
    const name = patch.name != null ? clampAppName(patch.name) : '';
    const title = patch.title != null ? clampAppName(patch.title) : '';
    if (name && name !== service.defaultName) entry.name = name;
    if (title && title !== service.defaultTitle) entry.title = title;
    if (Object.keys(entry).length) labels[id] = { ...(labels[id] || {}), ...entry };
    else delete labels[id];
    settings = saveSettings({ serviceLabels: labels });
    delete patch.name;
    delete patch.title;
  }

  // Custom apps store URL / color on the instance record.
  if (patch && (patch.url != null || patch.color != null)) {
    const instances = settings.serviceInstances || [];
    const idx = instances.findIndex((i) => i.id === id);
    if (idx >= 0 && isCustomAppId(instances[idx].appId)) {
      let nextUrl = instances[idx].url;
      if (patch.url != null) {
        try {
          const raw = String(patch.url).trim();
          const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { ok: false, error: 'URL must be http(s)' };
          }
          nextUrl = parsed.toString();
        } catch {
          return { ok: false, error: 'Invalid URL' };
        }
      }
      const updated = {
        ...instances[idx],
        url: nextUrl,
        color: patch.color != null ? patch.color : instances[idx].color,
      };
      if (labels[id]?.name) updated.name = labels[id].name;
      const nextInstances = instances.map((i, n) => (n === idx ? updated : i));
      settings = saveSettings({ serviceInstances: nextInstances });
      hibernateService(id);
      if (activeServiceId === id) activateService(id);
    }
    delete patch.url;
    delete patch.color;
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
  // Low-memory mode clamps warm/hibernate and turns GPU off (relaunch needed).
  if (next.lowMemoryMode === true) {
    next.maxWarmViews = 1;
    next.hibernateMinutes = Math.min(
      3,
      Math.max(1, Number(next.hibernateMinutes) || 2),
    );
    next.hardwareAcceleration = false;
  }
  settings = saveSettings(next);
  applyWindowPrefs();
  installApplicationMenu();
  ensureTray();
  applyProxyToAllSessions();
  sampleAppMemory();
  startAutoUpdate();
  // Sentry can start mid-session if the user just pasted a DSN.
  initSentryMain(settings);
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
  // Clears the whole profile partition — every app on this profile signs out.
  const s = session.fromPartition(service.partition);
  await s.clearStorageData();
  await s.clearCache();
  for (const inst of appsUsingProfile(service.profileId)) {
    unreadCounts.delete(inst.id);
    hibernateService(inst.id);
  }
  broadcastState();
  return { ok: true, profileId: service.profileId };
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
ipcMain.handle('dock:open-downloads', async () => {
  const downloadDir = String(settings.downloadPath || '').trim() || app.getPath('downloads');
  try {
    fs.mkdirSync(downloadDir, { recursive: true });
    const error = await shell.openPath(downloadDir);
    return { ok: !error, path: downloadDir, error: error || undefined };
  } catch (error) {
    return { ok: false, path: downloadDir, error: String(error?.message || error) };
  }
});

function watchSystemIdle() {
  const lockIfEnabled = () => {
    if (settings.lockOnSystemIdle && settings.lockEnabled) lockApp();
  };
  powerMonitor.on('lock-screen', lockIfEnabled);
  powerMonitor.on('suspend', lockIfEnabled);
}

app.whenReady().then(() => {
  // Keep a friendly name in menus/About; WM class stays "asperadock" for the dock icon.
  if (process.platform !== 'linux') {
    app.setName('Aspera Dock');
  }
  settings = loadSettings();
  installErrorReporting({
    getSettings: () => settings,
    getContext: () => ({
      activeServiceId,
      warmViewCount: views.size,
      locked,
      overlayOpen,
      serviceCount: (settings.serviceInstances || []).length,
    }),
  });
  logBreadcrumb('app-ready');
  createWindow();
  startHibernateTimer();
  startMemoryTimer();
  watchSystemIdle();
  configureUpdater({
    getSettings: () => settings,
    onError: (kind, payload) => reportError(kind, payload).catch(() => {}),
    onBeforeDialog: () => {
      setOverlayOpen(true);
      pauseFreezeWatch();
    },
    onAfterDialog: () => {
      resumeFreezeWatch();
      // Let the renderer re-assert if a settings/menu overlay is still open.
      mainWindow?.webContents.send('dock:sync-overlay');
      setOverlayOpen(false);
      // Re-layout after native dialogs — BrowserView can end up fullscreen otherwise.
      setTimeout(() => layoutActiveView(), 50);
      setTimeout(() => layoutActiveView(), 250);
    },
    onBeforeRelaunch: () => {
      markCleanShutdown();
    },
  });
  startAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  raiseDockWindow();
});

app.on('before-quit', () => {
  quitting = true;
  markCleanShutdown();
  logBreadcrumb('before-quit');
  // Seamless: apply a downloaded AppImage update in place while quitting so the
  // next launch is already the new version. deb/rpm need elevation, so those are
  // handled interactively during the session instead.
  if (updateReadyForQuit()) {
    installUpdate({ silentOnFail: true }).catch(() => {});
  }
});

app.on('will-quit', () => {
  markCleanShutdown();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('child-process-gone', (_event, details) => {
  reportError('child-process-gone', {
    message: `Child process gone: ${details?.type || 'unknown'} / ${details?.reason || ''}`,
    details,
  }).catch(() => {});
});

app.on('render-process-gone', (_event, _wc, details) => {
  reportError('app-render-process-gone', {
    message: `App render process gone: ${details?.reason || 'unknown'}`,
    details,
  }).catch(() => {});
});