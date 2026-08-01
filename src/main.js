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
  clipboard,
  screen,
} from 'electron';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAppMenuHtml } from './appMenuHtml.js';
import { buildChromeMenuHtml } from './chromeMenuHtml.js';
import { buildNotifCenterHtml } from './notifCenterHtml.js';
import { buildAiResultHtml } from './aiResultHtml.js';
import { buildForwardPickerHtml } from './forwardPickerHtml.js';
import { buildExtensionsHtml } from './extensionsHtml.js';
import {
  buildForwardClipboardText,
  canOfferForward,
  describeForwardPayload,
  isForwardAppId,
} from './forwardHub.js';
import {
  installUnpackedExtension,
  listInstalledExtensions,
  normalizeExtensionList,
  uninstallExtensionFiles,
} from './extensionsStore.js';
import {
  chromeWebStoreUrl,
  downloadAndUnpackChromeExtension,
  parseChromeExtensionId,
  unpackExtensionPackage,
} from './chromeWebStore.js';
import {
  AI_ALLOWED_APP_IDS,
  AI_LANGUAGES,
  AI_PROVIDERS,
  configuredProvidersInRouteOrder,
  getAiProvider,
  isAiAllowedAppId,
  normalizeAnthropicModel,
  normalizeGeminiModel,
  normalizeGrokModel,
} from './ai/catalog.js';
import {
  clearAiProviderKey,
  getAiProviderKey,
  listConfiguredAiProviders,
  setAiProviderKey,
} from './ai/keys.js';
import {
  promptForSkill,
  runAiCompletionWithFailover,
  onAiProviderKeyChanged,
  getStickyAiProviderId,
  resetAiProviderSession,
  setAiSettingsReader,
} from './ai/service.js';
import { parseSuggestedReplies } from './ai/replyEditor.js';
import {
  catalogModelsForProvider,
  getCachedAiModels,
  getProviderModelPreference,
  invalidateAiModelCache,
  listAiProviderModels,
  normalizeProviderModelChoice,
} from './ai/models.js';
import {
  APP_CATALOG,
  MAX_INSTANCES_PER_APP,
  MAX_APPS_TOTAL,
  MAX_APP_NAME_LENGTH,
  MAX_WARM_VIEWS_DEFAULT,
  MAX_WARM_VIEWS_CAP,
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
import { mergeAppConfig, MOBILE_USER_AGENT, DEFAULT_APP_CONFIG } from './appConfig.js';
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
import {
  isInternalUrl,
  isForbiddenGuestNavigation,
  isAuthOrLoginUrl,
  isUrlForService,
  isFragileZohoOneDeepUrl,
  safeStartUrlForService,
  extractGoogleOutboundUrl,
  isAllowedGmailTabUrl,
  isGoogleOwnedUrl,
} from './guestNav.js';
import {
  isGoogleService,
  isGoogleMailAppUrl,
  attachGoogleChromeSpoof,
  applyGoogleRequestHeaders,
  noteGoogleMarketingLanding,
} from './vendors/google.js';
import { reclaimServiceHomeIfWrongProduct as reclaimZohoHome } from './vendors/zoho.js';
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

// Linux Mint (XFCE/Cinnamon): Chromium GPU + chrome-sandbox often FATAL-exit
// before any window ("refuses to start"). Apply the safest flags FIRST.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('class', 'asperadock');
  try {
    app.disableHardwareAcceleration();
  } catch {
    // ignore if Electron rejects a duplicate call later
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

// Keep the legacy profile directory after the Dock → Hub rename.
// Electron would otherwise use productName ("Aspera Hub") under appData and
// drop WhatsApp/Zoho sessions + settings.json. Must run before any userData use
// (including the single-instance lock).
app.setPath('userData', path.join(app.getPath('appData'), 'Aspera Dock'));

// Clear stale singleton files left by GPU FATAL crashes so the next launch
// is not a silent no-op (second-instance lock held by a dead session).
try {
  const ud = app.getPath('userData');
  for (const name of ['SingletonLock', 'SingletonCookie']) {
    const p = path.join(ud, name);
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }
} catch {
  // ignore
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another live instance owns the dock — quit quietly so the first raises.
  app.quit();
}

// GNOME Wayland ignores BrowserWindow.setIcon for the dock/taskbar.
// It matches windows to a .desktop file via app id / StartupWMClass.
// Must be set before ready — use a stable id without spaces.
if (process.platform === 'linux') {
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
/** Child popup windows grouped by service id (OAuth/CRM popouts/etc). */
const servicePopups = new Map();
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
/** Dedupe identical toasts per service (fingerprint → last shown at). */
/** @type {Map<string, { fingerprint: string, at: number }>} */
const recentNotificationFingerprints = new Map();
const NOTIFICATION_DEDUPE_MS = 45_000;
/** Magic prefix for guest → main Notification bridge (console-message). */
const ASPERA_NOTIFY_PREFIX = '__ASPERA_DOCK_NOTIFY__';
/** Renderer-measured chrome size — keeps guest view aligned with wrapped rows. */
let chromeSize = null;
/** @type {Record<string, number>} */
let appMemory = {};
let memoryTimer = null;

let activeServiceId = null;
let locked = false;
let overlayOpen = false;
/** @type {null | 'full' | 'drawer' | 'menu'} */
let overlayMode = null;
/** Extra insets (px) so side drawers / floating menus stay above HTML. */
let overlayRightInset = 0;
let overlayLeftInset = 0;
/** Floating app right-click menu (child window — paints above WebContentsView guests). */
let appMenuWindow = null;
let appMenuServiceId = null;
/** Floating chrome (Aspera) menu — same overlay approach. */
let chromeMenuWindow = null;
/** Floating notification center. */
let notifCenterWindow = null;
/** Floating Aspera AI result panel. */
let aiResultWindow = null;
/** Context for follow-up actions on the open AI result (e.g. suggest replies). */
let aiResultContext = null;
/** Floating Forward-with-Hub account picker. */
let forwardPickerWindow = null;
/** @type {null | {
 *   text: string,
 *   linkURL: string,
 *   imagePath: string,
 *   filePath: string,
 *   hasImage: boolean,
 *   sourceServiceId: string,
 *   sourceAppId: string,
 *   sourceName: string,
 * }} */
let forwardPayload = null;
/** Floating Chrome-like Extensions manager. */
let extensionsWindow = null;
let settings = loadSettings();
settings = {
  ...settings,
  extensions: normalizeExtensionList(settings.extensions),
};
setAiSettingsReader(() => settings);

function trackServicePopup(serviceId, popupWindow) {
  if (!serviceId || !popupWindow) return;
  let set = servicePopups.get(serviceId);
  if (!set) {
    set = new Set();
    servicePopups.set(serviceId, set);
  }
  set.add(popupWindow);
  popupWindow.once('closed', () => {
    const current = servicePopups.get(serviceId);
    if (!current) return;
    current.delete(popupWindow);
    if (!current.size) servicePopups.delete(serviceId);
  });
}

function closeServicePopups(serviceId) {
  const set = servicePopups.get(serviceId);
  if (!set || !set.size) return;
  for (const win of [...set]) {
    try {
      if (!win.isDestroyed()) win.close();
    } catch {
      // ignore
    }
  }
  servicePopups.delete(serviceId);
}

/** High performance is the default — low memory is opt-in only. */
function isLowMemoryMode() {
  return settings.lowMemoryMode === true;
}

function applyMemorySwitches() {
  const lean = isLowMemoryMode();
  const disabled = new Set(['SpareRendererForSitePerProcess']);
  const warm = Math.max(
    1,
    Math.min(
      MAX_WARM_VIEWS_CAP || 5,
      Number(settings.maxWarmViews) || MAX_WARM_VIEWS_DEFAULT || 5,
    ),
  );

  // Linux Mint (NVIDIA / VM / older Intel): Chromium often dies at launch with
  // FATAL "GPU process isn't usable. Goodbye." Prefer starting over GPU speed.
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    try {
      const crashFlag = path.join(app.getPath('userData'), 'gpu-crash-v1');
      if (fs.existsSync(crashFlag)) {
        app.disableHardwareAcceleration();
        app.commandLine.appendSwitch('disable-gpu');
      }
    } catch {
      // ignore
    }
  }

  if (lean || settings.hardwareAcceleration === false) {
    app.disableHardwareAcceleration();
    // disableHardwareAcceleration() alone is not enough on some Mint GPUs —
    // Chromium still tries a GPU process and FATAL-exits.
    if (process.platform === 'linux') {
      app.commandLine.appendSwitch('disable-gpu');
    }
  }
  if (settings.hiDpiSupport === false) {
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  if (settings.mediaKeys === false) {
    disabled.add('HardwareMediaKeyHandling');
  }
  // Linux WMs (Mint XFCE/Cinnamon) often mis-report occlusion → blank WebContentsView
  // until the next resize/click. Keep guest surfaces painting while alt-tabbed away.
  if (process.platform === 'linux') {
    disabled.add('CalculateNativeWinOcclusion');
  }

  app.commandLine.appendSwitch('disable-features', [...disabled].join(','));
  app.commandLine.appendSwitch(
    'disk-cache-size',
    String((lean ? 16 : 32) * 1024 * 1024),
  );
  // Room for all warm guests + Zoho CRM child windows + shell.
  app.commandLine.appendSwitch(
    'renderer-process-limit',
    String(Math.max(12, warm + 6)),
  );
  // Keep warm SPA portals (Zoho One CRM) alive when the window is occluded /
  // idle — otherwise the shell stays and the content pane goes blank.
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
}

/**
 * Warm apps stay full-speed even in the background (instant switch / UX first).
 * Non-warm background guests may throttle after first load.
 * Heavy portals are not throttled until the user has opened them once.
 */
function applyGuestPerfMode(
  webContents,
  { active, loadedOnce = true, keepWarm = false, allowThrottle = true } = {},
) {
  if (!webContents || webContents.isDestroyed()) return;
  if (!active && !loadedOnce) return;
  try {
    if (active || keepWarm || !allowThrottle) {
      webContents.setBackgroundThrottling(false);
    } else {
      webContents.setBackgroundThrottling(true);
    }
  } catch {
    // ignore
  }
}

function syncAllGuestPerfModes() {
  for (const [id, entry] of views.entries()) {
    const wc = entry?.view?.webContents;
    if (!wc || wc.isDestroyed()) continue;
    const service = getService(id) || entry.service;
    const keepWarm = isKeepWarmService(id);
    applyGuestPerfMode(wc, {
      active:
        !locked &&
        id === activeServiceId &&
        !(overlayOpen && overlayMode === 'full'),
      loadedOnce: entry.loadedOnce === true,
      keepWarm,
      allowThrottle:
        !keepWarm ||
        !isHeavyPortalApp(service) ||
        entry.activatedOnce === true,
    });
  }
}

/** SPAs that need an unthrottled first boot (then stay full-speed if warm). */
function isHeavyPortalApp(service) {
  const id = service?.appId;
  return id === 'zoho-one' || id === 'arattai' || id === 'zoho-crm';
}

/**
 * Auto blank-pane recovery is only needed for Zoho portal spaces.
 * Arattai can look "blank enough" during fast tab restores and was getting
 * unnecessary reloads on every switch.
 */
function shouldRunPortalBlankRecovery(service) {
  const id = service?.appId;
  return id === 'zoho-one' || id === 'zoho-crm';
}

/**
 * Zoho portals: only recover when the content pane is actually blank.
 * Never blind-reload warm apps after tab switches or short idle — that is what
 * made "warm" feel cold (full reload every time you came back).
 */
const PORTAL_STALE_MS = 10 * 60_000;
const PORTAL_RELOAD_COOLDOWN_MS = 20_000;
const PORTAL_RELOAD_COOLDOWN_SALES_MS = 8000;
const PORTAL_HEALTH_CHECK_MS = 3500;
const PORTAL_HEALTH_RETRY_MS = 6500;
const ZOHO_SALES_RECOVERY_DELAYS_MS = [1500, 3500, 5500, 8000];

function touchPortalPresence(entry) {
  if (entry) entry.lastPresenceAt = Date.now();
}

/** When the user last interacted / the system stopped being idle. */
let lastUserActiveAt = Date.now();
/** When the current away spell began (idle / blur / lock). */
let awayStartedAt = 0;
/** Peak system idle seconds observed in the current away spell. */
let peakIdleSec = 0;

function markUserAway(reason = 'idle') {
  if (!awayStartedAt) {
    awayStartedAt = Date.now();
    try {
      logBreadcrumb('user-away', { reason });
    } catch {
      // ignore
    }
  }
}

function markUserActive() {
  lastUserActiveAt = Date.now();
  awayStartedAt = 0;
  peakIdleSec = 0;
}

/**
 * Sample the guest compositor surface. After long idle on Linux the DOM can be
 * fine while the on-screen surface is a flat blank — capturePage catches that.
 *
 * Must NOT treat WhatsApp QR / cream login pages as blank (that caused mid-login
 * reloads and spontaneous logouts in v0.2.75).
 */
async function isGuestVisuallyBlank(webContents) {
  if (!webContents || webContents.isDestroyed()) return false;
  if (typeof webContents.capturePage !== 'function') return false;
  try {
    const img = await webContents.capturePage();
    const size = img?.getSize?.() || {};
    const w = size.width || 0;
    const h = size.height || 0;
    if (w < 120 || h < 120) return true;
    const crop = {
      x: Math.floor(w * 0.12),
      y: Math.floor(h * 0.12),
      width: Math.max(40, Math.floor(w * 0.76)),
      height: Math.max(40, Math.floor(h * 0.76)),
    };
    const region = img.crop(crop);
    if (typeof region.toBitmap !== 'function') {
      // Real UIs (QR codes, chat lists) compress larger than a flat panel.
      const png = region.toPNG();
      return png.length < 6_000;
    }
    const buf = region.toBitmap();
    const unique = new Set();
    let samples = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let i = 0; i + 3 < buf.length; i += 40 * 4) {
      const b = buf[i];
      const g = buf[i + 1];
      const r = buf[i + 2];
      samples += 1;
      sumR += r;
      sumG += g;
      sumB += b;
      // 4-bit quantization — enough to separate UI chrome from flat fills.
      unique.add(`${r >> 4},${g >> 4},${b >> 4}`);
    }
    if (!samples) return false;
    // Chat / QR / dashboards have many distinct colors.
    if (unique.size >= 6) return false;

    const meanR = sumR / samples;
    const meanG = sumG / samples;
    const meanB = sumB / samples;
    let varSum = 0;
    for (let i = 0; i + 3 < buf.length; i += 40 * 4) {
      const b = buf[i];
      const g = buf[i + 1];
      const r = buf[i + 2];
      const dr = r - meanR;
      const dg = g - meanG;
      const db = b - meanB;
      varSum += dr * dr + dg * dg + db * db;
    }
    const stdev = Math.sqrt(varSum / samples);
    // True compositor blanks are nearly uniform (stdev very low, few colors).
    return unique.size <= 3 && stdev < 12;
  } catch {
    return false;
  }
}

function isMessagingApp(service) {
  const id = service?.appId || service?.id;
  return id === 'whatsapp' || id === 'arattai';
}

/** WhatsApp/Arattai QR or phone-link screens — never reload these. */
async function guestLooksLikeLoginOrPairing(webContents, service) {
  if (!webContents || webContents.isDestroyed()) return false;
  try {
    const url = String(webContents.getURL() || '');
    const title = String(webContents.getTitle() || '');
    if (isAuthOrLoginUrl(url)) return true;
    if (/scan|log\s*in|qr code|link with phone|stay logged in/i.test(title)) {
      return true;
    }
    if (!isMessagingApp(service)) return false;
    const pairing = await webContents.executeJavaScript(
      `(() => {
        try {
          const t = ((document.body && document.body.innerText) || '').slice(0, 4000);
          return /Scan to log in|Stay logged in on this browser|Link with phone number|QR code|Use WhatsApp on your phone|Enter phone number/i.test(t);
        } catch (_) { return false; }
      })()`,
      true,
    );
    return !!pairing;
  } catch {
    return false;
  }
}

function softReloadActiveGuest(reason = 'idle-blank') {
  if (!activeServiceId || locked) return false;
  const entry = views.get(activeServiceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed() || wc.isLoading()) return false;
  const service = getService(activeServiceId) || entry.service;
  // Never interrupt WhatsApp/Arattai login — reload mid-QR logs the user out.
  if (isMessagingApp(service) && /surface|active-surface/i.test(String(reason || ''))) {
    return false;
  }
  const now = Date.now();
  if (
    entry.__lastStaleReloadAt &&
    now - entry.__lastStaleReloadAt < PORTAL_RELOAD_COOLDOWN_MS
  ) {
    return false;
  }
  entry.__lastStaleReloadAt = now;
  try {
    rememberGoodUrl(activeServiceId, wc.getURL());
  } catch {
    // ignore
  }
  try {
    logBreadcrumb('guest-idle-reload', {
      reason,
      serviceId: activeServiceId,
      awayMs: awayStartedAt ? now - awayStartedAt : 0,
    });
    wc.reload();
    return true;
  } catch {
    return false;
  }
}

const ACTIVE_SURFACE_CHECK_DELAYS_MS = [2500, 5500, 10000];
const ACTIVE_SURFACE_POLL_MS = 40_000;
/** Give messaging apps time to finish QR pairing before any surface checks. */
const MESSAGING_SURFACE_GRACE_MS = 90_000;

function clearActiveSurfaceTimers(entry) {
  if (!entry?.__surfaceHealthTimers?.length) return;
  for (const t of entry.__surfaceHealthTimers) clearTimeout(t);
  entry.__surfaceHealthTimers = [];
}

/**
 * Pixel-based blank recovery for the ACTIVE guest.
 * Messaging apps (WhatsApp/Arattai): repaint only — never soft-reload (QR false positives).
 */
async function runActiveGuestSurfaceHealthCheck(id, { fromPoll = false } = {}) {
  if (!id || id !== activeServiceId || locked) return;
  if (overlayOpen && overlayMode === 'full') return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) return;
  if (fromPoll && !dockIsUserFocused()) return;

  const entry = views.get(id);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed() || wc.isLoading()) return;
  const service = getService(id) || entry.service;

  // Grace period after create/activate — WhatsApp QR is cream/white and used to
  // trip blank recovery, which reloaded and logged users out mid-pairing.
  const createdAt = entry.createdAt || entry.lastUsed || 0;
  if (
    isMessagingApp(service) &&
    createdAt &&
    Date.now() - createdAt < MESSAGING_SURFACE_GRACE_MS
  ) {
    return;
  }

  if (await guestLooksLikeLoginOrPairing(wc, service)) {
    entry.__surfaceBlankStrikes = 0;
    return;
  }

  const blank = await isGuestVisuallyBlank(wc);
  if (!blank) {
    entry.__surfaceBlankStrikes = 0;
    return;
  }

  entry.__surfaceBlankStrikes = (entry.__surfaceBlankStrikes || 0) + 1;
  try {
    logBreadcrumb('guest-surface-blank', {
      serviceId: id,
      appId: service?.appId,
      strikes: entry.__surfaceBlankStrikes,
      fromPoll: !!fromPoll,
    });
  } catch {
    // ignore
  }

  // Always try a gentle compositor kick first (bounds only — no detach for messaging).
  entry.__lastBounds = null;
  if (!isMessagingApp(service) && entry.__surfaceBlankStrikes === 1) {
    try {
      detachGuestView(entry.view);
      attachGuestView(entry.view);
    } catch {
      // ignore
    }
  }
  repaintActiveGuestView({ reason: 'active-surface-blank' });

  if (entry.__surfaceBlankStrikes === 1) {
    setTimeout(() => {
      if (id === activeServiceId) {
        runActiveGuestSurfaceHealthCheck(id, { fromPoll });
      }
    }, 2200);
    return;
  }

  // Second strike: reload only for non-messaging apps.
  entry.__surfaceBlankStrikes = 0;
  if (isMessagingApp(service)) {
    // Keep trying gentle repaints; never reload WhatsApp while focused.
    return;
  }
  softReloadActiveGuest('active-surface-blank');
}

