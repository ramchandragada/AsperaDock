import {
  app,
  BrowserWindow,
  WebContentsView,
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
  MAX_WARM_VIEWS_CAP,
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
  isLegacyPasswordHash,
  makeProfile,
  PRIMARY_PROFILE_ID,
  DEFAULTS,
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
import { openExternalSafe } from './safeShell.js';
import {
  registerChromeScheme,
  attachChromeProtocolHandler,
  chromeAppUrl,
} from './chromeProtocol.js';
import fs from 'node:fs';

// Custom scheme must be registered before ready (A+ fuse: no file:// privileges).
registerChromeScheme();

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

// Root is unsupported for packaged builds (also breaks chrome-sandbox).
if (
  app.isPackaged &&
  typeof process.getuid === 'function' &&
  process.getuid() === 0
) {
  // Electron refuses root without this; still quit after a clear message.
  app.commandLine.appendSwitch('no-sandbox');
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

const CHROME_VERSION = process.versions.chrome || '138.0.0.0';
const CHROME_MAJOR = String(CHROME_VERSION).split('.')[0] || '138';
/** Match the embedded Chromium build — Google rejects mismatched / Electron UAs. */
const CHROME_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
/** Softer Google accounts gate for embedded browsers. */
const FIREFOX_ACCOUNTS_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const SEC_CH_UA = `"Google Chrome";v="${CHROME_MAJOR}", "Chromium";v="${CHROME_MAJOR}", "Not_A Brand";v="24"`;

try {
  app.userAgentFallback = CHROME_USER_AGENT;
} catch {
  // ignore if called too early in tests
}

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

/** @type {Map<string, { view: WebContentsView, lastUsed: number }>} */
const views = new Map();
/** Last good in-app URL per service — used when recreating after hibernate/crash. */
/** @type {Map<string, string>} */
const lastGoodUrls = new Map();
/** When a background app was hibernated — used for auto-wake. */
/** @type {Map<string, number>} */
const hibernatedAt = new Map();
/** @type {Map<string, number>} */
const unreadCounts = new Map();
/** Recent unread activity shown in the notification center. */
/** @type {{ id: string, serviceId: string, title: string, body: string, at: number }[]} */
let notificationLog = [];
const NOTIFICATION_LOG_MAX = 40;
/** Renderer-measured chrome size — keeps guest view aligned with wrapped rows. */
let chromeSize = null;
/** @type {Record<string, number>} */
let appMemory = {};
let memoryTimer = null;

let activeServiceId = null;
let locked = false;
let overlayOpen = false;
let settings = loadSettings();

/** High performance is the default — low memory is opt-in only. */
function isLowMemoryMode() {
  return settings.lowMemoryMode === true;
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

  // Trim Chromium caches / spare processes. Do not cap V8's old-space heap:
  // WhatsApp Web can exceed the old 384 MB limit and its renderer then dies.
  // Low-memory mode controls usage through warm-view limits and hibernation.
  app.commandLine.appendSwitch('disable-features', [...disabled].join(','));
  app.commandLine.appendSwitch('disk-cache-size', String((lean ? 32 : 64) * 1024 * 1024));
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

/** Custom URLs are disabled — Aspera Dock only exposes the company catalog. */
function addCustomService() {
  return {
    ok: false,
    error: 'Custom apps are disabled — only the Aspera catalog is available.',
  };
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

  const wasActive = activeServiceId === id;
  hibernateService(id, { force: true });
  unreadCounts.delete(id);
  lastGoodUrls.delete(id);
  if (settings.lastServiceUrls?.[id]) {
    const lastServiceUrls = { ...settings.lastServiceUrls };
    delete lastServiceUrls[id];
    settings = saveSettings({ lastServiceUrls });
  }

  const instances = (settings.serviceInstances || []).filter((i) => i.id !== id);
  const serviceOrder = (settings.serviceOrder || []).filter((x) => x !== id);
  const serviceLabels = { ...(settings.serviceLabels || {}) };
  delete serviceLabels[id];
  const serviceConfigs = { ...(settings.serviceConfigs || {}) };
  delete serviceConfigs[id];

  const patch = { serviceInstances: instances, serviceOrder, serviceLabels, serviceConfigs };
  if (settings.lastActiveServiceId === id) patch.lastActiveServiceId = null;
  settings = saveSettings(patch);

  if (wasActive || activeServiceId === id) {
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
  if (isLowMemoryMode()) {
    return Math.min(3, Math.max(2, Number(settings.maxWarmViews) || 2));
  }
  const n = Number(settings.maxWarmViews);
  return Math.min(
    MAX_WARM_VIEWS_CAP,
    Math.max(1, Number.isFinite(n) ? n : MAX_WARM_VIEWS_DEFAULT),
  );
}

function baseDomain(hostname) {
  return hostname.split('.').slice(-2).join('.');
}

function isInternalUrl(url, service) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    // Fail closed — malformed URLs are never treated as in-dock.
    return false;
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

/** Dangerous or non-web schemes must never navigate inside a guest. */
function isForbiddenGuestNavigation(url) {
  try {
    const protocol = new URL(String(url || '')).protocol.toLowerCase();
    return ![
      'http:',
      'https:',
      'about:',
      'blob:',
      'data:',
    ].includes(protocol);
  } catch {
    return true;
  }
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

function assertShellSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('Dock window unavailable');
  }
  if (event.sender !== mainWindow.webContents) {
    throw new Error('Unauthorized IPC sender');
  }
}

/** IPC handlers that may only be invoked by the dock shell renderer. */
function dockHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertShellSender(event);
    return handler(event, ...args);
  });
}