function scheduleActiveGuestSurfaceChecks(id) {
  const entry = views.get(id);
  if (!entry) return;
  clearActiveSurfaceTimers(entry);
  entry.__surfaceBlankStrikes = 0;
  const service = getService(id) || entry.service;
  const delays = isMessagingApp(service)
    ? ACTIVE_SURFACE_CHECK_DELAYS_MS.map((d) => d + MESSAGING_SURFACE_GRACE_MS)
    : ACTIVE_SURFACE_CHECK_DELAYS_MS;
  entry.__surfaceHealthTimers = delays.map((delay) =>
    setTimeout(() => {
      runActiveGuestSurfaceHealthCheck(id);
    }, delay),
  );
}

/**
 * After the user returns from lock / sleep / long idle: reattach + two-step
 * repaint, then reload only if the surface is still visually blank.
 */
function recoverActiveGuestAfterAway(reason = 'idle', idleMs = 0) {
  const awayMs =
    idleMs || (awayStartedAt ? Date.now() - awayStartedAt : 0);
  if (!activeServiceId || locked) {
    markUserActive();
    return;
  }
  const entry = views.get(activeServiceId);
  if (!entry?.view) {
    markUserActive();
    return;
  }

  guestNeedsRepaint = true;
  try {
    // Re-seat the native view — long occlusion can leave a dead compositor surface.
    detachGuestView(entry.view);
    attachGuestView(entry.view);
  } catch {
    // ignore
  }
  entry.__lastBounds = null;
  entry.__parked = false;
  repaintActiveGuestView({ reason });

  const serviceId = activeServiceId;
  const checkAt = (delay, allowReload) => {
    setTimeout(async () => {
      if (!mainWindow || mainWindow.isDestroyed() || locked) return;
      if (activeServiceId !== serviceId) return;
      const live = views.get(serviceId);
      const wc = live?.view?.webContents;
      if (!wc || wc.isDestroyed() || wc.isLoading()) return;

      // Always nudge again — XFCE often needs a second pass after unlock.
      live.__lastBounds = null;
      repaintActiveGuestView({ reason: `${reason}-verify` });

      if (!allowReload) return;
      // Short away: repaint is enough. Long away / resume: verify pixels.
      if (awayMs < 5 * 60_000 && reason !== 'power-resume') return;

      // Give the nudge a moment to paint before sampling.
      setTimeout(async () => {
        if (activeServiceId !== serviceId || locked) return;
        const still = views.get(serviceId)?.view?.webContents;
        if (!still || still.isDestroyed() || still.isLoading()) return;
        const svc = getService(serviceId) || views.get(serviceId)?.service;
        if (await guestLooksLikeLoginOrPairing(still, svc)) return;
        const blank = await isGuestVisuallyBlank(still);
        if (blank) {
          softReloadActiveGuest(reason);
        }
      }, 350);
    }, delay);
  };

  checkAt(450, false);
  checkAt(1200, true);
  // Very long idle (screensaver / lunch): if still blank, reload once more.
  if (awayMs >= 15 * 60_000 || reason === 'power-resume') {
    checkAt(2800, true);
  }

  markUserActive();
  try {
    logBreadcrumb('guest-idle-recover', { reason, awayMs, serviceId });
  } catch {
    // ignore
  }
}

function maybeRefreshStaleHeavyPortal(id, { reason = 'idle' } = {}) {
  const entry = views.get(id);
  if (!entry) return false;
  const service = getService(id) || entry.service;
  if (!shouldRunPortalBlankRecovery(service)) return false;
  const wc = entry.view?.webContents;
  if (!wc || wc.isDestroyed() || wc.isLoading()) return false;

  // Warm apps must stay alive — never blind-reload them after idle/focus.
  // Only run a blank-pane health check (and only if still active).
  if (isKeepWarmService(id)) {
    if (id === activeServiceId) schedulePortalHealthChecks(id);
    touchPortalPresence(entry);
    return false;
  }

  const now = Date.now();
  const last = entry.lastPresenceAt || entry.lastUsed || 0;
  if (!last || now - last < PORTAL_STALE_MS) return false;
  if (
    entry.__lastStaleReloadAt &&
    now - entry.__lastStaleReloadAt < PORTAL_RELOAD_COOLDOWN_MS
  ) {
    return false;
  }

  entry.__lastStaleReloadAt = now;
  entry.lastPresenceAt = now;
  try {
    rememberGoodUrl(id, wc.getURL());
  } catch {
    // ignore
  }
  try {
    logBreadcrumb('portal-stale-reload', {
      serviceId: id,
      appId: service.appId,
      reason,
      idleMs: now - last,
    });
  } catch {
    // ignore
  }
  try {
    wc.reload();
    return true;
  } catch {
    return false;
  }
}

function onUserReturnedFromIdle(reason = 'presence') {
  const awayMs = awayStartedAt ? Date.now() - awayStartedAt : peakIdleSec * 1000;
  // Always recover the visible guest after away — Zoho blank checks alone miss
  // Arattai/WhatsApp compositor blanks on Mint after ~30 minutes idle.
  recoverActiveGuestAfterAway(reason, awayMs);
  if (activeServiceId) {
    maybeRefreshStaleHeavyPortal(activeServiceId, { reason });
    touchPortalPresence(views.get(activeServiceId));
  }
}

/** Drop HTTP cache only — cookies / IndexedDB stay so sessions survive. */
async function trimGuestHttpCache(partition) {
  if (!partition) return;
  try {
    await session.fromPartition(partition).clearCache();
  } catch {
    // ignore
  }
}

async function trimInactiveGuestCaches() {
  for (const [id, entry] of views.entries()) {
    if (id === activeServiceId) continue;
    // Never trim warm / portal guests — Zoho One CRM blanks when its cache is
    // cleared while the user works in another tab.
    if (isKeepWarmService(id)) continue;
    const service = getService(id) || entry?.service;
    if (isHeavyPortalApp(service)) continue;
    const partition = service?.partition || entry?.service?.partition;
    if (partition) await trimGuestHttpCache(partition);
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

function getRawInstance(id) {
  return (settings.serviceInstances || []).find((i) => i.id === id) || null;
}

function getAppConfig(id) {
  // IMPORTANT: do NOT call getService()/orderedServices() here.
  // orderedServices() decorates with getAppConfig() — that recursion
  // crashed startup with "Maximum call stack size exceeded" (blank launch).
  const raw = getRawInstance(id);
  const appId = raw?.appId || id;
  const stored = (settings.serviceConfigs || {})[id] || {};
  // Messaging sessions die if hibernated mid-pairing — keep them warm by default
  // unless the user explicitly turned keepWarm off.
  const messagingDefault =
    (appId === 'whatsapp' || appId === 'arattai') &&
    stored.keepWarm === undefined
      ? { keepWarm: true }
      : {};
  return mergeAppConfig({ ...messagingDefault, ...stored });
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

/** Custom URLs are disabled — Aspera Hub only exposes the company catalog. */
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

/** How many guest pages may stay loaded — same as warm budget (UX first). */
function maxResident() {
  return maxWarm();
}

function dockIsUserFocused() {
  return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
}

/** Only focus guest content when the user already has Aspera Hub focused. */
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
  // Focus event usually fires; still kick a repaint for WMs that skip it.
  setTimeout(() => repaintActiveGuestView({ reason: 'raise' }), 30);
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

/** IPC for the floating app-menu child window (not the dock shell). */
function appMenuHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !appMenuWindow ||
      appMenuWindow.isDestroyed() ||
      event.sender !== appMenuWindow.webContents
    ) {
      throw new Error('Unauthorized app-menu IPC sender');
    }
    return handler(event, ...args);
  });
}

function chromeMenuHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !chromeMenuWindow ||
      chromeMenuWindow.isDestroyed() ||
      event.sender !== chromeMenuWindow.webContents
    ) {
      throw new Error('Unauthorized chrome-menu IPC sender');
    }
    return handler(event, ...args);
  });
}

function notifCenterHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !notifCenterWindow ||
      notifCenterWindow.isDestroyed() ||
      event.sender !== notifCenterWindow.webContents
    ) {
      throw new Error('Unauthorized notif-center IPC sender');
    }
    return handler(event, ...args);
  });
}

function aiResultHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !aiResultWindow ||
      aiResultWindow.isDestroyed() ||
      event.sender !== aiResultWindow.webContents
    ) {
      throw new Error('Unauthorized ai-result IPC sender');
    }
    return handler(event, ...args);
  });
}

function forwardPickerHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !forwardPickerWindow ||
      forwardPickerWindow.isDestroyed() ||
      event.sender !== forwardPickerWindow.webContents
    ) {
      throw new Error('Unauthorized forward-picker IPC sender');
    }
    return handler(event, ...args);
  });
}

function extensionsHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !extensionsWindow ||
      extensionsWindow.isDestroyed() ||
      event.sender !== extensionsWindow.webContents
    ) {
      throw new Error('Unauthorized extensions IPC sender');
    }
    return handler(event, ...args);
  });
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
    if (typeof view.setVisible === 'function') view.setVisible(true);
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

function contentGuestBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: 70, width: 800, height: 600 };
  }
  const [width, height] = mainWindow.getContentSize();
  const m = effectiveMetrics();
  const right = m.right || 0;
  const top = Math.max(64, m.top || 0);
  return {
    x: Math.max(0, m.left || 0),
    y: top,
    width: Math.max(1, width - (m.left || 0) - right),
    height: Math.max(1, height - top),
  };
}

/**
 * Keep warm guests attached at full size and Chromium-visible.
 * setVisible(false) freezes Zoho CRM / Arattai iframes via Page Visibility.
 * Park every warm app off-screen instead — instant switch is the product promise.
 */
function parkGuestView(entry, viewId = null) {
  if (!mainWindow || !entry?.view || mainWindow.isDestroyed()) return;
  try {
    mainWindow.contentView.addChildView(entry.view);
    const bounds = contentGuestBounds();
    const parked = {
      ...bounds,
      x: -Math.max(bounds.width, 1100) - 80,
    };
    entry.view.setBounds(parked);
    entry.__lastBounds = parked;
    if (typeof entry.view.setVisible === 'function') {
      entry.view.setVisible(true);
    }
    entry.__parked = true;
    setGuestHubActiveFlag(entry.view.webContents, false);
    // Keep warm portals "present" so idle logic never treats them as stale.
    touchPortalPresence(entry);
  } catch {
    // ignore — may already be attached
  }
}

/** Detach non-warm guests; park warm ones off-screen (still visible to Chromium). */
function parkBackgroundViews(exceptId = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  for (const [viewId, entry] of views.entries()) {
    if (viewId === exceptId) continue;
    if (isKeepWarmService(viewId)) parkGuestView(entry, viewId);
    else detachGuestView(entry.view);
  }
}

function clearPortalTimer(entry, key) {
  if (!entry?.[key]) return;
  clearTimeout(entry[key]);
  entry[key] = null;
}

function schedulePortalHealthCheck(id, delay = PORTAL_HEALTH_CHECK_MS) {
  const entry = views.get(id);
  if (!entry) return;
  clearPortalTimer(entry, '__portalHealthTimer');
  entry.__portalHealthTimer = setTimeout(() => {
    entry.__portalHealthTimer = null;
    runPortalHealthCheck(id);
  }, delay);
}

function schedulePortalHealthChecks(id) {
  // After un-parking, Zoho/Arattai need several seconds to paint — checking
  // too early false-triggers a reload and feels like a cold start.
  schedulePortalHealthCheck(id, PORTAL_HEALTH_CHECK_MS);
  const entry = views.get(id);
  if (!entry) return;
  clearPortalTimer(entry, '__portalHealthTimer2');
  entry.__portalHealthTimer2 = setTimeout(() => {
    entry.__portalHealthTimer2 = null;
    runPortalHealthCheck(id);
  }, PORTAL_HEALTH_RETRY_MS);
}

function clearZohoSalesRecoveryTimers(entry) {
  if (!entry?.__zohoSalesRecoveryTimers?.length) return;
  for (const t of entry.__zohoSalesRecoveryTimers) clearTimeout(t);
  entry.__zohoSalesRecoveryTimers = [];
}

/** Faster blank checks after Zoho One Sales space activation (HR → Sales, etc.). */
function scheduleZohoSalesRecovery(id) {
  const entry = views.get(id);
  const service = getService(id) || entry?.service;
  if (!entry || service?.appId !== 'zoho-one') return;
  if (id !== activeServiceId || locked || overlayOpen) return;

  clearZohoSalesRecoveryTimers(entry);
  entry.__zohoSalesRecoveryTimers = ZOHO_SALES_RECOVERY_DELAYS_MS.map((delay) =>
    setTimeout(() => {
      // Blank-only checks — never blind-refresh a healthy Sales dashboard.
      runPortalHealthCheck(id, { salesRecovery: true });
    }, delay),
  );
}

/**
 * Spoof Page Visibility so Zoho CRM / Arattai do not freeze when parked.
 * Also exposes __asperaHubActive so in-page guardians never reload background tabs.
 */
function attachPortalVisibilityKeepAlive(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  const script = `(() => {
    try {
      if (window.__asperaPortalVisible) return;
      window.__asperaPortalVisible = true;
      if (typeof window.__asperaHubActive === 'undefined') {
        window.__asperaHubActive = false;
      }
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      const stop = (e) => e.stopImmediatePropagation();
      window.addEventListener('visibilitychange', stop, true);
      document.addEventListener('visibilitychange', stop, true);
    } catch (_) {}
  })()`;
  const inject = () => {
    if (webContents.isDestroyed()) return;
    webContents.executeJavaScript(script, true).catch(() => {});
  };
  webContents.on('dom-ready', inject);
  webContents.on('did-finish-load', inject);
  inject();
}

function setGuestHubActiveFlag(webContents, active) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents
    .executeJavaScript(
      `window.__asperaHubActive = ${active ? 'true' : 'false'};`,
      true,
    )
    .catch(() => {});
}

/**
 * In-page guardian for Zoho One: Finance/HR work, but Sales → CRM often paints
 * a blank pane after space switches. Recover only when the content pane is
 * still blank — never blind-refresh a healthy CRM iframe.
 */
function attachZohoOneBlankGuardian(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  const script = `(() => {
    if (window.__asperaZohoSalesGuardian) return;
    window.__asperaZohoSalesGuardian = true;
    let lastFixAt = 0;
    let blankStrikes = 0;
    let wasSales = false;
    let salesEnterAt = 0;
    let salesEnterToken = 0;
    const COOLDOWN = 12000;
    const SALES_BLANK_CHECK_MS = [4500, 7500, 11000];

    function salesContext() {
      const path = String(location.pathname || '').toLowerCase();
      const href = String(location.href || '').toLowerCase();
      if (path.includes('/cxapp-spaces/sales') || href.includes('/cxapp-spaces/sales')) {
        return true;
      }
      if (path.includes('/crm/') && path.includes('/tab/')) return true;
      const text = ((document.body && document.body.innerText) || '').slice(0, 5000);
      return /\\bCRM\\b/.test(text) && /\\bSales\\b/.test(text) && /Workqueue|Analytics|My Requests/.test(text);
    }

    function refreshCrmIframe() {
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      for (const frame of document.querySelectorAll('iframe')) {
        const r = frame.getBoundingClientRect();
        if (r.width < vw * 0.35 || r.height < vh * 0.25) continue;
        const src = String(frame.getAttribute('src') || frame.src || '');
        if (src && !src.startsWith('about:blank')) {
          try {
            frame.src = src;
            return true;
          } catch (_) {}
        }
      }
      return false;
    }

    function looksBlank() {
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      if (vw < 200 || vh < 200) return false;

      for (const frame of document.querySelectorAll('iframe')) {
        const r = frame.getBoundingClientRect();
        if (r.width < vw * 0.35 || r.height < vh * 0.28) continue;
        const src = String(frame.getAttribute('src') || frame.src || '');
        if (!src || src === 'about:blank' || src.startsWith('about:blank')) return true;
        try {
          const doc = frame.contentDocument;
          if (doc) {
            const t = ((doc.body && doc.body.innerText) || '').trim();
            const kids = doc.body ? doc.body.children.length : 0;
            if (t.length < 30 && kids < 2) return true;
          }
        } catch (_) {}
      }

      // Cross-origin CRM iframe: detect large empty content panes under the shell.
      let emptyArea = 0;
      for (const el of document.querySelectorAll('main,section,div')) {
        const r = el.getBoundingClientRect();
        if (r.width < vw * 0.42 || r.height < vh * 0.38) continue;
        const text = (el.innerText || '').trim();
        if (text.length > 80) continue;
        if (el.querySelectorAll('img,canvas,table,tr,li,button,input,a').length > 6) continue;
        emptyArea += r.width * r.height;
      }
      return emptyArea > vw * vh * 0.28;
    }

    function tryFix({ force = false } = {}) {
      if (!window.__asperaHubActive) return;
      const now = Date.now();
      if (!force && now - lastFixAt < COOLDOWN) return;
      if (!salesContext()) {
        blankStrikes = 0;
        return;
      }
      if (!looksBlank()) {
        blankStrikes = 0;
        return;
      }
      blankStrikes += 1;
      const paintGrace = salesEnterAt && now - salesEnterAt < 4000;
      if (!force && paintGrace) return;
      if (!force && blankStrikes < 2) return;
      blankStrikes = 0;
      lastFixAt = now;
      if (refreshCrmIframe()) return;
      try { location.reload(); } catch (_) {}
    }

    function onSalesEnter() {
      salesEnterAt = Date.now();
      const token = ++salesEnterToken;
      blankStrikes = 0;
      for (const delay of SALES_BLANK_CHECK_MS) {
        setTimeout(() => {
          if (token !== salesEnterToken || !salesContext() || !window.__asperaHubActive) return;
          if (!looksBlank()) return;
          tryFix({ force: true });
        }, delay);
      }
    }

    function trackSalesContext() {
      const nowSales = salesContext();
      if (nowSales && !wasSales) onSalesEnter();
      if (!nowSales) blankStrikes = 0;
      wasSales = nowSales;
    }

    setInterval(() => {
      trackSalesContext();
      tryFix();
    }, 2500);
    document.addEventListener('click', (e) => {
      const t = e.target;
      const label = String((t && (t.innerText || t.textContent)) || '').trim();
      if (/^Sales$/i.test(label.slice(0, 40))) onSalesEnter();
      setTimeout(() => tryFix(), 2500);
    }, true);
    window.addEventListener('hashchange', () => {
      trackSalesContext();
      setTimeout(() => tryFix(), 2000);
    });
    window.addEventListener('popstate', () => {
      trackSalesContext();
      setTimeout(() => tryFix(), 2000);
    });
    trackSalesContext();
  })()`;
  const inject = () => {
    if (webContents.isDestroyed()) return;
    webContents.executeJavaScript(script, true).catch(() => {});
  };
  webContents.on('dom-ready', inject);
  webContents.on('did-finish-load', inject);
  inject();
}

/**
 * Detect blank portal content and recover with reload (stay on current route).
 */
async function runPortalHealthCheck(id, { salesRecovery = false } = {}) {
  const entry = views.get(id);
  const service = getService(id) || entry?.service;
  if (!entry || !shouldRunPortalBlankRecovery(service)) return;
  if (id !== activeServiceId || locked || overlayOpen) return;
  const wc = entry.view?.webContents;
  if (!wc || wc.isDestroyed() || wc.isLoading()) return;

  const now = Date.now();
  const cooldownMs = salesRecovery
    ? PORTAL_RELOAD_COOLDOWN_SALES_MS
    : PORTAL_RELOAD_COOLDOWN_MS;
  if (entry.__lastStaleReloadAt && now - entry.__lastStaleReloadAt < cooldownMs) {
    return;
  }

  let looksBlank = false;
  let currentUrl = '';
  try {
    currentUrl = wc.getURL();
  } catch {
    return;
  }

  const isZohoSales =
    service.appId === 'zoho-one' &&
    /cxapp-spaces\/sales|\/crm\/.*\/tab\//i.test(String(currentUrl || ''));

  const refreshIframeScript = `(() => {
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    for (const frame of document.querySelectorAll('iframe')) {
      const r = frame.getBoundingClientRect();
      if (r.width < vw * 0.35 || r.height < vh * 0.25) continue;
      const src = String(frame.getAttribute('src') || frame.src || '');
      if (src && !src.startsWith('about:blank')) {
        try {
          frame.src = src;
          return true;
        } catch (_) {}
      }
    }
    return false;
  })()`;

  try {
    looksBlank = await wc.executeJavaScript(
      `(() => {
        const vw = window.innerWidth || 0;
        const vh = window.innerHeight || 0;
        if (vw < 200 || vh < 200) return false;

        for (const frame of document.querySelectorAll('iframe')) {
          const r = frame.getBoundingClientRect();
          if (r.width < vw * 0.35 || r.height < vh * 0.28) continue;
          const src = String(frame.getAttribute('src') || frame.src || '');
          if (!src || src === 'about:blank' || src.startsWith('about:blank')) {
            return true;
          }
          try {
            const doc = frame.contentDocument;
            if (doc) {
              const t = ((doc.body && doc.body.innerText) || '').trim();
              const kids = doc.body ? doc.body.children.length : 0;
              if (t.length < 30 && kids < 2) return true;
            }
          } catch (_) {}
        }

        let emptyArea = 0;
        for (const el of document.querySelectorAll('main,section,div')) {
          const r = el.getBoundingClientRect();
          if (r.width < vw * 0.4 || r.height < vh * 0.35) continue;
          const text = (el.innerText || '').trim();
          if (text.length > 80) continue;
          if (el.querySelectorAll('img,canvas,table,tr,li,button,a').length > 6) {
            continue;
          }
          emptyArea += r.width * r.height;
        }
        if (emptyArea > vw * vh * 0.28) return true;

        const bodyText = ((document.body && document.body.innerText) || '').trim();
        return bodyText.length < 24;
      })()`,
      true,
    );
  } catch {
    return;
  }

  // Cross-origin CRM iframe often defeats DOM blank checks — sample pixels.
  if (
    !looksBlank &&
    service.appId === 'zoho-one' &&
    (salesRecovery || isZohoSales) &&
    typeof wc.capturePage === 'function'
  ) {
    try {
      const img = await wc.capturePage();
      const size = img?.getSize?.() || {};
      const w = size.width || 0;
      const h = size.height || 0;
      if (w > 200 && h > 200) {
        // Sample the lower-right content region (below Zoho chrome).
        const crop = {
          x: Math.floor(w * 0.28),
          y: Math.floor(h * 0.28),
          width: Math.floor(w * 0.55),
          height: Math.floor(h * 0.55),
        };
        const region = img.crop(crop);
        const png = region.toPNG();
        // Tiny / near-empty PNG of a flat white region is much smaller than a dashboard.
        // Also check average luminance via a cheap byte scan of PNG is unreliable;
        // use JPEG size heuristic + bitmap if available.
        let whiteRatio = 0;
        if (typeof region.toBitmap === 'function') {
          const buf = region.toBitmap();
          let white = 0;
          let samples = 0;
          // BGRA pixels — sample every 32nd pixel.
          for (let i = 0; i + 3 < buf.length; i += 32 * 4) {
            const b = buf[i];
            const g = buf[i + 1];
            const r = buf[i + 2];
            samples += 1;
            if (r > 245 && g > 245 && b > 245) white += 1;
          }
          whiteRatio = samples ? white / samples : 0;
        } else {
          // Fallback: very small compressed PNG usually means flat color.
          whiteRatio = png.length < 12_000 ? 0.95 : 0;
        }
        if (whiteRatio > 0.92) looksBlank = true;
      }
    } catch {
      // ignore capture failures
    }
  }

  if (!looksBlank) {
    entry.__blankStrikes = 0;
    clearZohoSalesRecoveryTimers(entry);
    return;
  }
  entry.__blankStrikes = (entry.__blankStrikes || 0) + 1;
  const requiredStrikes = 2;
  if (entry.__blankStrikes < requiredStrikes) {
    schedulePortalHealthCheck(id, salesRecovery ? 1500 : 2000);
    return;
  }
  entry.__blankStrikes = 0;
  entry.__lastStaleReloadAt = now;

  if (service.appId === 'zoho-one' && (salesRecovery || isZohoSales)) {
    try {
      const refreshed = await wc.executeJavaScript(refreshIframeScript, true);
      if (refreshed) {
        entry.__lastSalesIframeRefreshAt = now;
        logBreadcrumb('portal-sales-iframe-refresh', {
          serviceId: id,
          from: String(currentUrl || '').slice(0, 200),
        });
        // Re-check once after paint — do not keep blind-refreshing.
        schedulePortalHealthCheck(id, 4000);
        return;
      }
    } catch {
      // fall through to reload
    }
  }

  try {
    logBreadcrumb('portal-blank-reload', {
      serviceId: id,
      appId: service.appId,
      from: String(currentUrl || '').slice(0, 200),
    });
    // Always reload in place — never navigate to portal home (that opens Personal).
    wc.reload();
  } catch {
    // ignore
  }
}

function layoutActiveView() {
  if (!mainWindow || !activeServiceId || locked) return;
  // Full-screen overlays hide the guest; drawer/menu keep it visible with inset.
  if (overlayOpen && overlayMode === 'full') return;
  if (mainWindow.isDestroyed()) return;
  const entry = views.get(activeServiceId);
  if (!entry?.view) return;

  const [width, height] = mainWindow.getContentSize();
  const m = effectiveMetrics();
  const left = (m.left || 0) + (overlayLeftInset || 0);
  const right = (m.right || 0) + (overlayRightInset || 0);
  // Always keep a floor under the measured bar so the guest never covers chrome.
  const top = Math.max(64, m.top || 0);
  const next = {
    x: Math.max(0, left),
    y: top,
    width: Math.max(1, width - left - right),
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
    if (typeof entry.view.setVisible === 'function') {
      entry.view.setVisible(true);
    }
    entry.view.setBounds(next);
    entry.__parked = false;
  } catch {
    // ignore
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let guestRepaintTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let guestRepaintTimer2 = null;
let guestNeedsRepaint = false;

function activeGuestTargetBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const [width, height] = mainWindow.getContentSize();
  if (width < 2 || height < 2) return null;
  const m = effectiveMetrics();
  const left = (m.left || 0) + (overlayLeftInset || 0);
  const right = (m.right || 0) + (overlayRightInset || 0);
  const top = Math.max(64, m.top || 0);
  return {
    x: Math.max(0, left),
    y: top,
    width: Math.max(1, width - left - right),
    height: Math.max(1, height - top),
  };
}

/**
 * Linux Mint XFCE/Cinnamon: WebContentsView often stays blank after alt-tab
 * until a real resize. Force a two-step setBounds across event-loop turns so
 * Chromium submits a fresh compositor frame (clicking into the app "fixed" it).
 */
function repaintActiveGuestView({ reason = 'focus' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || locked) return;
  if (overlayOpen && overlayMode === 'full') return;
  if (!activeServiceId) return;
  const entry = views.get(activeServiceId);
  if (!entry?.view) return;

  const target = activeGuestTargetBounds();
  if (!target) return;

  try {
    attachGuestView(entry.view);
  } catch {
    // ignore
  }

  if (guestRepaintTimer) {
    clearTimeout(guestRepaintTimer);
    guestRepaintTimer = null;
  }
  if (guestRepaintTimer2) {
    clearTimeout(guestRepaintTimer2);
    guestRepaintTimer2 = null;
  }

  const serviceId = activeServiceId;
  try {
    if (typeof entry.view.setVisible === 'function') {
      entry.view.setVisible(true);
    }
    // Step 1 — nudge by 1px (must differ from final bounds).
    const nudge = {
      ...target,
      height: Math.max(1, target.height - 1),
    };
    entry.view.setBounds(nudge);
    entry.__lastBounds = nudge;
    entry.__parked = false;
  } catch {
    // ignore
  }

  guestRepaintTimer = setTimeout(() => {
    guestRepaintTimer = null;
    if (!mainWindow || mainWindow.isDestroyed() || locked) return;
    if (activeServiceId !== serviceId) return;
    if (overlayOpen && overlayMode === 'full') return;
    const live = views.get(serviceId);
    if (!live?.view) return;
    const finalBounds = activeGuestTargetBounds() || target;
    try {
      if (typeof live.view.setVisible === 'function') {
        live.view.setVisible(true);
      }
      live.view.setBounds(finalBounds);
      live.__lastBounds = finalBounds;
      live.__parked = false;
      const wc = live.view.webContents;
      if (wc && !wc.isDestroyed()) {
        try {
          wc.invalidate?.();
        } catch {
          // ignore
        }
        applyGuestPerfMode(wc, {
          active: true,
          loadedOnce: live.loadedOnce === true,
          keepWarm: isKeepWarmService(serviceId),
          allowThrottle: true,
        });
      }
    } catch {
      // ignore
    }
    guestNeedsRepaint = false;
  }, 48);

  // XFCE sometimes settles focus a beat later — one more real layout pass.
  guestRepaintTimer2 = setTimeout(() => {
    guestRepaintTimer2 = null;
    if (!mainWindow || mainWindow.isDestroyed() || locked) return;
    if (activeServiceId !== serviceId) return;
    const live = views.get(serviceId);
    if (!live?.view) return;
    live.__lastBounds = null;
    layoutActiveView();
    focusActiveContents();
  }, 160);

  try {
    logBreadcrumb('guest-repaint', { reason, serviceId });
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

/**
 * Guest views paint above dock HTML.
 * - full: hide guest (lock / centered dialogs)
 * - drawer: keep guest visible, shrink from the right (Settings / Edit / Profiles)
 * - menu: keep guest visible, optional left/right inset for floating menus
 */
function setOverlayOpen(open, options = {}) {
  const next = !!open;
  const mode = next
    ? options.mode === 'drawer' || options.mode === 'menu'
      ? options.mode
      : 'full'
    : null;
  const rightInset =
    next && (mode === 'drawer' || mode === 'menu')
      ? Math.max(0, Number(options.rightInset) || (mode === 'drawer' ? 440 : 0))
      : 0;
  const leftInset =
    next && (mode === 'drawer' || mode === 'menu')
      ? Math.max(0, Number(options.leftInset) || 0)
      : 0;

  if (
    next === overlayOpen &&
    mode === overlayMode &&
    rightInset === overlayRightInset &&
    leftInset === overlayLeftInset
  ) {
    return;
  }

  overlayOpen = next;
  overlayMode = mode;
  overlayRightInset = rightInset;
  overlayLeftInset = leftInset;
  if (!mainWindow) return;

  if (overlayOpen && overlayMode === 'full') {
    detachAllViews();
    syncAllGuestPerfModes();
    return;
  }

  if (locked || !activeServiceId) {
    syncAllGuestPerfModes();
    return;
  }

  const entry = views.get(activeServiceId);
  if (!entry) {
    syncAllGuestPerfModes();
    return;
  }

  parkBackgroundViews(activeServiceId);
  attachGuestView(entry.view);
  entry.__lastBounds = null;
  layoutActiveView();
  if (!overlayOpen) focusActiveContents();
  syncAllGuestPerfModes();
}

function hideViewsForLock() {
  detachAllViews();
}

function closeAppContextMenu() {
  appMenuServiceId = null;
  if (!appMenuWindow || appMenuWindow.isDestroyed()) {
    appMenuWindow = null;
    return;
  }
  const win = appMenuWindow;
  appMenuWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
}

function closeChromeMenuWindow() {
  if (!chromeMenuWindow || chromeMenuWindow.isDestroyed()) {
    chromeMenuWindow = null;
    return;
  }
  const win = chromeMenuWindow;
  chromeMenuWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
}

function closeNotifCenterWindow() {
  if (!notifCenterWindow || notifCenterWindow.isDestroyed()) {
    notifCenterWindow = null;
    return;
  }
  const win = notifCenterWindow;
  notifCenterWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
}

function closeAiResultWindow() {
  aiResultContext = null;
  if (!aiResultWindow || aiResultWindow.isDestroyed()) {
    aiResultWindow = null;
    return;
  }
  const win = aiResultWindow;
  aiResultWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
}

function closeExtensionsWindow() {
  if (!extensionsWindow || extensionsWindow.isDestroyed()) {
    extensionsWindow = null;
    return;
  }
  const win = extensionsWindow;
  extensionsWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
}

function closeForwardPickerWindow() {
  if (!forwardPickerWindow || forwardPickerWindow.isDestroyed()) {
    forwardPickerWindow = null;
    return;
  }
  const win = forwardPickerWindow;
  forwardPickerWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
}

function closeAllFloatMenus() {
  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeAiResultWindow();
  closeForwardPickerWindow();
  closeExtensionsWindow();
}

function clampFloatPosition(screenX, screenY, menuW, menuH) {
  const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
  const wa = display.workArea;
  let x = screenX;
  let y = screenY;
  if (x + menuW > wa.x + wa.width - 8) x = wa.x + wa.width - menuW - 8;
  if (y + menuH > wa.y + wa.height - 8) y = wa.y + wa.height - menuH - 8;
  if (x < wa.x + 8) x = wa.x + 8;
  if (y < wa.y + 8) y = wa.y + 8;
  return { x: Math.round(x), y: Math.round(y) };
}

/** Linux Mint XFCE (and similar) without a compositor paint transparent windows badly. */
function linuxUsesOpaqueOverlays() {
  if (process.platform !== 'linux') return false;
  const de = `${process.env.XDG_CURRENT_DESKTOP || ''} ${process.env.DESKTOP_SESSION || ''} ${process.env.GDMSESSION || ''}`.toLowerCase();
  return (
    de.includes('xfce') ||
    de.includes('xubuntu') ||
    de.includes('lxde') ||
    de.includes('lxqt') ||
    de.includes('openbox')
  );
}

function createFloatBrowserWindow({
  width,
  height,
  x,
  y,
  preload,
  dark = false,
}) {
  const opaque = linuxUsesOpaqueOverlays();
  const win = new BrowserWindow({
    parent: mainWindow,
    modal: false,
    frame: false,
    // Cinnamon: transparent overlays are fine. XFCE: prefer opaque to avoid black/blank menus.
    transparent: !opaque,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    width,
    height,
    x,
    y,
    backgroundColor: opaque ? (dark ? '#111827' : '#ffffff') : '#00000000',
    hasShadow: !opaque,
    webPreferences: {
      preload: path.join(__dirname, preload),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  return win;
}

/**
 * Rambox-style: float the HTML app menu above the guest without resizing it.
 * In-page HTML cannot paint over WebContentsView, so use a frameless child window.
 */
function openAppContextMenu({ serviceId, x = 0, y = 0, dark = false } = {}) {
  const service = getService(serviceId);
  if (!service || !mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeAppContextMenu();

  const menuW = 236;
  const menuH = 292;
  const content = mainWindow.getContentBounds();
  const pos = clampFloatPosition(
    content.x + (Number(x) || 0),
    content.y + (Number(y) || 0),
    menuW,
    menuH,
  );

  appMenuServiceId = serviceId;
  appMenuWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'appMenuPreload.js',
    dark: !!dark,
  });

  const win = appMenuWindow;
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildAppMenuHtml(!!dark))}`,
  );

  const pushState = () => {
    if (!win || win.isDestroyed() || appMenuServiceId !== serviceId) return;
    const latest = getAppConfig(serviceId);
    win.webContents.send('app-menu:init', {
      serviceId,
      name: service.name || service.defaultName || 'App',
      enabled: latest.enabled !== false,
      sound: latest.allowSounds !== false,
      notifications: latest.allowNotifications !== false,
      warm: latest.keepWarm === true,
    });
  };

  win.webContents.once('did-finish-load', pushState);
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  win.on('blur', () => {
    setTimeout(() => {
      if (appMenuWindow === win) closeAppContextMenu();
    }, 120);
  });
  win.on('closed', () => {
    if (appMenuWindow === win) {
      appMenuWindow = null;
      appMenuServiceId = null;
    }
  });

  return { ok: true };
}

function openChromeMenuWindow({ x = 0, y = 0, dark = false, align = 'right' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeAppContextMenu();
  closeNotifCenterWindow();
  closeChromeMenuWindow();

  const menuW = 234;
  const menuH = 680;
  const content = mainWindow.getContentBounds();
  const anchorX = content.x + (Number(x) || 0);
  const anchorY = content.y + (Number(y) || 0);
  const rawX = align === 'right' ? anchorX - menuW : anchorX;
  const pos = clampFloatPosition(rawX, anchorY, menuW, menuH);

  chromeMenuWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'chromeMenuPreload.js',
    dark: !!dark,
  });

  const win = chromeMenuWindow;
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildChromeMenuHtml(!!dark))}`,
  );

  const versionLabel = `Aspera Hub ${app.getVersion()}${app.isPackaged ? '' : ' (dev)'}`;
  win.webContents.once('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('chrome-menu:init', {
        versionLabel,
        focusMode: !!settings.focusMode,
        muted: !!settings.muted,
      });
    }
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  win.on('blur', () => {
    setTimeout(() => {
      if (chromeMenuWindow === win) closeChromeMenuWindow();
    }, 120);
  });
  win.on('closed', () => {
    if (chromeMenuWindow === win) chromeMenuWindow = null;
  });

  return { ok: true };
}