function buildGoogleChromeSpoofSource() {
  const full = CHROME_VERSION;
  const major = CHROME_MAJOR;
  return `(() => {
  try {
    const full = ${JSON.stringify(full)};
    const major = ${JSON.stringify(major)};
    const brands = [
      { brand: 'Chromium', version: major },
      { brand: 'Google Chrome', version: major },
      { brand: 'Not_A Brand', version: '24' },
    ];
    const fullVersionList = [
      { brand: 'Chromium', version: full },
      { brand: 'Google Chrome', version: full },
      { brand: 'Not_A Brand', version: '24.0.0.0' },
    ];
    const high = {
      architecture: 'x86', bitness: '64', brands, fullVersionList,
      mobile: false, model: '', platform: 'Linux', platformVersion: '6.8.0',
      uaFullVersion: full, wow64: false,
    };
    const uaData = {
      brands, mobile: false, platform: 'Linux',
      getHighEntropyValues: () => Promise.resolve(high),
      toJSON: () => ({ brands, mobile: false, platform: 'Linux' }),
    };
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => uaData, configurable: true,
    });
    const t = Date.now() / 1000;
    const chrome = window.chrome || {};
    chrome.app = chrome.app || {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
    };
    chrome.runtime = chrome.runtime || {
      OnInstalledReason: {}, OnRestartRequiredReason: {}, PlatformArch: {}, PlatformOs: {},
      connect() {}, sendMessage() {},
    };
    chrome.loadTimes = chrome.loadTimes || function () {
      return {
        requestTime: t, startLoadTime: t, commitLoadTime: t,
        finishDocumentLoadTime: t, finishLoadTime: t, firstPaintTime: t,
        firstPaintAfterLoadTime: 0, navigationType: 'Other',
        wasFetchedViaSpdy: true, wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
      };
    };
    chrome.csi = chrome.csi || function () {
      return { startE: Date.now(), onloadT: Date.now(), pageT: 1000, tran: 15 };
    };
    window.chrome = chrome;
  } catch (e) {}
})();`;
}

async function attachGoogleChromeSpoof(wc) {
  if (!wc || wc.isDestroyed() || wc.__asperaGoogleSpoof) return;
  wc.__asperaGoogleSpoof = true;
  const source = buildGoogleChromeSpoofSource();
  // Prefer page inject only — CDP debugger attach causes Linux paint flicker.
  const inject = () => {
    if (wc.isDestroyed()) return;
    wc.executeJavaScript(source, true).catch(() => {});
  };
  wc.on('dom-ready', inject);
  wc.on('did-finish-load', inject);
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

function attachGuestView(view) {
  if (!mainWindow || !view || mainWindow.isDestroyed()) return;
  try {
    // WebContentsView (Electron 30+) — BrowserView bounds are unreliable on 37/Linux.
    mainWindow.contentView.addChildView(view);
  } catch {
    // ignore
  }
}

function detachGuestView(view) {
  if (!mainWindow || !view || mainWindow.isDestroyed()) return;
  try {
    mainWindow.contentView.removeChildView(view);
  } catch {
    // ignore
  }
}

function layoutActiveView() {
  if (!mainWindow || !activeServiceId || locked || overlayOpen) return;
  if (mainWindow.isDestroyed()) return;
  const entry = views.get(activeServiceId);
  if (!entry?.view) return;

  const [width, height] = mainWindow.getContentSize();
  const m = effectiveMetrics();
  const right = m.right || 0;
  // Always keep a floor under the measured bar so the guest never covers chrome.
  const top = Math.max(64, m.top || 0);
  const next = {
    x: Math.max(0, m.left || 0),
    y: top,
    width: Math.max(1, width - (m.left || 0) - right),
    height: Math.max(1, height - top),
  };
  // Skip identical layouts — repeated setBounds on Linux can flicker the guest.
  const prev = entry.__lastBounds;
  if (
    prev &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.width === next.width &&
    prev.height === next.height
  ) {
    return;
  }
  entry.__lastBounds = next;
  try {
    entry.view.setBounds(next);
  } catch {
    // ignore
  }
}

function detachAllViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  for (const entry of views.values()) {
    detachGuestView(entry.view);
  }
}

/** Guest views paint above the dock HTML — hide them while modals are open. */
function setOverlayOpen(open) {
  const next = !!open;
  // No-op when unchanged. Re-adding/focusing the view on every state sync
  // strobes the navy window background over the guest page on Linux.
  if (next === overlayOpen) return;
  overlayOpen = next;
  if (!mainWindow) return;

  if (overlayOpen) {
    detachAllViews();
    return;
  }

  if (locked || !activeServiceId) return;
  const entry = views.get(activeServiceId);
  if (!entry) return;
  attachGuestView(entry.view);
  entry.__lastBounds = null;
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

  // Google sign-in: spoof Client Hints as Chrome, and use a Firefox UA only on
  // accounts.google.com (widely used workaround for the embedded-browser block).
  partitionSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.google.com/*',
        '*://google.com/*',
        '*://*.googleusercontent.com/*',
        '*://*.gstatic.com/*',
        '*://*.googleapis.com/*',
      ],
    },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      let host = '';
      try {
        host = new URL(details.url).hostname.toLowerCase();
      } catch {
        // ignore
      }
      if (host === 'accounts.google.com' || host.endsWith('.accounts.google.com')) {
        headers['User-Agent'] = FIREFOX_ACCOUNTS_UA;
        delete headers['sec-ch-ua'];
        delete headers['sec-ch-ua-mobile'];
        delete headers['sec-ch-ua-platform'];
        delete headers['Sec-CH-UA'];
        delete headers['Sec-CH-UA-Mobile'];
        delete headers['Sec-CH-UA-Platform'];
      } else {
        headers['User-Agent'] = headers['User-Agent'] || CHROME_USER_AGENT;
        headers['sec-ch-ua'] = SEC_CH_UA;
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = '"Linux"';
      }
      callback({ cancel: false, requestHeaders: headers });
    },
  );

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

function isGoogleService(service) {
  if (!service) return false;
  if (service.appId === 'gmail') return true;
  try {
    const host = new URL(service.url).hostname.toLowerCase();
    return (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'gmail.com' ||
      host.endsWith('.gmail.com')
    );
  } catch {
    return false;
  }
}

function guestWebPreferences(service) {
  return {
    session: session.fromPartition(service.partition),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: true,
  };
}

function isGoogleMailAppUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === 'mail.google.com' ||
      host.endsWith('.mail.google.com') ||
      host === 'inbox.google.com'
    );
  } catch {
    return false;
  }
}

/**
 * Window-open policy shared by a service view and any popup it spawns.
 * Genuine external links go to the OS browser; internal popups (Zoho CRM
 * child windows, SSO handshakes, about:blank targets) open as real windows
 * that share the service session — denying them makes embedded apps like
 * Zoho CRM hang forever waiting for the window handle.
 *
 * Google is special: OAuth often opens a popup that then becomes the full
 * Gmail inbox. Keep http navigations in the dock tab, and if a blank popup
 * still appears, fold the session back into the parent when it lands on Gmail.
 */
function configureGuestWindowOpen(wc, service) {
  const linkMode =
    getAppConfig(service.id).linkHandling || settings.linkHandling || 'block';
  const googleish = isGoogleService(service);

  wc.setWindowOpenHandler(({ url }) => {
    const external =
      linkMode === 'external' ||
      (url.startsWith('http') && !isInternalUrl(url, service));
    if (external) {
      openExternalSafe(url);
      return { action: 'deny' };
    }

    // Gmail/Google: keep sign-in inside the dock tab whenever we have a URL.
    if (googleish && url.startsWith('http')) {
      wc.loadURL(url).catch(() => {});
      return { action: 'deny' };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        width: 1024,
        height: 720,
        webPreferences: guestWebPreferences(service),
      },
    };
  });
}

/** If a Google auth popup becomes the full inbox, move it into the dock tab. */
function attachPopupSessionAdopt(parentWc, childWindow, service) {
  if (!isGoogleService(service)) return;

  const childWc = childWindow.webContents;
  let adopting = false;

  const tryAdopt = () => {
    if (adopting || childWindow.isDestroyed() || parentWc.isDestroyed()) return;
    let popupUrl = '';
    try {
      popupUrl = childWc.getURL();
    } catch {
      return;
    }
    if (!popupUrl.startsWith('http') || isAuthOrLoginUrl(popupUrl)) return;
    if (!isGoogleMailAppUrl(popupUrl)) return;

    // Popup is the real Gmail app. Always fold it into the dock tab so the
    // inbox does not live in a floating window while the tab shows marketing.
    adopting = true;
    parentWc.loadURL(popupUrl).catch(() => {});
    rememberGoodUrl(service.id, popupUrl);
    setTimeout(() => {
      try {
        if (!childWindow.isDestroyed()) childWindow.close();
      } catch {
        // ignore
      }
    }, 150);
  };

  childWc.on('did-navigate', tryAdopt);
  childWc.on('did-navigate-in-page', tryAdopt);
  childWc.on('did-finish-load', tryAdopt);
  childWc.on('page-title-updated', tryAdopt);
  // Catch the already-loaded case (title set before listeners).
  setTimeout(tryAdopt, 300);
}