function buildNotifCenterData() {
  const notifications = (notificationLog || []).slice(0, 40).map((item) => {
    const service = getService(item.serviceId);
    return {
      serviceId: item.serviceId,
      title: item.title,
      body: item.body,
      at: item.at,
      logo: service?.logo || null,
      color: service?.color || '#e2e8f0',
    };
  });
  const monitorOn = !!settings.consumptionMonitor;
  const memoryRows = monitorOn
    ? (settings.serviceInstances || [])
        .map((service) => ({
          name: service.name || service.defaultName || 'App',
          mb: Number(appMemory?.[service.id]) || 0,
        }))
        .filter((row) => row.mb > 0)
        .sort((a, b) => b.mb - a.mb)
    : [];
  return { notifications, monitorOn, memoryRows };
}

function pushNotifCenterData() {
  if (!notifCenterWindow || notifCenterWindow.isDestroyed()) return;
  try {
    notifCenterWindow.webContents.send('notif-center:init', buildNotifCenterData());
  } catch {
    // ignore
  }
}

function openNotifCenterWindow({ x = 0, y = 0, dark = false, align = 'right' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();

  const menuW = 356;
  const menuH = 540;
  const content = mainWindow.getContentBounds();
  const anchorX = content.x + (Number(x) || 0);
  const anchorY = content.y + (Number(y) || 0);
  const rawX = align === 'right' ? anchorX - menuW : anchorX;
  const pos = clampFloatPosition(rawX, anchorY, menuW, menuH);

  notifCenterWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'notifCenterPreload.js',
    dark: !!dark,
  });

  const win = notifCenterWindow;
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildNotifCenterHtml(!!dark))}`,
  );

  win.webContents.once('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('notif-center:init', buildNotifCenterData());
    }
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  win.on('blur', () => {
    setTimeout(() => {
      if (notifCenterWindow === win) closeNotifCenterWindow();
    }, 120);
  });
  win.on('closed', () => {
    if (notifCenterWindow === win) notifCenterWindow = null;
  });

  return { ok: true };
}

function pushAiResult(payload) {
  if (!aiResultWindow || aiResultWindow.isDestroyed()) return;
  try {
    aiResultWindow.webContents.send('ai-result:init', payload);
  } catch {
    // ignore
  }
}

function openAiResultWindow({ title, meta, dark = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeAiResultWindow();

  const content = mainWindow.getContentBounds();
  const margin = 10;
  // Use nearly the full guest/workspace height so long EN/HI/MR text is readable.
  const menuW = Math.min(
    580,
    Math.max(440, Math.floor(content.width * 0.45)),
  );
  const menuH = Math.max(360, content.height - margin * 2);
  const pos = clampFloatPosition(
    content.x + content.width - menuW - margin,
    content.y + margin,
    menuW,
    menuH,
  );

  aiResultWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'aiResultPreload.js',
    dark: !!dark,
  });

  const win = aiResultWindow;
  attachAiResultContextMenu(win.webContents);
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildAiResultHtml(!!dark))}`,
  );
  win.webContents.once('did-finish-load', () => {
    pushAiResult({
      title: title || 'Aspera AI',
      meta: meta || '',
      loading: true,
      text: 'Working…',
    });
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  // Keep the panel open while reading — do not auto-close on blur.
  win.on('closed', () => {
    if (aiResultWindow === win) {
      aiResultWindow = null;
      aiResultContext = null;
    }
  });
  return { ok: true };
}

/** Right-click Copy / Select all inside the floating AI result panel. */
function attachAiResultContextMenu(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents.on('context-menu', (_event, params) => {
    if (webContents.isDestroyed()) return;
    const hasSelection = Boolean(params.selectionText);
    /** @type {Electron.MenuItemConstructorOptions[]} */
    const template = [
      {
        label: 'Copy',
        role: 'copy',
        enabled: hasSelection,
      },
      {
        label: 'Copy all',
        click: () => {
          const text = [
            aiResultContext?.summaryText,
            aiResultContext?.repliesText,
          ]
            .filter(Boolean)
            .join('\n\n—\n\n');
          if (text) clipboard.writeText(text);
        },
        enabled: Boolean(
          aiResultContext?.summaryText || aiResultContext?.repliesText,
        ),
      },
      { type: 'separator' },
      { label: 'Select all', role: 'selectAll' },
    ];
    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(webContents) || undefined,
    });
  });
}

function aiProvidersForUi() {
  return listConfiguredAiProviders().map((p) => {
    const selectedModel = getProviderModelPreference(settings, p.id);
    const availableModels =
      getCachedAiModels(p.id) || catalogModelsForProvider(p.id);
    return {
      ...p,
      selectedModel,
      availableModels,
      modelsLive: Boolean(getCachedAiModels(p.id)?.length),
    };
  });
}

async function refreshAiProviderModels(providerId, { force = true } = {}) {
  const id = String(providerId || '').trim();
  if (!id) return { ok: false, error: 'Unknown provider' };
  const apiKey = getAiProviderKey(id);
  if (!apiKey) {
    return {
      ok: false,
      providerId: id,
      models: catalogModelsForProvider(id),
      source: 'catalog',
      error: 'No API key saved',
    };
  }
  if (force) invalidateAiModelCache(id);
  return listAiProviderModels(id, apiKey, { force });
}

function setAiProviderModelPreference(providerId, modelId) {
  const id = String(providerId || '').trim();
  if (!AI_PROVIDERS.some((p) => p.id === id)) {
    return { ok: false, error: 'Unknown AI provider' };
  }
  const choice = normalizeProviderModelChoice(modelId);
  const nextMap = {
    ...(settings.aiProviderModels && typeof settings.aiProviderModels === 'object'
      ? settings.aiProviderModels
      : {}),
    [id]: choice,
  };
  settings = saveSettings({
    aiProviderModels: nextMap,
    // Keep legacy field in sync for the preferred/sticky provider.
    aiModel:
      id === (settings.aiProvider || 'gemini')
        ? choice === 'auto'
          ? ''
          : choice
        : settings.aiModel,
  });
  return { ok: true, providerId: id, model: choice };
}

function aiSettingsSnapshot() {
  const language = ['en', 'hi', 'mr'].includes(settings.aiLanguage)
    ? settings.aiLanguage
    : 'en';
  const configured = listConfiguredAiProviders()
    .filter((p) => p.configured)
    .map((p) => p.id);
  const order = configuredProvidersInRouteOrder(configured);
  const sticky = getStickyAiProviderId();
  const provider =
    (sticky && order.find((p) => p.id === sticky)) ||
    order[0] ||
    getAiProvider(settings.aiProvider || 'gemini');
  let model = String(
    getProviderModelPreference(settings, provider.id) === 'auto'
      ? ''
      : getProviderModelPreference(settings, provider.id),
  ).trim();
  if (provider.id === 'openrouter' && (!model || model === 'openrouter/free')) {
    model = provider.defaultModel;
  }
  if (provider.id === 'anthropic') {
    model = normalizeAnthropicModel(model || provider.defaultModel);
  }
  if (provider.id === 'gemini') {
    model = normalizeGeminiModel(model || provider.defaultModel);
  }
  if (provider.id === 'grok') {
    model = normalizeGrokModel(model || provider.defaultModel);
  }
  if (!model) model = provider.defaultModel;
  return { provider, model, language, routeOrder: order, stickyId: sticky };
}

/**
 * Keep settings.aiProvider aligned with sticky / first available (Gemini first).
 */
function syncPreferredAiProvider() {
  const configured = listConfiguredAiProviders()
    .filter((p) => p.configured)
    .map((p) => p.id);
  const order = configuredProvidersInRouteOrder(configured);
  const sticky = getStickyAiProviderId();
  const nextId =
    (sticky && configured.includes(sticky) && sticky) ||
    order[0]?.id ||
    'gemini';
  if (nextId !== settings.aiProvider) {
    settings = saveSettings({ aiProvider: nextId });
  }
  return nextId;
}

function collectCatchUpItems() {
  const services = orderedServices().filter((s) => isAiAllowedAppId(s.appId));
  const byId = new Map(services.map((s) => [s.id, s]));
  const items = [];

  for (const note of notificationLog || []) {
    const service = byId.get(note.serviceId);
    if (!service) continue;
    items.push({
      appId: service.appId,
      appName: service.name || service.defaultName || service.appId,
      unread: unreadCounts.get(service.id) || 0,
      title: note.title || '',
      body: settings.hideNotificationContent ? '' : note.body || '',
      at: note.at || 0,
    });
  }

  for (const service of services) {
    const unread = unreadCounts.get(service.id) || 0;
    if (unread <= 0) continue;
    if (items.some((i) => i.appId === service.appId && i.unread === unread)) continue;
    items.push({
      appId: service.appId,
      appName: service.name || service.defaultName || service.appId,
      unread,
      title: `${unread} unread`,
      body: '',
      at: Date.now(),
    });
  }

  return items.slice(0, 30);
}

async function getActiveSelectionText() {
  if (!activeServiceId) return '';
  const entry = views.get(activeServiceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) return '';
  try {
    const text = await wc.executeJavaScript(
      `(() => {
        try { return String(window.getSelection?.()?.toString() || ''); }
        catch (e) { return ''; }
      })()`,
      true,
    );
    return String(text || '').trim();
  } catch {
    return '';
  }
}