function createViewForService(service) {
  const cfg = getAppConfig(service.id);
  const partitionSession = session.fromPartition(service.partition);
  configureSession(partitionSession, service.partition);

  const ua =
    (cfg.userAgent && cfg.userAgent.trim()) ||
    (cfg.forceMobile ? MOBILE_USER_AGENT : CHROME_USER_AGENT);
  partitionSession.setUserAgent(ua);

  const view = new WebContentsView({
    webPreferences: guestWebPreferences(service),
  });
  // Seed non-fullscreen bounds before first attach (avoids a full-bleed flash).
  try {
    const m = effectiveMetrics();
    view.setBounds({
      x: 0,
      y: Math.max(64, m.top || 70),
      width: 800,
      height: 600,
    });
  } catch {
    // ignore
  }

  const { webContents } = view;
  webContents.setUserAgent(ua);
  webContents.setAudioMuted(settings.muted || !cfg.allowSounds);
  if (isGoogleService(service)) {
    attachGoogleChromeSpoof(webContents).catch(() => {});
  }
  const langs = cfg.spellChecker || settings.spellChecker || ['en-US'];
  webContents.session.setSpellCheckerLanguages(
    Array.isArray(langs) && langs.length ? langs : ['en-US'],
  );

  configureGuestWindowOpen(webContents, service);

  // Real popup windows (Zoho CRM child views, SSO handshakes) inherit these
  // rules too, and must never be trapped inside a broken denied handle.
  webContents.on('did-create-window', (childWindow) => {
    const childWc = childWindow.webContents;
    configureGuestWindowOpen(childWc, service);
    attachPopupSessionAdopt(webContents, childWindow, service);
    if (isGoogleService(service)) {
      attachGoogleChromeSpoof(childWc).catch(() => {});
    }
    childWc.on('will-navigate', (event, url) => {
      if (isForbiddenGuestNavigation(url)) {
        event.preventDefault();
        return;
      }
      if (!url.startsWith('http')) return;
      if (isInternalUrl(url, service)) return;
      event.preventDefault();
      openExternalSafe(url);
    });
    watchWebContents(childWc, `popup:${service.appId}:${service.id}`);
  });

  webContents.on('will-navigate', (event, url) => {
    if (isForbiddenGuestNavigation(url)) {
      event.preventDefault();
      return;
    }
    if (!url.startsWith('http')) return;
    if (isInternalUrl(url, service)) return;
    event.preventDefault();
    openExternalSafe(url);
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
    if (settings.allowPageInjection && live.injectCss && live.injectCss.trim()) {
      try {
        await webContents.insertCSS(live.injectCss);
      } catch {
        // ignore
      }
    }
    if (settings.allowPageInjection && live.stylishUrl && /^https?:\/\//i.test(live.stylishUrl.trim())) {
      try {
        const res = await fetch(live.stylishUrl.trim());
        if (res.ok) await webContents.insertCSS(await res.text());
      } catch {
        // ignore
      }
    }
    if (settings.allowPageInjection && live.injectJs && live.injectJs.trim()) {
      try {
        await webContents.executeJavaScript(live.injectJs, true);
      } catch {
        // ignore
      }
    }
  });

  // A crashed guest used to remain in `views`, so activating its tab reattached
  // a dead view and showed only the dock's grey background. Remove the
  // dead entry immediately; recreate it now when active, or on the next click
  // when it crashed in the background.
  webContents.on('render-process-gone', (_event, details) => {
    const reason = details?.reason || 'unknown';
    if (reason === 'clean-exit') return;
    const current = views.get(service.id);
    if (!current || current.view !== view) return;

    detachGuestView(view);
    views.delete(service.id);
    unreadCounts.delete(service.id);
    hibernatedAt.set(service.id, Date.now());
    broadcastState();

    if (service.id !== activeServiceId) return;
    setTimeout(() => {
      if (
        service.id === activeServiceId &&
        !locked &&
        mainWindow &&
        !mainWindow.isDestroyed() &&
        getService(service.id)
      ) {
        activateService(service.id);
      }
    }, 500);
  });

  if (cfg.preventBasicAuth) {
    webContents.on('login', (event) => {
      event.preventDefault();
    });
  }

  webContents.on('did-navigate', (_event, url) => {
    rememberGoodUrl(service.id, url);
    reclaimServiceHomeIfWrongProduct(webContents, service, url);
  });
  webContents.on('did-navigate-in-page', (_event, url) => {
    rememberGoodUrl(service.id, url);
  });
  webContents.on('did-finish-load', () => {
    try {
      const url = webContents.getURL();
      rememberGoodUrl(service.id, url);
      reclaimServiceHomeIfWrongProduct(webContents, service, url);
    } catch {
      // ignore
    }
  });

  attachShortcuts(webContents);
  webContents.on('found-in-page', (_event, result) => {
    mainWindow?.webContents.send('dock:find-result', {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
    });
  });
  webContents.loadURL(startUrlForService(service));

  const zoom = Number(cfg.zoomFactor);
  if (Number.isFinite(zoom) && zoom > 0) {
    webContents.setZoomFactor(Math.min(2, Math.max(0.5, zoom)));
  }

  views.set(service.id, { view, lastUsed: Date.now() });
  hibernatedAt.delete(service.id);
  watchWebContents(webContents, `app:${service.appId}:${service.id}`);
  return views.get(service.id);
}

function hibernateService(id, { force = false } = {}) {
  const entry = views.get(id);
  if (!entry) return;
  if (!force && id === activeServiceId) return;
  const service = getService(id);
  try {
    const url = entry.view.webContents.getURL();
    rememberGoodUrl(id, url);
  } catch {
    // ignore
  }
  if (mainWindow) {
    detachGuestView(entry.view);
  }
  try {
    entry.view.webContents.close();
  } catch {
    // ignore
  }
  views.delete(id);
  unreadCounts.delete(id);
  hibernatedAt.set(id, Date.now());
  if (force && activeServiceId === id) {
    activeServiceId = null;
  }
  // Persist cookies before the renderer is gone — otherwise Zoho/Gmail may
  // treat the next wake as a fresh device and demand MFA / sign-in again.
  if (service?.partition) {
    session
      .fromPartition(service.partition)
      .cookies.flushStore()
      .catch(() => {});
  }
}

/** True for Zoho/Google login and MFA pages — never restore these as "home". */
function isAuthOrLoginUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const pathName = u.pathname.toLowerCase();
    if (host.startsWith('accounts.')) return true;
    if (host.includes('accounts.google.')) return true;
    if (/\/signin|\/login|\/logout|\/oauth|\/oneauth|\/mfa|\/verify/i.test(pathName)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Only restore URLs that belong to this app. Shared Zoho SSO cookies made
 * Mail tabs remember Cliq/Meeting after a cross-product hop — reject those.
 */
function isUrlForService(service, url) {
  if (!service || !url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    let expected = '';
    try {
      expected = new URL(service.url).hostname.toLowerCase();
    } catch {
      return false;
    }
    if (!expected) return false;
    if (host === expected || host.endsWith(`.${expected}`)) return true;

    // Zoho DC aliases: mail.zoho.in ↔ mail.zoho.com (same product, first label).
    const product = expected.split('.')[0];
    const hostProduct = host.split('.')[0];
    if (
      product &&
      hostProduct === product &&
      (host.endsWith('.zoho.com') || host.endsWith('.zoho.in')) &&
      (expected.endsWith('.zoho.com') || expected.endsWith('.zoho.in'))
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Prefer the last in-app page; never cold-start on a login/QR / wrong-app screen. */
function startUrlForService(service) {
  const memory = lastGoodUrls.get(service.id);
  const disk = (settings.lastServiceUrls || {})[service.id];
  const last = memory || disk;
  if (
    last &&
    !isAuthOrLoginUrl(last) &&
    isUrlForService(service, last)
  ) {
    return last;
  }
  return service.url;
}

let lastUrlSaveTimer = null;
function rememberGoodUrl(serviceId, url) {
  if (!url || !String(url).startsWith('http') || isAuthOrLoginUrl(url)) return;
  const service = getService(serviceId);
  if (service && !isUrlForService(service, url)) return;
  lastGoodUrls.set(serviceId, url);
  if (lastUrlSaveTimer) clearTimeout(lastUrlSaveTimer);
  lastUrlSaveTimer = setTimeout(() => {
    const prev = settings.lastServiceUrls || {};
    if (prev[serviceId] === url) return;
    settings = saveSettings({
      lastServiceUrls: { ...prev, [serviceId]: url },
    });
  }, 1200);
}

function hydrateLastUrls() {
  const map = settings.lastServiceUrls || {};
  const cleaned = {};
  let dirty = false;
  for (const [id, url] of Object.entries(map)) {
    if (typeof url !== 'string' || !url.startsWith('http') || isAuthOrLoginUrl(url)) {
      dirty = true;
      continue;
    }
    const service = getService(id);
    if (service && !isUrlForService(service, url)) {
      dirty = true;
      continue;
    }
    cleaned[id] = url;
    lastGoodUrls.set(id, url);
  }
  if (dirty) {
    settings = saveSettings({ lastServiceUrls: cleaned });
  }
}

/** Zoho Mail (etc.) must not stay on Cliq/Meeting after an in-app hop. */
const reclaimInFlight = new Set();
function reclaimServiceHomeIfWrongProduct(webContents, service, url) {
  if (!service || !webContents || webContents.isDestroyed()) return;
  if (!url || isAuthOrLoginUrl(url)) return;
  if (isUrlForService(service, url)) return;
  // Only reclaim Zoho product tabs — shared SSO often dumps the wrong app.
  if (!String(service.appId || '').startsWith('zoho-')) return;
  if (reclaimInFlight.has(service.id)) return;
  reclaimInFlight.add(service.id);
  const home = service.url;
  webContents
    .loadURL(home)
    .catch(() => {})
    .finally(() => {
      setTimeout(() => reclaimInFlight.delete(service.id), 1500);
    });
}

function flushAllSessionCookies() {
  for (const appSession of allAppSessions()) {
    appSession.cookies.flushStore().catch(() => {});
  }
}

/** Warm status is chosen per app by the user; catalog type has no priority. */
function isKeepWarmService(id) {
  return getAppConfig(id).keepWarm === true;
}

function warmSelectionLimit() {
  // Reserve one view for an active app that the user did not mark warm.
  return Math.max(0, maxWarm() - 1);
}

function selectedWarmIds() {
  return orderedServices()
    .filter((service) => service.config?.enabled !== false && isKeepWarmService(service.id))
    .map((service) => service.id);
}

function reconcileWarmSelections() {
  const selected = selectedWarmIds();
  const limit = warmSelectionLimit();
  for (const id of selected.slice(limit)) {
    saveAppConfig(id, { keepWarm: false });
    if (id !== activeServiceId) hibernateService(id);
  }
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
  // User-selected warm apps are protected. The selection limit reserves enough
  // room for the active app, so only unselected background views are evictable.
  const evictable = [...views.entries()]
    .filter(([id]) => id !== activeServiceId && !isKeepWarmService(id))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  while (views.size > maxWarm() && evictable.length) {
    const [id] = evictable.shift();
    hibernateService(id);
  }
}

function toggleKeepWarm(id) {
  const service = getService(id);
  if (!service) return { ok: false, error: 'App not found' };

  const enabled = !isKeepWarmService(id);
  if (enabled) {
    const limit = warmSelectionLimit();
    if (selectedWarmIds().length >= limit) {
      return {
        ok: false,
        error:
          limit > 0
            ? `You can keep ${limit} background app${limit === 1 ? '' : 's'} warm (max ${MAX_WARM_VIEWS_CAP} apps in RAM including the active tab).`
            : `Maximum is ${MAX_WARM_VIEWS_CAP} apps in RAM. Turn off another warm app first.`,
      };
    }
  }

  const config = saveAppConfig(id, { keepWarm: enabled });
  if (!enabled) {
    if (id !== activeServiceId) hibernateService(id);
  } else if (!views.has(id) && !locked) {
    // Make room by dropping the oldest unselected background app.
    const candidate = [...views.entries()]
      .filter(([viewId]) => viewId !== activeServiceId && !isKeepWarmService(viewId))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
    if (views.size >= maxWarm() && candidate) hibernateService(candidate[0]);
    softWakeService(id);
  }
  enforceWarmLimit();
  broadcastState();
  return {
    ok: true,
    keepWarm: enabled,
    config,
    selected: selectedWarmIds().length,
    limit: warmSelectionLimit(),
  };
}

/** Reuse a warm view only when its renderer is still alive. */
function ensureLiveView(service) {
  const existing = views.get(service.id);
  if (existing) {
    const wc = existing.view?.webContents;
    if (wc && !wc.isDestroyed()) return existing;
    detachGuestView(existing.view);
    try {
      if (wc && !wc.isDestroyed()) wc.close();
    } catch {
      // ignore
    }
    views.delete(service.id);
    unreadCounts.delete(service.id);
    hibernatedAt.set(service.id, Date.now());
  }
  return createViewForService(service);
}

function activateService(id) {
  const service = getService(id);
  if (!service || !mainWindow || locked) return;
  const cfg = getAppConfig(id);
  if (!cfg.enabled) {
    broadcastState();
    return;
  }

  const previousId = activeServiceId;
  detachAllViews();
  const entry = ensureLiveView(service);
  entry.lastUsed = Date.now();
  activeServiceId = id;
  settings = saveSettings({ lastActiveServiceId: id });

  // Only user-selected apps remain loaded after switching away.
  if (previousId && previousId !== id && !isKeepWarmService(previousId)) {
    hibernateService(previousId);
  }

  if (!overlayOpen) {
    attachGuestView(entry.view);
    entry.__lastBounds = null;
    layoutActiveView();
    // Electron/Linux sometimes applies the first bounds late — re-assert.
    setTimeout(() => layoutActiveView(), 16);
    setTimeout(() => layoutActiveView(), 100);
    setTimeout(() => layoutActiveView(), 300);
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
    catalog: APP_CATALOG.map((a) => ({
      ...a,
      count: countInstances(a.appId),
      max: MAX_INSTANCES_PER_APP,
      totalApps: totalAppCount(),
      maxTotal: MAX_APPS_TOTAL,
      canAdd:
        totalAppCount() < MAX_APPS_TOTAL &&
        countInstances(a.appId) < MAX_INSTANCES_PER_APP,
    })),
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
    settings: {
      ...settings,
      lockPasswordHash: undefined,
      errorReportGithubToken: settings.errorReportGithubToken
        ? '[configured]'
        : '',
      sentryDsn: settings.sentryDsn ? '[configured]' : '',
      hasErrorReportGithubToken: Boolean(settings.errorReportGithubToken),
      hasSentryDsnOverride: Boolean(settings.sentryDsn),
    },
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
  const resumeId = activeServiceId || settings.lastActiveServiceId || null;
  if (resumeId) {
    settings = saveSettings({ lastActiveServiceId: resumeId });
  }
  // Tear down guest views so sessions are not live behind the lock screen.
  for (const id of [...views.keys()]) {
    hibernateService(id, { force: true });
  }
  activeServiceId = null;
  hideViewsForLock();
  broadcastState();
}

function unlockApp(password) {
  if (!verifyPassword(password, settings.lockPasswordHash)) {
    return { ok: false, error: 'Wrong password' };
  }
  // Upgrade legacy unsalted SHA-256 hashes on successful unlock.
  if (isLegacyPasswordHash(settings.lockPasswordHash)) {
    settings = saveSettings({ lockPasswordHash: hashPassword(password) });
  }
  locked = false;
  const resumeId =
    activeServiceId ||
    settings.lastActiveServiceId ||
    orderedServices()[0]?.id ||
    null;
  if (resumeId) activateService(resumeId);
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
            openExternalSafe(
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
    // Company desktops: always open full-screen workspace.
    mainWindow.maximize();
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
  mainWindow.on('maximize', () => {
    setTimeout(() => layoutActiveView(), 50);
    setTimeout(() => layoutActiveView(), 200);
  });
  mainWindow.on('unmaximize', () => setTimeout(() => layoutActiveView(), 50));
  mainWindow.on('show', () => setTimeout(() => layoutActiveView(), 50));
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

function chromeIndexCandidates() {
  const name =
    typeof MAIN_WINDOW_VITE_NAME === 'string' && MAIN_WINDOW_VITE_NAME
      ? MAIN_WINDOW_VITE_NAME
      : 'main_window';
  const appPath = app.getAppPath();
  return [
    path.join(appPath, '.vite', 'renderer', name, 'index.html'),
    path.join(process.resourcesPath || '', 'app.asar', '.vite', 'renderer', name, 'index.html'),
    path.join(__dirname, '..', 'renderer', name, 'index.html'),
  ];
}

function loadDockChrome() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return;
  }
  // Packaged: custom scheme (works with GrantFileProtocolExtraPrivileges=false).
  mainWindow.loadURL(chromeAppUrl('index.html')).catch((err) => {
    reportError('chrome-load-failed', {
      message: `Dock chrome scheme load failed: ${err?.message || err}`,
      details: { url: chromeAppUrl('index.html'), candidates: chromeIndexCandidates() },
    }).catch(() => {});
  });
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
    // Do NOT detach guest views here — that caused Gmail-only flicker while
    // chrome failed to load. Keep the guest; just retry the dock UI.
    loadDockChrome();
  }, 800 * chromeReloadTries);
}

function startHibernateTimer() {
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of views.entries()) {
      if (id === activeServiceId) continue;
      // Messaging apps stay warm — switching must not reload WhatsApp every time.
      if (isKeepWarmService(id)) continue;
      const cfg = getAppConfig(id);
      const mins =
        cfg.hibernateMinutes > 0
          ? cfg.hibernateMinutes
          : isLowMemoryMode()
            ? Math.min(10, Math.max(3, Number(settings.hibernateMinutes) || 10))
            : Math.max(5, Number(settings.hibernateMinutes) || 30);
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
dockHandle('dock:set-overlay', (_e, open) => {
  setOverlayOpen(open);
  return { ok: true };
});

dockHandle('dock:set-chrome-size', (_e, size) => {
  chromeSize = size && typeof size === 'object' ? size : null;
  layoutActiveView();
  return { ok: true };
});

dockHandle('dock:clear-notifications', () => {
  notificationLog = [];
  broadcastState();
  return { ok: true };
});

dockHandle('dock:mark-all-read', () => {
  unreadCounts.clear();
  notificationLog = [];
  refreshBadge();
  broadcastState();
  return { ok: true };
});

dockHandle('dock:heartbeat', () => {
  noteHeartbeat();
  return { ok: true };
});

dockHandle('dock:report-error', async (_e, payload = {}) => {
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

dockHandle('dock:list-error-reports', () => listRecentReports(30));
dockHandle('dock:open-error-reports', () => {
  openReportsFolder();
  return { ok: true, dir: getReportsDir() };
});

dockHandle('dock:update-status', () => getUpdateStatus());
dockHandle('dock:show-about', () => {
  showAboutDialog();
  return { version: app.getVersion() };
});
dockHandle('dock:update-check', () => checkForUpdates({ silent: false }));
dockHandle('dock:update-download', () => downloadUpdate());
dockHandle('dock:update-install', () => installUpdate());

dockHandle('dock:get-state', () => currentState());
dockHandle('dock:activate', (_e, id) => {
  activateService(id);
  return { ok: true };
});
dockHandle('dock:add-service', (_e, appId, profileId) =>
  addService(appId, profileId || null),
);
dockHandle('dock:add-custom-service', (_e, payload) =>
  addCustomService(payload || {}),
);
dockHandle('dock:find-in-page', (_e, text, options) =>
  findInActivePage(text, options || {}),
);
dockHandle('dock:stop-find', () => stopFindInActivePage());
dockHandle('dock:print-active', () => printActivePage());
dockHandle('dock:remove-service', (_e, id) => removeService(id));
dockHandle('dock:create-profile', (_e, name) => createProfile(name));
dockHandle('dock:rename-profile', (_e, id, name) => renameProfile(id, name));
dockHandle('dock:delete-profile', (_e, id) => deleteProfile(id));
dockHandle('dock:set-instance-profile', (_e, serviceId, profileId) =>
  setInstanceProfile(serviceId, profileId),
);
dockHandle('dock:toggle-keep-warm', (_e, id) => toggleKeepWarm(id));
dockHandle('dock:save-app-config', (_e, id, incoming) => {
  if (!getService(id)) return { ok: false, error: 'Not found' };
  const patch = { ...(incoming || {}) };
  // Company default: block page injection unless explicitly enabled.
  if (!settings.allowPageInjection) {
    delete patch.injectJs;
    delete patch.injectCss;
    delete patch.stylishUrl;
  }

  if (patch.profileId != null) {
    const moved = setInstanceProfile(id, patch.profileId);
    if (!moved.ok) return moved;
    delete patch.profileId;
  }

  const labels = { ...(settings.serviceLabels || {}) };
  if (patch.name != null || patch.title != null) {
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
  if (patch.url != null || patch.color != null) {
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
      hibernateService(id, { force: true });
      if (activeServiceId === id || !views.has(id)) activateService(id);
    }
    delete patch.url;
    delete patch.color;
  }

  const cfg = saveAppConfig(id, patch);
  if (!cfg.enabled) {
    hibernateService(id, { force: true });
    if (activeServiceId === id || !activeServiceId) {
      activeServiceId = null;
      const next = orderedServices().find((s) => s.id !== id && s.config?.enabled);
      if (next) activateService(next.id);
      else {
        detachAllViews();
        broadcastState();
      }
    } else {
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
dockHandle('dock:app-navigate', (_e, id, action) => {
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
    if (app.isPackaged && !settings.allowGuestDevTools) {
      return { ok: false, error: 'Guest DevTools disabled' };
    }
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach' });
  }
  return { ok: true };
});
dockHandle('dock:hibernate', (_e, id) => {
  hibernateService(id);
  broadcastState();
  return { ok: true };
});
dockHandle('dock:hibernate-background', () => {
  hibernateBackground();
  return { ok: true };
});
dockHandle('dock:reload-active', () => {
  reloadActive();
  return { ok: true };
});
dockHandle('dock:toggle-focus', () => {
  toggleFocusMode();
  return { focusMode: settings.focusMode };
});
dockHandle('dock:toggle-mute', () => {
  toggleMute();
  return { muted: settings.muted };
});
dockHandle('dock:save-settings', (_e, patch) => {
  const incoming = patch && typeof patch === 'object' ? patch : {};
  const adminOverride = process.env.ASPERADOCK_ADMIN === '1';
  const blocked = new Set(['allowPageInjection', 'allowGuestDevTools', 'lockPasswordHash']);
  const allowed = new Set([...Object.keys(DEFAULTS), 'lockPassword']);
  const next = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!allowed.has(key)) continue;
    if (blocked.has(key) && !adminOverride) continue;
    next[key] = value;
  }
  // Renderer may receive redacted placeholders — never persist those.
  if (next.errorReportGithubToken === '[configured]') {
    delete next.errorReportGithubToken;
  }
  if (next.sentryDsn === '[configured]') {
    delete next.sentryDsn;
  }
  if (next.errorReportUrl != null) {
    const reportUrl = String(next.errorReportUrl || '').trim();
    if (reportUrl) {
      try {
        const u = new URL(reportUrl);
        if (u.protocol !== 'https:') {
          return { ok: false, error: 'Error report URL must be HTTPS' };
        }
      } catch {
        return { ok: false, error: 'Invalid error report URL' };
      }
    }
    next.errorReportUrl = reportUrl;
  }
  if (next.updateFeedUrl != null) {
    const feed = String(next.updateFeedUrl || '').trim();
    if (feed) {
      try {
        const u = new URL(feed);
        if (u.protocol !== 'https:') {
          return { ok: false, error: 'Update feed must be HTTPS' };
        }
      } catch {
        return { ok: false, error: 'Invalid update feed URL' };
      }
    }
    next.updateFeedUrl = feed;
  }
  if (next.lockPassword) {
    next.lockPasswordHash = hashPassword(next.lockPassword);
    delete next.lockPassword;
  }
  if (next.lockEnabled === false) {
    next.lockPasswordHash = '';
  }
  // Low-memory mode clamps warm/hibernate and turns GPU off (relaunch needed).
  // Keep at least 2 warm slots so multi-WhatsApp switching still works.
  if (next.lowMemoryMode === true) {
    next.maxWarmViews = Math.min(3, Math.max(2, Number(next.maxWarmViews) || 3));
    next.hibernateMinutes = Math.min(
      10,
      Math.max(3, Number(next.hibernateMinutes) || 10),
    );
    next.hardwareAcceleration = false;
  } else if (next.maxWarmViews != null) {
    next.maxWarmViews = Math.min(
      MAX_WARM_VIEWS_CAP,
      Math.max(1, Number(next.maxWarmViews) || MAX_WARM_VIEWS_DEFAULT),
    );
  }
  if (next.density != null && !['normal', 'large', 'huge'].includes(next.density)) {
    next.density = 'normal';
  }
  if (next.appIconSize != null && !['normal', 'large', 'huge'].includes(next.appIconSize)) {
    next.appIconSize = 'normal';
  }
  next.appsPosition = 'top';
  settings = saveSettings(next);
  reconcileWarmSelections();
  enforceWarmLimit();
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
dockHandle('dock:lock', () => {
  lockApp();
  return { ok: true };
});
dockHandle('dock:unlock', (_e, password) => unlockApp(password));
dockHandle('dock:clear-session', async (_e, id) => {
  const service = getService(id);
  if (!service) return { ok: false };
  hibernateService(id, { force: true });
  // Clears the whole profile partition — every app on this profile signs out.
  const s = session.fromPartition(service.partition);
  await s.clearStorageData();
  await s.clearCache();
  for (const inst of appsUsingProfile(service.profileId)) {
    unreadCounts.delete(inst.id);
    hibernateService(inst.id, { force: true });
  }
  broadcastState();
  return { ok: true, profileId: service.profileId };
});
dockHandle('dock:reorder', (_e, order) => {
  settings = saveSettings({ serviceOrder: order });
  broadcastState();
  return { ok: true };
});
dockHandle('dock:pick-download-dir', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return { path: null };
  return { path: result.filePaths[0] };
});
dockHandle('dock:open-downloads', async () => {
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

app.whenReady().then(async () => {
  if (
    app.isPackaged &&
    typeof process.getuid === 'function' &&
    process.getuid() === 0
  ) {
    dialog.showErrorBox(
      'Aspera Dock',
      'Do not run Aspera Dock as root.\n\nStart it from your normal user session.',
    );
    app.quit();
    return;
  }

  attachChromeProtocolHandler();

  // Keep a friendly name in menus/About; WM class stays "asperadock" for the dock icon.
  if (process.platform !== 'linux') {
    app.setName('Aspera Dock');
  }
  settings = loadSettings();
  try {
    const userData = app.getPath('userData');
    fs.chmodSync(userData, 0o700);
  } catch {
    // ignore
  }
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
  hydrateLastUrls();
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
      // Re-layout after native dialogs — guest view can end up fullscreen otherwise.
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
  // Snapshot in-app URLs + flush cookies so the next launch stays signed in
  // even for apps that were not marked warm.
  for (const [id, entry] of views.entries()) {
    try {
      rememberGoodUrl(id, entry.view.webContents.getURL());
    } catch {
      // ignore
    }
  }
  flushAllSessionCookies();
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