/** Mark the focused/selected compose field so refined text can be put back later. */
async function markActiveComposeTarget(serviceId = activeServiceId) {
  if (!serviceId) return false;
  const entry = views.get(serviceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  try {
    return !!(await wc.executeJavaScript(
      `(() => {
        try {
          const mark = (target) => {
            document.querySelectorAll('[data-aspera-ai-compose]').forEach((n) => {
              if (n !== target) n.removeAttribute('data-aspera-ai-compose');
            });
            target.setAttribute('data-aspera-ai-compose', '1');
            return true;
          };
          const isCompose = (node) => {
            if (!node) return false;
            const tag = String(node.tagName || '');
            const inputOk =
              tag === 'TEXTAREA' ||
              (tag === 'INPUT' &&
                /^(text|search|email|tel|url|password)?$/i.test(node.type || 'text'));
            return !!(node.isContentEditable || inputOk);
          };
          const sel = window.getSelection?.();
          let node = sel?.anchorNode || null;
          let el = node && node.nodeType === 3 ? node.parentElement : node;
          while (el && el !== document.documentElement) {
            if (isCompose(el)) return mark(el);
            el = el.parentElement;
          }
          const active = document.activeElement;
          if (isCompose(active)) return mark(active);
          // Keep a previous mark when the AI panel stole focus (Refine again).
          if (document.querySelector('[data-aspera-ai-compose="1"]')) return true;
        } catch (e) {}
        return false;
      })()`,
      true,
    ));
  } catch {
    return false;
  }
}

async function applyTextToMarkedCompose(serviceId, text, originalText) {
  if (!serviceId) return { ok: false, error: 'No chat app selected.' };
  const entry = views.get(serviceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    return { ok: false, error: 'Chat view is gone.' };
  }
  const refined = String(text || '');
  const original = String(originalText || '');
  if (!refined.trim()) {
    return { ok: false, error: 'Nothing to insert.' };
  }
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
    wc.focus();
    const result = await wc.executeJavaScript(
      `(() => {
        const text = ${JSON.stringify(refined)};
        const original = ${JSON.stringify(original)};
        const el = document.querySelector('[data-aspera-ai-compose="1"]');
        if (!el) return { ok: false, reason: 'no-target' };
        el.focus();
        const tag = String(el.tagName || '');
        if (tag === 'TEXTAREA' || tag === 'INPUT') {
          const value = String(el.value || '');
          if (original && value.includes(original)) {
            const i = value.indexOf(original);
            el.value = value.slice(0, i) + text + value.slice(i + original.length);
          } else {
            el.value = text;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { ok: true };
        }
        if (el.isContentEditable) {
          const current = String(el.innerText || el.textContent || '');
          const sel = window.getSelection?.();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel?.removeAllRanges?.();
          sel?.addRange?.(range);
          if (original && current.includes(original) && current.trim() !== original.trim()) {
            // Replace only the original draft substring when the box has more text.
            const next = current.replace(original, text);
            el.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, next);
            return { ok: true };
          }
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, text);
          return { ok: true };
        }
        return { ok: false, reason: 'not-editable' };
      })()`,
      true,
    );
    if (result?.ok) return { ok: true };
    return {
      ok: false,
      error:
        'Could not find the send box. Text was copied — paste with Ctrl+V.',
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function activeAiService() {
  if (!activeServiceId) return null;
  const service = getService(activeServiceId);
  if (!service || !isAiAllowedAppId(service.appId)) return null;
  return service;
}

function asperaAiSkillTitle(skill) {
  if (skill === 'catch-up') return 'Catch me up';
  if (skill === 'refine') return 'Refine draft';
  return 'Summarize selection';
}

function cleanAiPlainText(text) {
  return String(text || '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

async function runAsperaAiSkill(skill, { selectionText = '', dark = false } = {}) {
  if (settings.aiEnabled === false) {
    return { ok: false, error: 'Aspera AI is turned off in Settings.' };
  }

  const { language, routeOrder } = aiSettingsSnapshot();
  if (!routeOrder.length) {
    mainWindow?.webContents.send('dock:chrome-action', 'settings');
    return {
      ok: false,
      error:
        'Add at least one AI API key in Settings → Aspera AI (Gemini recommended for speed).',
    };
  }

  const langLabel =
    AI_LANGUAGES.find((l) => l.id === language)?.label || 'English';
  const skillTitle = asperaAiSkillTitle(skill);
  const routeHint = routeOrder.map((p) => p.name).join(' → ');
  const metaLang = skill === 'summarize' ? 'EN · HI · MR' : langLabel;

  openAiResultWindow({
    title: `Aspera AI · ${skillTitle}`,
    meta: `Auto · ${routeHint} · ${metaLang}`,
    dark,
  });

  try {
    let prompt;
    let summarizeSelection = '';
    let summarizeAppName = '';
    let refineSelection = '';
    let refineAppName = '';
    let refineServiceId = '';
    let refineHasComposeTarget = false;
    if (skill === 'catch-up') {
      const items = collectCatchUpItems();
      prompt = promptForSkill('catch-up', { items, language });
    } else if (skill === 'summarize') {
      const service = activeAiService();
      if (!service) {
        throw new Error(
          'Summarize works only in WhatsApp, Arattai, Gmail, or Zoho Mail. Open one of those apps first.',
        );
      }
      const text = String(selectionText || (await getActiveSelectionText()) || '').trim();
      if (!text) {
        throw new Error('Select text in the app first, then run Summarize.');
      }
      summarizeSelection = text;
      summarizeAppName = service.name || service.defaultName || service.appId;
      prompt = promptForSkill('summarize', {
        text,
        appName: summarizeAppName,
      });
    } else if (skill === 'refine') {
      const service = activeAiService();
      if (!service) {
        throw new Error(
          'Refine works only in WhatsApp, Arattai, Gmail, or Zoho Mail. Open one of those apps first.',
        );
      }
      refineServiceId = service.id;
      refineHasComposeTarget = await markActiveComposeTarget(service.id);
      const text = String(selectionText || (await getActiveSelectionText()) || '').trim();
      if (!text) {
        throw new Error(
          'Select the text in the send box first, then choose Refine with Aspera AI.',
        );
      }
      refineSelection = text;
      refineAppName = service.name || service.defaultName || service.appId;
      prompt = promptForSkill('refine', {
        text,
        appName: refineAppName,
      });
    } else {
      throw new Error('Unknown skill');
    }

    const result = await runAiCompletionWithFailover(prompt);
    syncPreferredAiProvider();
    const resultText =
      skill === 'refine' ? cleanAiPlainText(result.text) : result.text;
    if (skill === 'summarize') {
      aiResultContext = {
        skill: 'summarize',
        selectionText: summarizeSelection,
        appName: summarizeAppName,
        dark: !!dark,
        summaryText: resultText,
        providerName: result.providerName,
        model: result.model,
      };
    } else if (skill === 'refine') {
      aiResultContext = {
        skill: 'refine',
        selectionText: refineSelection,
        originalComposeText: refineSelection,
        appName: refineAppName,
        serviceId: refineServiceId,
        hasComposeTarget: refineHasComposeTarget,
        dark: !!dark,
        refinedText: resultText,
        providerName: result.providerName,
        model: result.model,
      };
    } else {
      aiResultContext = null;
    }
    pushAiResult({
      title: `Aspera AI · ${skillTitle}`,
      meta: `${result.providerName} · ${result.model} · ${metaLang}`,
      text: resultText,
      loading: false,
      mode: skill === 'refine' ? 'refine' : skill === 'summarize' ? 'summarize' : 'catch-up',
      showTrilingual: skill === 'summarize',
      canSuggestReply: skill === 'summarize',
      canUseInCompose: skill === 'refine',
      canRefineAgain: skill === 'refine',
      repliesText: '',
      repliesLoading: false,
    });
    return {
      ok: true,
      text: resultText,
      provider: result.providerId,
      model: result.model,
    };
  } catch (error) {
    const message = String(error?.message || error);
    aiResultContext = null;
    pushAiResult({
      title: `Aspera AI · ${skillTitle}`,
      meta: `Auto · ${routeHint} · ${metaLang}`,
      error: message,
      text: message,
      loading: false,
      mode: skill === 'refine' ? 'refine' : undefined,
      canSuggestReply: false,
      canUseInCompose: false,
      canRefineAgain: false,
    });
    return { ok: false, error: message };
  }
}

async function runRefineAgainFromAiResult(payload = {}) {
  const ctx = aiResultContext;
  if (!ctx || ctx.skill !== 'refine') {
    return { ok: false, error: 'No draft to refine.' };
  }
  const draft = String(payload?.text || ctx.refinedText || ctx.selectionText || '').trim();
  if (!draft) {
    return { ok: false, error: 'Nothing to refine.' };
  }
  const originalComposeText = ctx.originalComposeText || ctx.selectionText || '';
  const serviceId = ctx.serviceId || activeServiceId;
  const result = await runAsperaAiSkill('refine', {
    selectionText: draft,
    dark: !!ctx.dark,
  });
  // Keep the send-box original so "Use in send box" still matches the typed draft.
  if (result?.ok && aiResultContext?.skill === 'refine') {
    aiResultContext = {
      ...aiResultContext,
      originalComposeText,
      selectionText: originalComposeText || aiResultContext.selectionText,
      serviceId: serviceId || aiResultContext.serviceId,
    };
  }
  return result;
}

async function runUseRefinedInCompose(payload = {}) {
  const ctx = aiResultContext;
  if (!ctx || ctx.skill !== 'refine') {
    return { ok: false, error: 'No refined draft available.' };
  }
  const text = String(payload?.text || ctx.refinedText || '').trim();
  if (!text) {
    return { ok: false, error: 'Nothing to insert.' };
  }
  ctx.refinedText = text;
  const applied = await applyTextToMarkedCompose(
    ctx.serviceId || activeServiceId,
    text,
    ctx.originalComposeText || ctx.selectionText || '',
  );
  if (applied.ok) {
    closeAiResultWindow();
    return { ok: true };
  }
  clipboard.writeText(text);
  return {
    ok: false,
    copied: true,
    error:
      applied.error ||
      'Could not find the send box. Text was copied — paste with Ctrl+V.',
  };
}

async function runSuggestRepliesFromAiResult() {
  if (settings.aiEnabled === false) {
    return { ok: false, error: 'Aspera AI is turned off in Settings.' };
  }
  const ctx = aiResultContext;
  if (!ctx?.selectionText) {
    return { ok: false, error: 'No message context for reply suggestions.' };
  }
  const { routeOrder } = aiSettingsSnapshot();
  if (!routeOrder.length) {
    return {
      ok: false,
      error: 'Add at least one AI API key in Settings → Aspera AI.',
    };
  }

  pushAiResult({
    title: 'Aspera AI · Summarize selection',
    meta: [ctx.providerName, ctx.model, 'EN · HI · MR'].filter(Boolean).join(' · '),
    text: ctx.summaryText || '',
    loading: false,
    showTrilingual: true,
    canSuggestReply: true,
    repliesLoading: true,
    repliesText: '',
  });

  try {
    const prompt = promptForSkill('suggest-reply', {
      text: ctx.selectionText,
      appName: ctx.appName,
    });
    const result = await runAiCompletionWithFailover(prompt);
    syncPreferredAiProvider();
    const repliesSections = parseSuggestedReplies(result.text);
    aiResultContext = {
      ...ctx,
      repliesText: result.text,
      providerName: result.providerName,
      model: result.model,
    };
    pushAiResult({
      title: 'Aspera AI · Summarize selection',
      meta: `${result.providerName} · ${result.model} · EN · HI · MR`,
      text: ctx.summaryText || '',
      loading: false,
      showTrilingual: true,
      canSuggestReply: true,
      repliesLoading: false,
      repliesText: result.text,
      repliesSections,
    });
    return { ok: true, text: result.text };
  } catch (error) {
    const message = String(error?.message || error);
    pushAiResult({
      title: 'Aspera AI · Summarize selection',
      meta: 'EN · HI · MR',
      text: ctx.summaryText || '',
      loading: false,
      showTrilingual: true,
      canSuggestReply: true,
      repliesLoading: false,
      repliesError: message,
    });
    return { ok: false, error: message };
  }
}

async function runReviseReplyFromAiResult(payload = {}) {
  if (settings.aiEnabled === false) {
    return { ok: false, error: 'Aspera AI is turned off in Settings.' };
  }
  const ctx = aiResultContext;
  if (!ctx?.selectionText) {
    return { ok: false, error: 'No message context for reply revision.' };
  }
  const { routeOrder } = aiSettingsSnapshot();
  if (!routeOrder.length) {
    return {
      ok: false,
      error: 'Add at least one AI API key in Settings → Aspera AI.',
    };
  }
  const replyText = String(payload?.replyText || '').trim();
  if (!replyText) {
    return { ok: false, error: 'Type a reply first, then Revise with AI.' };
  }
  try {
    const prompt = promptForSkill('revise-reply', {
      replyText,
      language: payload?.language || 'en',
      selectionText: ctx.selectionText,
      appName: ctx.appName,
    });
    const result = await runAiCompletionWithFailover(prompt);
    syncPreferredAiProvider();
    const revised = String(result.text || '')
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .trim();
    return { ok: true, text: revised || result.text };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function handleAppMenuAction(type, value) {
  const id = appMenuServiceId;
  if (!id || !getService(id)) return { ok: false };

  if (type === 'home') {
    const entry = views.get(id);
    const service = getService(id);
    if (entry?.view?.webContents && !entry.view.webContents.isDestroyed()) {
      const home = startUrlForService(service) || service.url;
      if (home) entry.view.webContents.loadURL(home).catch(() => {});
    }
    closeAppContextMenu();
    return { ok: true };
  }
  if (type === 'reload') {
    const entry = views.get(id);
    if (entry?.view?.webContents && !entry.view.webContents.isDestroyed()) {
      entry.view.webContents.reload();
    }
    return { ok: true };
  }
  if (type === 'edit') {
    closeAppContextMenu();
    mainWindow?.webContents.send('dock:open-edit-app', id);
    return { ok: true };
  }
  if (type === 'enabled') {
    saveAppConfig(id, { enabled: !!value });
    broadcastState();
    if (!value && id === activeServiceId) {
      // Stay on tab but guest may show disabled — mirror existing save path.
    }
    return { ok: true };
  }
  if (type === 'sound') {
    saveAppConfig(id, { allowSounds: !!value });
    broadcastState();
    return { ok: true };
  }
  if (type === 'notifications') {
    saveAppConfig(id, { allowNotifications: !!value });
    broadcastState();
    return { ok: true };
  }
  if (type === 'warm') {
    const want = !!value;
    const have = isKeepWarmService(id);
    const result =
      want === have ? { ok: true, keepWarm: have } : toggleKeepWarm(id);
    if (appMenuWindow && !appMenuWindow.isDestroyed()) {
      const latest = getAppConfig(id);
      const svc = getService(id);
      appMenuWindow.webContents.send('app-menu:init', {
        serviceId: id,
        name: svc?.name || svc?.defaultName || 'App',
        enabled: latest.enabled !== false,
        sound: latest.allowSounds !== false,
        notifications: latest.allowNotifications !== false,
        warm: latest.keepWarm === true,
      });
    }
    return result;
  }
  return { ok: false };
}

function handleChromeMenuAction(type) {
  closeChromeMenuWindow();
  if (!type) return { ok: false };

  if (type === 'catch-up') {
    const dark = false;
    runAsperaAiSkill('catch-up', { dark }).catch(() => {});
    return { ok: true };
  }
  if (type === 'summarize') {
    runAsperaAiSkill('summarize', { dark: false }).catch(() => {});
    return { ok: true };
  }
  if (type === 'ai-settings') {
    mainWindow?.webContents.send('dock:chrome-action', 'settings');
    // Renderer will scroll/focus AI section if we send a dedicated event.
    mainWindow?.webContents.send('dock:open-ai-settings');
    return { ok: true };
  }
  if (type === 'extensions') {
    openExtensionsWindow({ dark: false });
    return { ok: true };
  }
  if (type === 'search') {
    mainWindow?.webContents.send('dock:chrome-action', 'search');
    return { ok: true };
  }
  if (type === 'focus') {
    toggleFocusMode();
    return { ok: true };
  }
  if (type === 'mute') {
    toggleMute();
    return { ok: true };
  }
  if (type === 'reload') {
    if (activeServiceId) {
      const wc = views.get(activeServiceId)?.view?.webContents;
      if (wc && !wc.isDestroyed()) wc.reload();
    }
    return { ok: true };
  }
  if (type === 'home') {
    if (activeServiceId) {
      const service = getService(activeServiceId);
      const wc = views.get(activeServiceId)?.view?.webContents;
      if (service && wc && !wc.isDestroyed()) {
        const home = startUrlForService(service) || service.url;
        if (home) wc.loadURL(home).catch(() => {});
      }
    }
    return { ok: true };
  }
  if (type === 'free-ram') {
    hibernateBackground();
    broadcastState();
    return { ok: true };
  }
  if (type === 'about') {
    showAboutDialog();
    return { ok: true };
  }
  if (type === 'check-updates') {
    checkForUpdates({ silent: false }).catch(() => {});
    return { ok: true };
  }

  // UI drawers/modals live in the dock renderer.
  mainWindow?.webContents.send('dock:chrome-action', type);
  return { ok: true };
}

function handleNotifCenterAction(type, value) {
  if (type === 'clear') {
    notificationLog = [];
    broadcastState();
    return { ok: true };
  }
  if (type === 'read-all') {
    markAllReadWithoutNotifySpam();
    return { ok: true };
  }
  if (type === 'activate') {
    closeNotifCenterWindow();
    if (value) activateService(value);
    return { ok: true };
  }
  return { ok: false };
}

function applyFocusMode(webContents, serviceId) {
  const cfg = serviceId ? getAppConfig(serviceId) : mergeAppConfig();
  // Suppress native guest Notification (avoids Linux focus steal) but forward
  // title/body to main via a console bridge for rich OS + in-app toasts.
  const hideBody =
    settings.hideNotificationContent || cfg.hideNotificationContent
      ? 'true'
      : 'false';
  webContents
    .executeJavaScript(
      `(() => {
        window.__asperaDockHideBody = ${hideBody};
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
          try {
            const opts = options && typeof options === 'object' ? options : {};
            const payload = {
              title: String(title || ''),
              body: String(opts.body || ''),
              tag: String(opts.tag || ''),
            };
            console.log('${ASPERA_NOTIFY_PREFIX}' + JSON.stringify(payload));
          } catch (e) {}
          return {
            close() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; },
            onclick: null,
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

function firstTwoMessageLines(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return `${lines[0].slice(0, 160)}\n${lines[1].slice(0, 160)}`;
  }
  const single = lines[0] || raw;
  if (single.length <= 160) return single;
  return `${single.slice(0, 160)}\n${single.slice(160, 320)}`;
}

function notificationFingerprint(serviceId, title, body) {
  return `${serviceId}|${String(title || '').trim()}|${String(body || '').trim()}`;
}

function shouldShowNotification(serviceId, fingerprint) {
  const now = Date.now();
  const prev = recentNotificationFingerprints.get(serviceId);
  if (
    prev &&
    prev.fingerprint === fingerprint &&
    now - prev.at < NOTIFICATION_DEDUPE_MS
  ) {
    return false;
  }
  recentNotificationFingerprints.set(serviceId, { fingerprint, at: now });
  return true;
}

function logNotification(service, body, titleOverride) {
  const title = String(
    titleOverride || service.title || service.name || 'App',
  ).trim();
  notificationLog = [
    {
      id: `${service.id}-${Date.now().toString(36)}`,
      serviceId: service.id,
      title,
      body: String(body || '').trim(),
      at: Date.now(),
    },
    ...notificationLog,
  ].slice(0, NOTIFICATION_LOG_MAX);
  broadcastState();
  pushNotifCenterData();
}

/**
 * Show a rich desktop + in-app notification for a guest app.
 * Prefer intercepted page Notification payloads (sender + message).
 */
function emitServiceNotification(service, { title, body, fromTitleCount = false } = {}) {
  if (!service || settings.focusMode) return false;
  const liveCfg = getAppConfig(service.id);
  if (!liveCfg.allowNotifications) return false;
  if (service.id === activeServiceId) return false;

  const hide =
    settings.hideNotificationContent || liveCfg.hideNotificationContent;
  const sender = String(title || '').trim();
  const message = firstTwoMessageLines(body);
  const displayTitle = hide
    ? service.title || service.name || 'App'
    : sender || service.title || service.name || 'App';
  const displayBody = hide
    ? 'New notification'
    : message || (fromTitleCount ? `${body || ''}`.trim() : 'New message');

  if (!displayBody) return false;

  const fingerprint = notificationFingerprint(
    service.id,
    displayTitle,
    displayBody,
  );
  if (!shouldShowNotification(service.id, fingerprint)) return false;

  logNotification(service, displayBody, displayTitle);

  if (!Notification.isSupported()) return true;
  const n = new Notification({
    title: displayTitle,
    body: displayBody,
    silent: settings.muted || !liveCfg.allowSounds,
  });
  n.on('click', () => {
    raiseDockWindow();
    activateService(service.id);
  });
  n.show();
  return true;
}

function handleGuestNotificationBridge(service, rawMessage) {
  const text = String(rawMessage || '');
  if (!text.startsWith(ASPERA_NOTIFY_PREFIX)) return false;
  let payload = {};
  try {
    payload = JSON.parse(text.slice(ASPERA_NOTIFY_PREFIX.length));
  } catch {
    return true;
  }
  const title = String(payload?.title || '').trim();
  const body = String(payload?.body || '').trim();
  // Mark that this service delivered a rich notification recently — skip
  // the next generic title-count toast for a short window.
  const entry = views.get(service.id);
  if (entry) entry.__lastRichNotifyAt = Date.now();
  emitServiceNotification(service, { title, body, fromTitleCount: false });
  return true;
}

/** Seed unread from the live page title without firing a notification. */
function seedUnreadFromTitle(serviceId, webContents) {
  let count = 0;
  try {
    if (webContents && !webContents.isDestroyed()) {
      count = parseUnread(webContents.getTitle() || '');
    }
  } catch {
    count = 0;
  }
  unreadCounts.set(serviceId, count);
  const entry = views.get(serviceId);
  if (entry) {
    entry.__suppressTitleNotifyUntil = Date.now() + 2_500;
    entry.__titleCountBaseline = count;
  }
  return count;
}

function markAllReadWithoutNotifySpam() {
  for (const [id, entry] of views.entries()) {
    let titleCount = 0;
    try {
      titleCount = parseUnread(entry.view?.webContents?.getTitle?.() || '');
    } catch {
      titleCount = 0;
    }
    unreadCounts.set(id, 0);
    if (entry) {
      entry.__titleCountBaseline = Math.max(titleCount, 0);
      entry.__suppressTitleNotifyUntil = Date.now() + 5_000;
    }
  }
  for (const id of [...unreadCounts.keys()]) {
    if (!views.has(id)) unreadCounts.set(id, 0);
  }
  notificationLog = [];
  recentNotificationFingerprints.clear();
  refreshBadge();
  broadcastState();
  pushNotifCenterData();
}

function applyMuteState() {
  for (const [id, entry] of views.entries()) {
    const cfg = getAppConfig(id);
    entry.view.webContents.setAudioMuted(settings.muted || !cfg.allowSounds);
  }
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
  return app.isPackaged ? `Aspera Hub ${v}` : `Aspera Hub ${v} (dev)`;
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
  if (configuredPartitions.has(partitionKey)) {
    // Partition already wired — still (re)load extensions on later calls.
    syncExtensionsIntoSession(partitionSession).catch(() => {});
    return;
  }
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

  // Google sign-in: Client Hints + Firefox UA on accounts (vendor quarantine).
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
      const headers = applyGoogleRequestHeaders(
        { ...details.requestHeaders },
        details.url,
        {
          chromeUA: CHROME_USER_AGENT,
          firefoxAccountsUA: FIREFOX_ACCOUNTS_UA,
          secChUa: SEC_CH_UA,
          enabled: settings.googleSpoofEnabled !== false,
        },
      );
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

  syncExtensionsIntoSession(partitionSession).catch(() => {});
}

function getSessionExtensionsApi(partitionSession) {
  if (!partitionSession) return null;
  if (partitionSession.extensions) return partitionSession.extensions;
  // Older Electron surface on session itself.
  if (typeof partitionSession.loadExtension === 'function') {
    return partitionSession;
  }
  return null;
}

function listLoadedSessionExtensions(partitionSession) {
  const api = getSessionExtensionsApi(partitionSession);
  if (!api) return [];
  try {
    if (typeof api.getAllExtensions === 'function') {
      return api.getAllExtensions() || [];
    }
  } catch {
    // ignore
  }
  return [];
}

async function syncExtensionsIntoSession(partitionSession) {
  const api = getSessionExtensionsApi(partitionSession);
  if (!api || typeof api.loadExtension !== 'function') return;

  const catalog = listInstalledExtensions(settings.extensions);
  const enabledPaths = new Set(
    catalog.filter((e) => e.enabled && e.exists).map((e) => path.resolve(e.path)),
  );
  const root = path.join(app.getPath('userData'), 'extensions');

  for (const loaded of listLoadedSessionExtensions(partitionSession)) {
    const loadedPath = path.resolve(String(loaded.path || ''));
    const ours = loadedPath.startsWith(root + path.sep);
    if (!ours) continue;
    if (!enabledPaths.has(loadedPath)) {
      try {
        if (typeof api.removeExtension === 'function') {
          api.removeExtension(loaded.id);
        }
      } catch {
        // ignore
      }
    }
  }

  const loadedPaths = new Set(
    listLoadedSessionExtensions(partitionSession).map((e) =>
      path.resolve(String(e.path || '')),
    ),
  );

  let chromeIdChanged = false;
  const nextCatalog = catalog.map((ext) => ({ ...ext }));
  for (const ext of nextCatalog) {
    if (!ext.enabled || !ext.exists) continue;
    const abs = path.resolve(ext.path);
    if (loadedPaths.has(abs)) continue;
    try {
      const info = await api.loadExtension(abs, { allowFileAccess: true });
      if (info?.id && info.id !== ext.chromeId) {
        ext.chromeId = info.id;
        chromeIdChanged = true;
      }
    } catch (error) {
      console.warn('[extensions] load failed', ext.name, error?.message || error);
    }
  }
  if (chromeIdChanged) {
    settings = saveSettings({ extensions: nextCatalog });
  }
}

async function syncExtensionsToAllGuestSessions() {
  const partitions = new Set();
  for (const profile of settings.profiles || []) {
    if (String(profile?.partition || '').startsWith('persist:')) {
      partitions.add(String(profile.partition));
    }
  }
  for (const inst of settings.serviceInstances || []) {
    const part = partitionForInstance(inst);
    if (part) partitions.add(part);
  }
  for (const part of partitions) {
    try {
      await syncExtensionsIntoSession(session.fromPartition(part));
    } catch {
      // ignore
    }
  }
}

function reloadAllGuestViews() {
  for (const [, entry] of views.entries()) {
    const wc = entry?.view?.webContents;
    if (wc && !wc.isDestroyed()) {
      try {
        wc.reload();
      } catch {
        // ignore
      }
    }
  }
}

function buildExtensionsManagerData(error = '') {
  return {
    extensions: listInstalledExtensions(settings.extensions),
    error: String(error || ''),
  };
}

function pushExtensionsManagerData(error = '') {
  if (!extensionsWindow || extensionsWindow.isDestroyed()) return;
  try {
    extensionsWindow.webContents.send(
      'extensions:init',
      buildExtensionsManagerData(error),
    );
  } catch {
    // ignore
  }
}

function openExtensionsWindow({ dark = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeExtensionsWindow();

  const menuW = 440;
  const menuH = 580;
  const content = mainWindow.getContentBounds();
  const pos = clampFloatPosition(
    content.x + content.width - menuW - 16,
    content.y + Math.max(56, content.height * 0.1),
    menuW,
    menuH,
  );

  extensionsWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'extensionsPreload.js',
    dark: !!dark,
  });

  const win = extensionsWindow;
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildExtensionsHtml(!!dark))}`,
  );
  win.webContents.once('did-finish-load', () => {
    pushExtensionsManagerData();
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  win.on('closed', () => {
    if (extensionsWindow === win) extensionsWindow = null;
  });
  return { ok: true };
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

function serviceIdForWebContents(webContents) {
  if (!webContents) return activeServiceId;
  for (const [id, entry] of views.entries()) {
    if (entry?.view?.webContents === webContents) return id;
  }
  return activeServiceId;
}

function listForwardTargets(excludeServiceId) {
  return orderedServices().filter((service) => {
    if (!isForwardAppId(service.appId)) return false;
    if (service.id === excludeServiceId) return false;
    const cfg = getAppConfig(service.id);
    return cfg?.enabled !== false;
  });
}

function forwardTempDir() {
  const dir = path.join(app.getPath('temp'), 'asperadock-forward');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveForwardImage(image) {
  if (!image || image.isEmpty()) return '';
  try {
    const file = path.join(forwardTempDir(), `forward-${Date.now()}.png`);
    fs.writeFileSync(file, image.toPNG());
    return file;
  } catch {
    return '';
  }
}

async function captureForwardImage(webContents, params) {
  try {
    if (params?.hasImageContents) {
      webContents.copyImageAt(params.x, params.y);
      await new Promise((resolve) => setTimeout(resolve, 40));
      const fromClipboard = clipboard.readImage();
      if (fromClipboard && !fromClipboard.isEmpty()) return fromClipboard;
    }
  } catch {
    // ignore
  }
  const src = String(params?.srcURL || '');
  if (src.startsWith('data:image')) {
    try {
      const img = nativeImage.createFromDataURL(src);
      if (!img.isEmpty()) return img;
    } catch {
      // ignore
    }
  }
  return nativeImage.createEmpty();
}

async function beginForwardFromGuest(webContents, params = {}) {
  const sourceId = serviceIdForWebContents(webContents);
  const source = getService(sourceId);
  if (!source || !isForwardAppId(source.appId)) {
    return { ok: false, error: 'Forward works from WhatsApp or Arattai.' };
  }
  const targets = listForwardTargets(source.id);
  if (!targets.length) {
    const box = {
      type: 'info',
      title: 'Forward with Aspera Hub',
      message: 'Add another WhatsApp or Arattai account first.',
      detail:
        'Forward sends content to a different Hub tab. Add a second messaging account, then try again.',
      buttons: ['OK'],
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      await dialog.showMessageBox(mainWindow, box);
    } else {
      await dialog.showMessageBox(box);
    }
    return { ok: false, error: 'No target accounts.' };
  }

  const text = String(params.selectionText || '').trim();
  const linkURL = String(params.linkURL || '').trim();
  const image = await captureForwardImage(webContents, params);
  const imagePath = saveForwardImage(image);
  const hasImage = !!(imagePath || (image && !image.isEmpty()));

  if (!text && !hasImage && !linkURL) {
    return { ok: false, error: 'Select text, an image, or a link to forward.' };
  }

  forwardPayload = {
    text,
    linkURL: linkURL.startsWith('javascript:') ? '' : linkURL,
    imagePath,
    filePath: '',
    hasImage,
    sourceServiceId: source.id,
    sourceAppId: source.appId,
    sourceName: source.name || source.defaultName || source.appId,
  };

  return openForwardPickerWindow({
    dark: false,
    anchorX: params.x,
    anchorY: params.y,
    webContents,
  });
}

function openForwardPickerWindow({
  dark = false,
  anchorX = 0,
  anchorY = 0,
  webContents = null,
} = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !forwardPayload) {
    return { ok: false };
  }

  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeAiResultWindow();
  closeForwardPickerWindow();
  closeExtensionsWindow();

  const menuW = 360;
  const menuH = 420;
  const content = mainWindow.getContentBounds();
  let rawX = content.x + content.width - menuW - 16;
  let rawY = content.y + 72;
  try {
    if (webContents) {
      for (const entry of views.values()) {
        if (entry?.view?.webContents === webContents) {
          const bounds = entry.view.getBounds?.() || entry.__lastBounds;
          if (bounds) {
            rawX = content.x + (bounds.x || 0) + (Number(anchorX) || 0);
            rawY = content.y + (bounds.y || 0) + (Number(anchorY) || 0);
          }
          break;
        }
      }
    }
  } catch {
    // ignore
  }
  const pos = clampFloatPosition(rawX, rawY, menuW, menuH);

  forwardPickerWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'forwardPickerPreload.js',
    dark: !!dark,
  });

  const win = forwardPickerWindow;
  const source = getService(forwardPayload.sourceServiceId);
  const targets = listForwardTargets(forwardPayload.sourceServiceId).map((service) => {
    const profile = (settings.profiles || []).find((p) => p.id === service.profileId);
    const catalog = getAppCatalogEntry(service.appId);
    return {
      id: service.id,
      name: service.name || service.defaultName || catalog?.name || service.appId,
      appName: catalog?.name || service.appId,
      color: service.color || catalog?.color || '#64748b',
      profileName: profile?.name || '',
      logoDataUrl: '',
    };
  });

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildForwardPickerHtml(!!dark))}`,
  );
  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.webContents.send('forward-picker:init', {
      sourceLabel: source?.name || forwardPayload.sourceName || 'this chat',
      preview: describeForwardPayload({
        text: forwardPayload.text,
        hasImage: forwardPayload.hasImage,
        linkURL: forwardPayload.linkURL,
        fileName: forwardPayload.filePath
          ? path.basename(forwardPayload.filePath)
          : '',
      }),
      targets,
    });
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  win.on('blur', () => {
    setTimeout(() => {
      if (forwardPickerWindow === win) closeForwardPickerWindow();
    }, 160);
  });
  win.on('closed', () => {
    if (forwardPickerWindow === win) forwardPickerWindow = null;
  });
  return { ok: true };
}

async function stageForwardPaste(serviceId) {
  const entry = views.get(serviceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  try {
    return !!(await wc.executeJavaScript(
      `(() => {
        const focusAndPaste = (node) => {
          if (!node) return false;
          try { node.focus(); } catch (e) {}
          try {
            return document.execCommand('paste');
          } catch (e) {
            return false;
          }
        };
        const marked = document.querySelector('[data-aspera-ai-compose="1"]');
        if (focusAndPaste(marked)) return true;
        const selectors = [
          'footer [contenteditable="true"]',
          '[contenteditable="true"][role="textbox"]',
          '[contenteditable="true"][data-tab]',
          'div[contenteditable="true"]',
          'textarea',
        ];
        for (const sel of selectors) {
          const node = document.querySelector(sel);
          if (node && focusAndPaste(node)) return true;
        }
        return false;
      })()`,
      true,
    ));
  } catch {
    return false;
  }
}

async function deliverForwardToTarget(targetId) {
  const payload = forwardPayload;
  if (!payload) return { ok: false, error: 'Nothing to forward.' };
  const target = getService(targetId);
  if (!target || !isForwardAppId(target.appId)) {
    return { ok: false, error: 'Choose a WhatsApp or Arattai account.' };
  }

  const clipText = buildForwardClipboardText(payload);
  /** @type {Electron.Data} */
  const write = {};
  if (clipText) write.text = clipText;
  if (payload.imagePath && fs.existsSync(payload.imagePath)) {
    const image = nativeImage.createFromPath(payload.imagePath);
    if (!image.isEmpty()) write.image = image;
  }
  if (Object.keys(write).length) {
    try {
      clipboard.write(write);
    } catch {
      if (clipText) clipboard.writeText(clipText);
    }
  }

  closeForwardPickerWindow();
  activateService(targetId);
  await new Promise((resolve) => setTimeout(resolve, 480));
  await markActiveComposeTarget(targetId);
  const pasted = await stageForwardPaste(targetId);

  const targetName = target.name || target.defaultName || 'account';
  const detail = pasted
    ? `Staged in ${targetName}. Open the right chat if needed, then send.`
    : `Switched to ${targetName}. Open a chat and press Ctrl+V to paste.`;

  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Forward with Aspera Hub',
        body: detail,
        silent: true,
      }).show();
    }
  } catch {
    // ignore
  }

  return { ok: true, pasted };
}

/**
 * Native right-click menu for guest pages (Cut / Copy / Paste / Select All…).
 * Electron does not show Chromium's built-in menu unless we handle this event.
 */
function attachGuestContextMenu(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents.on('context-menu', (_event, params) => {
    if (webContents.isDestroyed()) return;

    /** @type {Electron.MenuItemConstructorOptions[]} */
    const template = [];

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions || []) {
        template.push({
          label: suggestion,
          click: () => webContents.replaceMisspelling(suggestion),
        });
      }
      if (params.dictionarySuggestions?.length) template.push({ type: 'separator' });
      template.push({
        label: 'Add to dictionary',
        click: () =>
          webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      template.push({ type: 'separator' });
    }

    if (params.linkURL) {
      template.push({
        label: 'Open link',
        click: () => openExternalSafe(params.linkURL),
      });
      template.push({
        label: 'Copy link address',
        click: () => clipboard.writeText(params.linkURL),
      });
      template.push({ type: 'separator' });
    }

    if (params.hasImageContents && params.srcURL) {
      template.push({
        label: 'Copy image',
        click: () => webContents.copyImageAt(params.x, params.y),
      });
      template.push({
        label: 'Copy image address',
        click: () => clipboard.writeText(params.srcURL),
      });
      template.push({
        label: 'Save image as…',
        click: () => webContents.downloadURL(params.srcURL),
      });
      template.push({ type: 'separator' });
    }

    const editable = params.isEditable;
    const hasSelection = Boolean(params.selectionText);
    const sourceServiceId = serviceIdForWebContents(webContents);
    const service = getService(sourceServiceId) || getService(activeServiceId);
    const forwardTargets = service ? listForwardTargets(service.id) : [];
    if (
      service &&
      canOfferForward({
        appId: service.appId,
        hasSelection,
        hasImage: !!params.hasImageContents,
        linkURL: params.linkURL,
        targetCount: forwardTargets.length,
      })
    ) {
      template.push({
        label: 'Forward with Aspera Hub',
        click: () => {
          beginForwardFromGuest(webContents, params).catch(() => {});
        },
      });
      template.push({ type: 'separator' });
    }

    if (
      hasSelection &&
      service &&
      isAiAllowedAppId(service.appId) &&
      settings.aiEnabled !== false
    ) {
      template.push({
        label: 'Summarize with Aspera AI',
        click: () => {
          runAsperaAiSkill('summarize', {
            selectionText: String(params.selectionText || ''),
          }).catch(() => {});
        },
      });
      // Send/compose box: polish the employee's own draft before sending.
      if (editable) {
        template.push({
          label: 'Refine with Aspera AI',
          click: () => {
            runAsperaAiSkill('refine', {
              selectionText: String(params.selectionText || ''),
            }).catch(() => {});
          },
        });
      }
      template.push({ type: 'separator' });
    }

    if (editable || hasSelection) {
      template.push({
        label: 'Cut',
        role: 'cut',
        enabled: editable && hasSelection && params.editFlags?.canCut !== false,
      });
      template.push({
        label: 'Copy',
        role: 'copy',
        enabled: hasSelection && params.editFlags?.canCopy !== false,
      });
      template.push({
        label: 'Paste',
        role: 'paste',
        enabled: editable && params.editFlags?.canPaste !== false,
      });
      if (editable) {
        template.push({
          label: 'Paste and match style',
          role: 'pasteAndMatchStyle',
          enabled: params.editFlags?.canPaste !== false,
        });
        template.push({
          label: 'Delete',
          role: 'delete',
          enabled: params.editFlags?.canDelete !== false,
        });
      }
      template.push({ type: 'separator' });
      template.push({
        label: 'Select all',
        role: 'selectAll',
        enabled: params.editFlags?.canSelectAll !== false,
      });
    } else if (hasSelection) {
      template.push({
        label: 'Copy',
        role: 'copy',
        enabled: params.editFlags?.canCopy !== false,
      });
      template.push({ type: 'separator' });
      template.push({ label: 'Select all', role: 'selectAll' });
    } else {
      // Always offer clipboard actions so users can paste into the page
      // even when the hit-test did not mark an input (common in SPAs).
      template.push({ label: 'Copy', role: 'copy' });
      template.push({ label: 'Paste', role: 'paste' });
      template.push({ label: 'Select all', role: 'selectAll' });
    }

    if (!template.length) return;
    const menu = Menu.buildFromTemplate(template);
    // params.x/y are relative to the guest WebContents; Menu.popup needs window coords.
    let popupX = params.x;
    let popupY = params.y;
    try {
      for (const entry of views.values()) {
        if (entry?.view?.webContents === webContents) {
          const bounds = entry.view.getBounds?.() || entry.__lastBounds;
          if (bounds) {
            popupX += bounds.x || 0;
            popupY += bounds.y || 0;
          }
          break;
        }
      }
    } catch {
      // ignore
    }
    menu.popup({
      window: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      x: Math.round(popupX),
      y: Math.round(popupY),
    });
  });
}

/**
 * Window-open policy shared by a service view and any popup it spawns.
 * Genuine external links go to the OS browser; internal popups (Zoho CRM
 * child windows, SSO handshakes, about:blank targets) open as real windows
 * that share the service session — denying them makes embedded apps like
 * Zoho CRM hang forever waiting for the window handle.
 *
 * IMPORTANT: linkHandling "external" must NOT deny about:blank / internal Zoho
 * popups. That setting only forces true third-party links into the OS browser.
 *
 * Gmail: never load google.com/url?q=… or third-party sites into the Gmail tab.
 */
function configureGuestWindowOpen(wc, service) {
  const googleish = isGoogleService(service);

  const allowPopup = () => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      autoHideMenuBar: true,
      width: 1024,
      height: 720,
      webPreferences: guestWebPreferences(service),
    },
  });

  wc.setWindowOpenHandler(({ url }) => {
    const raw = String(url || '');
    // Zoho One CRM / SPA portals boot child frames via about:blank first.
    if (!raw || raw === 'about:blank' || raw.startsWith('about:blank')) {
      return allowPopup();
    }

    if (raw.startsWith('http')) {
      if (googleish) {
        const outbound = extractGoogleOutboundUrl(raw);
        if (outbound) {
          openExternalSafe(outbound);
          return { action: 'deny' };
        }
        if (isGoogleOwnedUrl(raw) && !isAllowedGmailTabUrl(raw)) {
          // Malformed internal Google handoff URLs (drive/accounts continue=...)
          // should not spawn external error tabs. Reset to Gmail home.
          wc.loadURL(startUrlForService(service) || service.url).catch(() => {});
          return { action: 'deny' };
        }
        if (!isAllowedGmailTabUrl(raw)) {
          openExternalSafe(raw);
          return { action: 'deny' };
        }
        // Keep Gmail / accounts navigations inside the dock tab.
        wc.loadURL(raw).catch(() => {});
        return { action: 'deny' };
      }

      // Google OAuth / SSO popups must stay in-app for all services
      // (ChatGPT, Claude, etc. use "Sign in with Google").
      if (isAuthOrLoginUrl(raw) && isGoogleOwnedUrl(raw)) {
        return allowPopup();
      }

      const internal = isInternalUrl(raw, service);
      if (!internal) {
        // Never open broken Google consent/handoff URLs externally —
        // they produce 400 error tabs in the default browser.
        if (isGoogleOwnedUrl(raw)) return { action: 'deny' };
        openExternalSafe(raw);
        return { action: 'deny' };
      }

      return allowPopup();
    }

    // blob:/data: targets used by some in-app viewers
    if (raw.startsWith('blob:') || raw.startsWith('data:')) {
      return allowPopup();
    }

    return { action: 'deny' };
  });
}

/**
 * Main-frame navigation gate for a guest. Gmail stays on mail/accounts only.
 */
function attachGuestNavigationGate(webContents, service) {
  const gate = (event, url) => {
    if (isForbiddenGuestNavigation(url)) {
      event.preventDefault();
      return;
    }
    if (!String(url || '').startsWith('http')) return;

    if (isGoogleService(service)) {
      const outbound = extractGoogleOutboundUrl(url);
      if (outbound) {
        event.preventDefault();
        openExternalSafe(outbound);
        return;
      }
      if (isGoogleOwnedUrl(url) && !isAllowedGmailTabUrl(url)) {
        event.preventDefault();
        webContents.loadURL(startUrlForService(service) || service.url).catch(() => {});
        return;
      }
      if (!isAllowedGmailTabUrl(url)) {
        event.preventDefault();
        openExternalSafe(url);
        return;
      }
      return;
    }

    // Allow Google OAuth/SSO flows for any app (ChatGPT, Claude, etc.).
    if (isAuthOrLoginUrl(url) && isGoogleOwnedUrl(url)) return;

    if (isInternalUrl(url, service)) return;
    // Suppress broken Google consent URLs — they 400 in external browsers.
    if (isGoogleOwnedUrl(url)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    openExternalSafe(url);
  };

  webContents.on('will-navigate', gate);
  // Gmail /url → cybercrime.gov.in happens as a redirect after google.com loads.
  webContents.on('will-redirect', gate);

  // Safety net: if something still lands outside Gmail, open it externally + go home.
  webContents.on('did-navigate', (_event, url) => {
    if (!isGoogleService(service)) return;
    if (!url || !String(url).startsWith('http')) return;
    if (isAllowedGmailTabUrl(url)) return;
    const outbound = extractGoogleOutboundUrl(url);
    if (outbound) openExternalSafe(outbound);
    else if (!isGoogleOwnedUrl(url)) openExternalSafe(url);
    const home = startUrlForService(service);
    webContents.loadURL(home).catch(() => {});
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
    attachGoogleChromeSpoof(webContents, {
      chromeVersion: CHROME_VERSION,
      chromeMajor: CHROME_MAJOR,
      enabled: settings.googleSpoofEnabled !== false,
    }).catch(() => {});
  }
  const langs = cfg.spellChecker || settings.spellChecker || ['en-US'];
  webContents.session.setSpellCheckerLanguages(
    Array.isArray(langs) && langs.length ? langs : ['en-US'],
  );

  configureGuestWindowOpen(webContents, service);
  attachGuestContextMenu(webContents);
  attachGuestNavigationGate(webContents, service);
  if (isHeavyPortalApp(service) || isKeepWarmService(service.id)) {
    attachPortalVisibilityKeepAlive(webContents);
  }
  if (service.appId === 'zoho-one') {
    attachZohoOneBlankGuardian(webContents);
  }
  // Throttling is applied after first load (see did-finish-load below).

  // Real popup windows (Zoho CRM child views, SSO handshakes) inherit these
  // rules too, and must never be trapped inside a broken denied handle.
  webContents.on('did-create-window', (childWindow) => {
    const childWc = childWindow.webContents;
    trackServicePopup(service.id, childWindow);
    configureGuestWindowOpen(childWc, service);
    attachGuestContextMenu(childWc);
    attachGuestNavigationGate(childWc, service);
    attachPopupSessionAdopt(webContents, childWindow, service);
    if (isGoogleService(service)) {
      attachGoogleChromeSpoof(childWc, {
        chromeVersion: CHROME_VERSION,
        chromeMajor: CHROME_MAJOR,
        enabled: settings.googleSpoofEnabled !== false,
      }).catch(() => {});
    }
    watchWebContents(childWc, `popup:${service.appId}:${service.id}`);
  });

  webContents.on('console-message', (event, level, message) => {
    const text =
      (typeof event === 'object' && event && 'message' in event
        ? String(event.message || '')
        : '') ||
      (typeof message === 'string' ? message : '') ||
      '';
    if (!text) return;
    handleGuestNotificationBridge(service, text);
  });

  webContents.on('page-title-updated', (_event, title) => {
    const previous = unreadCounts.get(service.id) || 0;
    const next = parseUnread(title);
    if (previous === next) return;
    unreadCounts.set(service.id, next);
    refreshBadge();
    broadcastState();

    const entry = views.get(service.id);
    const suppressUntil = entry?.__suppressTitleNotifyUntil || 0;
    if (Date.now() < suppressUntil) return;

    // Prefer rich Notification payloads (sender + message). Skip generic
    // "N unread" toasts when a rich toast was just shown, or when the count
    // has not risen above the last seeded/read baseline.
    const richRecently =
      entry?.__lastRichNotifyAt &&
      Date.now() - entry.__lastRichNotifyAt < 15_000;
    if (richRecently) return;

    const baseline = Number(entry?.__titleCountBaseline) || 0;
    if (next > previous && next > baseline) {
      if (entry) entry.__titleCountBaseline = next;
      emitServiceNotification(service, {
        title: service.title || service.name,
        body: `${next} unread`,
        fromTitleCount: true,
      });
    }
  });

  webContents.on('dom-ready', async () => {
    applyFocusMode(webContents, service.id);
    // Seed badge from current title without treating it as a new message.
    seedUnreadFromTitle(service.id, webContents);
    refreshBadge();
    broadcastState();
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

  // Network blips used to leave a permanent blank until the user manually reloaded.
  webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    // -3 ERR_ABORTED is normal (navigation superseded). Never clear storage here.
    if (errorCode === -3 || errorCode === 0) return;
    const entry = views.get(service.id);
    if (!entry || entry.view !== view) return;
    const fails = (entry.__failLoadCount || 0) + 1;
    entry.__failLoadCount = fails;
    try {
      logBreadcrumb('guest-fail-load', {
        serviceId: service.id,
        appId: service.appId,
        errorCode,
        errorDescription: String(errorDescription || ''),
        url: String(validatedURL || '').slice(0, 180),
        attempt: fails,
      });
    } catch {
      // ignore
    }
    if (fails > 3) return;
    const delay = Math.min(8_000, 700 * fails * fails);
    setTimeout(() => {
      const live = views.get(service.id);
      if (!live || live.view !== view) return;
      const wc = live.view.webContents;
      if (!wc || wc.isDestroyed() || wc.isLoading()) return;
      try {
        if (validatedURL && String(validatedURL).startsWith('http')) {
          wc.loadURL(String(validatedURL));
        } else {
          wc.reload();
        }
      } catch {
        // ignore
      }
    }, delay);
  });

  webContents.on('unresponsive', () => {
    try {
      logBreadcrumb('guest-unresponsive', {
        serviceId: service.id,
        appId: service.appId,
      });
    } catch {
      // ignore
    }
    if (service.id !== activeServiceId || locked) return;
    // Kick the surface first; reload on next blank health strike if still dead.
    const entry = views.get(service.id);
    if (!entry) return;
    entry.__surfaceBlankStrikes = Math.max(1, entry.__surfaceBlankStrikes || 0);
    setTimeout(() => {
      if (service.id === activeServiceId) {
        runActiveGuestSurfaceHealthCheck(service.id);
      }
    }, 800);
  });

  if (cfg.preventBasicAuth) {
    webContents.on('login', (event) => {
      event.preventDefault();
    });
  }

  webContents.on('did-navigate', (_event, url) => {
    rememberGoodUrl(service.id, url);
    if (isGoogleService(service)) noteGoogleMarketingLanding(service.id, url);
    reclaimZohoHome(webContents, service, url, {
      enabled: settings.zohoReclaimEnabled !== false,
    });
  });
  webContents.on('did-navigate-in-page', (_event, url) => {
    rememberGoodUrl(service.id, url);
    // Zoho One Sales/Finance/HR are in-page space switches — CRM often blanks here.
    if (
      shouldRunPortalBlankRecovery(service) &&
      service.id === activeServiceId &&
      !locked &&
      !overlayOpen
    ) {
      schedulePortalHealthChecks(service.id);
      if (service.appId === 'zoho-one') {
        scheduleZohoSalesRecovery(service.id);
      }
    }
  });
  webContents.on('did-finish-load', () => {
    try {
      const url = webContents.getURL();
      rememberGoodUrl(service.id, url);
      if (isGoogleService(service)) noteGoogleMarketingLanding(service.id, url);
      reclaimZohoHome(webContents, service, url, {
        enabled: settings.zohoReclaimEnabled !== false,
      });
      const entry = views.get(service.id);
      if (entry) {
        entry.loadedOnce = true;
        entry.__portalBootPending = false;
        entry.__failLoadCount = 0;
        const keepWarm = isKeepWarmService(service.id);
        applyGuestPerfMode(webContents, {
          active: service.id === activeServiceId,
          loadedOnce: true,
          keepWarm,
          allowThrottle:
            !keepWarm ||
            !isHeavyPortalApp(service) ||
            entry.activatedOnce === true,
        });
        if (shouldRunPortalBlankRecovery(service) && service.id === activeServiceId) {
          schedulePortalHealthChecks(service.id);
        }
      }
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

  views.set(service.id, {
    view,
    lastUsed: Date.now(),
    createdAt: Date.now(),
    loadedOnce: false,
    service,
    lastPresenceAt: Date.now(),
  });
  hibernatedAt.delete(service.id);
  setGuestHubActiveFlag(webContents, service.id === activeServiceId);
  webContents.on('render-process-gone', (_event, details) => {
    try {
      logBreadcrumb('guest-renderer-gone', {
        serviceId: service.id,
        appId: service.appId,
        reason: details?.reason,
        exitCode: details?.exitCode,
      });
    } catch {
      // ignore
    }
  });
  watchWebContents(webContents, `app:${service.appId}:${service.id}`);
  return views.get(service.id);
}

function persistGuestSession(partition) {
  if (!partition) return;
  const appSession = session.fromPartition(partition);
  // IndexedDB / localStorage for WhatsApp must hit disk BEFORE the renderer dies.
  try {
    if (typeof appSession.flushStorageData === 'function') {
      appSession.flushStorageData();
    }
  } catch {
    // ignore
  }
  appSession.cookies.flushStore().catch(() => {});
}

function hibernateService(id, { force = false } = {}) {
  const entry = views.get(id);
  if (!entry) return;
  if (!force && id === activeServiceId) return;
  // Popouts are often the biggest hidden RAM users (Zoho CRM, OAuth windows).
  // When an app is hibernated, close its popups too.
  closeServicePopups(id);
  clearPortalTimer(entry, '__portalHealthTimer');
  clearPortalTimer(entry, '__portalHealthTimer2');
  clearActiveSurfaceTimers(entry);
  const service = getService(id);
  try {
    const url = entry.view.webContents.getURL();
    rememberGoodUrl(id, url);
  } catch {
    // ignore
  }
  // CRITICAL: flush session to disk before destroying the guest process.
  // Closing first caused WhatsApp/Arattai "random" sign-outs.
  if (service?.partition) {
    persistGuestSession(service.partition);
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
  // Heavy portals break (blank CRM) if we wipe cache between wakes.
  // Also skip HTTP cache trim for messaging — safer for session stickiness.
  if (
    service?.partition &&
    !isHeavyPortalApp(service) &&
    !isMessagingApp(service)
  ) {
    trimGuestHttpCache(service.partition).catch(() => {});
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
    return safeStartUrlForService(service, last);
  }
  return service.url;
}

let lastUrlSaveTimer = null;
function rememberGoodUrl(serviceId, url) {
  if (!url || !String(url).startsWith('http') || isAuthOrLoginUrl(url)) return;
  const service = getService(serviceId);
  if (service && !isUrlForService(service, url)) return;
  // Never remember third-party pages that hijacked a Gmail tab.
  if (isGoogleService(service) && !isAllowedGmailTabUrl(url)) return;
  // Never persist fragile Zoho One CRM deep links — they blank after restart.
  let storeUrl = url;
  if (service?.appId === 'zoho-one' && isFragileZohoOneDeepUrl(url)) {
    try {
      const u = new URL(url);
      const homeMatch = u.pathname.match(/^(\/zohoone\/[^/]+\/home)/i);
      storeUrl = homeMatch ? `${u.origin}${homeMatch[1]}` : service.url;
    } catch {
      storeUrl = service.url;
    }
  }
  lastGoodUrls.set(serviceId, storeUrl);
  if (lastUrlSaveTimer) clearTimeout(lastUrlSaveTimer);
  lastUrlSaveTimer = setTimeout(() => {
    const prev = settings.lastServiceUrls || {};
    if (prev[serviceId] === storeUrl) return;
    settings = saveSettings({
      lastServiceUrls: { ...prev, [serviceId]: storeUrl },
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
    const safe = service ? safeStartUrlForService(service, url) : url;
    if (safe !== url) dirty = true;
    cleaned[id] = safe;
    lastGoodUrls.set(id, safe);
  }
  if (dirty) {
    settings = saveSettings({ lastServiceUrls: cleaned });
  }
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
  // Keep one slot for the active tab so "warm apps" means background warm apps.
  return Math.max(1, maxWarm() - 1);
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

/** Background wake — loads without stealing the active tab. */
function softWakeService(id) {
  if (views.has(id) || locked) return false;
  const service = getService(id);
  if (!service || service.config?.enabled === false) return false;

  // Never park warm apps. Only drop non-warm background views for budget.
  const evictable = [...views.entries()]
    .filter(([viewId]) => viewId !== activeServiceId && !isKeepWarmService(viewId))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  while (views.size >= maxWarm() && evictable.length) {
    const [victimId] = evictable.shift();
    hibernateService(victimId);
  }
  // Warm apps are exempt from the hard cap — usability first (instant switch).
  if (views.size >= maxWarm() && !isKeepWarmService(id)) return false;
  createViewForService(service);
  if (id !== activeServiceId) {
    const warmed = views.get(id);
    if (warmed && isKeepWarmService(id)) parkGuestView(warmed, id);
  }
  enforceWarmLimit();
  return views.has(id);
}

/**
 * Soft-load every warm app so switching stays instant.
 * Fast stagger — warm guests must be ready within ~1s of each other.
 */
let softWakeTimer = null;
function softWakeKeepWarmApps(exceptId = null) {
  if (softWakeTimer) {
    clearTimeout(softWakeTimer);
    softWakeTimer = null;
  }
  const pending = selectedWarmIds().filter(
    (id) => id !== exceptId && !views.has(id),
  );
  if (!pending.length) return;

  let i = 0;
  const step = () => {
    softWakeTimer = null;
    if (locked) return;
    while (i < pending.length && views.has(pending[i])) i += 1;
    if (i >= pending.length) {
      broadcastState();
      return;
    }
    softWakeService(pending[i]);
    i += 1;
    broadcastState();
    if (i < pending.length) softWakeTimer = setTimeout(step, 250);
  };
  softWakeTimer = setTimeout(step, 80);
}

function enforceResidentLimit() {
  // Usability first: never park flame/keepWarm apps for RAM.
  // Only unload non-warm background guests beyond the warm budget.
  const evictable = [...views.entries()]
    .filter(([id]) => id !== activeServiceId && !isKeepWarmService(id))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  while (views.size > maxWarm() && evictable.length) {
    const [id] = evictable.shift();
    hibernateService(id);
  }
}

function enforceWarmLimit() {
  const evictable = [...views.entries()]
    .filter(([id]) => id !== activeServiceId && !isKeepWarmService(id))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  while (views.size > maxWarm() && evictable.length) {
    const [id] = evictable.shift();
    hibernateService(id);
  }
  enforceResidentLimit();
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
            ? `You can keep ${limit} background app${limit === 1 ? '' : 's'} warm (max ${MAX_WARM_VIEWS_CAP} including the active tab).`
            : `Maximum is ${MAX_WARM_VIEWS_CAP} warm apps. Turn off another warm app first.`,
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
  closeAllFloatMenus();
  const service = getService(id);
  if (!service || !mainWindow || locked) return;
  const cfg = getAppConfig(id);
  if (!cfg.enabled) {
    broadcastState();
    return;
  }

  const previousId = activeServiceId;
  parkBackgroundViews(id);
  const entry = ensureLiveView(service);
  const keepWarm = isKeepWarmService(id);
  // Blind stale-reload destroyed warm Zoho/Arattai after ~90s away.
  // Warm apps: never reload on activate — only blank health checks (delayed).
  const wasStale =
    !keepWarm &&
    shouldRunPortalBlankRecovery(service) &&
    entry.lastPresenceAt &&
    Date.now() - entry.lastPresenceAt >= PORTAL_STALE_MS;
  entry.lastUsed = Date.now();
  entry.activatedOnce = true;
  entry.__blankStrikes = 0;
  touchPortalPresence(entry);
  activeServiceId = id;
  settings = saveSettings({ lastActiveServiceId: id });

  const wc = entry.view.webContents;
  applyGuestPerfMode(wc, {
    active: true,
    loadedOnce: true,
    keepWarm,
    allowThrottle: true,
  });
  setGuestHubActiveFlag(wc, true);

  if (wasStale && !wc.isLoading()) {
    try {
      entry.__lastStaleReloadAt = Date.now();
      wc.reload();
    } catch {
      // ignore
    }
  } else if (shouldRunPortalBlankRecovery(service)) {
    // Delayed blank checks only — do not reload a healthy warm tab.
    schedulePortalHealthChecks(id);
    if (service.appId === 'zoho-one') {
      try {
        const url = entry.view?.webContents?.getURL?.() || '';
        if (/cxapp-spaces\/sales|\/crm\/.*\/tab\//i.test(url)) {
          scheduleZohoSalesRecovery(id);
        }
      } catch {
        // ignore
      }
    }
  }
  // All apps (WhatsApp included): pixel surface checks while this tab is active.
  scheduleActiveGuestSurfaceChecks(id);
  entry.__parked = false;

  // Only user-selected apps remain loaded after switching away.
  if (previousId && previousId !== id && !isKeepWarmService(previousId)) {
    hibernateService(previousId);
  }

  if (!overlayOpen) {
    attachGuestView(entry.view);
    entry.__lastBounds = null;
    layoutActiveView();
    setTimeout(() => layoutActiveView(), 16);
    setTimeout(() => layoutActiveView(), 100);
    setTimeout(() => layoutActiveView(), 300);
    focusActiveContents();
  }

  syncAllGuestPerfModes();

  // Seed from live title (do not zero — that made "(2)" look like a new alert).
  seedUnreadFromTitle(id, entry?.view?.webContents);
  enforceWarmLimit();
  softWakeKeepWarmApps(id);
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

/**
 * Free RAM from background tabs. Never destroys Keep Warm / messaging apps —
 * those sessions are sacred for daily work (WhatsApp, Arattai).
 */
function hibernateBackground({ forceWarm = false } = {}) {
  for (const id of [...views.keys()]) {
    if (id === activeServiceId) continue;
    if (!forceWarm && isKeepWarmService(id)) continue;
    hibernateService(id);
  }
  broadcastState();
}

function reloadActive() {
  if (!activeServiceId) return;
  const entry = views.get(activeServiceId);
  if (!entry) {
    // Hibernated / crashed — recreate instead of a dead no-op.
    activateService(activeServiceId);
    return;
  }
  entry.view.webContents.reload();
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
    ai: {
      enabled: settings.aiEnabled !== false,
      provider: settings.aiProvider || 'gemini',
      model: settings.aiModel || '',
      providerModels:
        settings.aiProviderModels && typeof settings.aiProviderModels === 'object'
          ? settings.aiProviderModels
          : {},
      language: settings.aiLanguage || 'en',
      allowedAppIds: AI_ALLOWED_APP_IDS,
      languages: AI_LANGUAGES,
      providers: aiProvidersForUi(),
      routeOrder: configuredProvidersInRouteOrder(
        listConfiguredAiProviders()
          .filter((p) => p.configured)
          .map((p) => p.id),
      ).map((p) => p.id),
    },
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
  pushNotifCenterData();
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
  closeAllFloatMenus();
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

function getTrayIconPath(size = 32) {
  const names = [
    `icon-${size}.png`,
    'icon-32.png',
    'icon-24.png',
    'icon-48.png',
    'icon.png',
  ];
  const bases = [
    process.resourcesPath || '',
    path.join(app.getAppPath(), 'assets'),
    path.join(__dirname, '../../assets'),
    path.join(__dirname, '../assets'),
  ];
  for (const base of bases) {
    if (!base) continue;
    for (const name of names) {
      const p = path.join(base, name);
      try {
        if (fs.existsSync(p) && fs.statSync(p).size > 100) return p;
      } catch {
        // try next
      }
    }
  }
  return getAppIconPath();
}

function createTrayIcon(_badge) {
  // Prefer PNG for Linux Mint XFCE / Cinnamon StatusNotifier hosts (SVG data-URLs are flaky).
  // Unread count stays in the tray tooltip + in-app bell (panel badge overlays vary by DE).
  const iconPath = getTrayIconPath(32);
  let image = iconPath
    ? nativeImage.createFromPath(iconPath)
    : getAppIcon();
  if (!image || image.isEmpty()) {
    image = getAppIcon();
  }
  if (!image.isEmpty()) {
    // XFCE panel icons are typically ~22–24px; Cinnamon is similar.
    const size = process.platform === 'linux' ? 24 : 32;
    image = image.resize({ width: size, height: size, quality: 'best' });
  }
  return image;
}

function updateTray() {
  if (!tray) return;
  const total = totalUnread();
  tray.setImage(createTrayIcon(total > 0));
  tray.setToolTip(
    total > 0 ? `Aspera Hub (${total} unread)` : 'Aspera Hub',
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
      label: 'Show Aspera Hub',
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
      title: 'Quit Aspera Hub?',
      message: 'Quit Aspera Hub?',
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
    title: 'Aspera Hub troubleshooting',
    message: 'Troubleshooting information',
    detail: [
      `Aspera Hub ${app.getVersion()}`,
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
        { label: 'Zoom Aspera Hub', submenu: zoomPresets },
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
          label: 'About Aspera Hub',
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
      title: 'About Aspera Hub',
      message: `Aspera Hub ${app.getVersion()}`,
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
    // Renderer is authoritative for open drawers/menus — do NOT force overlay
    // off here (that briefly puts the guest on top of Settings).
    mainWindow?.webContents.send('dock:sync-overlay');
    setTimeout(() => {
      layoutActiveView();
      repaintActiveGuestView({ reason: 'after-dialog' });
    }, 50);
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
    title: `Aspera Hub ${app.getVersion()}`,
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
    try {
      const crashFlag = path.join(app.getPath('userData'), 'gpu-crash-v1');
      if (fs.existsSync(crashFlag)) fs.unlinkSync(crashFlag);
    } catch {
      // ignore
    }
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
        // Let renderer re-assert Settings/menus; only clear if nothing is open.
        mainWindow?.webContents.send('dock:sync-overlay');
        setTimeout(() => {
          layoutActiveView();
          repaintActiveGuestView({ reason: 'after-crash-dialog' });
        }, 50);
      }
    }, 1200);
  });
  mainWindow.on('resize', layoutActiveView);
  mainWindow.on('maximize', () => {
    setTimeout(() => layoutActiveView(), 50);
    setTimeout(() => layoutActiveView(), 200);
  });
  mainWindow.on('unmaximize', () => setTimeout(() => layoutActiveView(), 50));
  mainWindow.on('show', () => {
    setTimeout(() => layoutActiveView(), 50);
    const awayMs = awayStartedAt ? Date.now() - awayStartedAt : 0;
    if (awayMs >= 3 * 60_000 || peakIdleSec >= 3 * 60) {
      setTimeout(() => onUserReturnedFromIdle('window-show'), 60);
    } else {
      setTimeout(() => repaintActiveGuestView({ reason: 'window-show' }), 60);
      markUserActive();
    }
  });
  mainWindow.on('restore', () => {
    setTimeout(() => repaintActiveGuestView({ reason: 'window-restore' }), 40);
  });
  mainWindow.on('hide', () => {
    guestNeedsRepaint = true;
    markUserAway('window-hide');
  });
  mainWindow.on('blur', () => {
    // Guest compositor may need a kick when we come back (esp. Mint XFCE).
    guestNeedsRepaint = true;
    markUserAway('window-blur');
  });
  mainWindow.on('focus', () => {
    const awayMs = awayStartedAt ? Date.now() - awayStartedAt : 0;
    // Long away: full recover (repaint + blank reload). Short: two-step repaint.
    if (awayMs >= 3 * 60_000 || peakIdleSec >= 3 * 60) {
      onUserReturnedFromIdle('window-focus-after-away');
    } else if (process.platform === 'linux' || guestNeedsRepaint) {
      repaintActiveGuestView({ reason: 'window-focus' });
      markUserActive();
    } else {
      focusActiveContents();
      markUserActive();
    }
  });
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
  let cacheTrimTicks = 0;
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
    // Every ~10 minutes, drop HTTP caches for inactive warm guests.
    cacheTrimTicks += 1;
    if (cacheTrimTicks >= 20) {
      cacheTrimTicks = 0;
      trimInactiveGuestCaches().catch(() => {});
    }
    broadcastState();
  }, 30_000);
}

// —— IPC ——
dockHandle('dock:set-overlay', (_e, openOrOptions) => {
  if (openOrOptions && typeof openOrOptions === 'object') {
    setOverlayOpen(!!openOrOptions.open, openOrOptions);
  } else {
    setOverlayOpen(!!openOrOptions);
  }
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
  markAllReadWithoutNotifySpam();
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
dockHandle('dock:prefetch', (_e, id) => {
  // Kept for compatibility; warm apps are soft-woken after activate instead
  // (hover prefetch raced with clicks and unloaded other priority tabs).
  if (!id || locked || id === activeServiceId) return { ok: false };
  if (!isKeepWarmService(id)) return { ok: false };
  softWakeService(id);
  broadcastState();
  return { ok: true, loaded: views.has(id) };
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
dockHandle('dock:open-app-menu', (_e, payload) =>
  openAppContextMenu(payload || {}),
);
dockHandle('dock:close-app-menu', () => {
  closeAppContextMenu();
  return { ok: true };
});
dockHandle('dock:open-chrome-menu', (_e, payload) =>
  openChromeMenuWindow(payload || {}),
);
dockHandle('dock:close-chrome-menu', () => {
  closeChromeMenuWindow();
  return { ok: true };
});
dockHandle('dock:toggle-chrome-menu', (_e, payload) => {
  if (chromeMenuWindow && !chromeMenuWindow.isDestroyed()) {
    closeChromeMenuWindow();
    return { ok: true, open: false };
  }
  openChromeMenuWindow(payload || {});
  return { ok: true, open: true };
});
dockHandle('dock:open-notif-center', (_e, payload) =>
  openNotifCenterWindow(payload || {}),
);
dockHandle('dock:close-notif-center', () => {
  closeNotifCenterWindow();
  return { ok: true };
});
dockHandle('dock:toggle-notif-center', (_e, payload) => {
  if (notifCenterWindow && !notifCenterWindow.isDestroyed()) {
    closeNotifCenterWindow();
    return { ok: true, open: false };
  }
  openNotifCenterWindow(payload || {});
  return { ok: true, open: true };
});
appMenuHandle('app-menu:action', (_e, type, value) => handleAppMenuAction(type, value));
appMenuHandle('app-menu:close', () => {
  closeAppContextMenu();
  return { ok: true };
});
chromeMenuHandle('chrome-menu:action', (_e, type) => handleChromeMenuAction(type));
chromeMenuHandle('chrome-menu:close', () => {
  closeChromeMenuWindow();
  return { ok: true };
});
notifCenterHandle('notif-center:action', (_e, type, value) =>
  handleNotifCenterAction(type, value),
);
notifCenterHandle('notif-center:close', () => {
  closeNotifCenterWindow();
  return { ok: true };
});
aiResultHandle('ai-result:copy', (_e, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});
aiResultHandle('ai-result:close', () => {
  closeAiResultWindow();
  return { ok: true };
});
aiResultHandle('ai-result:suggest-reply', () => runSuggestRepliesFromAiResult());
aiResultHandle('ai-result:sync-replies', (_e, text) => {
  if (!aiResultContext) return { ok: false };
  aiResultContext = {
    ...aiResultContext,
    repliesText: String(text || ''),
  };
  return { ok: true };
});
aiResultHandle('ai-result:revise-reply', (_e, payload) =>
  runReviseReplyFromAiResult(payload),
);
aiResultHandle('ai-result:refine-again', (_e, payload) =>
  runRefineAgainFromAiResult(payload),
);
aiResultHandle('ai-result:use-in-compose', (_e, payload) =>
  runUseRefinedInCompose(payload),
);
aiResultHandle('ai-result:sync-refine', (_e, text) => {
  if (!aiResultContext || aiResultContext.skill !== 'refine') {
    return { ok: false };
  }
  aiResultContext = {
    ...aiResultContext,
    refinedText: String(text || ''),
  };
  return { ok: true };
});
forwardPickerHandle('forward-picker:pick', (_e, serviceId) =>
  deliverForwardToTarget(String(serviceId || '')),
);
forwardPickerHandle('forward-picker:close', () => {
  closeForwardPickerWindow();
  return { ok: true };
});
async function commitInstalledExtension(installed) {
  const chromeId = String(installed.chromeId || '').trim().toLowerCase();
  let list = listInstalledExtensions(settings.extensions);
  if (chromeId) {
    const prev = list.find((ext) => String(ext.chromeId || '').toLowerCase() === chromeId);
    if (prev && prev.id !== installed.id) {
      uninstallExtensionFiles(prev);
      list = list.filter((ext) => ext.id !== prev.id);
    }
  }
  const withoutSame = list.filter((ext) => ext.id !== installed.id);
  const next = [...withoutSame, installed];
  settings = saveSettings({ extensions: next });
  await syncExtensionsToAllGuestSessions();
  reloadAllGuestViews();
  pushExtensionsManagerData();
  return installed;
}

extensionsHandle('extensions:close', () => {
  closeExtensionsWindow();
  return { ok: true };
});
extensionsHandle('extensions:install-webstore', async (_e, input) => {
  let workRoot = '';
  try {
    const chromeId = parseChromeExtensionId(input);
    if (!chromeId) {
      throw new Error(
        'Paste a Chrome Web Store link or 32-character extension ID.',
      );
    }
    const existing = listInstalledExtensions(settings.extensions).find(
      (ext) => String(ext.chromeId || '').toLowerCase() === chromeId,
    );
    const unpacked = await downloadAndUnpackChromeExtension(chromeId);
    workRoot = unpacked.workRoot;
    const installed = installUnpackedExtension(unpacked.path, {
      chromeId,
      replaceId: existing?.id || `ext-${chromeId}`,
    });
    await commitInstalledExtension(installed);
    return { ok: true, extension: installed };
  } catch (error) {
    const message = String(error?.message || error);
    pushExtensionsManagerData(message);
    return { ok: false, error: message };
  } finally {
    if (workRoot && fs.existsSync(workRoot)) {
      try {
        fs.rmSync(workRoot, { recursive: true, force: true });
      } catch {
        // ignore temp cleanup
      }
    }
  }
});
extensionsHandle('extensions:install-package', async () => {
  const picked = dialog.showOpenDialogSync(mainWindow || undefined, {
    title: 'Install extension package',
    properties: ['openFile'],
    filters: [
      { name: 'Chrome extension', extensions: ['crx', 'zip'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (!picked?.length) return { ok: false, cancelled: true };
  let workRoot = '';
  try {
    const unpacked = unpackExtensionPackage(picked[0]);
    workRoot = unpacked.workRoot;
    const installed = installUnpackedExtension(unpacked.path);
    await commitInstalledExtension(installed);
    return { ok: true, extension: installed };
  } catch (error) {
    const message = String(error?.message || error);
    pushExtensionsManagerData(message);
    return { ok: false, error: message };
  } finally {
    if (workRoot && fs.existsSync(workRoot)) {
      try {
        fs.rmSync(workRoot, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
});
extensionsHandle('extensions:open-webstore', async (_e, input) => {
  const url = chromeWebStoreUrl(input);
  await shell.openExternal(url);
  return { ok: true, url };
});
extensionsHandle('extensions:load-unpacked', async () => {
  const picked = dialog.showOpenDialogSync(mainWindow || undefined, {
    title: 'Load unpacked Chrome extension',
    properties: ['openDirectory'],
  });
  if (!picked?.length) return { ok: false, cancelled: true };
  try {
    const installed = installUnpackedExtension(picked[0]);
    await commitInstalledExtension(installed);
    return { ok: true, extension: installed };
  } catch (error) {
    const message = String(error?.message || error);
    pushExtensionsManagerData(message);
    return { ok: false, error: message };
  }
});
extensionsHandle('extensions:set-enabled', async (_e, id, enabled) => {
  const list = listInstalledExtensions(settings.extensions);
  const next = list.map((ext) =>
    ext.id === String(id || '')
      ? { ...ext, enabled: enabled !== false }
      : ext,
  );
  settings = saveSettings({ extensions: next });
  await syncExtensionsToAllGuestSessions();
  reloadAllGuestViews();
  pushExtensionsManagerData();
  return { ok: true };
});
extensionsHandle('extensions:remove', async (_e, id) => {
  const list = listInstalledExtensions(settings.extensions);
  const target = list.find((ext) => ext.id === String(id || ''));
  const next = list.filter((ext) => ext.id !== String(id || ''));
  settings = saveSettings({ extensions: next });
  if (target) uninstallExtensionFiles(target);
  await syncExtensionsToAllGuestSessions();
  reloadAllGuestViews();
  pushExtensionsManagerData();
  return { ok: true };
});
extensionsHandle('extensions:reload-guests', async () => {
  await syncExtensionsToAllGuestSessions();
  reloadAllGuestViews();
  pushExtensionsManagerData();
  return { ok: true };
});
dockHandle('dock:ai-status', () => ({
  enabled: settings.aiEnabled !== false,
  provider: settings.aiProvider || 'gemini',
  model: settings.aiModel || '',
  providerModels:
    settings.aiProviderModels && typeof settings.aiProviderModels === 'object'
      ? settings.aiProviderModels
      : {},
  language: settings.aiLanguage || 'en',
  allowedAppIds: AI_ALLOWED_APP_IDS,
  languages: AI_LANGUAGES,
  providers: aiProvidersForUi(),
  routeOrder: configuredProvidersInRouteOrder(
    listConfiguredAiProviders()
      .filter((p) => p.configured)
      .map((p) => p.id),
  ).map((p) => p.id),
}));
dockHandle('dock:ai-set-key', (_e, providerId, apiKey) => {
  const id = String(providerId || '').trim();
  const result = setAiProviderKey(id, apiKey);
  if (result.ok) {
    onAiProviderKeyChanged(id, result.configured !== false);
    syncPreferredAiProvider();
    invalidateAiModelCache(id);
    if (result.configured) {
      // Warm live model list in the background for Auto + Settings picker.
      refreshAiProviderModels(id, { force: true }).finally(() => broadcastState());
    }
  }
  broadcastState();
  return result;
});
dockHandle('dock:ai-clear-key', (_e, providerId) => {
  const id = String(providerId || '').trim();
  const result = clearAiProviderKey(id);
  onAiProviderKeyChanged(id, false);
  invalidateAiModelCache(id);
  syncPreferredAiProvider();
  broadcastState();
  return result;
});
dockHandle('dock:ai-list-models', async (_e, providerId) => {
  const result = await refreshAiProviderModels(providerId, { force: true });
  broadcastState();
  return result;
});
dockHandle('dock:ai-set-model', (_e, providerId, modelId) => {
  const result = setAiProviderModelPreference(providerId, modelId);
  if (result.ok) broadcastState();
  return result;
});
dockHandle('dock:ai-set-provider', (_e, providerId) => {
  const id = String(providerId || '').trim();
  const provider = getAiProvider(id);
  if (!id || provider.id !== id) {
    return { ok: false, error: 'Unknown AI provider' };
  }
  // Manual preference is stored but skills auto-route free-first → Anthropic last.
  settings = saveSettings({ aiProvider: id });
  broadcastState();
  return { ok: true, provider: id };
});
dockHandle('dock:ai-catch-up', (_e, opts) =>
  runAsperaAiSkill('catch-up', opts || {}),
);
dockHandle('dock:ai-summarize', (_e, opts) =>
  runAsperaAiSkill('summarize', opts || {}),
);
dockHandle('dock:ai-refine', (_e, opts) =>
  runAsperaAiSkill('refine', opts || {}),
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
  let entry = views.get(id);
  if (!entry) {
    const service = getService(id);
    if (!service) return { ok: false, error: 'App not found' };
    // Hibernated apps made Home/Reload look dead — wake first.
    activateService(id);
    entry = views.get(id);
    if (!entry) return { ok: false, error: 'Could not open app' };
    if (action === 'home' || action === 'reload') return { ok: true };
  }
  const wc = entry.view.webContents;
  if (action === 'back' && wc.canGoBack()) wc.goBack();
  else if (action === 'forward' && wc.canGoForward()) wc.goForward();
  else if (action === 'reload') wc.reload();
  else if (action === 'home') {
    const service = getService(id);
    if (service) wc.loadURL(startUrlForService(service) || service.url);
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
  const blocked = new Set([
    'allowPageInjection',
    'allowGuestDevTools',
    'lockPasswordHash',
    'googleSpoofEnabled',
    'zohoReclaimEnabled',
  ]);
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
    next.maxResidentViews = next.maxWarmViews;
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
    next.maxResidentViews = next.maxWarmViews;
  }
  if (next.maxResidentViews != null && next.maxWarmViews == null) {
    next.maxResidentViews = Math.min(
      MAX_WARM_VIEWS_CAP,
      Math.max(1, Number(next.maxResidentViews) || MAX_WARM_VIEWS_DEFAULT),
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
dockHandle('dock:open-extensions', (_e, payload = {}) =>
  openExtensionsWindow({ dark: !!payload?.dark }),
);
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
    markUserAway('lock-or-suspend');
    if (settings.lockOnSystemIdle && settings.lockEnabled) lockApp();
  };
  powerMonitor.on('lock-screen', lockIfEnabled);
  powerMonitor.on('suspend', lockIfEnabled);

  // User walked away — when they return, recover the guest surface (not just Zoho).
  const onResume = () => {
    setTimeout(() => onUserReturnedFromIdle('power-resume'), 400);
  };
  powerMonitor.on('resume', onResume);
  powerMonitor.on('unlock-screen', onResume);

  let systemWasIdle = false;
  let portalWasIdle = false;
  setInterval(() => {
    let idleSec = 0;
    try {
      idleSec = powerMonitor.getSystemIdleTime();
    } catch {
      return;
    }

    if (idleSec >= 60) {
      markUserAway('system-idle');
      peakIdleSec = Math.max(peakIdleSec, idleSec);
    }

    if (idleSec >= 8 * 60) systemWasIdle = true;
    if (systemWasIdle && idleSec < 8) {
      systemWasIdle = false;
      onUserReturnedFromIdle('system-idle-end');
    }
    // Medium away (3+ min): recover when the user comes back.
    if (idleSec >= 3 * 60) portalWasIdle = true;
    if (portalWasIdle && idleSec < 8) {
      portalWasIdle = false;
      onUserReturnedFromIdle('short-idle-end');
    }

    // Only refresh "presence" while the user is actually active.
    // Touching presence during idle hid 30-minute blanks from recovery logic.
    if (idleSec < 60) {
      for (const [id, entry] of views.entries()) {
        if (isKeepWarmService(id) || id === activeServiceId) {
          touchPortalPresence(entry);
        }
      }
    }
  }, 15_000);

  // While Hub stays focused, periodically sample the active guest surface.
  // Catches WhatsApp/Arattai going blank without alt-tab or idle.
  setInterval(() => {
    if (!activeServiceId || locked) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!dockIsUserFocused()) return;
    let idleSec = 0;
    try {
      idleSec = powerMonitor.getSystemIdleTime();
    } catch {
      idleSec = 0;
    }
    if (idleSec >= 90) return;
    runActiveGuestSurfaceHealthCheck(activeServiceId, { fromPoll: true });
  }, ACTIVE_SURFACE_POLL_MS);
}

app.whenReady().then(async () => {
  setAiSettingsReader(() => settings);
  resetAiProviderSession({ preferGemini: true });
  if (
    app.isPackaged &&
    typeof process.getuid === 'function' &&
    process.getuid() === 0
  ) {
    dialog.showErrorBox(
      'Aspera Hub',
      'Do not run Aspera Hub as root.\n\nStart it from your normal user session.',
    );
    app.quit();
    return;
  }

  attachChromeProtocolHandler();

  // Keep a friendly name in menus/About; WM class stays "asperadock" for the dock icon.
  if (process.platform !== 'linux') {
    app.setName('Aspera Hub');
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
  syncExtensionsToAllGuestSessions().catch(() => {});
  // Prefetch live model catalogs for saved keys (Auto + Settings picker).
  for (const p of listConfiguredAiProviders().filter((x) => x.configured)) {
    refreshAiProviderModels(p.id, { force: false })
      .then(() => broadcastState())
      .catch(() => {});
  }
  startHibernateTimer();
  startMemoryTimer();
  watchSystemIdle();
  configureUpdater({
    getSettings: () => settings,
    getMainWindow: () => mainWindow,
    onError: (kind, payload) => reportError(kind, payload).catch(() => {}),
    // Native OS dialogs already draw above BrowserViews — do not detach guests
    // (full overlay) or Linux sessions can lose focus and never show the box.
    onBeforeDialog: () => {
      pauseFreezeWatch();
    },
    onAfterDialog: () => {
      resumeFreezeWatch();
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
  const kind = String(details?.type || '');
  if (/gpu/i.test(kind) || /gpu/i.test(String(details?.reason || ''))) {
    try {
      fs.writeFileSync(
        path.join(app.getPath('userData'), 'gpu-crash-v1'),
        new Date().toISOString(),
        'utf8',
      );
    } catch {
      // ignore
    }
  }
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