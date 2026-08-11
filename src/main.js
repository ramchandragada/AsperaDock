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
  nativeTheme,
  webContents as electronWebContents,
} from 'electron';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAppMenuHtml } from './appMenuHtml.js';
import {
  buildChromeMenuHtml,
  chromeMenuPreferredHeight,
} from './chromeMenuHtml.js';
import { buildFindBarHtml } from './findBarHtml.js';
import { buildWebSearchHtml } from './webSearchHtml.js';
import {
  resolveWebSearchInput,
  webSearchTabName,
} from './webSearch.js';
import { buildNotifCenterHtml } from './notifCenterHtml.js';
import { buildAiResultHtml } from './aiResultHtml.js';
import { buildCrmLookupHtml } from './crmLookupHtml.js';
import { buildForwardPickerHtml } from './forwardPickerHtml.js';
import { buildExtensionsHtml } from './extensionsHtml.js';
import {
  isWhatsAppSafeMode,
  whatsappAutomationBlocked,
  whatsappSafeModeBlockedMessage,
} from './whatsappSafeMode.js';
import {
  clearZohoCrmAccessCache,
  exchangeGrantCode,
  searchDeals,
  testZohoCrmConnection,
} from './zohoCrm/client.js';
import {
  buildDealWhatsAppPrepPrompt,
  buildDealsWhatsAppDigestPrepPrompt,
  formatDealWhatsAppMessage,
  formatDealsWhatsAppDigest,
  sanitizePreparedWhatsAppMessage,
} from './zohoCrm/waDealMessage.js';
import {
  ZOHO_CRM_DCS,
  ZOHO_CRM_OAUTH_SCOPES,
  resolveZohoCrmDc,
  sanitizeZohoCrmDc,
} from './zohoCrm/dc.js';
import {
  clearZohoCrmAuth,
  getZohoCrmAuth,
  hasZohoCrmAuth,
  setZohoCrmAuth,
  zohoCrmAuthStatus,
} from './zohoCrm/keys.js';
import {
  getZohoCrmFleetToken,
  setZohoCrmFleetToken,
  zohoCrmFleetStatus,
} from './zohoCrm/fleet.js';
import {
  buildFleetCredentialsUrl,
  normalizeFleetApiUrl,
  parseFleetCredentialsBody,
} from './zohoCrm/fleetPull.js';
import {
  arattaiFullFileUrlFromAny,
  buildForwardClipboardText,
  canOfferForward,
  FORWARD_WITH_HUB_ENABLED,
  classifyForwardFileBytes,
  describeForwardPayload,
  extensionOf,
  extractDocumentFileName,
  forwardContentKind,
  forwardPickerHint,
  forwardPickerSteps,
  forwardReadyMessage,
  forwardRecipientClickSelector,
  forwardRecipientConfirmSelector,
  forwardTimeoutMessage,
  forwardWaitMessage,
  guestComposeDetectJs,
  guestComposeSelector,
  hasStrongDocumentEvidence,
  isDocumentAccept,
  isDocumentExtension,
  isForwardAppId,
  isImageOnlyAccept,
  looksLikeDocument,
  matchRecentDownload,
  mimeForFilename,
  sanitizeForwardFilename,
  sanitizeForwardLinkURL,
  shouldForwardAsDocument,
} from './forwardHub.js';
import {
  moveDownloadClaim,
  releaseDownloadPath,
  resolveSavePathAfterPrompt,
  sanitizeDownloadFilename,
  uniqueDownloadPath,
} from './downloadPath.js';
import { linuxUsesOpaqueOverlays } from './linuxDesktop.js';
import {
  clearMessagingLeftSearchJs,
  composeReplyJs,
  findMessagingChatTargetJs,
  findMessagingLeftSearchJs,
  findMessagingSearchChromeJs,
  inspectChatListTargetJs,
  isInboxAppId,
  isJunkChatName,
  makePinId,
  messagingChatHeaderMatchJs,
  normalizeChatKey,
  openMessagingChatJs,
  sanitizePinnedPeople,
  scrapeMessagingInboxJs,
  searchMessagingChatsJs,
} from './guestInbox.js';
import {
  formatMessagePreview,
  mergeNotificationFeed,
} from './notifFeed.js';
import {
  findExactWhatsAppContactTargetJs,
  findWhatsAppPaneResetJs,
  nuclearWipeMessagingSearchJs,
  readActiveWhatsAppChatJs,
  readMessagingSearchTextJs,
  tryOpenWhatsAppStoreChatJs,
  waMutateSearchJs,
  waSearchNodeJs,
} from './whatsappPinOpen.js';
import {
  PRIOR_MESSAGE_COUNT,
  sanitizePriorMessages,
  scrapeNearbyMessagesJs,
} from './guestChatContext.js';
import { guestContextMenuActionOrder, canOfferHubPin } from './guestContextMenu.js';
import { isHubComposePollution } from './composeSafety.js';
import { aboutDetailText, ASPERA_HUB_WEBSITE } from './aboutCopy.js';
import { spawnSync } from 'node:child_process';
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
  AI_PROVIDER_TRY_ORDER,
  AI_PROVIDERS,
  aiOutputLanguageMeta,
  aiProviderTryOrdinal,
  configuredProvidersInRouteOrder,
  getAiLanguage,
  getAiProvider,
  isAiAllowedAppId,
  isDefaultAiProviderOrder,
  languageSectionFor,
  normalizeAnthropicModel,
  normalizeGeminiModel,
  normalizeGrokModel,
  normalizeSarvamModel,
  refineSectionsForLanguages,
  replySectionsForLanguages,
  resolveAiOutputLanguages,
  sanitizeAiDisabledProviders,
  sanitizeAiExtraLanguages,
  sanitizeAiProviderOrder,
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
import {
  clipboardScreenshotFileName,
  extractPdfText,
  newAttachmentId,
  pdfTextIsUsable,
  pickClipboardImageEncoding,
  validateAiAttachmentMeta,
} from './ai/attachments.js';
import { parseSuggestedReplies } from './ai/replyEditor.js';
import { parseRefinedDrafts, serializeRefinedDrafts } from './ai/refineDraft.js';
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
  canShareProfileAcrossInstances,
  getChromeMetrics,
  getAppCatalogEntry,
  defaultInstanceName,
  defaultInstanceTitle,
  clampAppName,
  buildAppProfileName,
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
import {
  matchShortcut,
  migrateShortcutsMap,
  normalizeShortcutEntry,
} from './shortcutsConfig.js';
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
import {
  configureGuestWindowOpen as configureGuestWindowOpenImpl,
  attachGuestNavigationGate as attachGuestNavigationGateImpl,
} from './guestNavigation.js';
import {
  PORTAL_STALE_MS,
  PORTAL_RELOAD_COOLDOWN_MS,
  PORTAL_RELOAD_COOLDOWN_SALES_MS,
  PORTAL_HEALTH_CHECK_MS,
  PORTAL_HEALTH_RETRY_MS,
  ZOHO_SALES_RECOVERY_DELAYS_MS,
  shouldRunPortalBlankRecovery,
  shouldSkipBlankHeuristicReload,
  portalHealthCheckDelays,
} from './guestIdleRecovery.js';
import {
  hibernateMsFromSettings,
  defaultKeepWarmForApp,
} from './guestLifecycle.js';
import {
  isPageInjectionEnabled,
  normalizeStylishHttpsUrl,
} from './pageInjection.js';
import { openExternalSafe } from './safeShell.js';
import {
  registerChromeScheme,
  attachChromeProtocolHandler,
  chromeAppUrl,
} from './chromeProtocol.js';
import {
  setAiResultServerHtml,
  ensureAiResultServer,
  aiResultLocalUrl,
} from './aiResultServer.js';
import {
  linkTabSiteHome,
  isBlankOrErrorGuestUrl,
  isOauthHandoffUrl,
  shouldAdoptLinkTabPopupUrlAfterIdp,
  LINK_TAB_POST_AUTH_CHECK_MS,
} from './linkTabAuthRecovery.js';
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
  mustKeepGoogleUrlInApp,
  isSameEcosystemUrl,
  isGoogleOauthClientUrl,
  shouldOpenInSystemBrowser,
  isIdentityProviderUrl,
  shouldOpenZohoSharedDeepLinkAsHubTab,
  isZohoAssetHost,
  isMessagingAppId,
  isAllowedMessagingTabUrl,
  gmailWindowOpenAction,
} from './guestNav.js';
import {
  resolveLinkHandling,
  shouldOpenUnknownExternally,
  shouldOpenAsHubTab,
  shouldAskLinkHandling,
  normalizeLinkHandling,
  rememberModeForChoice,
} from './linkHandling.js';
import {
  isGoogleService,
  isGoogleMailAppUrl,
  attachGoogleChromeSpoof,
  applyGoogleRequestHeaders,
  noteGoogleMarketingLanding,
} from './vendors/google.js';
import { reclaimServiceHomeIfWrongProduct as reclaimZohoHome } from './vendors/zoho.js';
import { clearStaleChromiumSingleton } from './chromiumSingleton.js';
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
  // Wayland compositors (Mint + newer Electron) can FATAL on reset;
  // prefer XWayland unless the user already chose a platform.
  if (
    !app.commandLine.hasSwitch('ozone-platform') &&
    !process.env.ELECTRON_OZONE_PLATFORM_HINT &&
    (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland')
  ) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  }
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

try {
  clearStaleChromiumSingleton(app.getPath('userData'));
} catch {
  // ignore
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another live instance owns the dock — exit immediately so this process
  // never reaches createWindow() / whenReady (app.quit alone is not enough).
  app.quit();
  process.exit(0);
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
/** @type {{ id: string, serviceId: string, title: string, body: string, at: number, chatName?: string, chatKey?: string }[]} */
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
/** Floating Find-in-page popup (above WebContentsView — no guest resize). */
let findBarWindow = null;
/** Last find query so Ctrl+F reopens with the same text selected. */
let findBarLastQuery = '';
/** Bumped on every find/clear so late found-in-page cannot re-paint highlights. */
let findBarSession = 0;
/** Chromium findInPage request id — ignore stale replies from earlier keystrokes. */
let findBarRequestId = 0;
/** Floating Google Web-search popup. */
let webSearchWindow = null;
/** Last web-search query so Ctrl+K reopens with the same text selected. */
let webSearchLastQuery = '';
/** Floating notification center. */
let notifCenterWindow = null;
/** Floating Aspera AI result panel. */
let aiResultWindow = null;
/** Context for follow-up actions on the open AI result (e.g. suggest replies). */
let aiResultContext = null;
/** One staged file for Aspera AI inbox: { id, name, mime, kind, buffer }. */
let aiInboxAttachment = null;
/** Floating Zoho CRM Deals lookup panel. */
let crmLookupWindow = null;
/** Floating Forward-with-Hub account picker. */
let forwardPickerWindow = null;
/** @type {null | {
 *   text: string,
 *   linkURL: string,
 *   imagePath: string,
 *   filePath: string,
 *   fileName: string,
 *   hasImage: boolean,
 *   isDocument: boolean,
 *   sourceServiceId: string,
 *   sourceAppId: string,
 *   sourceName: string,
 * }} */
let forwardPayload = null;
/** One-shot download hijack used while capturing a document to forward. */
let pendingForwardDownload = null;
/**
 * Brief tail after Forward hijack completes — swallow duplicate DownloadItems
 * from the same preview click only. Must NOT block normal user downloads.
 */
let forwardExtraSwallowUntil = 0;
const FORWARD_EXTRA_SWALLOW_MS = 2_000;
/** Bumped to cancel in-flight Forward Ctrl+V waits (prevents paste into later chats). */
let forwardPasteGeneration = 0;
/** Text Hub last wrote to the system clipboard for Forward (for restore + sanitize). */
let hubStagedClipboardText = '';
/** Clipboard text before Hub staged a Forward payload. */
let hubClipboardBeforeStage = null;
/** Recent guest downloads (user tapped Download) — reused by Forward. */
const recentGuestDownloads = [];
const RECENT_DOWNLOAD_MAX = 40;
/** Dedupe double will-download from one preview click (same URL + name). */
let lastGuestDownloadDedupeKey = '';
let lastGuestDownloadDedupeAt = 0;

function beginForwardExtraSwallow(ms = FORWARD_EXTRA_SWALLOW_MS) {
  forwardExtraSwallowUntil = Math.max(forwardExtraSwallowUntil, Date.now() + ms);
}

function endForwardExtraSwallow() {
  forwardExtraSwallowUntil = 0;
}

function shouldSwallowForwardExtraDownload() {
  return Date.now() < forwardExtraSwallowUntil;
}

function swallowForwardExtraDownload(item) {
  try {
    item.cancel();
  } catch {
    try {
      const dump = path.join(
        forwardTempDir(),
        `fwd-extra-${Date.now()}-${sanitizeForwardFilename(item.getFilename() || 'bin')}`,
      );
      item.setSavePath(dump);
      item.once('done', () => {
        try {
          fs.unlinkSync(dump);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Ask-every-time Save As for guest downloads.
 *
 * Electron only honors `setSavePath` inside `will-download`. We claim a temp
 * path immediately (silences Chromium's dialog), show Hub's picker, then on
 * `done` move the claim to the user's path via {@link moveDownloadClaim}.
 * Changing `setSavePath` after the dialog and deleting the claim (v0.5.20)
 * left users with no file on disk.
 *
 * @param {object} destHolder Shared with the will-download `done` handler.
 */
function promptGuestDownloadSave(item, defaultPath, downloadName, destHolder) {
  const suggested = String(defaultPath || '').trim();
  const intendedName =
    String(downloadName || '').trim() ||
    item.getFilename?.() ||
    path.basename(suggested) ||
    'download';

  let claimPath = '';
  try {
    const claimDir = path.join(app.getPath('temp'), 'asperahub-downloads');
    fs.mkdirSync(claimDir, { recursive: true });
    claimPath = path.join(
      claimDir,
      `${Date.now()}-${sanitizeDownloadFilename(intendedName)}`,
    );
    item.setSavePath(claimPath);
  } catch {
    try {
      if (suggested) {
        claimPath = suggested;
        item.setSavePath(claimPath);
      }
    } catch {
      // ignore
    }
  }

  destHolder.claimPath = claimPath;
  destHolder.path = suggested;

  try {
    item.pause();
  } catch {
    // ignore — older builds may not support pause
  }
  const parent =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  try {
    if (parent) {
      if (parent.isMinimized()) parent.restore();
      parent.show();
      parent.focus();
      parent.moveTop?.();
    }
  } catch {
    // ignore
  }

  const cleanupClaimFile = () => {
    if (!claimPath) return;
    try {
      if (fs.existsSync(claimPath)) fs.unlinkSync(claimPath);
    } catch {
      // ignore
    }
  };

  const finishWithPath = (pickedPath) => {
    releaseDownloadPath(suggested);
    const finalPath = resolveSavePathAfterPrompt(pickedPath, intendedName);
    destHolder.path = finalPath;
    destHolder.canceled = false;
    destHolder.resolveReady();
    // Do not setSavePath here — it only applies inside will-download.
    // Do not delete claimPath — the file is still downloading (or already
    // finished) there and will be moved on `done`.
    try {
      item.resume();
    } catch {
      // ignore — download may already be complete
    }
  };

  const cancelItem = () => {
    destHolder.canceled = true;
    destHolder.resolveReady();
    releaseDownloadPath(suggested);
    try {
      item.cancel();
    } catch {
      // ignore
    }
    cleanupClaimFile();
  };

  dialog
    .showSaveDialog(parent, {
      title: 'Save download',
      defaultPath: suggested,
      buttonLabel: 'Save',
      nameFieldLabel: 'File name:',
      properties: ['createDirectory'],
    })
    .then(({ canceled, filePath }) => {
      if (canceled || !filePath) {
        cancelItem();
        return;
      }
      finishWithPath(filePath);
    })
    .catch(() => {
      // showSaveDialog failed — save to the suggested Downloads location.
      try {
        finishWithPath(suggested);
      } catch {
        cancelItem();
      }
    });
}
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

/**
 * SPAs that need an unthrottled first boot (then stay full-speed if warm).
 */
function isHeavyPortalApp(service) {
  const id = service?.appId;
  return id === 'zoho-one' || id === 'arattai' || id === 'zoho-crm';
}

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

/** Defer inbox scrape while PDF/media preview is open (common in group chats). */
const scrapeDeferTimers = new Map();
const SCRAPE_DEFER_MS = 5_000;

function guestMediaViewerOpenJs() {
  return `(() => {
    if (document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], .pdfViewer, #viewer')) {
      return true;
    }
    const roots = [];
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) roots.push(dialog);
    const viewer = document.querySelector(
      '[data-testid="media-viewer"], [data-testid="media-viewer-modal"], #media-viewer, .media-viewer',
    );
    if (viewer) roots.push(viewer);
    for (const root of roots) {
      if (root.querySelector('embed, object, iframe, canvas, video, img[src^="blob:"]')) return true;
      const label = (root.getAttribute('aria-label') || root.textContent || '').slice(0, 240);
      if (/\\bPDF\\b|application\\/pdf|document preview/i.test(label)) return true;
    }
    return false;
  })()`;
}

function serviceHasBlobPreviewPopup(serviceId) {
  const set = servicePopups.get(serviceId);
  if (!set?.size) return false;
  for (const win of set) {
    try {
      if (win.isDestroyed?.()) continue;
      const url = String(win.webContents?.getURL?.() || '');
      if (/^blob:|^data:/i.test(url)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function serviceIsBusyWithMediaViewer(serviceId) {
  if (serviceHasBlobPreviewPopup(serviceId)) return true;
  const wc = views.get(serviceId)?.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  try {
    return await wc.executeJavaScript(guestMediaViewerOpenJs(), true);
  } catch {
    return false;
  }
}

function scheduleDeferredInboxScrape(service, run) {
  const key = String(service?.id || '');
  if (!key || scrapeDeferTimers.has(key)) return;
  scrapeDeferTimers.set(
    key,
    setTimeout(async () => {
      scrapeDeferTimers.delete(key);
      if (await serviceIsBusyWithMediaViewer(key)) {
        scheduleDeferredInboxScrape(service, run);
        return;
      }
      run();
    }, SCRAPE_DEFER_MS),
  );
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
  // Zoho CRM/Books white forms look "blank" to capturePage — never soft-reload.
  if (shouldSkipBlankHeuristicReload(service)) {
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

  if (isMessagingApp(service) && (await serviceIsBusyWithMediaViewer(id))) {
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

  // Second strike: reload only for non-messaging / non-CRM-form apps.
  entry.__surfaceBlankStrikes = 0;
  if (isMessagingApp(service) || shouldSkipBlankHeuristicReload(service)) {
    // Keep trying gentle repaints; never reload WhatsApp or CRM/Books forms.
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

  for (const delay of portalHealthCheckDelays(awayMs, reason)) {
    checkAt(delay, delay >= 1200);
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
  // Messaging + Zoho form apps stay warm by default unless the user turned
  // keepWarm off — otherwise switching tabs wiped unsaved CRM/Books drafts.
  const warmDefault =
    defaultKeepWarmForApp(appId) && stored.keepWarm === undefined
      ? { keepWarm: true }
      : {};
  return mergeAppConfig({ ...warmDefault, ...stored });
}

function saveAppConfig(id, patch) {
  const prev = getAppConfig(id);
  const next = mergeAppConfig({ ...prev, ...patch });
  const serviceConfigs = { ...(settings.serviceConfigs || {}), [id]: next };
  settings = saveSettings({ serviceConfigs });
  // Keep live view's service snapshot in sync (linkHandling, etc.).
  const entry = views.get(id);
  if (entry) {
    const fresh = getService(id);
    if (fresh) entry.service = fresh;
  }
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
 * Auto-assign a dedicated profile named like "WhatsApp 1" / "Gmail 2".
 * First copy and extras each get their own partition (separate logins).
 * Zoho suite tabs share one profile so workspace login stays linked.
 */
function profileIdForNewApp(appId, entry) {
  const existing = (settings.serviceInstances || []).filter((i) => i.appId === appId);
  if (canShareProfileAcrossInstances(appId)) {
    if (!existing.length) {
      const created = createProfile(buildAppProfileName(entry.name, 1));
      return created.profile.id;
    }
    return (
      existing[0].profileId ||
      getProfile(PRIMARY_PROFILE_ID)?.id ||
      PRIMARY_PROFILE_ID
    );
  }
  const slot = existing.length + 1;
  const created = createProfile(buildAppProfileName(entry.name, slot));
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
    const sourceAppId = String(inst.sourceAppId || '').trim() || null;
    const sourceEntry = sourceAppId ? getAppCatalogEntry(sourceAppId) : null;
    // Prefer source app branding (WhatsApp, Gmail, …) so link tabs match origin.
    const logo = sourceEntry?.logo || inst.logo || 'custom';
    const color = sourceEntry?.color || inst.color || entry.color;
    const sourceName = sourceEntry?.name || sourceEntry?.title || '';
    return {
      id: inst.id,
      appId: CUSTOM_APP_ID,
      name,
      title: String(inst.title || name).trim() || name,
      url,
      partition: partitionForInstance(inst),
      profileId: profile?.id || PRIMARY_PROFILE_ID,
      profileName: profile?.name || 'Primary',
      color,
      logo,
      keepWarm: false,
      slot,
      config,
      isCustom: true,
      linkTab: !!inst.linkTab,
      sourceAppId,
      sourceName,
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

function addService(appId, profileId = null, { startUrl = null } = {}) {
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
  // Zoho CRM/One may share a profile so multiple Hub tabs keep one login.
  // Custom URLs may share a profile (different sites, same cookies jar is fine).
  if (!isCustomAppId(appId) && !canShareProfileAcrossInstances(appId)) {
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

  let lastServiceUrls = settings.lastServiceUrls || {};
  const initialUrl =
    startUrl &&
    String(startUrl).startsWith('http') &&
    isInternalUrl(startUrl, { ...entry, id: 'pending', url: entry.url, appId })
      ? String(startUrl)
      : null;
  if (initialUrl) {
    lastServiceUrls = { ...lastServiceUrls, [id]: initialUrl };
    lastGoodUrls.set(id, initialUrl);
  }

  settings = saveSettings({
    serviceInstances: instances,
    serviceOrder,
    ...(initialUrl ? { lastServiceUrls } : {}),
    ...(canShareProfileAcrossInstances(appId)
      ? {
          serviceConfigs: {
            ...(settings.serviceConfigs || {}),
            [id]: {
              ...mergeAppConfig((settings.serviceConfigs || {})[id]),
              // New Zoho workspace tabs default to Hub-tab link handling.
              linkHandling:
                (settings.serviceConfigs || {})[id]?.linkHandling ?? 'hub-tab',
            },
          },
        }
      : {}),
  });
  broadcastState();
  activateService(id);
  return { ok: true, id, profileId: resolvedProfileId };
}

/**
 * Open a Zoho (or shared-profile) deep link as a new Hub app-bar tab that
 * reuses the source app's login/session. Returns false if the dock is full
 * or the URL is not suitable — callers may fall back to a popup.
 */
function openInternalLinkAsHubTab(sourceService, url) {
  if (!sourceService?.appId || !url) return false;
  if (!canShareProfileAcrossInstances(sourceService.appId)) return false;
  if (!String(url).startsWith('http')) return false;
  if (!isInternalUrl(url, sourceService)) return false;
  if (isAuthOrLoginUrl(url)) return false;
  if (isZohoAssetHost(url)) return false;
  if (totalAppCount() >= MAX_APPS_TOTAL) return false;
  if (countInstances(sourceService.appId) >= MAX_INSTANCES_PER_APP) return false;

  const result = addService(sourceService.appId, sourceService.profileId, {
    startUrl: url,
  });
  return !!result?.ok;
}

/** Effective link-handling mode — same Hub-wide rule for every app. */
function effectiveLinkHandling(_service) {
  return resolveLinkHandling(null, settings.linkHandling || 'hub-tab');
}

/** Live service record (config/logo may change after the view was created). */
function liveService(service) {
  if (!service?.id) return service;
  return getService(service.id) || service;
}

/** Open a third-party URL in the OS browser only when the mode allows it. */
function openUnknownExternalIfAllowed(service, url) {
  if (!shouldOpenUnknownExternally(effectiveLinkHandling(service))) return false;
  if (!shouldOpenInSystemBrowser(url)) return false;
  return openExternalSafe(url);
}

/** Extra temporary link tabs allowed beyond the normal 10-app bar. */
const LINK_TAB_OVERFLOW = 4;

function tabNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '');
    const parts = host.split('.').filter(Boolean);
    // Prefer meaningful label: w.meta.me → meta, flexiloans.com → flexiloans
    let raw = parts[0] || 'Link';
    if (parts.length >= 2 && raw.length <= 2) raw = parts[1];
    const label = String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
    return clampAppName(label || 'Link');
  } catch {
    return 'Link';
  }
}

function listLinkTabInstances() {
  return (settings.serviceInstances || []).filter(
    (i) => i?.linkTab && isCustomAppId(i.appId),
  );
}

/**
 * Open any http(s) URL as a real Hub app-bar tab (right of existing apps).
 * Zoho shared-login deep links reuse the source profile; other links become
 * temporary custom tabs (recyclable when the bar is full).
 */
function openUrlAsHubAppTab(url, sourceService = null, opts = {}) {
  const href = String(url || '').trim();
  if (!href.startsWith('http')) {
    return { ok: false, error: 'Invalid link' };
  }
  if (isForbiddenGuestNavigation(href)) {
    return { ok: false, error: 'This link cannot be opened in Hub' };
  }

  // Zoho CRM/One/… shared workspace tabs.
  if (openInternalLinkAsHubTab(sourceService, href)) {
    return { ok: true, kind: 'shared' };
  }

  // Reuse an existing link tab for the same URL.
  const existing = orderedServices().find(
    (s) =>
      s.isCustom &&
      s.url &&
      String(s.url).split('#')[0] === href.split('#')[0],
  );
  if (existing) {
    const lastServiceUrls = {
      ...(settings.lastServiceUrls || {}),
      [existing.id]: href,
    };
    settings = saveSettings({ lastServiceUrls });
    lastGoodUrls.set(existing.id, href);
    activateService(existing.id);
    const wc = views.get(existing.id)?.view?.webContents;
    if (wc && !wc.isDestroyed()) wc.loadURL(href).catch(() => {});
    return { ok: true, id: existing.id, kind: 'reuse' };
  }

  const maxLinkDock = MAX_APPS_TOTAL + LINK_TAB_OVERFLOW;
  // Only recycle after all overflow slots are full — keep up to LINK_TAB_OVERFLOW
  // Hub link tabs open at once (same or different apps).
  if (totalAppCount() >= maxLinkDock) {
    const victims = listLinkTabInstances();
    if (!victims.length) {
      return {
        ok: false,
        error: `App bar is full (${MAX_APPS_TOTAL} apps + ${LINK_TAB_OVERFLOW} link tabs). Close a link tab or remove an app.`,
      };
    }
    removeService(victims[0].id);
  }

  if (totalAppCount() >= maxLinkDock) {
    return {
      ok: false,
      error: `App bar is full. Close a link tab or remove an app.`,
    };
  }

  const slot = nextSlot(CUSTOM_APP_ID);
  if (!slot) {
    return { ok: false, error: 'Too many link tabs open' };
  }

  const id = `${CUSTOM_APP_ID}-${slot}-${Date.now().toString(36)}`;
  const preferredName = String(opts?.tabName || '').trim();
  const name = preferredName
    ? clampAppName(preferredName)
    : tabNameFromUrl(href);
  const profileId =
    getProfile(PRIMARY_PROFILE_ID)?.id || PRIMARY_PROFILE_ID;
  const sourceAppId = sourceService?.appId || null;
  const sourceEntry = sourceAppId ? getAppCatalogEntry(sourceAppId) : null;
  const instances = [
    ...(settings.serviceInstances || []),
    {
      id,
      appId: CUSTOM_APP_ID,
      profileId,
      slot,
      url: href,
      name,
      title: name,
      linkTab: true,
      sourceAppId,
      logo: sourceEntry?.logo || 'custom',
      color: sourceEntry?.color || '#3D5A80',
    },
  ];
  const serviceOrder = [...(settings.serviceOrder || []), id];
  const lastServiceUrls = {
    ...(settings.lastServiceUrls || {}),
    [id]: href,
  };
  settings = saveSettings({
    serviceInstances: instances,
    serviceOrder,
    lastServiceUrls,
    serviceConfigs: {
      ...(settings.serviceConfigs || {}),
      [id]: {
        ...mergeAppConfig((settings.serviceConfigs || {})[id]),
        // Inside a link tab, browse freely — don’t re-ask on every redirect.
        linkHandling: 'block',
        keepWarm: false,
      },
    },
  });
  lastGoodUrls.set(id, href);
  broadcastState();
  activateService(id);
  // Ensure the target loads even if activate raced before lastServiceUrls hydrated.
  const entry = views.get(id);
  const wc = entry?.view?.webContents;
  if (wc && !wc.isDestroyed()) {
    const current = (() => {
      try {
        return wc.getURL();
      } catch {
        return '';
      }
    })();
    if (!current || current === 'about:blank' || !current.startsWith('http')) {
      wc.loadURL(href).catch(() => {});
    }
  }
  return { ok: true, id, kind: 'link-tab' };
}

/** Serialize ask-mode chooser dialogs (never drop rapid clicks). */
const linkAskQueue = [];
let linkAskBusy = false;

/**
 * Rambox-style chooser: browser vs Hub tab, optional remember for this app.
 * Always deny/prevent the original navigation first, then call this async.
 */
function promptAndApplyLinkChoice(service, url, webContents) {
  const href = String(url || '');
  if (!href.startsWith('http')) return;
  linkAskQueue.push({ service, url: href, webContents });
  void drainLinkAskQueue();
}

async function drainLinkAskQueue() {
  if (linkAskBusy) return;
  linkAskBusy = true;
  try {
    while (linkAskQueue.length) {
      const job = linkAskQueue.shift();
      await runLinkAskDialog(job.service, job.url, job.webContents);
    }
  } finally {
    linkAskBusy = false;
    if (linkAskQueue.length) void drainLinkAskQueue();
  }
}

async function runLinkAskDialog(service, href, webContents) {
  try {
    const detail =
      href.length > 480 ? `${href.slice(0, 477)}…` : href;
    const box = {
      type: 'question',
      buttons: ['Open in default browser', 'Open in Hub tab', 'Cancel'],
      defaultId: 1,
      cancelId: 2,
      title: 'Open link',
      message: 'How should Aspera Hub open this link?',
      detail,
      checkboxLabel: 'Do this for all apps always',
      checkboxChecked: false,
      noLink: true,
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, box)
      : await dialog.showMessageBox(box);
    if (result.response === 2) return;

    const choice = result.response === 0 ? 'browser' : 'hub-tab';
    if (result.checkboxChecked) {
      settings = saveSettings({
        linkHandling: rememberModeForChoice(choice),
      });
      broadcastState();
    }

    if (choice === 'browser') {
      if (shouldOpenInSystemBrowser(href)) openExternalSafe(href);
      return;
    }

    // Real app-bar tab (never a floating popup window).
    const opened = openUrlAsHubAppTab(href, service);
    if (!opened.ok) {
      const errBox = {
        type: 'warning',
        buttons: ['OK'],
        title: 'Could not open Hub tab',
        message: opened.error || 'App bar is full.',
      };
      if (mainWindow) await dialog.showMessageBox(mainWindow, errBox);
      else await dialog.showMessageBox(errBox);
    }
  } catch (err) {
    reportError('link-ask-failed', {
      message: String(err?.message || err),
      url: href.slice(0, 200),
    }).catch(() => {});
  }
}

/**
 * Handle an outbound / new-window http link according to linkHandling.
 * Returns true when the caller should deny/preventDefault (already handled).
 *
 * Rule (all apps the same): “Hub tab” always means a real top app-bar tab —
 * never a floating BrowserWindow.
 */
function handleOutboundOrNewWindowLink(service, url, webContents, opts = {}) {
  const href = String(url || '');
  if (!href.startsWith('http')) return false;
  const allowHubTab = opts.allowHubTab === true;
  // Temporary Hub link tabs (opened from WhatsApp/Arattai/etc.): keep login and
  // redirects in the same tab. Spawning another top-bar tab mid-login leaves
  // the original Canva/site tab blank after auth.
  if (service?.isCustom || service?.linkTab) {
    if (
      (isAuthOrLoginUrl(href) && isGoogleOwnedUrl(href)) ||
      mustKeepGoogleUrlInApp(href)
    ) {
      return false;
    }
    if (webContents && !webContents.isDestroyed()) {
      webContents.loadURL(href).catch(() => {});
      return true;
    }
    return false;
  }
  // WhatsApp / Arattai: Hub-tab BEFORE same-ecosystem. google.com is in
  // INTERNAL_HOSTS for Gmail, so Drive used to hit loadURL-in-messenger and
  // fight will-navigate preventDefault — link opened nowhere.
  if (
    isMessagingAppId(service?.appId) &&
    !isAllowedMessagingTabUrl(service, href)
  ) {
    const opened = openUrlAsHubAppTab(href, service);
    if (!opened.ok && opened.error) {
      const errBox = {
        type: 'warning',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Could not open Hub tab',
        message: opened.error,
      };
      if (mainWindow) dialog.showMessageBox(mainWindow, errBox).catch(() => {});
      else dialog.showMessageBox(errBox).catch(() => {});
    }
    return true;
  }
  // Catalog apps (Gmail/Zoho/…): same-ecosystem URLs stay in-tab — except Zoho
  // CRM/Books/One deep links, which open as shared-login Hub tabs (multi-screen).
  // Gmail email links pass allowHubTab: true → Hub tab (keep inbox; no popup).
  if (!(service?.isCustom || service?.linkTab) && isSameEcosystemUrl(service, href)) {
    if (
      isGoogleOauthClientUrl(href) ||
      (isAuthOrLoginUrl(href) && isGoogleOwnedUrl(href)) ||
      (mustKeepGoogleUrlInApp(href) && !allowHubTab)
    ) {
      return false; // real popup
    }
    if (
      allowHubTab &&
      isGoogleService(service) &&
      shouldOpenAsHubTab(effectiveLinkHandling(service))
    ) {
      const opened = openUrlAsHubAppTab(href, service);
      if (!opened.ok && opened.error) {
        const errBox = {
          type: 'warning',
          buttons: ['OK'],
          defaultId: 0,
          title: 'Could not open Hub tab',
          message: opened.error,
        };
        if (mainWindow) dialog.showMessageBox(mainWindow, errBox).catch(() => {});
        else dialog.showMessageBox(errBox).catch(() => {});
      }
      return true;
    }
    if (isGoogleService(service) && !isAllowedGmailTabUrl(href)) {
      return false; // allow popup / stay; do not Hub-tab Google side UIs
    }
    if (webContents && !webContents.isDestroyed()) {
      try {
        const cur = String(webContents.getURL() || '');
        if (cur.split('#')[0] === href.split('#')[0]) return true;
      } catch {
        // ignore
      }
    }
    if (
      shouldOpenZohoSharedDeepLinkAsHubTab(service, href) &&
      shouldOpenAsHubTab(effectiveLinkHandling(service)) &&
      openInternalLinkAsHubTab(service, href)
    ) {
      return true;
    }
    if (webContents && !webContents.isDestroyed()) {
      webContents.loadURL(href).catch(() => {});
      return true;
    }
    return false;
  }
  // Gmail sign-in / SSO must never spawn Hub link tabs (e.g. 2507573.apps…).
  // Email-link unwraps and window.open targets pass allowHubTab: true.
  if (isGoogleService(service) && !(service?.isCustom || service?.linkTab) && !allowHubTab) {
    if (shouldOpenInSystemBrowser(href)) openExternalSafe(href);
    return true;
  }
  const mode = effectiveLinkHandling(service);
  if (shouldAskLinkHandling(mode)) {
    void promptAndApplyLinkChoice(service, href, webContents);
    return true;
  }
  if (shouldOpenAsHubTab(mode)) {
    const opened = openUrlAsHubAppTab(href, service);
    if (!opened.ok && opened.error) {
      const errBox = {
        type: 'warning',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Could not open Hub tab',
        message: opened.error,
      };
      if (mainWindow) dialog.showMessageBox(mainWindow, errBox).catch(() => {});
      else dialog.showMessageBox(errBox).catch(() => {});
    }
    return true;
  }
  if (isInternalUrl(href, service)) {
    return false;
  }
  openUnknownExternalIfAllowed(service, href);
  return true;
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
      !isCustomAppId(inst.appId) &&
      !canShareProfileAcrossInstances(inst.appId),
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
  return hibernateMsFromSettings(settings.hibernateMinutes, {
    lowMemoryMode: isLowMemoryMode(),
  });
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

/**
 * After closing a floating child (Find / Web search), mainWindow often is not
 * focused yet — dockIsUserFocused() is false and focusActiveContents() no-ops,
 * so WhatsApp compose receives no keys until the user opens Find again.
 */
function restoreGuestFocusAfterFloat() {
  if (locked || overlayOpen || !activeServiceId) return;
  const entry = views.get(activeServiceId);
  const wc = entry?.view?.webContents;
  const kick = () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    } catch {
      // ignore
    }
    try {
      if (wc && !wc.isDestroyed()) wc.focus();
    } catch {
      // ignore
    }
  };
  kick();
  setTimeout(kick, 0);
  setTimeout(kick, 40);
  setTimeout(kick, 120);
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

function findBarHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !findBarWindow ||
      findBarWindow.isDestroyed() ||
      event.sender !== findBarWindow.webContents
    ) {
      throw new Error('Unauthorized find-bar IPC sender');
    }
    return handler(event, ...args);
  });
}

function webSearchHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !webSearchWindow ||
      webSearchWindow.isDestroyed() ||
      event.sender !== webSearchWindow.webContents
    ) {
      throw new Error('Unauthorized web-search IPC sender');
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

function crmLookupHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !crmLookupWindow ||
      crmLookupWindow.isDestroyed() ||
      event.sender !== crmLookupWindow.webContents
    ) {
      throw new Error('Unauthorized crm-lookup IPC sender');
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

/**
 * Park warm + recently-used tabs off-screen (keeps Zoho/CRM SPAs alive on
 * Mint XFCE). Only detach truly stale non-warm guests.
 */
function parkBackgroundViews(exceptId = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  for (const [viewId, entry] of views.entries()) {
    if (viewId === exceptId) continue;
    if (isKeepWarmService(viewId) || !isEvictableBackground(viewId, entry)) {
      parkGuestView(entry, viewId);
    } else {
      detachGuestView(entry.view);
    }
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

function closeFindBarWindow({ clear = true } = {}) {
  if (clear) {
    try {
      stopFindInActivePage();
    } catch {
      // ignore
    }
  }
  if (!findBarWindow || findBarWindow.isDestroyed()) {
    findBarWindow = null;
    restoreGuestFocusAfterFloat();
    return;
  }
  const win = findBarWindow;
  findBarWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
  // Force focus back to WhatsApp/Arattai compose (not focusActiveContents —
  // mainWindow is often unfocused while the Find child still had keyboard).
  restoreGuestFocusAfterFloat();
}

function isFindBarOpen() {
  return !!(findBarWindow && !findBarWindow.isDestroyed());
}

function closeWebSearchWindow() {
  if (!webSearchWindow || webSearchWindow.isDestroyed()) {
    webSearchWindow = null;
    restoreGuestFocusAfterFloat();
    return;
  }
  const win = webSearchWindow;
  webSearchWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
  restoreGuestFocusAfterFloat();
}

function isWebSearchOpen() {
  return !!(webSearchWindow && !webSearchWindow.isDestroyed());
}

/**
 * Floating Google Web-search popup (Aspera AI / Find pattern).
 * Enter opens results in a Hub link tab — WhatsApp stays put.
 */
function openWebSearchWindow({ dark = null } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  if (isWebSearchOpen()) {
    try {
      webSearchWindow.show();
      webSearchWindow.focus();
      webSearchWindow.webContents.focus();
      webSearchWindow.webContents.send('web-search:init', {
        query: webSearchLastQuery,
      });
    } catch {
      // ignore
    }
    return { ok: true, focused: true };
  }

  closeFindBarWindow({ clear: false });
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeAppContextMenu();

  const barW = 480;
  const barH = 132;
  const content = mainWindow.getContentBounds();
  const chromeTop = Math.max(48, Number(effectiveMetrics().top) || 78);
  const rawX = content.x + Math.max(12, Math.floor((content.width - barW) / 2));
  const rawY = content.y + chromeTop + 10;
  const pos = clampFloatPosition(rawX, rawY, barW, barH);
  const darkNow =
    typeof dark === 'boolean' ? dark : !!nativeTheme.shouldUseDarkColors;

  webSearchWindow = createFloatBrowserWindow({
    width: barW,
    height: barH,
    x: pos.x,
    y: pos.y,
    preload: 'webSearchPreload.js',
    dark: darkNow,
  });

  const win = webSearchWindow;
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildWebSearchHtml(darkNow))}`,
  );

  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.webContents.send('web-search:init', { query: webSearchLastQuery });
  });
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    win.show();
    try {
      if (typeof win.moveTop === 'function') win.moveTop();
    } catch {
      // ignore
    }
    win.focus();
    try {
      win.webContents.focus();
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (win.isDestroyed()) return;
      try {
        win.focus();
        win.webContents.focus();
      } catch {
        // ignore
      }
    }, 40);
  });
  win.on('closed', () => {
    if (webSearchWindow === win) webSearchWindow = null;
  });

  return { ok: true };
}

function runWebSearch(text) {
  const query = String(text || '');
  webSearchLastQuery = query.trim();
  const href = resolveWebSearchInput(query);
  if (!href) return { ok: false, error: 'Empty search' };
  const result = openUrlAsHubAppTab(href, null, {
    tabName: webSearchTabName(query),
  });
  closeWebSearchWindow();
  return result;
}

/**
 * Floating Find popup above the guest. In-page HTML cannot paint over
 * WebContentsView, so we must not push the page down to reveal a chrome bar.
 */
function openFindBarWindow({ dark = null } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  if (isFindBarOpen()) {
    try {
      findBarWindow.show();
      findBarWindow.focus();
      findBarWindow.webContents.focus();
      findBarWindow.webContents.send('find-bar:init', {
        query: findBarLastQuery,
      });
    } catch {
      // ignore
    }
    return { ok: true, focused: true };
  }

  closeWebSearchWindow();
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeAppContextMenu();

  const barW = 360;
  const barH = 56;
  const content = mainWindow.getContentBounds();
  const chromeTop = Math.max(48, Number(effectiveMetrics().top) || 78);
  const rawX = content.x + content.width - barW - 12;
  const rawY = content.y + chromeTop + 8;
  const pos = clampFloatPosition(rawX, rawY, barW, barH);
  const darkNow =
    typeof dark === 'boolean' ? dark : !!nativeTheme.shouldUseDarkColors;

  findBarWindow = createFloatBrowserWindow({
    width: barW,
    height: barH,
    x: pos.x,
    y: pos.y,
    preload: 'findBarPreload.js',
    dark: darkNow,
  });

  const win = findBarWindow;
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildFindBarHtml(darkNow))}`,
  );

  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.webContents.send('find-bar:init', { query: findBarLastQuery });
  });
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    win.show();
    // XFCE / Cinnamon focus-stealing: raise + focus so typing works immediately.
    try {
      if (typeof win.moveTop === 'function') win.moveTop();
    } catch {
      // ignore
    }
    win.focus();
    try {
      win.webContents.focus();
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (win.isDestroyed()) return;
      try {
        win.focus();
        win.webContents.focus();
      } catch {
        // ignore
      }
    }, 40);
  });
  // Do NOT close on blur — user clicks the page to read match highlights.
  win.on('closed', () => {
    if (findBarWindow === win) findBarWindow = null;
  });

  return { ok: true };
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
  clearAiInboxAttachment();
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

function closeCrmLookupWindow() {
  if (!crmLookupWindow || crmLookupWindow.isDestroyed()) {
    crmLookupWindow = null;
    return;
  }
  const win = crmLookupWindow;
  crmLookupWindow = null;
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

function closeForwardPickerWindow({ clearPayload = false } = {}) {
  if (!forwardPickerWindow || forwardPickerWindow.isDestroyed()) {
    forwardPickerWindow = null;
    if (clearPayload) {
      cancelPendingForwardPaste();
      forwardPayload = null;
      restoreHubClipboardAfterForward();
    }
    return;
  }
  const win = forwardPickerWindow;
  forwardPickerWindow = null;
  try {
    win.close();
  } catch {
    // ignore
  }
  if (clearPayload) {
    cancelPendingForwardPaste();
    forwardPayload = null;
    restoreHubClipboardAfterForward();
  }
}

function cancelPendingForwardPaste() {
  forwardPasteGeneration += 1;
}

function restoreHubClipboardAfterForward() {
  try {
    if (hubClipboardBeforeStage) {
      clipboard.writeText(String(hubClipboardBeforeStage.text || ''));
    } else if (hubStagedClipboardText) {
      const cur = clipboard.readText() || '';
      if (cur === hubStagedClipboardText) clipboard.clear();
    }
  } catch {
    // ignore
  }
  hubClipboardBeforeStage = null;
  hubStagedClipboardText = '';
}

function stageHubForwardClipboard(write) {
  try {
    hubClipboardBeforeStage = { text: clipboard.readText() || '' };
  } catch {
    hubClipboardBeforeStage = { text: '' };
  }
  hubStagedClipboardText = String(write?.text || '');
  clipboard.write(write);
}

function closeAllFloatMenus() {
  closeAppContextMenu();
  closeChromeMenuWindow();
  closeFindBarWindow({ clear: true });
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

function createFloatBrowserWindow({
  width,
  height,
  x,
  y,
  preload,
  dark = false,
}) {
  // Mint XFCE / MATE (weak compositor): opaque. Cinnamon / Ubuntu GNOME: transparent OK.
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
  const menuH = 340;
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
    const svc = getService(serviceId);
    win.webContents.send('app-menu:init', {
      serviceId,
      name: service.name || service.defaultName || 'App',
      enabled: latest.enabled !== false,
      sound: latest.allowSounds !== false,
      notifications: latest.allowNotifications !== false,
      warm: latest.keepWarm === true,
      linkTab: !!svc?.linkTab,
      isCustom: !!svc?.isCustom,
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

  const menuW = 256;
  // Tall enough for every section + website/About/version — no inner scrollbar.
  const display = screen.getDisplayNearestPoint({
    x: mainWindow.getBounds().x,
    y: mainWindow.getBounds().y,
  });
  const workH = display?.workArea?.height || 900;
  const menuH = chromeMenuPreferredHeight({ workAreaHeight: workH });
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
    if (win.isDestroyed()) return;
    win.webContents.send('chrome-menu:init', {
      versionLabel,
      focusMode: !!settings.focusMode,
      muted: !!settings.muted,
    });
    // Size the window to the measured card so nothing scrolls.
    win.webContents
      .executeJavaScript(
        `(() => {
          const card = document.querySelector('.card');
          if (!card) return 0;
          card.style.maxHeight = 'none';
          card.style.overflow = 'visible';
          return Math.ceil(card.getBoundingClientRect().height) + 10;
        })()`,
      )
      .then((measured) => {
        if (win.isDestroyed() || !measured || measured < 200) return;
        const bounds = win.getBounds();
        const d = screen.getDisplayNearestPoint({
          x: bounds.x,
          y: bounds.y,
        });
        const maxH = Math.max(400, (d?.workArea?.height || workH) - 16);
        const nextH = Math.min(maxH, Math.max(measured, menuH));
        if (Math.abs(nextH - bounds.height) < 4) return;
        const next = clampFloatPosition(bounds.x, bounds.y, bounds.width, nextH);
        win.setBounds({
          x: next.x,
          y: next.y,
          width: bounds.width,
          height: nextH,
        });
      })
      .catch(() => {});
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

function buildNotifCenterDataSync(scrapedChats = []) {
  const hideContent = !!settings.hideNotificationContent;
  const logItems = (notificationLog || []).slice(0, 40).map((item) => {
    const service = getService(item.serviceId);
    const appId = service?.appId || item.appId || '';
    return {
      id: item.id,
      serviceId: item.serviceId,
      appId,
      title: item.title,
      body: item.body,
      at: item.at,
      chatName: item.chatName || '',
      chatKey: item.chatKey || '',
      unread: Number(item.unread) || 0,
      canReply:
        isInboxAppId(appId) && !whatsappAutomationBlocked(settings, appId),
      accountLabel: item.accountLabel || service?.title || service?.name || '',
      logo: service?.logo || null,
      color: service?.color || '#e2e8f0',
    };
  });
  const notifications = mergeNotificationFeed({
    logItems,
    scrapedChats,
    hideContent,
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

function buildNotifCenterData() {
  return buildNotifCenterDataSync([]);
}

async function scrapeUnreadChatsForService(service, { allowDefer = true } = {}) {
  if (!service || !isInboxAppId(service.appId)) return [];
  if (whatsappAutomationBlocked(settings, service.appId)) return [];
  const wc = views.get(service.id)?.view?.webContents;
  if (!wc || wc.isDestroyed()) return [];
  if (allowDefer && (await serviceIsBusyWithMediaViewer(service.id))) return [];
  try {
    const result = await wc.executeJavaScript(scrapeMessagingInboxJs(), true);
    const at = Date.now();
    return (result?.chats || [])
      .map((chat) => {
        const name = String(chat?.name || '').replace(/\s+/g, ' ').trim();
        if (!name || isJunkChatName(name)) return null;
        const preview = String(chat?.preview || '').replace(/\s+/g, ' ').trim();
        return {
          id: `${service.id}-${normalizeChatKey(name)}-${at}`,
          serviceId: service.id,
          appId: service.appId,
          name,
          chatKey: normalizeChatKey(chat?.chatKey || name),
          preview,
          unread: Number(chat?.unread) || 1,
          accountLabel: service.title || service.name || 'App',
          logo: service.logo || null,
          color: service.color || '#e2e8f0',
          at,
          canReply: true,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function scrapeAllUnreadChats() {
  const services = orderedServices().filter(
    (s) => isInboxAppId(s.appId) && views.has(s.id),
  );
  const batches = await Promise.all(
    services.map((service) => scrapeUnreadChatsForService(service)),
  );
  return batches.flat();
}

async function buildNotifCenterDataAsync() {
  const scraped = await scrapeAllUnreadChats();
  return buildNotifCenterDataSync(scraped);
}

function pushNotifCenterData() {
  if (!notifCenterWindow || notifCenterWindow.isDestroyed()) return;
  buildNotifCenterDataAsync()
    .then((data) => {
      if (!notifCenterWindow || notifCenterWindow.isDestroyed()) return;
      try {
        notifCenterWindow.webContents.send('notif-center:init', data);
      } catch {
        // ignore
      }
    })
    .catch(() => {
      try {
        notifCenterWindow?.webContents.send(
          'notif-center:init',
          buildNotifCenterData(),
        );
      } catch {
        // ignore
      }
    });
}

function openNotifCenterWindow({ x = 0, y = 0, dark = false, align = 'right' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();

  const menuW = 420;
  const menuH = 580;
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
    if (win.isDestroyed()) return;
    buildNotifCenterDataAsync()
      .then((data) => {
        if (!win.isDestroyed()) win.webContents.send('notif-center:init', data);
      })
      .catch(() => {
        if (!win.isDestroyed()) {
          win.webContents.send('notif-center:init', buildNotifCenterData());
        }
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
      if (notifCenterWindow === win) closeNotifCenterWindow();
    }, 120);
  });
  win.on('closed', () => {
    if (notifCenterWindow === win) notifCenterWindow = null;
  });

  return { ok: true };
}

function pushCrmLookup(payload) {
  if (!crmLookupWindow || crmLookupWindow.isDestroyed()) return;
  try {
    crmLookupWindow.webContents.send('crm-lookup:init', payload);
  } catch {
    // ignore
  }
}

function openCrmLookupWindow({ query = '', dark = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  closeAppContextMenu();
  closeChromeMenuWindow();
  closeNotifCenterWindow();
  closeCrmLookupWindow();

  const content = mainWindow.getContentBounds();
  const margin = 10;
  // Mint/Cinnamon: size to work area (excludes panel/taskbar), not a tiny fixed max.
  const display = screen.getDisplayNearestPoint({
    x: mainWindow.getBounds().x,
    y: mainWindow.getBounds().y,
  });
  const waH = display?.workArea?.height || 800;
  const menuW = Math.min(480, Math.max(380, Math.floor(content.width * 0.4)));
  const menuH = Math.max(
    420,
    Math.min(Math.floor(waH * 0.88), content.height - margin * 2),
  );
  const pos = clampFloatPosition(
    content.x + content.width - menuW - margin,
    content.y + margin,
    menuW,
    menuH,
  );

  crmLookupWindow = createFloatBrowserWindow({
    width: menuW,
    height: menuH,
    x: pos.x,
    y: pos.y,
    preload: 'crmLookupPreload.js',
    dark: !!dark,
  });

  const win = crmLookupWindow;
  // Child of Hub only — never system-wide always-on-top (Mint/Cinnamon).
  try {
    win.setAlwaysOnTop(false);
  } catch {
    // ignore
  }
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildCrmLookupHtml(!!dark))}`,
  );
  win.webContents.once('did-finish-load', () => {
    pushCrmLookup({
      loading: true,
      query: String(query || ''),
      deals: [],
    });
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
      try {
        win.moveTop();
      } catch {
        // ignore
      }
    }
  });
  win.on('closed', () => {
    if (crmLookupWindow === win) crmLookupWindow = null;
  });
  return { ok: true };
}

async function lookupZohoCrmDeals(selectionText, { dark = false } = {}) {
  const query = String(selectionText || '').replace(/\s+/g, ' ').trim();
  if (!query) {
    return { ok: false, error: 'Select a keyword to look up.' };
  }

  const enabled = settings.zohoCrmEnabled !== false;
  if (!enabled) {
    return {
      ok: false,
      error: 'Zoho CRM lookup is disabled in Settings → Integrations.',
    };
  }
  if (!hasZohoCrmAuth()) {
    openCrmLookupWindow({ query, dark });
    pushCrmLookup({
      loading: false,
      query,
      error:
        'Zoho CRM is not connected. Open Settings → Integrations and add Client ID, Secret, and Refresh Token.',
      deals: [],
    });
    return { ok: false, error: 'not_configured' };
  }

  openCrmLookupWindow({ query, dark });
  try {
    const result = await searchDeals(query, {
      dcId: sanitizeZohoCrmDc(settings.zohoCrmDc),
      limit: 15,
    });
    if (!result.ok) {
      pushCrmLookup({
        loading: false,
        query: result.query || query,
        error: result.error || 'Lookup failed.',
        deals: [],
      });
      return result;
    }
    pushCrmLookup({
      loading: false,
      query: result.query || query,
      deals: result.deals || [],
    });
    return result;
  } catch (error) {
    const message = String(error?.message || error || 'Lookup failed.');
    pushCrmLookup({
      loading: false,
      query,
      error: message,
      deals: [],
    });
    return { ok: false, error: message };
  }
}

function pushAiResult(payload) {
  if (!aiResultWindow || aiResultWindow.isDestroyed()) return;
  try {
    aiResultWindow.webContents.send('ai-result:init', payload);
  } catch {
    // ignore
  }
}

function openAiResultWindow({ title, meta, dark = false, initialPayload = null } = {}) {
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
  // Stay above Hub guests via parent: mainWindow — do NOT use system
  // alwaysOnTop (pop-up-menu). On Mint/Cinnamon that floats above Cursor
  // and every other app until closed.
  try {
    win.setAlwaysOnTop(false);
  } catch {
    // ignore
  }
  // Mic needs a secure context. data: hides mediaDevices; custom schemes are
  // unreliable on some Electron/Linux builds. http://127.0.0.1 always works.
  const html = buildAiResultHtml(!!dark);
  setAiResultServerHtml(html);
  ensureAiResultServer()
    .then(() => {
      if (win.isDestroyed()) return;
      const url = aiResultLocalUrl(!!dark);
      return win.loadURL(url);
    })
    .catch((err) => {
      console.error('Aspera AI panel failed to load on localhost:', err);
    });
  try {
    const sess = win.webContents.session;
    sess.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(
        permission === 'media' ||
          permission === 'mediaKeySystem' ||
          permission === 'clipboard-read',
      );
    });
    sess.setPermissionCheckHandler((_wc, permission) => {
      return (
        permission === 'media' ||
        permission === 'mediaKeySystem' ||
        permission === 'clipboard-read'
      );
    });
    // Linux: allow mic/camera device choice without an extra prompt UI.
    if (typeof sess.setDevicePermissionHandler === 'function') {
      sess.setDevicePermissionHandler((details) => {
        return (
          details?.deviceType === 'microphone' ||
          details?.deviceType === 'speaker' ||
          details?.deviceType === 'camera'
        );
      });
    }
  } catch {
    // ignore
  }
  win.webContents.once('did-finish-load', () => {
    if (initialPayload && typeof initialPayload === 'object') {
      pushAiResult(initialPayload);
      return;
    }
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
      try {
        win.moveTop();
      } catch {
        // ignore
      }
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

/** Reuse the open AI panel when Run is clicked — never spawn a second popup. */
function ensureAiResultWindow({ title, meta, dark = false, loadingText = 'Working…' } = {}) {
  const payload = {
    title: title || 'Aspera AI',
    meta: meta || '',
    loading: true,
    text: loadingText,
    mode: 'working',
  };
  if (aiResultWindow && !aiResultWindow.isDestroyed()) {
    pushAiResult(payload);
    try {
      if (!aiResultWindow.isVisible()) aiResultWindow.show();
      aiResultWindow.focus();
      aiResultWindow.moveTop();
    } catch {
      // ignore
    }
    return { ok: true, reused: true };
  }
  return openAiResultWindow({
    title,
    meta,
    dark,
    initialPayload: payload,
  });
}

/**
 * Same on every app: clipboard inbox → Run → Copy result → user pastes back.
 * Does not read guest DOM — only system clipboard + pasted text.
 */
function openAsperaAiInbox({ dark = false, skill = 'summarize', pasteText = null } = {}) {
  if (settings.aiEnabled === false) {
    return { ok: false, error: 'Aspera AI is turned off in Settings.' };
  }
  const { routeOrder } = aiSettingsSnapshot();
  if (!routeOrder.length) {
    mainWindow?.webContents.send('dock:chrome-action', 'settings');
    mainWindow?.webContents.send('dock:open-ai-settings');
    return {
      ok: false,
      error: 'Add at least one AI API key in Settings → Aspera AI.',
    };
  }

  const seed =
    pasteText != null
      ? String(pasteText)
      : (() => {
          try {
            return clipboard.readText() || '';
          } catch {
            return '';
          }
        })();
  const hasClipImage = pasteText == null && clipboardHasAiImage();

  // Fresh inbox — drop any previous staged file.
  // Do not auto-attach clipboard screenshots — user confirms via Paste.
  clearAiInboxAttachment();

  const inboxPayload = {
    title: 'Aspera AI',
    meta: 'Paste or attach → Run → copy result back',
    mode: 'inbox',
    skill: skill === 'refine' || skill === 'suggest-reply' ? skill : 'summarize',
    pasteText: seed,
    attachment: null,
    hint: hasClipImage
      ? 'Screenshot on clipboard — click Paste from clipboard to attach it for Summarize.'
      : seed
        ? 'Clipboard text loaded. Choose a skill and Run — or attach a file.'
        : 'Paste text or attach a PDF/image. Hub never sends for you.',
  };

  if (aiResultWindow && !aiResultWindow.isDestroyed()) {
    pushAiResult(inboxPayload);
    try {
      if (!aiResultWindow.isVisible()) aiResultWindow.show();
      aiResultWindow.focus();
      aiResultWindow.moveTop();
    } catch {
      // ignore
    }
    return { ok: true, reused: true };
  }

  return openAiResultWindow({
    title: 'Aspera AI',
    meta: inboxPayload.meta,
    dark,
    initialPayload: inboxPayload,
  });
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

function aiRoutePrefs() {
  return {
    order: sanitizeAiProviderOrder(settings.aiProviderOrder),
    disabledIds: sanitizeAiDisabledProviders(settings.aiDisabledProviders),
  };
}

function aiConfiguredRouteOrderIds() {
  const configured = listConfiguredAiProviders()
    .filter((p) => p.configured)
    .map((p) => p.id);
  return configuredProvidersInRouteOrder(configured, aiRoutePrefs()).map(
    (p) => p.id,
  );
}

function aiProvidersForUi() {
  const { order, disabledIds } = aiRoutePrefs();
  const disabled = new Set(disabledIds);
  const byId = new Map(listConfiguredAiProviders().map((p) => [p.id, p]));
  const enabledOrder = order.filter((id) => !disabled.has(id));
  return order.map((id, index) => {
    const base = byId.get(id) || getAiProvider(id);
    const selectedModel = getProviderModelPreference(settings, id);
    const availableModels =
      getCachedAiModels(id) || catalogModelsForProvider(id);
    const enabled = !disabled.has(id);
    const tryIndex = enabled ? enabledOrder.indexOf(id) : -1;
    return {
      ...base,
      id,
      selectedModel,
      availableModels,
      modelsLive: Boolean(getCachedAiModels(id)?.length),
      enabled,
      routeIndex: index,
      tryOrdinal: tryIndex >= 0 ? aiProviderTryOrdinal(tryIndex) : '',
    };
  });
}

function saveAiProviderRoute({ order, disabledIds } = {}) {
  const nextOrder =
    order === undefined
      ? sanitizeAiProviderOrder(settings.aiProviderOrder)
      : sanitizeAiProviderOrder(order);
  const nextDisabled =
    disabledIds === undefined
      ? sanitizeAiDisabledProviders(settings.aiDisabledProviders)
      : sanitizeAiDisabledProviders(disabledIds);
  settings = saveSettings({
    aiProviderOrder: nextOrder,
    aiDisabledProviders: nextDisabled,
  });
  // Sticky session may point at a now-disabled provider — clear failover state.
  resetAiProviderSession();
  syncPreferredAiProvider();
  broadcastState();
  return {
    ok: true,
    order: nextOrder,
    disabledIds: nextDisabled,
    isDefault: isDefaultAiProviderOrder(nextOrder) && nextDisabled.length === 0,
    routeOrder: aiConfiguredRouteOrderIds(),
  };
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

function aiOutputLanguages() {
  return resolveAiOutputLanguages(settings.aiExtraLanguages);
}

function aiLanguageMetaLabel(languages = aiOutputLanguages()) {
  return aiOutputLanguageMeta(languages);
}

function aiLanguagePromptPayload(languages = aiOutputLanguages()) {
  return {
    languages,
    extraLanguages: sanitizeAiExtraLanguages(settings.aiExtraLanguages),
  };
}

function aiOutputLanguageSections(languages = aiOutputLanguages()) {
  return {
    refine: refineSectionsForLanguages(languages),
    replies: replySectionsForLanguages(languages),
    payload: languages.map((l) => languageSectionFor(l)),
  };
}

function aiSettingsSnapshot() {
  const language = getAiLanguage(settings.aiLanguage || 'en').id;
  const extraLanguages = sanitizeAiExtraLanguages(settings.aiExtraLanguages);
  const outputLanguages = resolveAiOutputLanguages(extraLanguages);
  const languageMeta = aiOutputLanguageMeta(outputLanguages);
  const configured = listConfiguredAiProviders()
    .filter((p) => p.configured)
    .map((p) => p.id);
  const order = configuredProvidersInRouteOrder(configured, aiRoutePrefs());
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
  if (provider.id === 'sarvam') {
    model = normalizeSarvamModel(model || provider.defaultModel);
  }
  if (!model) model = provider.defaultModel;
  return {
    provider,
    model,
    language,
    extraLanguages,
    outputLanguages,
    languageMeta,
    routeOrder: order,
    stickyId: sticky,
  };
}

/**
 * Keep settings.aiProvider aligned with sticky / first available in the
 * user's effective failover order (enabled + has key).
 */
function syncPreferredAiProvider() {
  const configured = listConfiguredAiProviders()
    .filter((p) => p.configured)
    .map((p) => p.id);
  const order = configuredProvidersInRouteOrder(configured, aiRoutePrefs());
  const sticky = getStickyAiProviderId();
  const stickyOk =
    sticky &&
    configured.includes(sticky) &&
    order.some((p) => p.id === sticky);
  const nextId = (stickyOk && sticky) || order[0]?.id || 'gemini';
  if (nextId !== settings.aiProvider) {
    settings = saveSettings({ aiProvider: nextId });
  }
  return nextId;
}

function collectCatchUpItems() {
  const services = orderedServices().filter(
    (s) =>
      isAiAllowedAppId(s.appId) &&
      !whatsappAutomationBlocked(settings, s.appId),
  );
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

/**
 * Read ~4–5 earlier messages near the current selection in the open chat/thread.
 * Best-effort: returns [] if the DOM cannot be scraped (mail layouts vary).
 */
async function getNearbyPriorMessages({
  selectionText = '',
  clickX = 0,
  clickY = 0,
  maxPrior = PRIOR_MESSAGE_COUNT,
} = {}) {
  if (!activeServiceId) return [];
  const service = getService(activeServiceId);
  if (whatsappAutomationBlocked(settings, service?.appId)) return [];
  const entry = views.get(activeServiceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) return [];
  try {
    const result = await wc.executeJavaScript(
      scrapeNearbyMessagesJs({
        selectionText,
        maxPrior,
        clickX,
        clickY,
      }),
      true,
    );
    return sanitizePriorMessages(result?.messages, { max: maxPrior });
  } catch {
    return [];
  }
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
  // Safe Mode: do not scrape / AI-instrument WhatsApp Web.
  if (whatsappAutomationBlocked(settings, service.appId)) return null;
  return service;
}

function asperaAiSkillTitle(skill) {
  if (skill === 'catch-up') return 'Catch me up';
  if (skill === 'refine') return 'Refine draft';
  if (skill === 'suggest-reply') return 'Suggest reply';
  return 'Summarize';
}

function cleanAiPlainText(text) {
  return String(text || '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

function clearAiInboxAttachment() {
  aiInboxAttachment = null;
}

/** Packaged: resources/pdfjs-runtime; dev: resolve via node_modules. */
function aiPdfjsRuntimeDir() {
  try {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'pdfjs-runtime');
    }
  } catch {
    // ignore
  }
  return '';
}

function aiAttachmentPublicMeta(att = aiInboxAttachment) {
  if (!att) return null;
  return {
    id: att.id,
    name: att.name,
    mime: att.mime,
    kind: att.kind,
    size: att.buffer?.length || 0,
  };
}

function stageAiInboxAttachment({ name, mime, base64 }) {
  const raw = String(base64 || '');
  const buffer = Buffer.from(raw.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const checked = validateAiAttachmentMeta({
    name,
    mime,
    byteLength: buffer.length,
  });
  if (!checked.ok) return { ok: false, error: checked.error };
  aiInboxAttachment = {
    id: newAttachmentId(),
    name: checked.name || String(name || 'file').trim() || 'file',
    mime: checked.mime,
    kind: checked.kind,
    buffer,
  };
  return { ok: true, attachment: aiAttachmentPublicMeta() };
}

function clipboardHasAiImage() {
  try {
    const img = clipboard.readImage();
    return !!(img && !img.isEmpty());
  } catch {
    return false;
  }
}

/**
 * Stage a screenshot/image from the system clipboard for Summarize.
 * Prefer PNG; use JPEG when PNG exceeds the image size cap.
 */
function stageAiInboxAttachmentFromClipboardImage() {
  let img;
  try {
    img = clipboard.readImage();
  } catch {
    img = null;
  }
  if (!img || img.isEmpty()) {
    return { ok: false, error: 'No image on the clipboard.' };
  }
  let png;
  let jpeg;
  try {
    png = img.toPNG();
  } catch {
    png = null;
  }
  try {
    jpeg = img.toJPEG(85);
  } catch {
    jpeg = null;
  }
  const encoding = pickClipboardImageEncoding(
    png?.length || 0,
    jpeg?.length || 0,
  );
  if (!encoding) {
    return {
      ok: false,
      error:
        'Clipboard image is too large (max 5 MB). Save a smaller screenshot, or upload a file.',
    };
  }
  const buffer = encoding === 'jpeg' ? jpeg : png;
  const mime = encoding === 'jpeg' ? 'image/jpeg' : 'image/png';
  const name = clipboardScreenshotFileName(encoding);
  return stageAiInboxAttachment({
    name,
    mime,
    base64: Buffer.from(buffer).toString('base64'),
  });
}

/** Paste button: image first (screenshots), else text. */
function pasteAiInboxFromClipboard() {
  if (clipboardHasAiImage()) {
    const staged = stageAiInboxAttachmentFromClipboardImage();
    if (!staged.ok) return { ok: false, kind: 'image', error: staged.error };
    return { ok: true, kind: 'image', attachment: staged.attachment };
  }
  let text = '';
  try {
    text = clipboard.readText() || '';
  } catch {
    text = '';
  }
  if (!String(text).trim()) {
    return {
      ok: false,
      kind: 'empty',
      error:
        'Clipboard is empty — copy text, or take a screenshot and Paste from clipboard.',
    };
  }
  return { ok: true, kind: 'text', text: String(text) };
}

async function runAsperaAiSkill(
  skill,
  {
    selectionText = '',
    dark = false,
    clickX = 0,
    clickY = 0,
    attachmentId = '',
  } = {},
) {
  if (settings.aiEnabled === false) {
    return { ok: false, error: 'Aspera AI is turned off in Settings.' };
  }

  const { language, routeOrder, outputLanguages, languageMeta } =
    aiSettingsSnapshot();
  if (!routeOrder.length) {
    mainWindow?.webContents.send('dock:chrome-action', 'settings');
    return {
      ok: false,
      error:
        'Add at least one AI API key in Settings → Aspera AI (Gemini recommended for speed).',
    };
  }

  const langLabel = getAiLanguage(language).id === 'en'
    ? 'English'
    : `${getAiLanguage(language).name} (${getAiLanguage(language).native})`;
  const skillTitle = asperaAiSkillTitle(skill);
  const routeHint = routeOrder.map((p) => p.name).join(' → ');
  const metaLang =
    skill === 'summarize' || skill === 'refine' || skill === 'suggest-reply'
      ? languageMeta
      : langLabel;
  const langPayload = aiLanguagePromptPayload(outputLanguages);
  const langSections = aiOutputLanguageSections(outputLanguages);

  ensureAiResultWindow({
    title: `Aspera AI · ${skillTitle}`,
    meta: `Auto · ${routeHint} · ${metaLang}`,
    dark,
    loadingText: 'Working…',
  });

  try {
    let prompt;
    let media = null;
    let summarizeSelection = '';
    let summarizeAppName = '';
    let summarizePriorMessages = [];
    let refineSelection = '';
    let refineAppName = '';
    let refineServiceId = '';
    let refineHasComposeTarget = false;
    const wantAttach =
      attachmentId &&
      aiInboxAttachment &&
      aiInboxAttachment.id === String(attachmentId);

    if (wantAttach && skill !== 'summarize') {
      throw new Error(
        'PDF/image attachments only work with Summarize. Clear the file for Refine or Suggest reply.',
      );
    }

    if (skill === 'catch-up') {
      const items = collectCatchUpItems();
      prompt = promptForSkill('catch-up', { items, language });
    } else if (wantAttach && skill === 'summarize') {
      const att = aiInboxAttachment;
      summarizeAppName = att.name || (att.kind === 'pdf' ? 'PDF' : 'Image');
      summarizePriorMessages = [];
      if (att.kind === 'pdf') {
        let extracted = { text: '', pagesRead: 0, numPages: 0 };
        try {
          extracted = await extractPdfText(att.buffer, {
            pdfjsDir: aiPdfjsRuntimeDir() || undefined,
          });
        } catch (err) {
          extracted = { text: '', pagesRead: 0, numPages: 0, error: err };
        }
        if (pdfTextIsUsable(extracted.text)) {
          summarizeSelection = extracted.text;
          prompt = promptForSkill('summarize-file-text', {
            text: extracted.text,
            fileName: att.name,
            pagesRead: extracted.pagesRead,
            numPages: extracted.numPages,
            ...langPayload,
          });
        } else {
          // Scanned / image PDF — send bytes to Gemini.
          summarizeSelection = `[PDF attachment: ${att.name}]`;
          prompt = promptForSkill('summarize-attachment', {
            kind: 'pdf',
            fileName: att.name,
            ...langPayload,
          });
          media = {
            kind: 'pdf',
            mime: att.mime,
            base64: att.buffer.toString('base64'),
          };
        }
      } else {
        summarizeSelection = `[Image attachment: ${att.name}]`;
        prompt = promptForSkill('summarize-attachment', {
          kind: 'image',
          fileName: att.name,
          ...langPayload,
        });
        media = {
          kind: 'image',
          mime: att.mime,
          base64: att.buffer.toString('base64'),
        };
      }
    } else if (skill === 'summarize' || skill === 'suggest-reply') {
      // Clipboard-first on every app — never scrape guest DOM for the source text.
      const text = String(selectionText || '').trim();
      if (!text) {
        throw new Error(
          wantAttach
            ? 'Attachment missing — re-attach the file, or paste text.'
            : 'Paste text into Aspera AI first (copy from any app, then paste here), or attach a PDF/image.',
        );
      }
      const service = activeAiService();
      summarizeSelection = text;
      summarizeAppName =
        service?.name || service?.defaultName || service?.appId || 'Clipboard';
      summarizePriorMessages = [];
      prompt = promptForSkill(
        skill === 'suggest-reply' ? 'suggest-reply' : 'summarize',
        {
          text,
          appName: summarizeAppName,
          priorMessages: [],
          ...langPayload,
        },
      );
    } else if (skill === 'refine') {
      const text = String(selectionText || '').trim();
      if (!text) {
        throw new Error(
          'Paste a draft into Aspera AI first (copy from the send box, then paste here).',
        );
      }
      const service = activeAiService();
      refineServiceId = service?.id || '';
      refineHasComposeTarget = false;
      refineSelection = text;
      refineAppName =
        service?.name || service?.defaultName || service?.appId || 'Clipboard';
      prompt = promptForSkill('refine', {
        text,
        appName: refineAppName,
        ...langPayload,
      });
    } else {
      throw new Error('Unknown skill');
    }

    const result = await runAiCompletionWithFailover(prompt, { media });
    syncPreferredAiProvider();
    let resultText = result.text;
    let refineSections = null;
    if (skill === 'refine') {
      refineSections = parseRefinedDrafts(result.text, langSections.refine);
      resultText = serializeRefinedDrafts(refineSections, langSections.refine);
    }
    if (skill === 'summarize' || skill === 'suggest-reply') {
      aiResultContext = {
        skill: 'summarize',
        selectionText: summarizeSelection,
        appName: summarizeAppName,
        priorMessages: summarizePriorMessages,
        dark: !!dark,
        summaryText: resultText,
        providerName: result.providerName,
        model: result.model,
        outputLanguages: langSections.payload,
        languageMeta,
      };
    } else if (skill === 'refine') {
      aiResultContext = {
        skill: 'refine',
        selectionText: refineSelection,
        originalComposeText: refineSelection,
        appName: refineAppName,
        serviceId: refineServiceId,
        hasComposeTarget: false,
        dark: !!dark,
        refinedText: resultText,
        outputLanguages: langSections.payload,
        languageMeta,
        refineSections,
        providerName: result.providerName,
        model: result.model,
      };
    } else {
      aiResultContext = null;
    }
    const priorMeta =
      skill === 'summarize' && summarizePriorMessages.length
        ? ` · +${summarizePriorMessages.length} prior`
        : '';
    pushAiResult({
      title: `Aspera AI · ${skillTitle}`,
      meta: `${result.providerName} · ${result.model} · ${metaLang}${priorMeta}`,
      text: resultText,
      loading: false,
      mode: skill === 'refine' ? 'refine' : skill === 'catch-up' ? 'catch-up' : 'summarize',
      showTrilingual: skill === 'summarize' || skill === 'suggest-reply',
      canSuggestReply: skill === 'summarize' || skill === 'suggest-reply',
      canUseInCompose: false,
      canRefineAgain: skill === 'refine',
      refineSections: refineSections || undefined,
      repliesText: '',
      repliesLoading: skill === 'suggest-reply',
      outputLanguages: langSections.payload,
      languageMeta: metaLang,
    });
    if (skill === 'suggest-reply') {
      runSuggestRepliesFromAiResult().catch(() => {});
    }
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
      outputLanguages: langSections.payload,
      languageMeta: metaLang,
    });
    return { ok: false, error: message };
  }
}

async function runRefineAgainFromAiResult(payload = {}) {
  const ctx = aiResultContext;
  if (!ctx || ctx.skill !== 'refine') {
    return { ok: false, error: 'No draft to refine.' };
  }
  // Always re-refine from the original send-box draft (not one language variant).
  const draft = String(
    ctx.originalComposeText || ctx.selectionText || payload?.text || '',
  ).trim();
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
  const text = cleanAiPlainText(payload?.text || ctx.refinedText || '');
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
  const { routeOrder, outputLanguages, languageMeta } = aiSettingsSnapshot();
  if (!routeOrder.length) {
    return {
      ok: false,
      error: 'Add at least one AI API key in Settings → Aspera AI.',
    };
  }
  const langPayload = aiLanguagePromptPayload(outputLanguages);
  const langSections = aiOutputLanguageSections(outputLanguages);
  const metaLang = ctx.languageMeta || languageMeta;

  pushAiResult({
    title: 'Aspera AI · Summarize selection',
    meta: [ctx.providerName, ctx.model, metaLang].filter(Boolean).join(' · '),
    text: ctx.summaryText || '',
    loading: false,
    showTrilingual: true,
    canSuggestReply: true,
    repliesLoading: true,
    repliesText: '',
    outputLanguages: langSections.payload,
    languageMeta: metaLang,
  });

  try {
    const prompt = promptForSkill('suggest-reply', {
      text: ctx.selectionText,
      appName: ctx.appName,
      priorMessages: ctx.priorMessages,
      ...langPayload,
    });
    const result = await runAiCompletionWithFailover(prompt);
    syncPreferredAiProvider();
    const repliesSections = parseSuggestedReplies(
      result.text,
      langSections.replies,
    );
    aiResultContext = {
      ...ctx,
      repliesText: result.text,
      providerName: result.providerName,
      model: result.model,
      outputLanguages: langSections.payload,
      languageMeta: metaLang,
    };
    pushAiResult({
      title: 'Aspera AI · Summarize selection',
      meta: `${result.providerName} · ${result.model} · ${metaLang}`,
      text: ctx.summaryText || '',
      loading: false,
      showTrilingual: true,
      canSuggestReply: true,
      repliesLoading: false,
      repliesText: result.text,
      repliesSections,
      outputLanguages: langSections.payload,
      languageMeta: metaLang,
    });
    return { ok: true, text: result.text };
  } catch (error) {
    const message = String(error?.message || error);
    pushAiResult({
      title: 'Aspera AI · Summarize selection',
      meta: metaLang,
      text: ctx.summaryText || '',
      loading: false,
      showTrilingual: true,
      canSuggestReply: true,
      repliesLoading: false,
      repliesError: message,
      outputLanguages: langSections.payload,
      languageMeta: metaLang,
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
      priorMessages: ctx.priorMessages,
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
  if (type === 'close') {
    closeAppContextMenu();
    const svc = getService(id);
    // Link tabs close immediately; permanent apps confirm in the shell.
    if (svc?.linkTab || svc?.isCustom) {
      removeService(id);
      return { ok: true };
    }
    mainWindow?.webContents.send('dock:confirm-remove-app', id);
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
  if (type === 'aspera-ai' || type === 'summarize') {
    openAsperaAiInbox({ dark: false, skill: 'summarize' });
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
  if (type === 'web-search') {
    openWebSearchWindow();
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
  if (type === 'back') {
    if (activeServiceId) {
      const wc = views.get(activeServiceId)?.view?.webContents;
      if (wc && !wc.isDestroyed() && wc.canGoBack()) {
        wc.goBack();
        scheduleActiveNavStatePush();
      }
    }
    return { ok: true };
  }
  if (type === 'forward') {
    if (activeServiceId) {
      const wc = views.get(activeServiceId)?.view?.webContents;
      if (wc && !wc.isDestroyed() && wc.canGoForward()) {
        wc.goForward();
        scheduleActiveNavStatePush();
      }
    }
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
  if (type === 'copy-link') {
    return copyActivePageLink();
  }
  if (type === 'about') {
    showAboutDialog();
    return { ok: true };
  }
  if (type === 'website') {
    openExternalSafe(ASPERA_HUB_WEBSITE);
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

async function handleNotifCenterAction(type, value) {
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
    const serviceId =
      typeof value === 'string' ? value : String(value?.serviceId || '');
    const chatName =
      typeof value === 'object' ? String(value?.chatName || '') : '';
    const chatKey =
      typeof value === 'object' ? String(value?.chatKey || '') : '';
    if (!serviceId) return { ok: false };
    if (chatName || chatKey) {
      return openMessagingChat(serviceId, { name: chatName, chatKey });
    }
    activateService(serviceId);
    return { ok: true };
  }
  if (type === 'reply') {
    closeNotifCenterWindow();
    const serviceId = String(value?.serviceId || '');
    const text = String(value?.text || '').trim();
    const chatName = String(value?.chatName || value?.title || '');
    const chatKey = String(value?.chatKey || '');
    return sendQuickReply(serviceId, { name: chatName, chatKey, text });
  }
  return { ok: false };
}

function applyFocusMode(webContents, serviceId) {
  const service = getService(serviceId);
  // Safe Mode: do not replace Notification / focus on WhatsApp Web.
  if (whatsappAutomationBlocked(settings, service?.appId)) return;
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
  return formatMessagePreview(text, { maxLines: 3, maxChars: 280, lineChars: 96 });
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
  const accountLabel = String(service.title || service.name || 'App').trim();
  // Rich notifications use the sender as title — keep that for jump / reply.
  const chatName =
    title && title !== accountLabel && !/^\d+\s*unread$/i.test(title)
      ? title
      : '';
  notificationLog = [
    {
      id: `${service.id}-${Date.now().toString(36)}`,
      serviceId: service.id,
      title,
      body: String(body || '').trim(),
      at: Date.now(),
      chatName,
      chatKey: chatName ? normalizeChatKey(chatName) : '',
      appId: service.appId || '',
      accountLabel,
    },
    ...notificationLog,
  ].slice(0, NOTIFICATION_LOG_MAX);
  broadcastState();
  pushNotifCenterData();
}

async function guestHeaderMatchesPin(wc, chatName, key) {
  if (!wc || wc.isDestroyed()) return { ok: false, header: '' };
  try {
    const match = await wc.executeJavaScript(
      messagingChatHeaderMatchJs(chatName, key),
      true,
    );
    if (match?.ok) {
      return { ok: true, header: String(match.header || chatName) };
    }
    return { ok: false, header: String(match?.header || '') };
  } catch {
    return { ok: false, header: '' };
  }
}

/** Trusted key chord into the focused guest control. */
function sendGuestKey(webContents, keyCode, modifiers = []) {
  if (!webContents || webContents.isDestroyed()) return;
  try {
    webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    if (!modifiers.length || (keyCode.length === 1 && !modifiers.includes('control') && !modifiers.includes('meta'))) {
      webContents.sendInputEvent({ type: 'char', keyCode, modifiers });
    } else if (modifiers.includes('control') || modifiers.includes('meta')) {
      // Still emit char for Ctrl+A / Ctrl+V on some guests.
      webContents.sendInputEvent({ type: 'char', keyCode, modifiers });
    }
    webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  } catch {
    /* ignore */
  }
}

/**
 * Replace left-pane search text.
 * Never use Ctrl+A here — if focus is on the chat, Ctrl+A selects every message.
 */
async function replaceGuestSearchText(webContents, text) {
  if (!webContents || webContents.isDestroyed()) return false;
  const value = String(text || '');
  try {
    const mutated = await cdpEvaluate(webContents, waMutateSearchJs(value));
    if (mutated?.ok) return true;
  } catch {
    /* fall through */
  }
  // Focus search geometrically, then CDP-mutate again (still no Ctrl+A).
  try {
    const node = await cdpEvaluate(webContents, waSearchNodeJs());
    if (node?.x != null) await cdpClickAt(webContents, node.x, node.y);
    await sleepMs(80);
    const mutated = await cdpEvaluate(webContents, waMutateSearchJs(value));
    if (mutated?.ok) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Drop any blue text selection left in the open chat after pin-open. */
async function clearGuestPageSelection(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  try {
    await cdpEvaluate(
      webContents,
      `(() => {
        try { window.getSelection()?.removeAllRanges(); } catch (e) {}
        try {
          const ae = document.activeElement;
          const ph = String(
            ae?.getAttribute?.('placeholder')
              || ae?.getAttribute?.('data-placeholder')
              || ae?.getAttribute?.('aria-label')
              || '',
          ).toLowerCase();
          // Blur search so the green search chrome goes away; keep compose focused later.
          if (ae && (ae.getAttribute?.('data-tab') === '3' || /search/.test(ph))) {
            ae.blur();
          }
        } catch (e) {}
        return true;
      })()`,
    );
  } catch {
    try {
      await webContents.executeJavaScript(
        `(() => { try { window.getSelection()?.removeAllRanges(); } catch (e) {} return true; })()`,
        true,
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * After a successful pin open: clear leftover search text ONLY.
 * Never click Back / re-focus search / Chats — those close the open chat
 * (Meta AI empty pane) and caused the 0.4.27 pin chaos.
 */
async function dismissMessagingSearchAfterOpen(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  try {
    const node = await cdpEvaluate(webContents, waSearchNodeJs());
    // Prefer the clear (X) control only — do not click the search field or Back.
    if (node?.clearX != null) {
      await cdpClickAt(webContents, node.clearX, node.clearY);
      await sleepMs(50);
    }
  } catch {
    /* ignore */
  }
  try {
    await cdpEvaluate(webContents, waMutateSearchJs(''));
  } catch {
    try {
      await webContents.executeJavaScript(
        `(() => {
          const els = document.querySelectorAll(
            '[contenteditable="true"][data-tab="3"], [data-testid="chat-list-search"]',
          );
          for (const el of els) {
            try {
              if (document.activeElement === el) {
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
              }
              if ('value' in el) el.value = '';
              else el.textContent = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {}
          }
          try { window.getSelection()?.removeAllRanges(); } catch (e) {}
          try { document.activeElement?.blur?.(); } catch (e) {}
          return true;
        })()`,
        true,
      );
    } catch {
      /* ignore */
    }
  }
  await clearGuestPageSelection(webContents);
}

/** Monotonic token — a newer pin click cancels in-flight automation. */
let pinOpenGeneration = 0;

/** CDP evaluate with userGesture — required for WhatsApp React contenteditable. */
async function cdpEvaluate(webContents, expression, { awaitPromise = false } = {}) {
  if (!webContents || webContents.isDestroyed()) return null;
  const dbg = await ensureGuestDebugger(webContents);
  const result = await dbg.sendCommand('Runtime.evaluate', {
    expression: String(expression || ''),
    returnByValue: true,
    awaitPromise: !!awaitPromise,
    userGesture: true,
  });
  if (result?.exceptionDetails) {
    const msg =
      result.exceptionDetails?.exception?.description ||
      result.exceptionDetails?.text ||
      'cdp_evaluate_failed';
    throw new Error(String(msg));
  }
  return result?.result?.value;
}

async function cdpClickAt(webContents, x, y) {
  if (!webContents || webContents.isDestroyed()) return;
  const dbg = await ensureGuestDebugger(webContents);
  const cx = Math.max(0, Math.round(Number(x) || 0));
  const cy = Math.max(0, Math.round(Number(y) || 0));
  const base = {
    x: cx,
    y: cy,
    button: 'left',
    clickCount: 1,
    buttons: 1,
  };
  try {
    await dbg.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base });
    await dbg.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await dbg.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...base,
      buttons: 0,
    });
  } catch {
    clickWebContentsAt(webContents, cx, cy);
  }
}

async function readGuestSearchText(webContents) {
  if (!webContents || webContents.isDestroyed()) return '';
  try {
    const got = await cdpEvaluate(webContents, readMessagingSearchTextJs());
    return String(got?.text || '').trim();
  } catch {
    try {
      const got = await webContents.executeJavaScript(readMessagingSearchTextJs(), true);
      return String(got?.text || '').trim();
    } catch {
      return '';
    }
  }
}

/**
 * Nuclear WhatsApp search wipe — CDP userGesture + verified empty.
 * Screenshots on 0.4.22 still showed leftover "shrikant" after the first pin.
 */
async function trustedClearMessagingSearch(webContents, { resetPane = true } = {}) {
  if (!webContents || webContents.isDestroyed()) return false;
  for (let pass = 0; pass < 6; pass += 1) {
    let node = null;
    let reset = null;
    try {
      node = await cdpEvaluate(webContents, waSearchNodeJs());
      reset = await cdpEvaluate(webContents, findWhatsAppPaneResetJs());
    } catch {
      try {
        node = await webContents.executeJavaScript(waSearchNodeJs(), true);
        reset = await webContents.executeJavaScript(findWhatsAppPaneResetJs(), true);
      } catch {
        node = null;
      }
    }

    if (node?.clearX != null) await cdpClickAt(webContents, node.clearX, node.clearY);
    else if (reset?.clearHint) await cdpClickAt(webContents, reset.clearHint.x, reset.clearHint.y);
    await sleepMs(70);

    if (node?.x != null) await cdpClickAt(webContents, node.x, node.y);
    else if (reset?.search) await cdpClickAt(webContents, reset.search.x, reset.search.y);
    await sleepMs(70);

    // CDP userGesture mutate — plain executeJavaScript is ignored by WA React.
    // Do NOT send Ctrl+A: if focus is on the conversation it selects every message.
    try {
      await cdpEvaluate(webContents, waMutateSearchJs(''));
    } catch {
      try {
        await webContents.executeJavaScript(nuclearWipeMessagingSearchJs(), true);
      } catch {
        /* ignore */
      }
    }

    if (node?.backX != null) await cdpClickAt(webContents, node.backX, node.backY);
    else if (reset?.backHint) await cdpClickAt(webContents, reset.backHint.x, reset.backHint.y);
    await sleepMs(80);

    if (resetPane && reset?.chats && pass <= 1) {
      await cdpClickAt(webContents, reset.chats.x, reset.chats.y);
      await sleepMs(120);
    }
    if (resetPane && reset?.allFilter && pass <= 2) {
      await cdpClickAt(webContents, reset.allFilter.x, reset.allFilter.y);
      await sleepMs(80);
    }

    try {
      await webContents.executeJavaScript(clearMessagingLeftSearchJs(), true);
    } catch {
      /* ignore */
    }

    const left = await readGuestSearchText(webContents);
    if (!left) return true;
  }
  return !(await readGuestSearchText(webContents));
}

/** Focus left-pane search (not the compose box) via CDP click. */
async function focusGuestLeftSearch(webContents) {
  if (!webContents || webContents.isDestroyed()) return false;
  for (let i = 0; i < 4; i += 1) {
    let node = null;
    try {
      node = await cdpEvaluate(webContents, waSearchNodeJs());
    } catch {
      node = await webContents.executeJavaScript(waSearchNodeJs(), true).catch(() => null);
    }
    if (!node || !Number.isFinite(node.x)) {
      const box = await webContents.executeJavaScript(findMessagingLeftSearchJs(), true);
      if (!box?.ok) return false;
      await cdpClickAt(webContents, box.x, box.y);
    } else {
      await cdpClickAt(webContents, node.x, node.y);
    }
    await sleepMs(120);
    try {
      const focused = await cdpEvaluate(
        webContents,
        `(() => {
          const el = document.activeElement;
          return !!(el && (el.getAttribute('data-tab') === '3'
            || /search/i.test(el.getAttribute('aria-label') || '')
            || /search/i.test(el.getAttribute('data-placeholder') || '')));
        })()`,
      );
      if (focused) return true;
    } catch {
      /* retry */
    }
  }
  return false;
}

/** Clear then set pin name via CDP userGesture; verify box shows the new name. */
async function fillGuestSearchVerified(webContents, text) {
  const want = String(text || '').trim();
  const wantN = want.toLowerCase().replace(/\s+/g, ' ');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trustedClearMessagingSearch(webContents, { resetPane: attempt === 0 });
    const emptied = !(await readGuestSearchText(webContents));
    if (!emptied && attempt < 4) continue;

    await focusGuestLeftSearch(webContents);
    let mutated = null;
    try {
      mutated = await cdpEvaluate(webContents, waMutateSearchJs(want));
    } catch {
      mutated = null;
    }
    if (!mutated?.ok) {
      // Fallback: CDP mutate again after re-focus (never Ctrl+A — selects chat text).
      await focusGuestLeftSearch(webContents);
      await replaceGuestSearchText(webContents, want);
      await sleepMs(220);
    }
    await sleepMs(260);
    const got = (await readGuestSearchText(webContents)).toLowerCase().replace(/\s+/g, ' ');
    if (got === wantN || (wantN && got.includes(wantN)) || (got && wantN.includes(got) && got.length >= 6)) {
      return true;
    }
  }
  return false;
}

async function openMessagingChat(serviceId, { name = '', chatKey = '', nativeId = '' } = {}) {
  const service = getService(serviceId);
  if (!service || !isInboxAppId(service.appId)) {
    return { ok: false, error: 'Open a WhatsApp or Arattai chat.' };
  }
  if (whatsappAutomationBlocked(settings, service.appId)) {
    return {
      ok: false,
      error: whatsappSafeModeBlockedMessage('auto-opening WhatsApp chats'),
    };
  }
  const chatName = String(name || '').trim();
  const key = chatKey || normalizeChatKey(chatName);
  const waId = String(nativeId || '').trim();
  if (!chatName && !key) {
    return { ok: false, error: 'Missing contact name.' };
  }
  const isWhatsApp = service.appId === 'whatsapp';
  // Never let a leftover Forward Ctrl+V land in the chat we are about to open.
  cancelPendingForwardPaste();
  // Cancel any previous pin-open automation (video: late AYUSH click stole later UI).
  const myGen = (pinOpenGeneration += 1);
  const alive = () => myGen === pinOpenGeneration;

  raiseDockWindow();
  activateService(serviceId);

  // Wait for the guest to be interactive (cold/warm wake).
  let wc = null;
  const readyDeadline = Date.now() + 8_000;
  while (Date.now() < readyDeadline) {
    if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
    const entry = views.get(serviceId);
    wc = entry?.view?.webContents || null;
    if (wc && !wc.isDestroyed() && !wc.isLoading()) break;
    await sleepMs(200);
  }
  if (!wc || wc.isDestroyed()) {
    return { ok: false, error: 'Chat view is not ready.' };
  }

  // After account switch, WA/Arattai list can still be empty for a beat.
  // Arattai: shorter wait — frequent contacts / recent search often enough.
  const listDeadline = Date.now() + (isWhatsApp ? 5_000 : 2_000);
  while (Date.now() < listDeadline) {
    if (!alive() || wc.isDestroyed()) break;
    try {
      const listReady = await wc.executeJavaScript(
        `(() => {
          const hasRow = !!(
            document.querySelector('[data-testid="cell-frame-container"]')
            || document.querySelector('.art-chat-item')
            || document.querySelector('[role="listitem"]')
            || document.querySelector('[chid]')
          );
          const hasSearch = !!(
            document.querySelector('[data-testid="chat-list-search"]')
            || document.querySelector('[contenteditable="true"][data-tab="3"]')
            || document.querySelector('[aria-label*="Search or start" i]')
            || document.querySelector('[placeholder*="Search" i]')
          );
          return hasRow || hasSearch;
        })()`,
        true,
      );
      if (listReady) break;
    } catch (_) {
      /* retry */
    }
    await sleepMs(isWhatsApp ? 200 : 100);
  }
  if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
  await sleepMs(isWhatsApp ? 280 : 80);

  // Header match only — do not focus compose yet (that steals the next search paste).
  const headerOpen = async () => {
    const match = await guestHeaderMatchesPin(wc, chatName, key);
    if (!match.ok) return null;
    return { ok: true, via: 'opened', chat: match.header || chatName };
  };

  const persistResolvedNativeId = async () => {
    if (!isWhatsApp) return;
    try {
      const active = await wc.executeJavaScript(readActiveWhatsAppChatJs(), true);
      const nid = String(active?.nativeId || '').trim();
      if (!nid) return;
      const pins = sanitizePinnedPeople(settings.pinnedPeople || []);
      const pinId = makePinId(serviceId, key);
      let changed = false;
      const next = pins.map((p) => {
        if (p.id !== pinId && normalizeChatKey(p.name) !== key) return p;
        if (p.nativeId === nid) return p;
        changed = true;
        return { ...p, nativeId: nid };
      });
      if (changed) {
        settings = saveSettings({ pinnedPeople: next });
        broadcastState();
      }
    } catch {
      /* ignore */
    }
  };

  const finishOpenWhatsApp = async (opened) => {
    if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
    // Clear search text only — never Back (closes chat → Meta AI empty pane).
    await dismissMessagingSearchAfterOpen(wc);
    if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
    // Re-confirm header after dismiss — false "success" was the 0.4.27 chaos.
    const still = await headerOpen();
    if (!still) {
      return { ok: false, error: `Could not keep “${chatName}” open.` };
    }
    await markActiveComposeTarget(serviceId);
    await clearGuestPageSelection(wc);
    await sanitizeComposeAfterHubChatOpen(wc);
    await persistResolvedNativeId();
    return { ...opened, chat: still.chat || opened.chat };
  };

  /** Arattai: light cleanup only — never WA nuclear wipe / CDP search smash. */
  const finishOpenArattai = async (opened) => {
    if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
    try {
      await wc.executeJavaScript(clearMessagingLeftSearchJs(), true);
    } catch {
      /* ignore */
    }
    await clearGuestPageSelection(wc);
    await markActiveComposeTarget(serviceId);
    await clearGuestPageSelection(wc);
    await sanitizeComposeAfterHubChatOpen(wc);
    return opened;
  };

  const trustedClickTarget = async (via) => {
    if (!alive()) return null;
    const hit = await wc.executeJavaScript(
      findMessagingChatTargetJs(chatName, key, waId),
      true,
    );
    if (!hit?.ok || !Number.isFinite(hit.x) || !Number.isFinite(hit.y)) {
      return null;
    }
    // Refuse weak / group matches for WhatsApp person pins.
    if (isWhatsApp && (hit.group || hit.score < 78)) return null;
    if (isWhatsApp) await cdpClickAt(wc, hit.x, hit.y);
    else clickWebContentsAt(wc, hit.x, hit.y);
    await sleepMs(isWhatsApp ? 380 : 220);
    if (!alive()) return null;
    const opened = await headerOpen();
    if (opened) return { ...opened, via };
    if (isWhatsApp) await cdpClickAt(wc, hit.x, hit.y);
    else clickWebContentsAt(wc, hit.x, hit.y);
    await sleepMs(isWhatsApp ? 420 : 260);
    if (!alive()) return null;
    const again = await headerOpen();
    return again ? { ...again, via: `${via}-retry` } : null;
  };

  // ── Arattai fast path ──────────────────────────────────────────────
  if (!isWhatsApp) {
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!alive() || wc.isDestroyed()) {
        return { ok: false, error: 'cancelled', cancelled: true };
      }
      try {
        const already = await headerOpen();
        if (already) return finishOpenArattai({ ...already, via: 'already-open' });

        let opened = await trustedClickTarget(
          waId && attempt === 0 ? 'arattai-chid' : attempt === 0 ? 'list-click' : 'list-retry',
        );
        if (opened) return finishOpenArattai(opened);

        const legacy = await wc.executeJavaScript(
          openMessagingChatJs(chatName, key, waId),
          true,
        );
        if (legacy?.ok) {
          const matched = await headerOpen();
          if (matched) {
            return finishOpenArattai({ ...matched, via: legacy.via || 'legacy-js' });
          }
          lastError = `Could not confirm “${chatName}” opened.`;
        } else {
          lastError = legacy?.reason || 'chat_not_found';
        }
      } catch (error) {
        lastError = String(error?.message || error);
      }
      await sleepMs(220 + attempt * 120);
    }
    if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
    try {
      if (!wc.isDestroyed()) await wc.executeJavaScript(clearMessagingLeftSearchJs(), true);
    } catch {
      /* ignore */
    }
    await clearGuestPageSelection(wc);
    return {
      ok: false,
      error:
        lastError && lastError !== 'chat_not_found'
          ? lastError
          : `Could not open “${chatName || 'chat'}”. Search that name once in the app, then pin again.`,
    };
  }

  // ── WhatsApp hardened path ─────────────────────────────────────────
  // ONLY header match counts as success (never trust Store title alone).
  const confirmOpened = async (via) => {
    for (let i = 0; i < 5; i += 1) {
      if (!alive()) return null;
      const matched = await headerOpen();
      if (matched) return { ...matched, via };
      await sleepMs(200);
    }
    return null;
  };

  const tryStoreOpen = async (via) => {
    if (!alive()) return null;
    let storeOpen = null;
    try {
      storeOpen = await cdpEvaluate(
        wc,
        tryOpenWhatsAppStoreChatJs(chatName, waId),
        { awaitPromise: true },
      );
    } catch {
      try {
        storeOpen = await wc.executeJavaScript(
          tryOpenWhatsAppStoreChatJs(chatName, waId),
          true,
        );
      } catch {
        storeOpen = null;
      }
    }
    if (!storeOpen?.ok) return null;
    await sleepMs(350);
    return confirmOpened(via);
  };

  const tryExactContactClick = async (via) => {
    if (!alive()) return null;
    let hit = null;
    try {
      hit = await cdpEvaluate(wc, findExactWhatsAppContactTargetJs(chatName, waId));
    } catch {
      try {
        hit = await wc.executeJavaScript(
          findExactWhatsAppContactTargetJs(chatName, waId),
          true,
        );
      } catch {
        hit = null;
      }
    }
    if (!hit?.ok || !Number.isFinite(hit.x)) return null;
    await cdpClickAt(wc, hit.x, hit.y);
    await sleepMs(380);
    if (!alive()) return null;
    const opened = await confirmOpened(via);
    if (opened) return opened;
    await cdpClickAt(wc, hit.x, hit.y);
    await sleepMs(420);
    if (!alive()) return null;
    return confirmOpened(`${via}-retry`);
  };

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!alive() || wc.isDestroyed()) {
      return { ok: false, error: 'cancelled', cancelled: true };
    }
    try {
      const viaStore = await tryStoreOpen(attempt === 0 ? 'wa-store' : 'wa-store-retry');
      if (viaStore) return finishOpenWhatsApp(viaStore);

      const alreadyPre = await headerOpen();
      if (alreadyPre) return finishOpenWhatsApp({ ...alreadyPre, via: 'already-open' });

      // Exact chip/list only — do not focus search first (that steals the UI).
      let opened = await tryExactContactClick(
        attempt === 0 ? 'exact-chip' : 'exact-chip-retry',
      );
      if (opened) return finishOpenWhatsApp(opened);
      opened = await trustedClickTarget(
        attempt === 0 ? 'list-click' : 'list-retry',
      );
      if (opened) return finishOpenWhatsApp(opened);

      // Light clear (no Chats reset) then exact again.
      await trustedClearMessagingSearch(wc, { resetPane: false });
      await sleepMs(100);
      if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };

      const already = await headerOpen();
      if (already) return finishOpenWhatsApp({ ...already, via: 'already-open' });

      opened = await tryExactContactClick('exact-after-clear');
      if (opened) return finishOpenWhatsApp(opened);

      // Short search fill — click exact Contacts hit only. Never ArrowDown/Enter
      // (opens wrong chat / races with the user's next click).
      const filled = await fillGuestSearchVerified(wc, chatName);
      if (filled) {
        await sleepMs(400);
        const searchStarted = Date.now();
        while (Date.now() - searchStarted < 2800) {
          if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
          opened = await tryExactContactClick('search-exact');
          if (opened) return finishOpenWhatsApp(opened);
          await sleepMs(200);
        }
      } else {
        lastError = 'search_fill_failed';
      }

      const viaStoreLate = await tryStoreOpen('wa-store-late');
      if (viaStoreLate) return finishOpenWhatsApp(viaStoreLate);
      lastError = lastError || 'chat_not_found';
    } catch (error) {
      lastError = String(error?.message || error);
    }
    await sleepMs(280 + attempt * 120);
  }

  if (!alive()) return { ok: false, error: 'cancelled', cancelled: true };
  // Failed: clear leftover search gently so the next pin is not poisoned.
  try {
    if (!wc.isDestroyed()) await dismissMessagingSearchAfterOpen(wc);
  } catch {
    /* ignore */
  }

  return {
    ok: false,
    error:
      lastError && lastError !== 'chat_not_found' && lastError !== 'search_fill_failed'
        ? lastError
        : `Could not open “${chatName || 'chat'}”. Search that name once in the app, then pin again.`,
  };
}

async function sendQuickReply(serviceId, { name = '', chatKey = '', text = '' } = {}) {
  const message = String(text || '').trim();
  if (!message) return { ok: false, error: 'Type a short reply first.' };
  const service = getService(serviceId);
  if (whatsappAutomationBlocked(settings, service?.appId)) {
    return {
      ok: false,
      error: whatsappSafeModeBlockedMessage('Quick reply Send on WhatsApp'),
    };
  }
  const opened = await openMessagingChat(serviceId, { name, chatKey });
  if (!opened.ok) return opened;
  const entry = views.get(serviceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    return { ok: false, error: 'Chat view is gone.' };
  }
  try {
    await markActiveComposeTarget(serviceId);
    const placed = await wc.executeJavaScript(
      composeReplyJs(message, { send: true }),
      true,
    );
    if (placed?.ok) {
      return { ok: true, via: placed.via || 'sent' };
    }
    return {
      ok: false,
      error: 'Opened the chat — paste or type your reply, then Send.',
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function searchChatsAcrossAccounts(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: true, chats: [] };
  const services = orderedServices().filter(
    (s) =>
      isInboxAppId(s.appId) &&
      views.has(s.id) &&
      !whatsappAutomationBlocked(settings, s.appId),
  );
  const chats = [];
  await Promise.all(
    services.map(async (service) => {
      const wc = views.get(service.id)?.view?.webContents;
      if (!wc || wc.isDestroyed()) return;
      try {
        const result = await wc.executeJavaScript(searchMessagingChatsJs(q), true);
        for (const chat of result?.chats || []) {
          chats.push({
            serviceId: service.id,
            appId: service.appId,
            accountLabel: service.title || service.name || 'App',
            chatKey: normalizeChatKey(chat.chatKey || chat.name),
            name: String(chat.name || '').trim(),
            match: String(chat.match || 'name'),
            snippet: String(chat.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            color: service.color || '#64748b',
            logo: service.logo || null,
          });
        }
      } catch {
        // ignore
      }
    }),
  );
  return { ok: true, chats: chats.slice(0, 30) };
}

function pinPerson(payload = {}) {
  const service = getService(payload.serviceId);
  if (!service || !isInboxAppId(service.appId)) {
    return { ok: false, error: 'Pin WhatsApp or Arattai chats only.' };
  }
  if (whatsappAutomationBlocked(settings, service.appId)) {
    return {
      ok: false,
      error: whatsappSafeModeBlockedMessage('Hub Pins on WhatsApp'),
    };
  }
  const name = String(payload.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const chatKey = normalizeChatKey(payload.chatKey || name);
  const nativeId = String(payload.nativeId || payload.chid || '').trim().slice(0, 120);
  if (!name || !chatKey || isJunkChatName(name)) {
    return { ok: false, error: 'Could not read that chat name. Right-click the contact in the list.' };
  }
  const existing = sanitizePinnedPeople(settings.pinnedPeople || []);
  if (existing.some((p) => p.id === makePinId(service.id, chatKey))) {
    return { ok: true, pinnedPeople: existing, already: true };
  }
  if (existing.length >= 10) {
    return {
      ok: false,
      error: 'Hub pins are full (10). Unpin one from the Pinned strip, then try again.',
    };
  }
  const next = sanitizePinnedPeople([
    {
      id: makePinId(service.id, chatKey),
      serviceId: service.id,
      chatKey,
      name,
      appId: service.appId,
      ...(nativeId ? { nativeId } : {}),
    },
    ...existing,
  ]);
  settings = saveSettings({ pinnedPeople: next });
  broadcastState();
  return { ok: true, pinnedPeople: next };
}

/**
 * Pin a chat from the guest right-click menu.
 * Uses the chat-list row under the cursor — not WhatsApp/Arattai's own Pin.
 * Prefer a hit resolved when the menu opened (Arattai's overlay can cover the row later).
 */
async function pinChatFromGuestContext(webContents, service, params = {}, preHit = null) {
  if (!webContents || webContents.isDestroyed() || !service) {
    return { ok: false };
  }
  let name = '';
  let chatKey = '';
  let nativeId = '';
  const applyHit = (hit) => {
    if (!hit?.ok) return;
    const n = String(hit.name || '').trim();
    if (!n || isJunkChatName(n)) return;
    name = n;
    chatKey = String(hit.chatKey || normalizeChatKey(n)).trim();
    const nid = String(hit.nativeId || hit.chid || '').trim();
    if (nid) nativeId = nid;
  };
  applyHit(preHit);
  if (!name) {
    try {
      const hit = await webContents.executeJavaScript(
        inspectChatListTargetJs(params.x, params.y),
        true,
      );
      applyHit(hit);
    } catch {
      // ignore
    }
  }
  // Selection / titleText from the context-menu event (contact name under cursor).
  if (!name || isJunkChatName(name)) {
    for (const raw of [params.selectionText, params.titleText, params.altText]) {
      const n = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (n && !isJunkChatName(n)) {
        name = n;
        chatKey = normalizeChatKey(n);
        break;
      }
    }
  }
  // Open conversation header as fallback when right-clicking inside an open chat.
  if (!name || isJunkChatName(name)) {
    try {
      const key = await getGuestChatKey(webContents);
      if (key?.title && !isJunkChatName(key.title)) {
        name = key.title;
        chatKey = normalizeChatKey(key.title);
      }
    } catch {
      // ignore
    }
  }
  // Capture WA chat id whenever possible — name-only pins fail for mention-heavy contacts.
  if (!nativeId && service.appId === 'whatsapp') {
    try {
      const active = await webContents.executeJavaScript(readActiveWhatsAppChatJs(), true);
      if (active?.ok) {
        const nid = String(active.nativeId || '').trim();
        if (nid) nativeId = nid;
        if ((!name || isJunkChatName(name)) && active.title && !isJunkChatName(active.title)) {
          name = String(active.title).trim();
          chatKey = normalizeChatKey(name);
        }
      }
    } catch {
      /* ignore */
    }
  }
  const result = pinPerson({
    serviceId: service.id,
    name,
    chatKey,
    appId: service.appId,
    nativeId,
  });
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Aspera Hub',
        body: result.ok
          ? result.already
            ? `“${name}” is already in Hub Pinned.`
            : `Pinned “${name}” in Hub (works for Arattai + WhatsApp; Hub pins ≠ in-app pins).`
          : result.error || 'Could not pin that chat.',
        silent: true,
      }).show();
    }
  } catch {
    // ignore
  }
  return result;
}

function unpinPerson(pinId) {
  const id = String(pinId || '');
  const next = sanitizePinnedPeople(
    (settings.pinnedPeople || []).filter((p) => p.id !== id),
  );
  settings = saveSettings({ pinnedPeople: next });
  broadcastState();
  return { ok: true, pinnedPeople: next };
}

/**
 * Show a rich desktop + in-app notification for a guest app.
 * Prefer intercepted page Notification payloads (sender + message).
 */
function emitServiceNotification(
  service,
  { title, body, fromTitleCount = false, showOs = true } = {},
) {
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

  if (!showOs || !Notification.isSupported()) return true;
  const n = new Notification({
    title: displayTitle,
    body: displayBody,
    silent: settings.muted || !liveCfg.allowSounds,
  });
  n.on('click', () => {
    raiseDockWindow();
    if (isInboxAppId(service.appId) && sender && !hide) {
      openMessagingChat(service.id, {
        name: sender,
        chatKey: normalizeChatKey(sender),
      }).catch(() => activateService(service.id));
      return;
    }
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
    const wc = entry?.view?.webContents;
    if (!wc || wc.isDestroyed()) continue;
    const cfg = getAppConfig(id);
    wc.setAudioMuted(settings.muted || !cfg.allowSounds);
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

/** Resolve Hub service for a guest/popup webContents (for UA / spoof policy). */
function serviceForWebContentsId(wcId) {
  const id = Number(wcId);
  if (!Number.isFinite(id)) return null;
  for (const [serviceId, entry] of views.entries()) {
    try {
      if (entry?.view?.webContents?.id === id) {
        return getService(serviceId) || entry.service || null;
      }
    } catch {
      // ignore
    }
  }
  // OAuth popups are not docked views — map them via tracked service windows.
  for (const [serviceId, set] of servicePopups.entries()) {
    if (!set) continue;
    for (const win of set) {
      try {
        if (!win || win.isDestroyed()) continue;
        if (win.webContents?.id === id) {
          return getService(serviceId) || null;
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

/** Keep link-tab guests on Chrome UA (some CDNs reject a Firefox pin). */
function pinChromeUserAgent(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  try {
    webContents.setUserAgent(CHROME_USER_AGENT);
  } catch {
    // ignore
  }
}

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

  // Google: Chrome UA/Client Hints on product hosts; Firefox on accounts.google.com
  // for ALL Google sign-in (Gmail and third-party OAuth). Never flip mid-OAuth.
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
        callback({ cancel: false, requestHeaders: headers });
        return;
      }

      const svc = serviceForWebContentsId(details.webContentsId);
      const isAccounts =
        host === 'accounts.google.com' || host.endsWith('.accounts.google.com');

      // accounts.google.com FIRST — never send Chrome UA here (Google blocks Electron).
      if (isAccounts) {
        const next = applyGoogleRequestHeaders(headers, details.url, {
          chromeUA: CHROME_USER_AGENT,
          firefoxAccountsUA: FIREFOX_ACCOUNTS_UA,
          secChUa: SEC_CH_UA,
          enabled: settings.googleSpoofEnabled !== false,
        });
        callback({ cancel: false, requestHeaders: next });
        return;
      }

      if (svc?.linkTab || svc?.isCustom) {
        // Match real Chrome — some CDNs reject mismatched CH after Firefox pin.
        headers['User-Agent'] = CHROME_USER_AGENT;
        headers['sec-ch-ua'] = SEC_CH_UA;
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = '"Linux"';
      }

      const next = applyGoogleRequestHeaders(headers, details.url, {
        chromeUA: CHROME_USER_AGENT,
        firefoxAccountsUA: FIREFOX_ACCOUNTS_UA,
        secChUa: SEC_CH_UA,
        enabled: settings.googleSpoofEnabled !== false,
      });
      callback({ cancel: false, requestHeaders: next });
    },
  );

  partitionSession.on('will-download', (_event, item) => {
    // Silent capture for Forward-with-Hub (must not show Save dialog).
    const pending = pendingForwardDownload;
    if (pending) {
      pendingForwardDownload = null;
      try {
        const hinted = String(pending.fileName || '').trim();
        const rawName = hinted || item.getFilename() || 'document.bin';
        const name = sanitizeForwardFilename(
          rawName,
          extensionOf(rawName) || 'bin',
        );
        const savePath = path.join(forwardTempDir(), `${Date.now()}-${name}`);
        item.setSavePath(savePath);
        item.once('done', (_e, state) => {
          if (state === 'completed') {
            rememberGuestDownload(savePath, name);
            pending.resolve(item.getSavePath());
          } else {
            pending.reject(new Error(`Download ${state}`));
          }
        });
      } catch (error) {
        try {
          item.cancel();
        } catch {
          // ignore
        }
        pending.reject(error);
      }
      // Swallow duplicate DownloadItems from the same preview click briefly.
      beginForwardExtraSwallow();
      return;
    }

    if (shouldSwallowForwardExtraDownload()) {
      swallowForwardExtraDownload(item);
      return;
    }

    // One click can emit two DownloadItems (preview + real). A second Save
    // dialog reuses GTK's sticky last filename — Maharashtra then "replaces"
    // into Karnataka.pdf. Cancel near-duplicate prompts.
    const downloadName = item.getFilename() || 'download';
    const downloadUrl = typeof item.getURL === 'function' ? item.getURL() : '';
    const dedupeKey = `${downloadUrl}|${downloadName}|${item.getTotalBytes?.() || 0}`;
    const now = Date.now();
    if (
      dedupeKey &&
      dedupeKey === lastGuestDownloadDedupeKey &&
      now - lastGuestDownloadDedupeAt < 2_000
    ) {
      try {
        item.cancel();
      } catch {
        // ignore
      }
      return;
    }
    lastGuestDownloadDedupeKey = dedupeKey;
    lastGuestDownloadDedupeAt = now;

    const downloadDir = String(settings.downloadPath || '').trim();
    let savePathClaimed = '';
    /** @type {{ path: string, claimPath: string, canceled: boolean, ready: Promise<void>, resolveReady: () => void } | null} */
    let destHolder = null;
    if (downloadDir) {
      savePathClaimed = uniqueDownloadPath(downloadDir, downloadName);
      item.setSavePath(savePathClaimed);
    } else {
      const defaultPath = uniqueDownloadPath(
        app.getPath('downloads'),
        downloadName,
      );
      savePathClaimed = defaultPath;
      let resolveReady = () => {};
      const ready = new Promise((resolve) => {
        resolveReady = resolve;
      });
      destHolder = {
        path: defaultPath,
        claimPath: '',
        canceled: false,
        ready,
        resolveReady: () => resolveReady(),
      };
      promptGuestDownloadSave(item, defaultPath, downloadName, destHolder);
    }
    item.once('done', async (_e, state) => {
      if (destHolder) {
        try {
          await destHolder.ready;
        } catch {
          // ignore
        }
        releaseDownloadPath(savePathClaimed);
        releaseDownloadPath(destHolder.path);
        if (destHolder.canceled || state !== 'completed') {
          const claim = String(destHolder.claimPath || '').trim();
          if (claim) {
            try {
              if (fs.existsSync(claim)) fs.unlinkSync(claim);
            } catch {
              // ignore
            }
          }
          return;
        }
        const savePath = moveDownloadClaim(
          destHolder.claimPath,
          destHolder.path,
        );
        releaseDownloadPath(savePath);
        if (!savePath || !fs.existsSync(savePath)) return;
        rememberGuestDownload(
          savePath,
          item.getFilename?.() || path.basename(savePath),
        );
        // Ask-every-time: user already picked the folder — skip auto-open
        // folder (Thunar can cover the next dialog on XFCE).
        if (settings.openFileOnDownload) shell.openPath(savePath);
        return;
      }

      const savePath = item.getSavePath?.() || savePathClaimed;
      releaseDownloadPath(savePath);
      releaseDownloadPath(savePathClaimed);
      if (state !== 'completed') return;
      rememberGuestDownload(
        savePath,
        item.getFilename?.() || path.basename(savePath),
      );
      // After Save As, opening the folder is redundant and Thunar can cover
      // the next Save dialog on XFCE — only auto-open for fixed download dirs.
      if (settings.openFolderOnDownload && downloadDir) {
        shell.showItemInFolder(savePath);
      }
      if (settings.openFileOnDownload) shell.openPath(savePath);
    });
  });

  syncExtensionsIntoSession(partitionSession).catch(() => {});
}

function rememberGuestDownload(filePath, fileName = '') {
  const abs = String(filePath || '').trim();
  if (!abs || !fs.existsSync(abs)) return;
  const name = String(fileName || path.basename(abs)).trim();
  const ext = extensionOf(name || abs);
  if (!isDocumentExtension(ext) && !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return;
  }
  recentGuestDownloads.unshift({ path: abs, name, at: Date.now() });
  if (recentGuestDownloads.length > RECENT_DOWNLOAD_MAX) {
    recentGuestDownloads.length = RECENT_DOWNLOAD_MAX;
  }
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
  // PDF preview / child popups are tracked separately.
  for (const [id, set] of servicePopups.entries()) {
    if (!set) continue;
    for (const win of set) {
      try {
        if (win && !win.isDestroyed() && win.webContents === webContents) return id;
      } catch {
        // ignore
      }
    }
  }
  try {
    const owner = BrowserWindow.fromWebContents(webContents);
    if (owner) {
      for (const [id, set] of servicePopups.entries()) {
        if (set?.has?.(owner)) return id;
      }
    }
  } catch {
    // ignore
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

async function inspectForwardContext(webContents, x, y) {
  const empty = {
    url: '',
    name: '',
    nearbyText: '',
    hasDownload: false,
    hasDocIcon: false,
    docLikely: false,
    arattaiDownloadUrl: '',
    downloadPoints: [],
  };
  if (!webContents || webContents.isDestroyed()) return empty;
  try {
    const result = await webContents.executeJavaScript(
      `(() => {
        const x = ${Number(x) || 0};
        const y = ${Number(y) || 0};
        const start = document.elementFromPoint(x, y);
        if (!start) {
          return {
            url: '', name: '', nearbyText: '', hasDownload: false,
            hasDocIcon: false, docLikely: false,
            arattaiDownloadUrl: '', downloadPoints: [],
          };
        }
        const isDoc = (href, name) => {
          const s = String(href || '') + ' ' + String(name || '');
          return /\\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z)(\\?|#|$)/i.test(s)
            || /application\\/pdf|\\/pdf\\b/i.test(s)
            || /webdownload|\\/v1\\/attachments\\//i.test(s)
            || /\\bpdf\\b/i.test(String(name || ''));
        };
        const abs = (href) => {
          try { return new URL(href, location.href).href; }
          catch (e) { return String(href || ''); }
        };
        const chatIdGuess = () => {
          const href = String(location.href || '');
          const hash = String(location.hash || '');
          const hay = href + ' ' + hash;
          return (
            (hay.match(/chats?\\/([A-Za-z0-9_.-]+)/i) || [])[1] ||
            (hay.match(/[?&#](?:chat[_-]?id|chid|chidid)=([A-Za-z0-9_.-]+)/i) || [])[1] ||
            (hay.match(/\\b([0-9]{10,})\\b/) || [])[1] ||
            ''
          );
        };
        const pickLink = (node) => {
          if (!node) return null;
          if (node.tagName === 'A' && node.href && isDoc(node.href, node.download || node.textContent)) {
            return {
              url: node.href,
              name: String(node.download || node.textContent || '').trim(),
            };
          }
          const attrUrl =
            node.getAttribute?.('href') ||
            node.getAttribute?.('data-url') ||
            node.getAttribute?.('data-src') ||
            node.getAttribute?.('data-file-url') ||
            node.getAttribute?.('data-original') ||
            '';
          const attrName =
            node.getAttribute?.('download') ||
            node.getAttribute?.('data-filename') ||
            node.getAttribute?.('title') ||
            node.getAttribute?.('aria-label') ||
            '';
          if (attrUrl && isDoc(attrUrl, attrName)) {
            return { url: abs(attrUrl), name: String(attrName || '').trim() };
          }
          return null;
        };
        const collectAttrUrls = (root) => {
          const out = [];
          const push = (v) => {
            const s = String(v || '').trim();
            if (!s) return;
            if (/^https?:|^blob:|^data:/i.test(s) || s.startsWith('/')) out.push(abs(s));
          };
          if (!root?.querySelectorAll) return out;
          for (const el of root.querySelectorAll('img, a, source, [src], [href], [data-url], [data-src], [data-file-url], [data-file-id], [data-id]')) {
            push(el.currentSrc || el.src);
            push(el.href);
            for (const attr of [
              'data-url', 'data-src', 'data-file-url', 'data-original',
              'data-file-id', 'data-id', 'data-event-id', 'data-msgid',
            ]) {
              push(el.getAttribute?.(attr));
            }
          }
          try {
            for (const entry of performance.getEntriesByType('resource') || []) {
              push(entry.name);
            }
          } catch (e) {}
          return out;
        };
        const downloadishScore = (el) => {
          if (!el || el === document.body) return 0;
          const hay = [
            el.getAttribute?.('aria-label'),
            el.getAttribute?.('title'),
            el.getAttribute?.('data-icon'),
            el.getAttribute?.('data-testid'),
            el.getAttribute?.('data-mat-icon-name'),
            el.className,
            el.id,
            el.tagName === 'MAT-ICON' || el.classList?.contains?.('material-icons')
              ? el.textContent
              : '',
          ].join(' ').toLowerCase();
          let score = 0;
          if (/download|file_download|get_app|save as|save_alt|arrow_downward/.test(hay)) score += 8;
          if (/\\bpdf\\b|document|attachment/.test(hay)) score += 2;
          if (el.tagName === 'A' && el.hasAttribute?.('download')) score += 10;
          // Small icon-like controls inside a document card (Arattai arrow).
          try {
            const r = el.getBoundingClientRect?.();
            if (r && r.width > 8 && r.width < 56 && r.height > 8 && r.height < 56) score += 1;
          } catch (e) {}
          return score;
        };
        const centerOf = (el) => {
          try {
            const r = el.getBoundingClientRect();
            if (!r || r.width < 2 || r.height < 2) return null;
            return {
              x: Math.round(r.left + r.width / 2),
              y: Math.round(r.top + r.height / 2),
            };
          } catch (e) {
            return null;
          }
        };

        // Prefer a message/bubble container so "Invoice.pdf" labels are visible.
        let root = start;
        for (let i = 0; i < 14 && root && root !== document.body; i += 1) {
          const role = String(root.getAttribute?.('role') || '');
          const cls = String(root.className || '');
          const testid = String(root.getAttribute?.('data-testid') || '');
          if (
            role === 'row' ||
            /message|bubble|msg|document|attachment|media/i.test(cls + ' ' + testid)
          ) {
            break;
          }
          if (root.parentElement) root = root.parentElement;
        }

        let url = '';
        let name = '';
        let node = start;
        for (let i = 0; i < 12 && node; i += 1) {
          const direct = pickLink(node);
          if (direct) { url = direct.url; name = direct.name; break; }
          node = node.parentElement;
        }
        if (!url && root?.querySelectorAll) {
          for (const a of root.querySelectorAll('a[href], [download], [data-url], [data-file-url]')) {
            const hit = pickLink(a);
            if (hit) { url = hit.url; name = hit.name; break; }
          }
        }

        const nearbyText = String(root?.innerText || start.innerText || '')
          .replace(/\\s+/g, ' ')
          .trim()
          .slice(0, 500);
        const fileFromText = (nearbyText.match(/([\\w.\\- ()[\\]]+\\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv))\\b/i) || [])[1] || '';
        const truncatedPdf = (nearbyText.match(
          /([A-Za-z0-9][\\w.\\- ()[\\]]{2,80})\\.\\.\\.(?:(?!\\n).{0,80})?\\bPDF\\b/i,
        ) || [])[1] || '';
        if (!name && fileFromText) name = fileFromText;
        if (!name && truncatedPdf) name = truncatedPdf + '.pdf';

        const downloadSelectors = [
          '[aria-label*="download" i]',
          '[title*="download" i]',
          '[aria-label*="Download" i]',
          '[data-testid*="download" i]',
          '[data-icon="download"]',
          '[class*="download" i]',
          '[id*="download" i]',
          'a[download]',
          'button[aria-label*="save" i]',
          '[aria-label*="Save as" i]',
          '[title*="Save as" i]',
          '[data-mat-icon-name*="download" i]',
        ];
        const hasDownload = !!(root?.querySelector?.(downloadSelectors.join(', ')));
        // Avoid broad class*=document matches — many UIs use "document" in
        // unrelated class names and that false-flags ordinary photo bubbles.
        const hasDocIcon = !!(root?.querySelector?.(
          [
            '[data-icon="document"]',
            '[data-testid*="document" i]',
            '[aria-label*="document" i]',
            '[aria-label*="PDF" i]',
            'span[data-icon="document"]',
            'span[data-icon="audio-document"]',
          ].join(', '),
        ));
        const pagesMeta = /\\b\\d+\\s*pages?\\s*[·•|\\-]\\s*[\\d.,]+\\s*(KB|MB|GB)\\b/i.test(nearbyText);
        const docLikely =
          !!url ||
          !!fileFromText ||
          !!truncatedPdf ||
          hasDocIcon ||
          pagesMeta ||
          /\\bPDF\\b/.test(nearbyText) ||
          /\\b(Document|Attachment)\\b/i.test(nearbyText) ||
          /\\.(pdf|docx?|xlsx?|pptx?)\\b/i.test(nearbyText);

        const chatId = chatIdGuess();
        let arattaiDownloadUrl = '';
        const mediaUrls = collectAttrUrls(root || start);
        for (const mediaUrl of mediaUrls) {
          if (/files\\.arattai\\.in\\/webdownload|\\/v1\\/attachments\\//i.test(mediaUrl)) {
            url = url || mediaUrl;
            // Prefer rebuilding full-file URL in main via parse helpers.
            arattaiDownloadUrl = arattaiDownloadUrl || mediaUrl;
          }
          const fileIdAttr = (mediaUrl.match(/event-id=([^&]+)/i) || [])[1];
          if (fileIdAttr && chatId && !arattaiDownloadUrl.includes('thumbnail')) {
            // keep first candidate; main will strip thumbnail
          }
        }
        // data-file-id on card + chat from location
        if (!arattaiDownloadUrl && root?.querySelectorAll && chatId) {
          for (const el of root.querySelectorAll('[data-file-id], [data-event-id], [data-id]')) {
            const fid = el.getAttribute('data-file-id')
              || el.getAttribute('data-event-id')
              || el.getAttribute('data-id')
              || '';
            if (fid && fid.length >= 8) {
              arattaiDownloadUrl =
                'https://files.arattai.in/webdownload?x-service=CLIQ&event-id=' +
                encodeURIComponent(fid) +
                '&x-cli-msg=' +
                encodeURIComponent(JSON.stringify({ chat_id: chatId }));
              break;
            }
          }
        }

        const downloadPoints = [];
        const seen = new Set();
        const pushPoint = (el, why) => {
          const pt = centerOf(el);
          if (!pt) return;
          const key = pt.x + ',' + pt.y;
          if (seen.has(key)) return;
          seen.add(key);
          downloadPoints.push({ x: pt.x, y: pt.y, why: String(why || '') });
        };
        const scope = root || document;
        for (const sel of downloadSelectors) {
          for (const btn of scope.querySelectorAll(sel)) pushPoint(btn, sel);
        }
        // Score icon-like controls in the bubble (Arattai often uses unlabeled arrows).
        const candidates = Array.from(
          scope.querySelectorAll('button, a, [role="button"], svg, i, mat-icon, span, div'),
        );
        candidates
          .map((el) => ({ el, score: downloadishScore(el) }))
          .filter((row) => row.score >= 3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .forEach((row) => pushPoint(row.el.closest('button, a, [role="button"]') || row.el, 'score'));

        // Filename / PDF meta label click (opens or downloads depending on app).
        for (const n of scope.querySelectorAll('span, div, a, button, p')) {
          const t = String(n.textContent || '').replace(/\\s+/g, ' ').trim();
          if (!t || t.length > 120) continue;
          if (
            /\\.(pdf|docx?|xlsx?|pptx?)\\b/i.test(t) ||
            (/\\bPDF\\b/.test(t) && t.length < 80) ||
            /\\b\\d+\\s*pages?\\b/i.test(t)
          ) {
            pushPoint(n, 'label');
          }
        }

        return {
          url,
          name: String(name || '').trim(),
          nearbyText,
          hasDownload: hasDownload || downloadPoints.length > 0,
          hasDocIcon,
          docLikely,
          arattaiDownloadUrl,
          chatId,
          downloadPoints: downloadPoints.slice(0, 12),
        };
      })()`,
      true,
    );
    const chatId = String(result?.chatId || '').trim();
    const rawArattai = String(result?.arattaiDownloadUrl || '').trim();
    const arattaiDownloadUrl =
      arattaiFullFileUrlFromAny(rawArattai, chatId) ||
      arattaiFullFileUrlFromAny(String(result?.url || ''), chatId) ||
      rawArattai;
    return {
      url: String(result?.url || '').trim(),
      name: String(result?.name || '').trim(),
      nearbyText: String(result?.nearbyText || '').trim(),
      hasDownload: !!result?.hasDownload,
      hasDocIcon: !!result?.hasDocIcon,
      docLikely: !!result?.docLikely,
      arattaiDownloadUrl,
      chatId,
      downloadPoints: Array.isArray(result?.downloadPoints) ? result.downloadPoints : [],
    };
  } catch {
    return empty;
  }
}

function moveWebContentsTo(webContents, x, y) {
  if (!webContents || webContents.isDestroyed()) return;
  const cx = Math.max(0, Math.round(Number(x) || 0));
  const cy = Math.max(0, Math.round(Number(y) || 0));
  try {
    webContents.focus();
    webContents.sendInputEvent({ type: 'mouseMove', x: cx, y: cy });
  } catch {
    // ignore
  }
}

function clickWebContentsAt(webContents, x, y) {
  if (!webContents || webContents.isDestroyed()) return;
  const cx = Math.max(0, Math.round(Number(x) || 0));
  const cy = Math.max(0, Math.round(Number(y) || 0));
  try {
    webContents.focus();
  } catch {
    // ignore
  }
  const base = { x: cx, y: cy, button: 'left', clickCount: 1 };
  try {
    webContents.sendInputEvent({ type: 'mouseMove', x: cx, y: cy });
    webContents.sendInputEvent({ type: 'mouseDown', ...base });
    webContents.sendInputEvent({ type: 'mouseUp', ...base });
  } catch {
    // ignore
  }
}

function armForwardDownload(fileName = '', timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (pendingForwardDownload?.reject === reject) pendingForwardDownload = null;
      reject(new Error('Document download timed out.'));
    }, timeoutMs);
    pendingForwardDownload = {
      fileName,
      resolve: (filePath) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        beginForwardExtraSwallow();
        resolve(filePath);
      },
      reject: (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    };
  });
}

function disarmForwardDownload(downloadPromise) {
  if (pendingForwardDownload) {
    const pending = pendingForwardDownload;
    pendingForwardDownload = null;
    endForwardExtraSwallow();
    try {
      pending.reject(new Error('cancelled'));
    } catch {
      // ignore
    }
  }
  return downloadPromise.catch(() => '');
}

/** Script: find any in-memory PDF (%PDF-) from embeds, blobs, or WA caches. */
function guestPdfBytesProbeJs() {
  return `(() => {
    const toB64 = async (url) => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (bytes.length < 5) return null;
        if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
          return null;
        }
        if (bytes.length > 12 * 1024 * 1024) return null;
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return { b64: btoa(bin), size: bytes.length, url: String(url || '') };
      } catch (e) {
        return null;
      }
    };

    const urls = [];
    const push = (u) => {
      const s = String(u || '').trim();
      if (!s || urls.includes(s)) return;
      urls.push(s);
    };

    for (const el of document.querySelectorAll(
      'embed, object, iframe, a[href], a[download], source, video, audio',
    )) {
      push(el.src);
      push(el.href);
      push(el.getAttribute?.('data'));
      push(el.getAttribute?.('data-url'));
      push(el.getAttribute?.('data-src'));
    }

    // WhatsApp blob: URLs usually have no ".pdf" in the name — collect ALL blobs.
    try {
      for (const e of performance.getEntriesByType('resource') || []) {
        const n = String(e.name || '');
        if (/^blob:/i.test(n) || /\\.pdf($|\\?|#)/i.test(n) || /application%2Fpdf|application\\/pdf/i.test(n)) {
          push(n);
        }
        // WhatsApp CDN media often already decrypted into blob cache after open.
        if (/mmg\\.whatsapp\\.net|media\\.whatsapp|web\\.whatsapp\\.com\\/.*media/i.test(n)) {
          push(n);
        }
      }
    } catch (e) {}

    // Walk open dialogs / media viewers for hidden anchors.
    try {
      const roots = [
        document.querySelector('[role="dialog"]'),
        document.querySelector('[data-animate-modal-body="true"]'),
        document.body,
      ].filter(Boolean);
      for (const root of roots) {
        for (const a of root.querySelectorAll('a[href], a[download]')) {
          push(a.href);
          push(a.getAttribute('download') ? a.href : '');
        }
      }
    } catch (e) {}

    return (async () => {
      let best = null;
      // Prefer larger PDFs (skip tiny broken headers / thumbs).
      for (const url of urls.slice(0, 40)) {
        const hit = await toB64(url);
        if (!hit) continue;
        if (!best || hit.size > best.size) best = hit;
      }
      if (best) return { ok: true, ...best };

      // Last resort: WhatsApp Store media blob for the open document message.
      try {
        const modules = window.require && window.require('__debug')
          ? null
          : null;
        void modules;
      } catch (e) {}
      try {
        const chunk = window.webpackChunkwhatsapp_web_client || window.webpackChunkbuild;
        // Soft probe — ignore if Store is unavailable.
        void chunk;
      } catch (e) {}

      return { ok: false, tried: urls.length };
    })();
  })()`;
}

/**
 * True when WhatsApp/Adobe already shows a full-screen PDF / media viewer.
 * Used so we do not click the page (that closes the open preview).
 */
async function tryCaptureViewerDocumentBytes(webContents, fileName = '') {
  if (!webContents || webContents.isDestroyed()) {
    return { ok: false, error: 'Chat view is gone.' };
  }

  const runInFrame = async (frame) => {
    try {
      if (!frame || frame.isDestroyed?.()) return null;
      return await frame.executeJavaScript(guestPdfBytesProbeJs(), true);
    } catch {
      return null;
    }
  };

  try {
    const frames = [];
    try {
      const main = webContents.mainFrame;
      if (main) {
        frames.push(main);
        for (const f of main.framesInSubtree || []) frames.push(f);
      }
    } catch {
      // ignore
    }

    let result = null;
    if (frames.length) {
      for (const frame of frames) {
        const hit = await runInFrame(frame);
        if (hit?.ok && hit.b64) {
          if (!result || Number(hit.size) > Number(result.size)) result = hit;
        }
      }
    } else {
      result = await webContents.executeJavaScript(guestPdfBytesProbeJs(), true);
    }

    if (!result?.ok || !result.b64) {
      return { ok: false, error: 'No viewer PDF bytes.' };
    }
    const buf = Buffer.from(String(result.b64), 'base64');
    const classified = classifyForwardFileBytes(
      buf.subarray(0, 16),
      fileName || 'document.pdf',
    );
    if (!classified.ok) {
      return { ok: false, error: classified.error || classified.kind };
    }
    const name = sanitizeForwardFilename(
      fileName || 'document.pdf',
      extensionOf(fileName) || 'pdf',
    );
    const savePath = path.join(forwardTempDir(), `${Date.now()}-${name}`);
    fs.writeFileSync(savePath, buf);
    return { ok: true, filePath: savePath };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function tryCaptureDocumentByUiDownload(webContents, x, y, fileName = '', points = []) {
  if (!webContents || webContents.isDestroyed()) {
    return { ok: false, error: 'Chat view is gone.' };
  }

  let clickPoints = Array.isArray(points) ? points.filter((p) => p && p.x >= 0 && p.y >= 0) : [];
  if (!clickPoints.length) {
    try {
      const found = await inspectForwardContext(webContents, x, y);
      clickPoints = found.downloadPoints || [];
    } catch {
      clickPoints = [];
    }
  }
  if (!clickPoints.length) {
    clickPoints = [{ x, y, why: 'origin' }];
  }

  // Hover only (no click) so download arrows reveal without starting a download.
  moveWebContentsTo(webContents, x, y);
  await new Promise((r) => setTimeout(r, 120));

  for (const point of clickPoints.slice(0, 4)) {
    const downloadPromise = armForwardDownload(fileName, 5_000);
    // Prefer one real mouse click — avoid stacking DOM + input events.
    clickWebContentsAt(webContents, point.x, point.y);
    try {
      const filePath = await downloadPromise;
      if (filePath) {
        beginForwardExtraSwallow();
        return { ok: true, filePath };
      }
    } catch {
      await disarmForwardDownload(downloadPromise);
    }
  }

  // Viewer toolbar Download (Adobe / WhatsApp preview).
  try {
    const overlayPoints = await webContents.executeJavaScript(
      `(() => {
        const sels = [
          '[aria-label*="download" i]',
          '[title*="download" i]',
          '[data-icon="download"]',
          '[class*="download" i]',
          'a[download]',
          'button[aria-label*="save" i]',
          '[aria-label*="Save as" i]',
          '#download',
          '#downloadButton',
        ];
        const pts = [];
        const seen = new Set();
        const scopes = [document.querySelector('[role="dialog"]'), document.body];
        for (const scope of scopes) {
          if (!scope?.querySelectorAll) continue;
          for (const sel of sels) {
            for (const el of scope.querySelectorAll(sel)) {
              const r = el.getBoundingClientRect();
              if (!r || r.width < 2 || r.height < 2) continue;
              const x = Math.round(r.left + r.width / 2);
              const y = Math.round(r.top + r.height / 2);
              const key = x + ',' + y;
              if (seen.has(key)) continue;
              seen.add(key);
              pts.push({ x, y });
            }
          }
        }
        return pts.slice(0, 6);
      })()`,
      true,
    );
    for (const point of overlayPoints || []) {
      const downloadPromise = armForwardDownload(fileName, 5_000);
      clickWebContentsAt(webContents, point.x, point.y);
      try {
        const filePath = await downloadPromise;
        if (filePath) {
          beginForwardExtraSwallow();
          return { ok: true, filePath };
        }
      } catch {
        await disarmForwardDownload(downloadPromise);
      }
    }
  } catch (error) {
    console.warn('[forward] overlay download attempt failed', error);
  }

  return { ok: false, error: 'No download control in this message.' };
}

function downloadForwardFile(webContents, url, fileName = '') {
  return new Promise((resolve, reject) => {
    if (!webContents || webContents.isDestroyed()) {
      reject(new Error('Chat view is gone.'));
      return;
    }
    const target = String(url || '').trim();
    if (!target || target.startsWith('javascript:')) {
      reject(new Error('No downloadable document URL.'));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (pendingForwardDownload?.reject === reject) pendingForwardDownload = null;
      reject(new Error('Document download timed out.'));
    }, 45_000);
    pendingForwardDownload = {
      fileName,
      resolve: (filePath) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        beginForwardExtraSwallow();
        resolve(filePath);
      },
      reject: (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    };
    try {
      webContents.downloadURL(target);
    } catch (error) {
      pendingForwardDownload = null;
      clearTimeout(timer);
      reject(error);
    }
  });
}

function writeLinuxFileClipboard(filePath) {
  if (process.platform !== 'linux') return false;
  const abs = path.resolve(String(filePath || ''));
  if (!abs || !fs.existsSync(abs)) return false;
  const uri = `file://${abs}`;
  const attempts = [
    {
      args: ['-selection', 'clipboard', '-t', 'x-special/gnome-copied-files'],
      input: `copy\n${uri}\n`,
    },
    {
      args: ['-selection', 'clipboard', '-t', 'text/uri-list'],
      input: `${uri}\n`,
    },
  ];
  for (const attempt of attempts) {
    try {
      const result = spawnSync('xclip', attempt.args, {
        input: attempt.input,
        encoding: 'utf8',
      });
      if (result.status === 0) return true;
    } catch {
      // try next
    }
  }
  return false;
}

async function fetchArattaiDocumentViaSession(webContents, downloadUrl, fileName = '') {
  const url = String(downloadUrl || '').trim();
  if (!url || !webContents || webContents.isDestroyed()) {
    return { ok: false, error: 'No Arattai download URL.' };
  }
  try {
    const ses = webContents.session;
    if (!ses?.fetch) return { ok: false, error: 'Session fetch unavailable.' };
    const res = await ses.fetch(url, { bypassCustomProtocolHandlers: true });
    if (!res.ok) return { ok: false, error: `Download HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64) return { ok: false, error: 'Empty download.' };
    const classified = classifyForwardFileBytes(buf.subarray(0, 16), fileName || 'document.pdf');
    if (!classified.ok) return { ok: false, error: classified.error || classified.kind };
    const name = sanitizeForwardFilename(
      fileName || 'document.pdf',
      extensionOf(fileName) || (classified.kind === 'pdf' ? 'pdf' : 'bin'),
    );
    const savePath = path.join(forwardTempDir(), `${Date.now()}-${name}`);
    fs.writeFileSync(savePath, buf);
    return { ok: true, filePath: savePath };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function beginForwardFromGuest(webContents, params = {}, opts = {}) {
  // Feature parked — flip FORWARD_WITH_HUB_ENABLED in forwardHub.js to restore.
  if (!FORWARD_WITH_HUB_ENABLED) {
    return { ok: false, error: 'Forward with Aspera Hub is temporarily disabled.' };
  }
  const forceDocument = !!opts.forceDocument;
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
  // Never treat Arattai profile/thumbnail webdownload URLs as the message link.
  let linkURL = sanitizeForwardLinkURL(params.linkURL);
  const srcURL = String(params.srcURL || '').trim();
  const titleText = String(params.titleText || params.altText || '').trim();
  let pageTitle = '';
  try {
    pageTitle = String(webContents.getTitle?.() || '').trim();
  } catch {
    pageTitle = '';
  }
  const ctx = await inspectForwardContext(webContents, params.x, params.y);
  // blob: alone is not proof of a photo — Adobe/WhatsApp PDF previews use blob: too.
  const srcLooksLikeImage =
    /^data:image\//i.test(srcURL) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(srcURL);
  const srcIsBlob = /^blob:/i.test(srcURL);
  // Prefer real document links — never treat a preview thumbnail URL as the PDF.
  // ctx.url may be an Arattai webdownload (used for file capture only).
  const candidateUrl =
    linkURL ||
    String(ctx.url || '').trim() ||
    (srcLooksLikeImage ? '' : srcURL);
  const candidateName =
    ctx.name ||
    extractDocumentFileName(ctx.nearbyText) ||
    extractDocumentFileName(titleText) ||
    extractDocumentFileName(pageTitle) ||
    extractDocumentFileName(text) ||
    titleText ||
    '';

  const hasImageContents = !!params.hasImageContents;
  const nearbyForDoc = [ctx.nearbyText, pageTitle, titleText].filter(Boolean).join(' ');
  const strongDocument = hasStrongDocumentEvidence({
    forceDocument,
    hasImage: hasImageContents || srcLooksLikeImage,
    linkURL: candidateUrl || linkURL || ctx.url,
    srcURL: srcLooksLikeImage ? '' : srcIsBlob ? '' : srcURL,
    fileName: candidateName,
    text,
    titleText: titleText || pageTitle,
    nearbyText: nearbyForDoc,
    mediaType: params.mediaType,
    hasDownload: ctx.hasDownload,
    hasDocIcon: ctx.hasDocIcon,
    docLikely: ctx.docLikely || /\.pdf\b/i.test(pageTitle),
  });
  const documentHint = shouldForwardAsDocument({
    forceDocument,
    hasImage: hasImageContents || srcLooksLikeImage,
    linkURL: candidateUrl || linkURL || ctx.url,
    srcURL: srcLooksLikeImage ? '' : srcIsBlob ? '' : srcURL,
    fileName: candidateName,
    text,
    titleText: titleText || pageTitle,
    nearbyText: nearbyForDoc,
    mediaType: params.mediaType,
    hasDownload: ctx.hasDownload,
    hasDocIcon: ctx.hasDocIcon,
    docLikely: ctx.docLikely || /\.pdf\b/i.test(pageTitle),
  });

  let filePath = '';
  let fileName = '';
  let isDocument = false;
  let imagePath = '';
  let hasImage = false;

  if (documentHint) {
    // Entire document capture must stay silent — no "Save download" dialogs.
    const hintedName = sanitizeForwardFilename(
      candidateName || 'document.pdf',
      extensionOf(candidateName) || extensionOf(candidateUrl) || 'pdf',
    );

    const arattaiUrl =
      String(ctx.arattaiDownloadUrl || '').trim() ||
      arattaiFullFileUrlFromAny(candidateUrl, ctx.chatId) ||
      arattaiFullFileUrlFromAny(String(params.linkURL || ''), ctx.chatId) ||
      arattaiFullFileUrlFromAny(srcURL, ctx.chatId);

    // 0) PDF already open in Adobe / WhatsApp preview — read bytes (no Download click).
    if (!filePath) {
      const viewer = await tryCaptureViewerDocumentBytes(webContents, hintedName);
      if (viewer.ok) filePath = viewer.filePath;
    }

    // 1) User already downloaded this file in chat — reuse it.
    if (!filePath) {
      const recentPath = matchRecentDownload(
        recentGuestDownloads,
        hintedName,
        ctx.nearbyText || candidateName,
      );
      if (recentPath && fs.existsSync(recentPath)) {
        try {
          const dest = path.join(
            forwardTempDir(),
            `${Date.now()}-${path.basename(recentPath)}`,
          );
          fs.copyFileSync(recentPath, dest);
          filePath = dest;
        } catch (error) {
          console.warn('[forward] reuse recent download failed', error);
        }
      }
    }

    // 2) Arattai UDS via session cookies (more reliable than downloadURL).
    if (!filePath && arattaiUrl) {
      const fetched = await fetchArattaiDocumentViaSession(
        webContents,
        arattaiUrl,
        hintedName,
      );
      if (fetched.ok) filePath = fetched.filePath;
      else {
        try {
          filePath = await downloadForwardFile(webContents, arattaiUrl, hintedName);
        } catch (error) {
          console.warn('[forward] Arattai document URL download failed', error);
        }
      }
    }

    // 3) Direct URL download when we have a real document link (not image/blob thumbs).
    if (
      !filePath &&
      candidateUrl &&
      !/^data:image\//i.test(candidateUrl) &&
      !/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(candidateUrl) &&
      !/webdownload/i.test(candidateUrl)
    ) {
      try {
        filePath = await downloadForwardFile(webContents, candidateUrl, hintedName);
      } catch (error) {
        console.warn('[forward] document URL download failed', error);
      }
    }

    // 4) Click download control; duplicate DownloadItems are swallowed briefly.
    if (!filePath) {
      const ui = await tryCaptureDocumentByUiDownload(
        webContents,
        params.x,
        params.y,
        hintedName,
        ctx.downloadPoints,
      );
      if (ui.ok && ui.filePath) filePath = ui.filePath;
      else console.warn('[forward] UI document download failed', ui.error);
    }

    // 5) Retry session fetch after UI click (Arattai may warm the file).
    if (!filePath && arattaiUrl) {
      const fetched = await fetchArattaiDocumentViaSession(
        webContents,
        arattaiUrl,
        hintedName,
      );
      if (fetched.ok) filePath = fetched.filePath;
    }

    if (filePath && fs.existsSync(filePath)) {
      // Guard: reject preview thumbs / non-document bytes (causes "File not supported").
      const ext = extensionOf(filePath);
      const size = fs.statSync(filePath).size;
      const looksImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
      let header = Buffer.alloc(0);
      try {
        const fd = fs.openSync(filePath, 'r');
        header = Buffer.alloc(16);
        const n = fs.readSync(fd, header, 0, 16, 0);
        fs.closeSync(fd);
        header = header.subarray(0, n);
      } catch {
        header = Buffer.alloc(0);
      }
      const classified = classifyForwardFileBytes(header, path.basename(filePath));
      if (looksImage || size < 512 || !classified.ok) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
        filePath = '';
        if (!classified.ok) {
          console.warn('[forward] rejected non-document download', classified.error || classified.kind);
        }
      } else {
        fileName = path.basename(filePath);
        isDocument = true;
      }
    }

    // Never paste a PDF preview tile as a photo when the bubble is clearly a document.
    // Plain Forward on a real photo may still use the image path if document capture
    // was only a soft/false hint.
    if (!filePath) {
      if (!forceDocument && hasImageContents && !strongDocument) {
        console.warn('[forward] document capture missed; falling back to image forward');
      } else {
        const box = {
          type: 'warning',
          title: 'Forward with Aspera Hub',
          message: 'Could not get the PDF/document file.',
          detail:
            'Aspera Hub will not paste the preview thumbnail as a photo.\n\n' +
            'Try: tap the download arrow on the document in this chat once, then right-click → Forward with Aspera Hub again.',
          buttons: ['OK'],
        };
        if (mainWindow && !mainWindow.isDestroyed()) {
          await dialog.showMessageBox(mainWindow, box);
        } else {
          await dialog.showMessageBox(box);
        }
        return { ok: false, error: 'Document download failed.' };
      }
    }
  }

  if (!isDocument) {
    // True photos — never call copyImageAt while a real document was staged
    // (that pollutes the clipboard with the PDF thumbnail).
    const image = await captureForwardImage(webContents, params);
    imagePath = saveForwardImage(image);
    hasImage = !!(imagePath || (image && !image.isEmpty()));
  }

  if (!text && !hasImage && !linkURL && !filePath && !isDocument) {
    // Right-click on empty chrome / no capturable bubble.
    const box = {
      type: 'info',
      title: 'Forward with Aspera Hub',
      message: 'Nothing to forward here.',
      detail:
        'Right-click the message text, photo, or PDF card you want to send to another Hub account.',
      buttons: ['OK'],
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      await dialog.showMessageBox(mainWindow, box);
    } else {
      await dialog.showMessageBox(box);
    }
    return { ok: false, error: 'Select text, an image, or a document to forward.' };
  }

  forwardPayload = {
    text: isDocument ? '' : text,
    // Never append Arattai webdownload / profile URLs to text paste.
    linkURL: isDocument ? '' : sanitizeForwardLinkURL(linkURL),
    imagePath,
    filePath,
    fileName,
    hasImage,
    isDocument,
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
    const kind = forwardContentKind(forwardPayload);
    win.webContents.send('forward-picker:init', {
      sourceLabel: source?.name || forwardPayload.sourceName || 'this chat',
      preview: describeForwardPayload({
        text: forwardPayload.text,
        hasImage: forwardPayload.hasImage,
        isDocument: forwardPayload.isDocument,
        linkURL: forwardPayload.linkURL,
        fileName:
          forwardPayload.fileName ||
          (forwardPayload.filePath ? path.basename(forwardPayload.filePath) : ''),
      }),
      kind,
      steps: forwardPickerSteps(),
      hint: forwardPickerHint(kind),
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


async function readGuestComposeText(webContents) {
  if (!webContents || webContents.isDestroyed()) return '';
  try {
    return String(
      (await webContents.executeJavaScript(
        `(() => {
          const nodes = [
            document.querySelector('[data-testid="conversation-compose-box-input"]'),
            document.querySelector('[data-aspera-ai-compose="1"]'),
            ...document.querySelectorAll(${JSON.stringify(guestComposeSelector())}),
          ].filter(Boolean);
          for (const el of nodes) {
            const tag = String(el.tagName || '');
            if (tag === 'TEXTAREA' || tag === 'INPUT') {
              const v = String(el.value || '').trim();
              if (v) return v;
            }
            const t = String(el.innerText || el.textContent || '').trim();
            if (t) return t;
          }
          return '';
        })()`,
        true,
      )) || '',
    );
  } catch {
    return '';
  }
}

async function clearGuestComposeBox(webContents) {
  if (!webContents || webContents.isDestroyed()) return false;
  try {
    return !!(await webContents.executeJavaScript(
      `(() => {
        const clearOne = (el) => {
          if (!el) return false;
          try { el.focus(); } catch (e) {}
          const tag = String(el.tagName || '');
          if (tag === 'TEXTAREA' || tag === 'INPUT') {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          if (el.isContentEditable) {
            try {
              const sel = window.getSelection?.();
              const range = document.createRange();
              range.selectNodeContents(el);
              sel?.removeAllRanges?.();
              sel?.addRange?.(range);
              document.execCommand('delete', false, null);
              document.execCommand('selectAll', false, null);
              document.execCommand('delete', false, null);
            } catch (e) {}
            try {
              el.textContent = '';
              while (el.firstChild) el.removeChild(el.firstChild);
            } catch (e) {}
            el.dispatchEvent(new InputEvent('input', {
              bubbles: true, inputType: 'deleteContentBackward', data: null,
            }));
            return true;
          }
          return false;
        };
        const marked = document.querySelector('[data-aspera-ai-compose="1"]');
        if (clearOne(marked)) return true;
        const wa = document.querySelector('[data-testid="conversation-compose-box-input"]');
        if (clearOne(wa)) return true;
        for (const node of document.querySelectorAll(${JSON.stringify(guestComposeSelector())})) {
          if (clearOne(node)) return true;
        }
        return false;
      })()`,
      true,
    ));
  } catch {
    return false;
  }
}

/**
 * After Hub opens a chat (pin / Forward), wipe send-box text that was clearly
 * an accidental clipboard paste or a leftover AI/Forward error — WhatsApp
 * persists drafts, so this otherwise looks like Hub "typed" into the chat.
 */
async function sanitizeComposeAfterHubChatOpen(
  webContents,
  { allowClipboardMatch = true } = {},
) {
  if (!webContents || webContents.isDestroyed()) return { cleared: false };
  const text = await readGuestComposeText(webContents);
  if (!String(text || '').trim()) return { cleared: false };
  let systemClipboard = '';
  try {
    systemClipboard = clipboard.readText() || '';
  } catch {
    systemClipboard = '';
  }
  const polluted = isHubComposePollution(text, {
    stagedClipboard: hubStagedClipboardText,
    systemClipboard,
    allowClipboardMatch,
  });
  if (!polluted) return { cleared: false, text };
  const ok = await clearGuestComposeBox(webContents);
  return { cleared: !!ok, text };
}

async function focusGuestCompose(webContents) {
  if (!webContents || webContents.isDestroyed()) return false;
  try {
    return !!(await webContents.executeJavaScript(
      `(() => {
        const marked = document.querySelector('[data-aspera-ai-compose="1"]');
        const nodes = [
          marked,
          ...document.querySelectorAll(${JSON.stringify(guestComposeSelector())}),
        ].filter(Boolean);
        for (const node of nodes) {
          try { node.focus({ preventScroll: true }); } catch (e) {
            try { node.focus(); } catch (e2) {}
          }
          try { node.click(); } catch (e) {}
          return true;
        }
        return false;
      })()`,
      true,
    ));
  } catch {
    return false;
  }
}

/** Native Ctrl+V — more reliable than execCommand('paste') for image clipboard in guests. */
async function sendCtrlVToGuest(webContents) {
  if (!webContents || webContents.isDestroyed()) return false;
  try {
    webContents.focus();
  } catch {
    /* ignore */
  }
  const mods = ['control'];
  try {
    webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: mods });
    webContents.sendInputEvent({ type: 'char', keyCode: 'V', modifiers: mods });
    webContents.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: mods });
    return true;
  } catch {
    return false;
  }
}

async function stageForwardPaste(serviceId) {
  const entry = views.get(serviceId);
  const wc = entry?.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;

  const focused = await focusGuestCompose(wc);
  if (!focused) return false;

  // Prefer OS-level paste for images; execCommand often no-ops on WhatsApp/Arattai.
  const viaKeys = await sendCtrlVToGuest(wc);
  if (viaKeys) {
    await sleepMs(180);
    return true;
  }

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
        const marked2 = document.querySelector('[data-aspera-ai-compose="1"]');
        if (focusAndPaste(marked2)) return true;
        for (const node of document.querySelectorAll(${JSON.stringify(guestComposeSelector())})) {
          if (focusAndPaste(node)) return true;
        }
        return false;
      })()`,
      true,
    ));
  } catch {
    return false;
  }
}

/**
 * Wait for an open compose box, then paste the staged image/text (like doc attach).
 */
async function waitForChatAndPasteForward(serviceId, pasteGen = forwardPasteGeneration) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (pasteGen !== forwardPasteGeneration) return false;
    const entry = views.get(serviceId);
    const wc = entry?.view?.webContents;
    if (!wc || wc.isDestroyed()) return false;
    if (await guestHasOpenCompose(wc)) {
      await sleepMs(280);
      if (pasteGen !== forwardPasteGeneration) return false;
      await markActiveComposeTarget(serviceId);
      return stageForwardPaste(serviceId);
    }
    await sleepMs(400);
  }
  return false;
}

/** Snapshot of the open chat so we don't paste into a pre-selected recipient. */
async function getGuestChatKey(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return { title: '', compose: false, href: '' };
  }
  try {
    const result = await webContents.executeJavaScript(
      `(() => {
        const header =
          document.querySelector('.art-chwindow-hdr')
          || document.querySelector('[data-testid="conversation-info-header"]')
          || document.querySelector('#main header')
          || document.querySelector('[class*="chat-header" i]')
          || document.querySelector('[class*="ChatHeader" i]')
          || document.querySelector('[class*="conversation-header" i]')
          || document.querySelector('header');
        const title = String(
          header?.querySelector?.('.chat-title-text')?.getAttribute?.('title')
          || header?.querySelector?.('.chat-title-text')?.textContent
          || header?.querySelector?.('.art-chat-title')?.textContent
          || header?.querySelector?.('[data-testid="conversation-info-header-chat-title"]')?.textContent
          || header?.querySelector?.('span[title]')?.getAttribute?.('title')
          || header?.querySelector?.('[dir="auto"]')?.textContent
          || header?.querySelector?.('h1,h2,h3,[role="heading"]')?.textContent
          || header?.querySelector?.('span')?.textContent
          || '',
        ).replace(/\\s+/g, ' ').trim().slice(0, 120);
        const compose = ${guestComposeDetectJs()};
        return { title, compose: !!compose, href: String(location.href || '') };
      })()`,
      true,
    );
    return {
      title: String(result?.title || ''),
      compose: !!result?.compose,
      href: String(result?.href || ''),
    };
  } catch {
    return { title: '', compose: false, href: '' };
  }
}

/**
 * Wait until the user searches/opens a recipient chat.
 * Never treat the already-open chat as the pick — they must choose (or re-click).
 */
async function waitForRecipientChatSelection(webContents, {
  initialKey = null,
  timeoutMs = 90_000,
} = {}) {
  const baseline = initialKey || (await getGuestChatKey(webContents));
  const deadline = Date.now() + timeoutMs;
  // Ignore accidental focus clicks during tab activate (Arattai often already has a chat open).
  const confirmAfter = Date.now() + 700;
  // Arm a detector for chat-list / search-result picks and "confirm open chat" clicks.
  try {
    await webContents.executeJavaScript(
      `(() => {
        window.__asperaForwardRecipientArmed = true;
        window.__asperaForwardRecipientPicked = false;
        window.__asperaForwardRecipientConfirmed = false;
        if (window.__asperaForwardRecipientHandler) {
          document.removeEventListener('click', window.__asperaForwardRecipientHandler, true);
        }
        const listSel = ${JSON.stringify(forwardRecipientClickSelector())};
        const confirmSel = ${JSON.stringify(forwardRecipientConfirmSelector())};
        window.__asperaForwardRecipientHandler = (e) => {
          const t = e?.target;
          if (!t || !t.closest) return;
          if (t.closest(listSel)) window.__asperaForwardRecipientPicked = true;
          // Click compose / conversation panel = "use this already-open chat".
          if (t.closest(confirmSel)) window.__asperaForwardRecipientConfirmed = true;
        };
        document.addEventListener('click', window.__asperaForwardRecipientHandler, true);
        return true;
      })()`,
      true,
    );
  } catch {
    // ignore
  }

  while (Date.now() < deadline) {
    if (!webContents || webContents.isDestroyed()) {
      return { ok: false, error: 'Chat view is gone.' };
    }
    let pickedClick = false;
    let confirmedClick = false;
    try {
      const flags = await webContents.executeJavaScript(
        `({
          picked: !!window.__asperaForwardRecipientPicked,
          confirmed: !!window.__asperaForwardRecipientConfirmed,
        })`,
        true,
      );
      pickedClick = !!flags?.picked;
      confirmedClick = !!flags?.confirmed;
    } catch {
      pickedClick = false;
      confirmedClick = false;
    }
    const cur = await getGuestChatKey(webContents);
    if (cur.compose) {
      const titleChanged =
        !!(cur.title && baseline.title && cur.title !== baseline.title) ||
        !!(cur.title && !baseline.title);
      const hrefChanged =
        !!(cur.href && baseline.href && cur.href !== baseline.href);
      // No chat was open → first compose the user opens is the recipient.
      if (!baseline.compose) {
        return { ok: true, via: 'opened-chat', chat: cur };
      }
      if (titleChanged || hrefChanged) {
        return { ok: true, via: 'chat-changed', chat: cur };
      }
      // Same chat still open: chat-list click OR compose/panel click (Arattai Pocket case).
      if (pickedClick || (confirmedClick && Date.now() >= confirmAfter)) {
        await sleepMs(250);
        const after = await getGuestChatKey(webContents);
        if (after.compose) {
          return {
            ok: true,
            via: pickedClick ? 'chat-list-click' : 'compose-confirm',
            chat: after,
          };
        }
      }
    }
    await sleepMs(350);
  }

  try {
    await webContents.executeJavaScript(
      `(() => {
        if (window.__asperaForwardRecipientHandler) {
          document.removeEventListener('click', window.__asperaForwardRecipientHandler, true);
        }
        window.__asperaForwardRecipientArmed = false;
        window.__asperaForwardRecipientPicked = false;
        window.__asperaForwardRecipientConfirmed = false;
        window.__asperaForwardRecipientHandler = null;
        return true;
      })()`,
      true,
    );
  } catch {
    // ignore
  }
  return { ok: false, timedOut: true };
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function guestHasOpenCompose(webContents) {
  if (!webContents || webContents.isDestroyed()) return false;
  try {
    return !!(await webContents.executeJavaScript(guestComposeDetectJs(), true));
  } catch {
    return false;
  }
}

async function ensureGuestDebugger(webContents) {
  const dbg = webContents.debugger;
  if (!dbg.isAttached()) {
    try {
      dbg.attach('1.3');
    } catch {
      // May already be attached by another helper.
    }
  }
  return dbg;
}

/** Click Attach → Document (WhatsApp) or equivalent attach control (Arattai). */
async function clickAttachDocumentUi(webContents, appId = '') {
  if (!webContents || webContents.isDestroyed()) return { ok: false };
  const requireDocument = String(appId || '') === 'whatsapp';
  const isArattai = String(appId || '') === 'arattai';
  try {
    return await webContents.executeJavaScript(
      `(async () => {
        const requireDocument = ${JSON.stringify(requireDocument)};
        const isArattai = ${JSON.stringify(isArattai)};
        const composeSel = ${JSON.stringify(guestComposeSelector())};
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const visible = (el) => {
          if (!el) return false;
          const s = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        const click = (el) => {
          if (!el || !visible(el)) return false;
          try { el.focus({ preventScroll: true }); } catch (e) {}
          try { el.click(); return true; } catch (e) { return false; }
        };
        const labelOf = (el) => [
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || '',
          el.getAttribute('data-testid') || '',
          el.getAttribute('data-tooltip') || '',
          el.textContent || '',
        ].join(' ').replace(/\\s+/g, ' ').trim();
        const all = () => Array.from(document.querySelectorAll(
          'button,[role="button"],li,[role="menuitem"],label,div,span,a',
        ));
        const byText = (re) => all().find((el) => {
          if (!visible(el)) return false;
          return re.test(labelOf(el));
        });
        const isPhotoOrOther = (el) => {
          const t = labelOf(el).toLowerCase();
          return /photo|video|camera|sticker|contact|poll|event|location|image|emoji|mic|voice|send/i.test(t);
        };
        const findDocumentItem = () => {
          const direct =
            document.querySelector('[data-testid="mi-attach-document"]')
            || document.querySelector('span[data-icon="document"]')?.closest('li,button,[role="button"],[role="menuitem"]');
          if (direct && visible(direct) && !isPhotoOrOther(direct)) return direct;
          return all().find((el) => {
            if (!visible(el) || isPhotoOrOther(el)) return false;
            const t = labelOf(el).toLowerCase();
            const icon = String(el.getAttribute('data-icon') || el.querySelector?.('[data-icon]')?.getAttribute?.('data-icon') || '').toLowerCase();
            if (icon.includes('document') || icon.includes('doc')) return true;
            if (t === 'document' || t === 'documents') return true;
            if (/\\bdocument\\b/.test(t) && !/photo|video/.test(t)) return true;
            return false;
          }) || null;
        };

        // Prefer the paperclip sitting to the left of the compose box (Arattai).
        const findComposePaperclip = () => {
          const compose = document.querySelector(composeSel);
          if (!compose) return null;
          const cr = compose.getBoundingClientRect();
          const root =
            compose.closest('footer, form, [class*="composer" i], [class*="Composer"], [class*="input-area" i], [class*="InputArea"]')
            || compose.parentElement?.parentElement
            || compose.parentElement
            || document.body;
          const candidates = Array.from(
            root.querySelectorAll('button, [role="button"], label, span, div, a'),
          );
          let best = null;
          let bestScore = -1;
          for (const el of candidates) {
            if (!visible(el) || isPhotoOrOther(el)) continue;
            const er = el.getBoundingClientRect();
            if (er.width < 10 || er.height < 10 || er.width > 72 || er.height > 72) continue;
            const t = labelOf(el).toLowerCase();
            let score = 0;
            if (/attach|paper\\s*clip|upload|clip/.test(t)) score += 8;
            if (el.querySelector?.('svg, img, [data-icon], use')) score += 2;
            // Left of compose, same row.
            if (er.right <= cr.left + 12 && Math.abs((er.top + er.bottom) / 2 - (cr.top + cr.bottom) / 2) < 36) {
              score += 6;
            }
            if (score > bestScore) {
              bestScore = score;
              best = el;
            }
          }
          return bestScore >= 6 ? best : null;
        };

        // WhatsApp Web: plus / attach → Document (must click Document, not Photos).
        const waAttach =
          document.querySelector('[data-testid="conversation-clip"]')
          || document.querySelector('[data-testid="attach-menu-plus"]')
          || document.querySelector('button[aria-label="Attach"]')
          || document.querySelector('div[title="Attach"]')
          || document.querySelector('span[data-icon="plus"]')?.closest('button,[role="button"]')
          || byText(/^\\s*attach\\s*$/i);
        if (!isArattai && waAttach && click(waAttach)) {
          const deadline = Date.now() + 2200;
          while (Date.now() < deadline) {
            await wait(80);
            const doc = findDocumentItem();
            if (doc && click(doc)) return { ok: true, via: 'whatsapp-document' };
          }
          if (requireDocument) {
            return { ok: false, reason: 'document_menu_missing' };
          }
          return { ok: false, reason: 'document_menu_missing', via: 'whatsapp-attach-open' };
        }

        // Arattai / generic paperclip — often opens a chooser without a Document submenu.
        const genericAttach =
          findComposePaperclip()
          || document.querySelector('[aria-label*="attach" i]')
          || document.querySelector('[title*="attach" i]')
          || document.querySelector('[aria-label*="upload" i]')
          || document.querySelector('[title*="upload" i]')
          || byText(/^\\s*(attach|upload|paper\\s*clip)\\s*$/i)
          || document.querySelector('input[type="file"]')?.closest('button,label,[role="button"]');
        if (genericAttach && click(genericAttach)) {
          const deadline = Date.now() + 2500;
          while (Date.now() < deadline) {
            await wait(80);
            if (!isArattai) {
              const doc = findDocumentItem() || byText(/\\bdocument\\b|\\bpdf\\b|\\bfile\\b/i);
              if (doc && !isPhotoOrOther(doc) && click(doc)) {
                return { ok: true, via: 'generic-document' };
              }
            }
            if (document.querySelector('input[type="file"]')) {
              return { ok: true, via: 'generic-attach-open' };
            }
          }
          return { ok: true, via: 'generic-attach-clicked' };
        }

        if (document.querySelector('input[type="file"]')) {
          return { ok: true, via: 'file-input-ready' };
        }
        return { ok: false, reason: 'attach_missing' };
      })()`,
      true,
    );
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

/**
 * Inject a local file into a guest <input type="file"> via CDP.
 * For documents, never target image/video-only accept attributes (WhatsApp Photos).
 */
async function setFileInputViaCdp(webContents, filePath, { documentOnly = true } = {}) {
  const abs = path.resolve(filePath);
  if (!webContents || webContents.isDestroyed() || !fs.existsSync(abs)) {
    return { ok: false };
  }
  try {
    const dbg = await ensureGuestDebugger(webContents);
    await dbg.sendCommand('DOM.enable');
    const { root } = await dbg.sendCommand('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await dbg.sendCommand('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: 'input[type="file"]',
    });
    if (!Array.isArray(nodeIds) || !nodeIds.length) {
      return { ok: false, reason: 'no_file_input' };
    }

    const scored = [];
    for (let i = 0; i < nodeIds.length; i += 1) {
      const nodeId = nodeIds[i];
      let accept = '';
      let multiple = false;
      try {
        const { attributes } = await dbg.sendCommand('DOM.getAttributes', { nodeId });
        const attrs = {};
        for (let j = 0; j + 1 < (attributes || []).length; j += 2) {
          attrs[String(attributes[j]).toLowerCase()] = String(attributes[j + 1] || '');
        }
        accept = String(attrs.accept || '');
        multiple = Object.prototype.hasOwnProperty.call(attrs, 'multiple');
      } catch {
        /* ignore */
      }
      const imageOnly = isImageOnlyAccept(accept);
      const docOk = isDocumentAccept(accept);
      let score = 0;
      if (documentOnly) {
        if (imageOnly || !docOk) continue;
        if (/pdf|application\/pdf/i.test(accept)) score += 5;
        else if (/application\//i.test(accept)) score += 3;
        else if (!accept.trim() || accept.trim() === '*' || accept.includes('*/*')) score += 2;
        else score += 1;
      } else {
        if (docOk) score += 3;
        if (imageOnly) score -= 4;
      }
      if (multiple) score += 1;
      // Prefer later (menu-opened) inputs when scores tie.
      score += i * 0.01;
      scored.push({ nodeId, score, accept });
    }

    if (!scored.length) {
      return {
        ok: false,
        reason: documentOnly ? 'no_document_file_input' : 'no_file_input',
        totalInputs: nodeIds.length,
      };
    }

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    await dbg.sendCommand('DOM.setFileInputFiles', {
      nodeId: best.nodeId,
      files: [abs],
    });
    await webContents.executeJavaScript(
      `(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        // Nudge the document-capable input(s); skip image-only to avoid WA errors.
        const isImageOnly = (accept) => {
          const a = String(accept || '').toLowerCase().trim();
          if (!a) return false;
          const hasDoc = /pdf|msword|officedocument|opendocument|\\.docx?|\\.xlsx?|\\.pptx?|\\.txt|\\.csv|\\.zip|text\\/plain|application\\//i.test(a);
          if (hasDoc) return false;
          return /image\\//.test(a) || /\\.(png|jpe?g|gif|webp|bmp|heic|svg)/.test(a) || /video\\//.test(a);
        };
        for (const el of inputs) {
          if (isImageOnly(el.getAttribute('accept'))) continue;
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        }
        return true;
      })()`,
      true,
    );
    return {
      ok: true,
      method: 'cdp-set-files',
      documentOnly: !!documentOnly,
      accept: best.accept || '',
      score: best.score,
    };
  } catch (error) {
    console.warn('[forward] CDP setFileInputFiles failed', error);
    return { ok: false, error: String(error?.message || error) };
  }
}

/** Drop a real File onto the open chat (works like OS drag-and-drop for many web apps). */
async function dropFileOntoGuestChat(webContents, filePath) {
  const abs = path.resolve(filePath);
  if (!webContents || webContents.isDestroyed() || !fs.existsSync(abs)) {
    return { ok: false };
  }
  const stat = fs.statSync(abs);
  // Keep IPC payload reasonable — large docs use CDP attach instead.
  if (stat.size > 12 * 1024 * 1024) return { ok: false, error: 'too-large-for-drop' };
  const b64 = fs.readFileSync(abs).toString('base64');
  const name = path.basename(abs);
  const mime = mimeForFilename(name);
  try {
    const result = await webContents.executeJavaScript(
      `(() => {
        const b64 = ${JSON.stringify(b64)};
        const name = ${JSON.stringify(name)};
        const mime = ${JSON.stringify(mime)};
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], name, { type: mime });
        const dt = new DataTransfer();
        dt.items.add(file);
        const isImageOnly = (accept) => {
          const a = String(accept || '').toLowerCase().trim();
          if (!a) return false;
          const hasDoc = /pdf|msword|officedocument|opendocument|\\.docx?|\\.xlsx?|\\.pptx?|\\.txt|\\.csv|\\.zip|text\\/plain|application\\//i.test(a);
          if (hasDoc) return false;
          return /image\\//.test(a) || /\\.(png|jpe?g|gif|webp|bmp|heic|svg)/.test(a) || /video\\//.test(a);
        };
        const isDocAccept = (accept) => {
          const a = String(accept || '').toLowerCase().trim();
          if (isImageOnly(a)) return false;
          if (!a || a === '*' || a.includes('*/*')) return true;
          return /pdf|msword|officedocument|opendocument|\\.docx?|\\.xlsx?|\\.pptx?|\\.txt|\\.csv|\\.zip|text\\/plain|application\\//i.test(a);
        };
        const composeSel = ${JSON.stringify(guestComposeSelector())};
        const targets = [
          document.querySelector('#main'),
          document.querySelector('[data-testid="conversation-panel-wrapper"]'),
          document.querySelector('[data-testid="conversation-panel-body"]'),
          document.querySelector('[data-testid="conversation-compose-box-input"]'),
          document.querySelector('footer'),
          document.querySelector(composeSel),
          document.querySelector('[class*="composer" i]'),
          document.querySelector('[class*="Composer"]'),
          document.querySelector('[class*="chat-content" i]'),
          document.querySelector('[contenteditable="true"][role="textbox"]'),
          document.querySelector('[contenteditable="true"]'),
          document.querySelector('textarea'),
          document.body,
        ].filter(Boolean);
        let dropped = false;
        for (const target of targets) {
          for (const type of ['dragenter', 'dragover', 'drop']) {
            const ev = new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt,
            });
            target.dispatchEvent(ev);
          }
          dropped = true;
        }
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        const docInput = inputs.find((el) => isDocAccept(el.getAttribute('accept'))) || null;
        // Never assign a PDF into Photos & videos input — WhatsApp shows "File not supported".
        if (docInput) {
          try {
            const iDt = new DataTransfer();
            iDt.items.add(file);
            docInput.files = iDt.files;
            docInput.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true, method: 'input-files' };
          } catch (e) {}
        }
        return { ok: dropped, method: 'drop' };
      })()`,
      true,
    );
    return result?.ok ? { ok: true, method: result.method || 'drop' } : { ok: false };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function validateLocalForwardDocument(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    return { ok: false, error: 'Document file missing.' };
  }
  const size = fs.statSync(abs).size;
  if (size < 32) {
    return { ok: false, error: 'Document file is empty or too small.' };
  }
  let header = Buffer.alloc(0);
  try {
    const fd = fs.openSync(abs, 'r');
    header = Buffer.alloc(16);
    const n = fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    header = header.subarray(0, n);
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
  const classified = classifyForwardFileBytes(header, path.basename(abs));
  if (!classified.ok) {
    return { ok: false, error: classified.error || 'Unsupported file type.' };
  }
  return { ok: true, kind: classified.kind, size };
}

/**
 * Attach a local document into the guest chat the seamless way:
 * file-chooser intercept → Attach/Document click → CDP set files → DOM drop.
 */
async function attachDocumentToGuest(webContents, filePath, { appId = '' } = {}) {
  const abs = path.resolve(filePath);
  if (!webContents || webContents.isDestroyed()) {
    return { ok: false, error: 'Chat view is gone.' };
  }
  const validated = validateLocalForwardDocument(abs);
  if (!validated.ok) {
    return { ok: false, error: validated.error || 'Document file missing.' };
  }

  const targetApp = String(appId || '');
  // WhatsApp Photos accept is image-only — must use Document input.
  // Arattai uses one unrestricted file input behind the paperclip.
  const documentOnly = targetApp === 'whatsapp';

  const dbg = await ensureGuestDebugger(webContents);
  let chooserHandled = false;
  let chooserError = '';
  const onMessage = (_event, method) => {
    if (method !== 'Page.fileChooserOpened' || chooserHandled) return;
    chooserHandled = true;
    dbg
      .sendCommand('Page.handleFileChooser', {
        action: 'select',
        files: [abs],
      })
      .catch((error) => {
        chooserError = String(error?.message || error);
        chooserHandled = false;
      });
  };

  try {
    dbg.on('message', onMessage);
    try {
      await dbg.sendCommand('Page.enable');
    } catch {
      // ignore
    }
    try {
      await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
    } catch (error) {
      console.warn('[forward] setInterceptFileChooserDialog failed', error);
    }

    const composeOpen = await guestHasOpenCompose(webContents);
    if (!composeOpen) {
      return {
        ok: false,
        needChat: true,
        error: 'Open the person or group chat first.',
      };
    }

    const menu = await clickAttachDocumentUi(webContents, appId);
    // WhatsApp: must open Document path. Injecting into Photos yields "File not supported".
    if (targetApp === 'whatsapp' && !menu?.ok) {
      return {
        ok: false,
        error:
          'Could not open Attach → Document. Open the chat, then try Forward again.',
        reason: menu?.reason || 'document_menu_missing',
      };
    }

    const start = Date.now();
    while (!chooserHandled && Date.now() - start < 7000) {
      await sleepMs(120);
      if (Date.now() - start > 400) {
        const injected = await setFileInputViaCdp(webContents, abs, { documentOnly });
        if (injected.ok) return injected;
        // Arattai: retry without accept filtering if the first pass found nothing.
        if (targetApp === 'arattai') {
          const anyInput = await setFileInputViaCdp(webContents, abs, {
            documentOnly: false,
          });
          if (anyInput.ok) return anyInput;
        }
      }
    }
    if (chooserHandled) {
      await sleepMs(250);
      return { ok: true, method: 'file-chooser' };
    }
    if (chooserError) {
      console.warn('[forward] file chooser handle failed', chooserError);
    }

    let injected = await setFileInputViaCdp(webContents, abs, { documentOnly });
    if (injected.ok) return injected;
    if (targetApp === 'arattai') {
      injected = await setFileInputViaCdp(webContents, abs, { documentOnly: false });
      if (injected.ok) return injected;
    }

    const dropped = await dropFileOntoGuestChat(webContents, abs);
    if (dropped.ok) return dropped;

    // Last try: click paperclip again, then CDP once more (Arattai mounts input late).
    if (targetApp === 'arattai') {
      await clickAttachDocumentUi(webContents, appId);
      await sleepMs(350);
      injected = await setFileInputViaCdp(webContents, abs, { documentOnly: false });
      if (injected.ok) return injected;
      if (chooserHandled) {
        await sleepMs(200);
        return { ok: true, method: 'file-chooser-retry' };
      }
    }

    return {
      ok: false,
      error: 'Could not attach the document automatically.',
    };
  } finally {
    try {
      dbg.removeListener('message', onMessage);
    } catch {
      // ignore
    }
    try {
      await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: false });
    } catch {
      // ignore
    }
  }
}

/**
 * If no chat is open yet, wait briefly for the user to click one, then attach.
 */
async function waitForChatAndAttachDocument(webContents, filePath, appId = '') {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (!webContents || webContents.isDestroyed()) {
      return { ok: false, error: 'Chat view is gone.' };
    }
    if (await guestHasOpenCompose(webContents)) {
      await sleepMs(350);
      return attachDocumentToGuest(webContents, filePath, { appId });
    }
    await sleepMs(400);
  }
  return { ok: false, needChat: true, error: 'Timed out waiting for a chat.' };
}

async function deliverForwardToTarget(targetId) {
  if (!FORWARD_WITH_HUB_ENABLED) {
    return { ok: false, error: 'Forward with Aspera Hub is temporarily disabled.' };
  }
  const payload = forwardPayload;
  if (!payload) return { ok: false, error: 'Nothing to forward.' };
  const target = getService(targetId);
  if (!target || !isForwardAppId(target.appId)) {
    return { ok: false, error: 'Choose a WhatsApp or Arattai account.' };
  }

  const isDocument =
    !!payload.isDocument &&
    !!payload.filePath &&
    fs.existsSync(payload.filePath);
  const kind = forwardContentKind({
    isDocument,
    hasImage: !!payload.hasImage,
  });
  const clipText = buildForwardClipboardText(payload);

  // Stage content the same way for every direction: clipboard for text/image,
  // file path for documents (placed after the user picks a recipient).
  if (isDocument) {
    try {
      clipboard.clear();
    } catch {
      // ignore
    }
  } else {
    /** @type {Electron.Data} */
    const write = {};
    if (clipText) write.text = clipText;
    if (payload.imagePath && fs.existsSync(payload.imagePath)) {
      const image = nativeImage.createFromPath(payload.imagePath);
      if (!image.isEmpty()) write.image = image;
    }
    if (Object.keys(write).length) {
      try {
        stageHubForwardClipboard(write);
      } catch {
        if (clipText) {
          try {
            hubClipboardBeforeStage = { text: clipboard.readText() || '' };
          } catch {
            hubClipboardBeforeStage = { text: '' };
          }
          hubStagedClipboardText = clipText;
          clipboard.writeText(clipText);
        }
      }
    }
  }

  const pasteGen = forwardPasteGeneration;
  closeForwardPickerWindow();
  activateService(targetId);
  await sleepMs(520);

  const targetName = target.name || target.defaultName || 'account';
  const docName =
    payload.fileName ||
    (payload.filePath ? path.basename(payload.filePath) : 'document');
  const entry = views.get(targetId);
  const wc = entry?.view?.webContents;

  let pasted = false;
  let attached = false;
  let detail = '';

  // Unified step 2: never dump into whoever is already open.
  const initialChat = await getGuestChatKey(wc);
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Forward with Aspera Hub',
        body: forwardWaitMessage(kind, targetName, docName),
        silent: true,
      }).show();
    }
  } catch {
    // ignore
  }

  const picked = await waitForRecipientChatSelection(wc, {
    initialKey: initialChat,
    timeoutMs: 90_000,
  });

  if (!picked.ok) {
    detail = forwardTimeoutMessage(kind, targetName, docName);
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
    if (isDocument) {
      writeLinuxFileClipboard(payload.filePath);
      try {
        shell.showItemInFolder(payload.filePath);
      } catch {
        // ignore
      }
    } else {
      restoreHubClipboardAfterForward();
    }
    cancelPendingForwardPaste();
    return { ok: false, needRecipient: true, isDocument, kind, detail };
  }

  try {
    await wc?.executeJavaScript?.(
      `(() => {
        if (window.__asperaForwardRecipientHandler) {
          document.removeEventListener('click', window.__asperaForwardRecipientHandler, true);
        }
        window.__asperaForwardRecipientArmed = false;
        window.__asperaForwardRecipientPicked = false;
        window.__asperaForwardRecipientConfirmed = false;
        window.__asperaForwardRecipientHandler = null;
        return true;
      })()`,
      true,
    );
  } catch {
    // ignore
  }

  await sleepMs(280);
  await markActiveComposeTarget(targetId);

  // Unified step 3: Hub places content the same way every direction.
  // Documents → attach; text/images → paste. On failure, stage clipboard + Ctrl+V.
  if (isDocument) {
    let result = await attachDocumentToGuest(wc, payload.filePath, {
      appId: target.appId,
    });
    if (!result.ok && result.needChat) {
      result = await waitForChatAndAttachDocument(wc, payload.filePath, target.appId);
    }
    attached = !!result.ok;
    if (!attached) {
      // Same fallback for WhatsApp ↔ Arattai: file on clipboard, try Ctrl+V once.
      writeLinuxFileClipboard(payload.filePath);
      await sleepMs(120);
      pasted = await stageForwardPaste(targetId);
      if (pasted) attached = true;
    }
    detail = forwardReadyMessage(kind, targetName, {
      ok: attached,
      fileName: docName,
    });
  } else {
    pasted = await stageForwardPaste(targetId);
    if (!pasted) {
      await sleepMs(350);
      await markActiveComposeTarget(targetId);
      pasted = await stageForwardPaste(targetId);
    }
    if (!pasted) {
      pasted = await waitForChatAndPasteForward(targetId, pasteGen);
    }
    detail = forwardReadyMessage(kind, targetName, { ok: pasted });
  }

  // Unified step 4 cue: same toast style for every content type / direction.
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

  // Do not leave Forward text sitting on the system clipboard for the next chat open.
  restoreHubClipboardAfterForward();
  return {
    ok: true,
    pasted,
    attached,
    isDocument,
    kind,
  };
}

/**
 * Native right-click menu for guest pages (Cut / Copy / Paste / Select All…).
 * Electron does not show Chromium's built-in menu unless we handle this event.
 * WhatsApp/Arattai: one Forward entry — Hub decides text / image / document.
 *
 * Do NOT suppress the page's own contextmenu — blocking it (v0.3.5) disabled
 * right-click entirely when the native Menu.popup was not visible over the guest.
 */
function attachGuestContextMenu(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  if (webContents.__asperaGuestContextMenu) return;
  webContents.__asperaGuestContextMenu = true;

  webContents.on('context-menu', (_event, params) => {
    if (webContents.isDestroyed()) return;

    const sourceServiceId = serviceIdForWebContents(webContents);
    const service = getService(sourceServiceId) || getService(activeServiceId);

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

    const safeLink = sanitizeForwardLinkURL(params.linkURL);
    if (safeLink) {
      const live = liveService(service);
      const isLinkTabGuest = !!(live?.isCustom || live?.linkTab);
      const linkIsInternal = live ? isInternalUrl(safeLink, live) : false;
      template.push({
        label: 'Open link',
        click: () => {
          // WhatsApp / Arattai: never load Drive/Google into the chat tab.
          if (
            isMessagingAppId(live?.appId) &&
            !isAllowedMessagingTabUrl(live, safeLink)
          ) {
            const opened = openUrlAsHubAppTab(safeLink, live);
            if (!opened.ok && opened.error) {
              const errBox = {
                type: 'warning',
                buttons: ['OK'],
                defaultId: 0,
                title: 'Could not open Hub tab',
                message: opened.error,
              };
              if (mainWindow) dialog.showMessageBox(mainWindow, errBox).catch(() => {});
              else dialog.showMessageBox(errBox).catch(() => {});
            }
            return;
          }
          // Google SSO/consent URLs 400 in Chrome — keep them in Hub (Gmail/Zoho).
          if (mustKeepGoogleUrlInApp(safeLink) || isGoogleOwnedUrl(safeLink)) {
            webContents.loadURL(safeLink).catch(() => {});
            return;
          }
          if (handleOutboundOrNewWindowLink(live, safeLink, webContents)) {
            return;
          }
          webContents.loadURL(safeLink).catch(() => {});
        },
      });
      // Never replace WhatsApp/Arattai/etc. with a third-party site via this
      // menu — that looked like “Open in tab” but covered the messenger.
      // Link tabs (and same-app URLs) may navigate in place.
      // Zoho CRM/Books/One also offer Hub tab so lead/deal links can multi-screen.
      if (isLinkTabGuest || linkIsInternal) {
        template.push({
          label: 'Open link in this tab',
          click: () => {
            if (isForbiddenGuestNavigation(safeLink)) return;
            webContents.loadURL(safeLink).catch(() => {});
          },
        });
      }
      if (
        !isLinkTabGuest &&
        (!linkIsInternal || shouldOpenZohoSharedDeepLinkAsHubTab(live, safeLink))
      ) {
        template.push({
          label: 'Open in Hub tab',
          click: () => {
            if (isForbiddenGuestNavigation(safeLink)) return;
            if (isGoogleService(live)) {
              const outbound = extractGoogleOutboundUrl(safeLink);
              if (outbound) {
                if (
                  mustKeepGoogleUrlInApp(outbound) ||
                  isGoogleOwnedUrl(outbound)
                ) {
                  webContents.loadURL(outbound).catch(() => {});
                  return;
                }
                handleOutboundOrNewWindowLink(live, outbound, webContents);
                return;
              }
              if (!isAllowedGmailTabUrl(safeLink)) {
                handleOutboundOrNewWindowLink(live, safeLink, webContents);
                return;
              }
              webContents.loadURL(safeLink).catch(() => {});
              return;
            }
            // Messaging: always Hub-tab outbound (including Google Drive / Accounts).
            if (
              isMessagingAppId(live?.appId) &&
              !isAllowedMessagingTabUrl(live, safeLink)
            ) {
              const opened = openUrlAsHubAppTab(safeLink, live);
              if (!opened.ok && opened.error) {
                const errBox = {
                  type: 'warning',
                  buttons: ['OK'],
                  defaultId: 0,
                  title: 'Could not open Hub tab',
                  message: opened.error,
                };
                if (mainWindow) dialog.showMessageBox(mainWindow, errBox).catch(() => {});
                else dialog.showMessageBox(errBox).catch(() => {});
              }
              return;
            }
            if (
              mustKeepGoogleUrlInApp(safeLink) ||
              (isAuthOrLoginUrl(safeLink) && isGoogleOwnedUrl(safeLink))
            ) {
              webContents.loadURL(safeLink).catch(() => {});
              return;
            }
            // Zoho shared deep links reuse the same profile/session.
            if (shouldOpenZohoSharedDeepLinkAsHubTab(live, safeLink)) {
              if (openInternalLinkAsHubTab(live, safeLink)) return;
            }
            // Force a real top-bar tab (ignore temporary external/block modes).
            const opened = openUrlAsHubAppTab(safeLink, live);
            if (!opened.ok && opened.error) {
              const errBox = {
                type: 'warning',
                buttons: ['OK'],
                defaultId: 0,
                title: 'Could not open Hub tab',
                message: opened.error,
              };
              if (mainWindow) dialog.showMessageBox(mainWindow, errBox).catch(() => {});
              else dialog.showMessageBox(errBox).catch(() => {});
            }
          },
        });
      }
      template.push({
        label: 'Copy link address',
        click: () => clipboard.writeText(safeLink),
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
    const forwardTargets = service ? listForwardTargets(service.id) : [];
    const canForward = !!(
      service &&
      canOfferForward({
        appId: service.appId,
        hasSelection,
        hasImage: !!params.hasImageContents,
        linkURL: safeLink,
        srcURL: params.srcURL,
        mediaType: params.mediaType,
        titleText: params.titleText || params.altText,
        targetCount: forwardTargets.length,
        alwaysOnMessaging: true,
      })
    );
    const canSummarize = false; // Aspera AI opens from the bar wordmark — not right-click.
    const canCrmLookup = !!(
      hasSelection && settings.zohoCrmEnabled !== false
    );

    // With selected message text: Summarize → CRM lookup → Forward (Pin does not apply).
    // On chat-list rows (no selection, not an image): Pin → Forward.
    // Never show Pin on photos / PDF preview tiles in an open chat.
    const canPin = canOfferHubPin({
      inboxApp: !!(
        service &&
        isInboxAppId(service.appId) &&
        !whatsappAutomationBlocked(settings, service.appId)
      ),
      hasSelection,
      hasImage: !!params.hasImageContents,
      mediaType: params.mediaType,
    });
    const pushPinItem = () => {
      if (!canPin) return;
      const pinHitPromise = webContents
        .executeJavaScript(inspectChatListTargetJs(params.x, params.y), true)
        .catch(() => null);
      template.push({
        label: 'Pin with Aspera Hub',
        click: () => {
          pinHitPromise
            .then((preHit) =>
              pinChatFromGuestContext(webContents, service, params, preHit),
            )
            .catch(() => {});
        },
      });
    };
    const pushForwardItem = () => {
      if (!canForward) return;
      template.push({
        label: 'Forward with Aspera Hub',
        click: () => {
          beginForwardFromGuest(webContents, params).catch(() => {});
        },
      });
    };
    const pushCrmLookupItem = () => {
      if (!canCrmLookup) return;
      template.push({
        label: 'Lookup in Zoho CRM',
        click: () => {
          const theme = String(settings.theme || 'system');
          const dark =
            theme === 'dark' ||
            theme === 'darkest' ||
            (theme === 'system' && nativeTheme.shouldUseDarkColors);
          lookupZohoCrmDeals(params.selectionText, { dark }).catch(() => {});
        },
      });
    };
    const pushSummarizeItems = () => {
      // Intentionally empty — Aspera AI is opened from the top-bar wordmark.
    };
    for (const action of guestContextMenuActionOrder({
      hasSelection,
      canSummarize,
      canForward,
      canPin,
      canCrmLookup,
    })) {
      if (action === 'summarize') pushSummarizeItems();
      else if (action === 'crm-lookup') pushCrmLookupItem();
      else if (action === 'forward') pushForwardItem();
      else if (action === 'pin') pushPinItem();
    }

    if (canSummarize || canCrmLookup || canForward || canPin) {
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
      template.push({ label: 'Copy', role: 'copy' });
      template.push({ label: 'Paste', role: 'paste' });
      template.push({ label: 'Select all', role: 'selectAll' });
    }

    if (!template.length) return;
    const menu = Menu.buildFromTemplate(template);

    let popupWindow =
      mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    let popupX = params.x;
    let popupY = params.y;
    try {
      const owner = BrowserWindow.fromWebContents(webContents);
      if (owner && !owner.isDestroyed()) {
        popupWindow = owner;
        // Child preview windows: coords are already relative to that window.
        if (owner !== mainWindow) {
          popupX = params.x;
          popupY = params.y;
        }
      }
    } catch {
      // ignore
    }
    if (popupWindow === mainWindow || !popupWindow) {
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
      popupWindow =
        mainWindow && !mainWindow.isDestroyed() ? mainWindow : popupWindow;
    }
    menu.popup({
      window: popupWindow,
      x: Math.round(popupX),
      y: Math.round(popupY),
    });
  });
}

/**
 * Window-open policy shared by a service view and any popup it spawns.
 * Genuine external links go to the OS browser when linkHandling allows it;
 * internal popups (Zoho CRM child windows, SSO, about:blank) stay in Hub.
 *
 * Per-app / global linkHandling (same for every app):
 * - block:    known hosts in Hub; unknown blocked
 * - external: known in Hub; unknown → system browser
 * - hub-tab:  outbound/new-window → new top app-bar tab (never a floating popup)
 * - ask:      chooser (browser vs Hub tab; optional remember for this app)
 *
 * Gmail: never load google.com/url?q=… or third-party sites into the Gmail tab.
 */
function guestNavigationApi() {
  return {
    liveService,
    isGoogleService,
    startUrlForService,
    handleOutboundOrNewWindowLink,
    guestWebPreferences,
    getMainWindow: () => mainWindow,
    tryOpenZohoSharedHubTab: (svc, url) => {
      if (!shouldOpenAsHubTab(effectiveLinkHandling(svc))) return false;
      return openInternalLinkAsHubTab(svc, url);
    },
  };
}

function configureGuestWindowOpen(wc, service) {
  configureGuestWindowOpenImpl(wc, service, guestNavigationApi());
}

/**
 * Main-frame (+ iframe) navigation gate for a guest.
 * Gmail stays on mail/accounts only. Messaging apps never navigate away into
 * third-party sites in-place — those become Hub tabs / browser per settings.
 */
function attachGuestNavigationGate(webContents, service) {
  attachGuestNavigationGateImpl(webContents, service, guestNavigationApi());
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

/**
 * WhatsApp/Arattai / Web Search Hub link tabs: OAuth often finishes in a
 * floating popup while the dock tab stays blank. Fold the post-login app page
 * back into the same Hub tab — but only after the popup has visited an IdP,
 * and never fold fragile /login shells.
 */
function attachLinkTabPopupAdopt(parentWc, childWindow, service) {
  if (!(service?.isCustom || service?.linkTab)) return;
  if (!parentWc || parentWc.isDestroyed()) return;

  const childWc = childWindow.webContents;
  let adopting = false;
  let sawIdp = false;
  let lastAdoptableUrl = '';
  let lastThirdPartyOrigin = '';

  const rememberThirdParty = (popupUrl) => {
    if (!popupUrl.startsWith('http')) return;
    if (isIdentityProviderUrl(popupUrl) || isGoogleOwnedUrl(popupUrl)) return;
    try {
      lastThirdPartyOrigin = `${new URL(popupUrl).origin}/`;
    } catch {
      // ignore
    }
  };

  const adoptIntoParent = (url, { closePopup = true } = {}) => {
    if (adopting || !url || parentWc.isDestroyed()) return;
    adopting = true;
    parentWc.loadURL(url).catch(() => {});
    rememberGoodUrl(service.id, url);
    if (!closePopup) return;
    setTimeout(() => {
      try {
        if (!childWindow.isDestroyed()) childWindow.close();
      } catch {
        // ignore
      }
    }, 150);
  };

  const tryAdopt = () => {
    if (adopting || childWindow.isDestroyed() || parentWc.isDestroyed()) return;
    let popupUrl = '';
    try {
      popupUrl = childWc.getURL();
    } catch {
      return;
    }
    if (isIdentityProviderUrl(popupUrl)) sawIdp = true;
    rememberThirdParty(popupUrl);
    if (shouldAdoptLinkTabPopupUrlAfterIdp(popupUrl, { sawIdp })) {
      lastAdoptableUrl = popupUrl;
      adoptIntoParent(popupUrl);
    }
  };

  childWc.on('did-navigate', tryAdopt);
  childWc.on('did-navigate-in-page', tryAdopt);
  childWc.on('did-finish-load', tryAdopt);
  childWc.on('page-title-updated', tryAdopt);
  setTimeout(tryAdopt, 300);
  setTimeout(tryAdopt, 1200);

  childWindow.on('closed', () => {
    if (adopting || parentWc.isDestroyed()) return;
    const home =
      linkTabSiteHome(lastAdoptableUrl || lastThirdPartyOrigin) ||
      lastAdoptableUrl ||
      lastThirdPartyOrigin;
    if (!home || !sawIdp) return;
    let parentUrl = '';
    try {
      parentUrl = parentWc.getURL();
    } catch {
      parentUrl = '';
    }
    // After Google popup closes: blank or login handoff → site home.
    const parentNeedsHome =
      isBlankOrErrorGuestUrl(parentUrl) ||
      (isOauthHandoffUrl(parentUrl) && !isIdentityProviderUrl(parentUrl));
    if (!parentNeedsHome) return;
    setTimeout(() => {
      if (adopting || parentWc.isDestroyed()) return;
      pinChromeUserAgent(parentWc);
      adoptIntoParent(home, { closePopup: false });
      rememberGoodUrl(service.id, home);
    }, 700);
  });
}

/**
 * Same-tab Google SSO on Hub link tabs: recover wiped about:blank / chrome-error
 * after IdP. Never interrupt OAuth handoffs. Never force-home white SPA shells —
 * only wiped blank documents.
 */
function attachLinkTabAuthRecovery(webContents, service) {
  if (!(service?.isCustom || service?.linkTab)) return;
  if (!webContents || webContents.isDestroyed()) return;

  let sawIdp = false;
  let returnOrigin = '';
  let lastNonIdpUrl = '';
  let recovering = false;
  /** @type {ReturnType<typeof setTimeout>[]} */
  const timers = [];

  const clearTimers = () => {
    for (const t of timers.splice(0, timers.length)) clearTimeout(t);
  };

  const captureReturnOrigin = (fromUrl) => {
    const home = linkTabSiteHome(fromUrl);
    if (home) {
      try {
        returnOrigin = new URL(home).origin;
      } catch {
        returnOrigin = '';
      }
    }
  };

  const resolveHome = (cur) =>
    linkTabSiteHome(cur) ||
    linkTabSiteHome(returnOrigin) ||
    linkTabSiteHome(lastNonIdpUrl) ||
    linkTabSiteHome(lastGoodUrls.get(service.id)) ||
    linkTabSiteHome(service.url);

  const navigateHome = (reason, cur) => {
    if (recovering || webContents.isDestroyed()) return;
    if (isOauthHandoffUrl(cur)) return;
    const home = resolveHome(cur);
    if (!home) return;
    recovering = true;
    clearTimers();
    pinChromeUserAgent(webContents);
    try {
      logBreadcrumb('link-tab-post-auth-recover', {
        reason,
        serviceId: service.id,
        from: cur,
        home,
      });
    } catch {
      // ignore
    }
    webContents.loadURL(home).catch(() => {});
    rememberGoodUrl(service.id, home);
    lastGoodUrls.set(service.id, home);
    setTimeout(() => {
      recovering = false;
      sawIdp = false;
    }, 2500);
  };

  const tryRecover = (reason) => {
    if (recovering || webContents.isDestroyed()) return;
    if (service.id !== activeServiceId) return;
    let cur = '';
    try {
      cur = String(webContents.getURL() || '');
    } catch {
      return;
    }
    if (!sawIdp) return;
    if (isOauthHandoffUrl(cur)) return;
    if (!isBlankOrErrorGuestUrl(cur)) return;
    navigateHome(reason, cur);
  };

  const scheduleRecover = (reason) => {
    clearTimers();
    for (const ms of LINK_TAB_POST_AUTH_CHECK_MS) {
      timers.push(setTimeout(() => tryRecover(reason), ms));
    }
  };

  const onNav = (_event, url) => {
    const href = String(url || '');
    if (isIdentityProviderUrl(href)) {
      sawIdp = true;
      recovering = false;
      if (lastNonIdpUrl) captureReturnOrigin(lastNonIdpUrl);
      if (!returnOrigin) captureReturnOrigin(service.url);
      return;
    }
    if (href.startsWith('http') && !isGoogleOwnedUrl(href)) {
      lastNonIdpUrl = href;
      captureReturnOrigin(href);
      pinChromeUserAgent(webContents);
    }
    if (!sawIdp) return;
    if (isOauthHandoffUrl(href)) {
      scheduleRecover('oauth-handoff');
      return;
    }
    scheduleRecover('left-idp');
    if (isBlankOrErrorGuestUrl(href)) {
      timers.push(setTimeout(() => tryRecover('immediate-blank'), 1200));
    }
  };

  webContents.on('did-navigate', onNav);
  webContents.on('did-navigate-in-page', onNav);
  webContents.on('did-finish-load', () => {
    if (!sawIdp) return;
    try {
      const cur = String(webContents.getURL() || '');
      if (isOauthHandoffUrl(cur)) return;
      if (isBlankOrErrorGuestUrl(cur)) {
        scheduleRecover('finish-load-stuck');
      }
    } catch {
      // ignore
    }
  });
  webContents.on('did-fail-load', (_e, _code, _desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || !sawIdp) return;
    timers.push(setTimeout(() => tryRecover('fail-load'), 800));
    void validatedURL;
  });
}

/**
 * Zoho often window.opens about:blank then navigates. Fold that floating
 * window into a Hub app-bar tab that shares the CRM/One login.
 */
function attachZohoPopupAdoptToHubTab(parentWc, childWindow, service) {
  if (!canShareProfileAcrossInstances(service?.appId)) return;
  // Only fold popups into Hub tabs when linkHandling is hub-tab.
  if (!shouldOpenAsHubTab(effectiveLinkHandling(service))) return;

  const childWc = childWindow.webContents;
  let adopting = false;

  const tryAdopt = () => {
    if (adopting || childWindow.isDestroyed()) return;
    let popupUrl = '';
    try {
      popupUrl = childWc.getURL();
    } catch {
      return;
    }
    if (!popupUrl.startsWith('http') || isAuthOrLoginUrl(popupUrl)) return;
    if (!isInternalUrl(popupUrl, service)) return;
    if (isZohoAssetHost(popupUrl)) return;

    // Zoho CRM/Books/One deep links → shared-login Hub tabs (same profile).
    if (!openInternalLinkAsHubTab(service, popupUrl)) return;
    adopting = true;
    setTimeout(() => {
      try {
        if (!childWindow.isDestroyed()) childWindow.close();
      } catch {
        // ignore
      }
    }, 120);
  };

  childWc.on('did-navigate', tryAdopt);
  childWc.on('did-navigate-in-page', tryAdopt);
  childWc.on('did-finish-load', tryAdopt);
  setTimeout(tryAdopt, 400);
}

/**
 * Gmail often window.opens about:blank then navigates the popup to the email
 * link. Under Hub-tab mode, fold that destination into an app-bar tab and
 * close the floating window — otherwise users see a blank Aspera Hub window.
 * OAuth/SSO client popups stay floating.
 */
function attachGmailPopupAdoptToHubTab(_parentWc, childWindow, service) {
  if (!isGoogleService(service)) return;
  if (!shouldOpenAsHubTab(effectiveLinkHandling(service))) return;

  const childWc = childWindow.webContents;
  let adopting = false;

  const closeChild = () => {
    setTimeout(() => {
      try {
        if (!childWindow.isDestroyed()) childWindow.close();
      } catch {
        // ignore
      }
    }, 120);
  };

  const tryAdopt = () => {
    if (adopting || childWindow.isDestroyed()) return;
    let popupUrl = '';
    try {
      popupUrl = childWc.getURL();
    } catch {
      return;
    }
    if (!popupUrl || popupUrl === 'about:blank' || popupUrl.startsWith('about:blank')) {
      return;
    }
    if (!popupUrl.startsWith('http')) return;

    const action = gmailWindowOpenAction(popupUrl);
    if (action === 'oauth-popup') return;
    if (action !== 'hub-tab') return;

    const target = extractGoogleOutboundUrl(popupUrl) || popupUrl;
    const opened = openUrlAsHubAppTab(target, service);
    if (!opened.ok) return;
    adopting = true;
    closeChild();
  };

  childWc.on('did-navigate', tryAdopt);
  childWc.on('did-navigate-in-page', tryAdopt);
  childWc.on('did-finish-load', tryAdopt);
  childWc.on('will-redirect', (_e, url) => {
    // Redirect targets are visible via getURL after the event; retry shortly.
    setTimeout(tryAdopt, 0);
    void url;
  });
  setTimeout(tryAdopt, 400);
  setTimeout(tryAdopt, 1500);

  // Stuck blank popups (opener never assigned a URL) — close so they don't
  // linger as empty Aspera Hub windows.
  setTimeout(() => {
    if (adopting || childWindow.isDestroyed()) return;
    let u = '';
    try {
      u = childWc.getURL();
    } catch {
      return;
    }
    if (!u || u === 'about:blank' || u.startsWith('about:blank')) {
      closeChild();
    }
  }, 8000);
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
  if (
    isGoogleService(service) ||
    service.linkTab ||
    service.isCustom
  ) {
    // Link tabs need a stable Chrome UA on the webContents itself
    // (not only request headers) so navigator.userAgent matches sec-ch-ua.
    if (service.linkTab || service.isCustom) {
      pinChromeUserAgent(webContents);
    }
    attachGoogleChromeSpoof(webContents, {
      chromeVersion: CHROME_VERSION,
      chromeMajor: CHROME_MAJOR,
      chromeUA: CHROME_USER_AGENT,
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
  attachLinkTabAuthRecovery(webContents, service);
  if (isHeavyPortalApp(service) || isKeepWarmService(service.id)) {
    // Safe Mode: do not spoof Page Visibility on WhatsApp.
    if (!whatsappAutomationBlocked(settings, service.appId)) {
      attachPortalVisibilityKeepAlive(webContents);
    }
  }
  if (service.appId === 'zoho-one') {
    attachZohoOneBlankGuardian(webContents);
  }
  // Throttling is applied after first load (see did-finish-load below).

  // Real popup windows (Zoho CRM child views, SSO handshakes) inherit these
  // rules too, and must never be trapped inside a broken denied handle.
  webContents.on('did-create-window', (childWindow) => {
    const childWc = childWindow.webContents;
    try {
      // Taskbar: never show guest popups as extra Aspera Hub apps.
      childWindow.setSkipTaskbar(true);
      if (mainWindow && !mainWindow.isDestroyed() && childWindow !== mainWindow) {
        childWindow.setParentWindow(mainWindow);
      }
    } catch {
      // ignore
    }
    trackServicePopup(service.id, childWindow);
    attachGuestContextMenu(childWc);
    watchWebContents(childWc, `popup:${service.appId}:${service.id}`);

    // WhatsApp/Arattai PDF and photo previews are read-only blob windows.
    if (isMessagingApp(service)) return;

    configureGuestWindowOpen(childWc, service);
    attachGuestNavigationGate(childWc, service);
    attachPopupSessionAdopt(webContents, childWindow, service);
    attachLinkTabPopupAdopt(webContents, childWindow, service);
    attachZohoPopupAdoptToHubTab(webContents, childWindow, service);
    attachGmailPopupAdoptToHubTab(webContents, childWindow, service);
    if (
      isGoogleService(service) ||
      service.linkTab ||
      service.isCustom
    ) {
      if (service.linkTab || service.isCustom) {
        pinChromeUserAgent(childWc);
      }
      attachGoogleChromeSpoof(childWc, {
        chromeVersion: CHROME_VERSION,
        chromeMajor: CHROME_MAJOR,
        chromeUA: CHROME_USER_AGENT,
        enabled: settings.googleSpoofEnabled !== false,
      }).catch(() => {});
    }
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
      // Prefer per-chat cards with last-message preview over a bare "N unread".
      const runScrape = () => {
        scrapeUnreadChatsForService(service, { allowDefer: false })
          .then((chats) => {
            if (chats.length) {
              chats.slice(0, 8).forEach((chat, index) => {
                emitServiceNotification(service, {
                  title: chat.name,
                  body:
                    chat.preview ||
                    (chat.unread > 1
                      ? `${chat.unread} unread messages`
                      : 'New message'),
                  fromTitleCount: false,
                  // One desktop toast; the rest fill the in-app center.
                  showOs: index === 0,
                });
              });
              return;
            }
            emitServiceNotification(service, {
              title: service.title || service.name,
              body: `${next} unread`,
              fromTitleCount: true,
            });
          })
          .catch(() => {
            emitServiceNotification(service, {
              title: service.title || service.name,
              body: `${next} unread`,
              fromTitleCount: true,
            });
          });
      };
      serviceIsBusyWithMediaViewer(service.id).then((busy) => {
        if (busy) scheduleDeferredInboxScrape(service, runScrape);
        else runScrape();
      });
      return;
    }
  });

  webContents.on('dom-ready', async () => {
    applyFocusMode(webContents, service.id);
    // Seed badge from current title without treating it as a new message.
    seedUnreadFromTitle(service.id, webContents);
    refreshBadge();
    broadcastState();
    const live = getAppConfig(service.id);
    if (isPageInjectionEnabled(settings) && live.injectCss && live.injectCss.trim()) {
      try {
        await webContents.insertCSS(live.injectCss);
      } catch {
        // ignore
      }
    }
    const stylishHttps = isPageInjectionEnabled(settings)
      ? normalizeStylishHttpsUrl(live.stylishUrl)
      : null;
    if (stylishHttps) {
      try {
        const res = await fetch(stylishHttps);
        if (res.ok) await webContents.insertCSS(await res.text());
      } catch {
        // ignore
      }
    }
    if (isPageInjectionEnabled(settings) && live.injectJs && live.injectJs.trim()) {
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
    if (service.id === activeServiceId) pushActiveNavState();
  });
  webContents.on('did-navigate-in-page', (_event, url) => {
    rememberGoodUrl(service.id, url);
    if (service.id === activeServiceId) pushActiveNavState();
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
      // Guest reload must not resurrect sticky yellow find marks from a prior session.
      if (!isFindBarOpen()) {
        findBarLastQuery = '';
        findBarRequestId = 0;
        clearGuestFindHighlights(webContents);
      }
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
    // User cleared the query (or closed Find) while this request was in flight —
    // do not keep yellow matches painted on the guest page.
    if (!findBarLastQuery) {
      clearGuestFindHighlights(webContents);
      if (isFindBarOpen()) {
        try {
          findBarWindow.webContents.send('find-bar:result', {
            activeMatchOrdinal: 0,
            matches: 0,
          });
        } catch {
          // ignore
        }
      }
      return;
    }
    // Typing "aspera" fires find("a"), find("as"), … — a late reply for "a"
    // must not win after the full-string search (that painted every letter a).
    if (
      findBarRequestId &&
      result?.requestId &&
      result.requestId !== findBarRequestId
    ) {
      return;
    }
    const matches = Number(result?.matches) || 0;
    if (matches <= 0) {
      // Zero-match queries must not leave the previous query's yellow marks.
      clearGuestFindHighlights(webContents);
    }
    const payload = {
      activeMatchOrdinal: matches ? result.activeMatchOrdinal || 0 : 0,
      matches,
    };
    mainWindow?.webContents.send('dock:find-result', payload);
    if (isFindBarOpen()) {
      try {
        findBarWindow.webContents.send('find-bar:result', payload);
      } catch {
        // ignore
      }
    }
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
  // Link / custom tabs may browse any https host (redirects from wa.me, bit.ly, …).
  if (service?.isCustom) {
    if (last && String(last).startsWith('http') && !isAuthOrLoginUrl(last)) {
      return last;
    }
    return service.url;
  }
  if (last && !isAuthOrLoginUrl(last)) {
    if (isUrlForService(service, last)) {
      return safeStartUrlForService(service, last);
    }
    // Zoho workspace tabs may open sibling product deep links (same login).
    if (
      canShareProfileAcrossInstances(service.appId) &&
      isInternalUrl(last, service)
    ) {
      return last;
    }
  }
  return service.url;
}

let lastUrlSaveTimer = null;
function rememberGoodUrl(serviceId, url) {
  if (!url || !String(url).startsWith('http') || isAuthOrLoginUrl(url)) return;
  const service = getService(serviceId);
  if (!service) return;
  const allowedForService =
    service.isCustom ||
    isUrlForService(service, url) ||
    (canShareProfileAcrossInstances(service.appId) && isInternalUrl(url, service));
  if (!allowedForService) return;
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
    if (!service) {
      dirty = true;
      continue;
    }
    const allowed =
      service.isCustom ||
      isUrlForService(service, url) ||
      (canShareProfileAcrossInstances(service.appId) && isInternalUrl(url, service));
    if (!allowed) {
      dirty = true;
      continue;
    }
    const safe = service.isCustom
      ? url
      : isUrlForService(service, url)
      ? safeStartUrlForService(service, url)
      : url;
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

/** Warm status — includes catalog defaults (WhatsApp / Zoho) when unset. */
function isKeepWarmService(id) {
  return getAppConfig(id).keepWarm === true;
}

/** User flame-marked keepWarm only (for the warm-slot quota). */
function isExplicitKeepWarm(id) {
  const stored = (settings.serviceConfigs || {})[id] || {};
  return stored.keepWarm === true;
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

function explicitWarmIds() {
  return orderedServices()
    .filter((service) => service.config?.enabled !== false && isExplicitKeepWarm(service.id))
    .map((service) => service.id);
}

function reconcileWarmSelections() {
  // Only demote user flame marks — never persist keepWarm:false over catalog defaults
  // (that used to wipe Zoho CRM draft retention after Settings save).
  const selected = explicitWarmIds();
  const limit = warmSelectionLimit();
  for (const id of selected.slice(limit)) {
    saveAppConfig(id, { keepWarm: false });
    if (id !== activeServiceId && !defaultKeepWarmForApp(getService(id)?.appId)) {
      hibernateService(id);
    }
  }
}

/**
 * Recently used non-warm tabs stay resident so form drafts survive tab
 * switches (e.g. CRM ↔ WhatsApp). Idle hibernate still unloads later.
 * Low-memory Mint PCs skip the grace so RAM stays tight.
 */
function residentGraceMs() {
  if (isLowMemoryMode()) return 0;
  return 20 * 60_000;
}

function isEvictableBackground(id, entry) {
  if (!id || id === activeServiceId) return false;
  if (isKeepWarmService(id)) return false;
  const grace = residentGraceMs();
  if (!grace) return true;
  const last = Number(entry?.lastUsed) || 0;
  if (last && Date.now() - last < grace) return false;
  return true;
}

function listEvictableBackground() {
  return [...views.entries()]
    .filter(([viewId, entry]) => isEvictableBackground(viewId, entry))
    .sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
}

/** Background wake — loads without stealing the active tab. */
function softWakeService(id) {
  if (views.has(id) || locked) return false;
  const service = getService(id);
  if (!service || service.config?.enabled === false) return false;

  // Never park warm apps. Only drop stale non-warm background views for budget.
  const evictable = listEvictableBackground();
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
  // Only unload stale non-warm background guests beyond the warm budget.
  const evictable = listEvictableBackground();

  while (views.size > maxWarm() && evictable.length) {
    const [id] = evictable.shift();
    hibernateService(id);
  }
}

function enforceWarmLimit() {
  const evictable = listEvictableBackground();

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
    // Quota applies to user flame marks; catalog defaults (WA/Zoho) stay free.
    if (explicitWarmIds().length >= limit) {
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
  // Reused warm CRM/Books tabs must NOT run blank-recovery reload — that wiped
  // lead forms ~3–4s after switching back (false “blank” on white forms).
  const reusedLiveView = (() => {
    const existing = views.get(id);
    const existingWc = existing?.view?.webContents;
    return !!(existingWc && !existingWc.isDestroyed());
  })();
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

  // Recover blank Hub link tabs after SSO, failed redirects, or reload.
  if (service.isCustom && wc && !wc.isDestroyed()) {
    try {
      const cur = String(wc.getURL() || '');
      const home =
        linkTabSiteHome(cur) ||
        linkTabSiteHome(lastGoodUrls.get(service.id) || '') ||
        linkTabSiteHome(service.url);
      const target =
        (home && home.startsWith('http') ? home : '') ||
        startUrlForService(service) ||
        service.url;
      if (
        target &&
        target.startsWith('http') &&
        (isBlankOrErrorGuestUrl(cur) ||
          cur.startsWith('chrome-error://') ||
          cur === 'chrome://blank/')
      ) {
        wc.loadURL(target).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  if (wasStale && !wc.isLoading()) {
    try {
      entry.__lastStaleReloadAt = Date.now();
      wc.reload();
    } catch {
      // ignore
    }
  } else if (shouldRunPortalBlankRecovery(service) && !reusedLiveView) {
    // Cold start only — never reload a parked CRM form that looked “blank”.
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

  // Keep the previous tab resident (parked/detached) so form drafts survive.
  // Idle hibernate + warm-budget eviction (with grace) reclaim RAM later.
  if (previousId && previousId !== id) {
    const prev = views.get(previousId);
    if (prev) prev.lastUsed = Date.now();
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

  // Clear Hub/AI error drafts that WhatsApp may have persisted in the send box.
  // Clipboard-match clearing is only for pin-open (too aggressive on every tab switch).
  if (isInboxAppId(service.appId)) {
    const sanitizeId = id;
    setTimeout(() => {
      if (activeServiceId !== sanitizeId) return;
      const live = views.get(sanitizeId)?.view?.webContents;
      if (!live || live.isDestroyed()) return;
      sanitizeComposeAfterHubChatOpen(live, { allowClipboardMatch: false }).catch(
        () => {},
      );
    }, 450);
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
    const wc = entry?.view?.webContents;
    if (!wc || wc.isDestroyed()) continue;
    applyFocusMode(wc, id);
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

/**
 * Copy the active guest page URL (http/https) for sharing in WhatsApp/Arattai.
 * Like Chrome’s address-bar copy — Hub has no address bar, so this is the shortcut.
 */
function copyActivePageLink() {
  if (!activeServiceId) {
    return { ok: false, error: 'Open an app first' };
  }
  const wc = views.get(activeServiceId)?.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    return { ok: false, error: 'No page open' };
  }
  let url = '';
  try {
    url = String(wc.getURL() || '').trim();
  } catch {
    return { ok: false, error: 'Could not read page link' };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'This page has no shareable link yet' };
  }
  try {
    clipboard.writeText(url);
  } catch {
    return { ok: false, error: 'Could not copy to clipboard' };
  }
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Link copied',
        body: url.length > 120 ? `${url.slice(0, 117)}…` : url,
        silent: true,
      }).show();
    }
  } catch {
    // ignore — clipboard already has the URL
  }
  return { ok: true, url };
}

function reloadActive() {
  if (!activeServiceId) return;
  const entry = views.get(activeServiceId);
  if (!entry) {
    // Hibernated / crashed — recreate instead of a dead no-op.
    activateService(activeServiceId);
    return;
  }
  const wc = entry.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    hibernateService(activeServiceId, { force: true });
    activateService(activeServiceId);
    return;
  }
  // Hard reload during WhatsApp/Arattai QR / login can sign the user out.
  try {
    const url = String(wc.getURL() || '');
    const title = String(wc.getTitle() || '');
    if (
      isAuthOrLoginUrl(url) ||
      /scan|log\s*in|qr code|link with phone|stay logged in/i.test(title)
    ) {
      repaintActiveGuestView({ reason: 'reload-guard-login' });
      return;
    }
  } catch {
    // ignore and fall through to reload
  }
  // Drop find markers before reload — some builds keep them across soft reloads.
  if (isFindBarOpen()) {
    closeFindBarWindow({ clear: true });
  } else {
    findBarLastQuery = '';
    findBarRequestId = 0;
    clearGuestFindHighlights(wc);
  }
  wc.reload();
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
    catalog: APP_CATALOG.map((a) => {
      const max = MAX_INSTANCES_PER_APP;
      const count = countInstances(a.appId);
      return {
        ...a,
        count,
        max,
        totalApps: totalAppCount(),
        maxTotal: MAX_APPS_TOTAL,
        canAdd: totalAppCount() < MAX_APPS_TOTAL && count < max,
      };
    }),
    limits: {
      maxAppsTotal: MAX_APPS_TOTAL,
      maxPerApp: MAX_INSTANCES_PER_APP,
      maxNameLength: MAX_APP_NAME_LENGTH,
      totalApps: totalAppCount(),
      whatsappMax: MAX_INSTANCES_PER_APP,
      whatsappSafeMode: isWhatsAppSafeMode(settings),
    },
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    unread: unreadForUi,
    totalUnread: totalUnread(),
    notifications: notificationLog,
    pinnedPeople: sanitizePinnedPeople(settings.pinnedPeople || []),
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
      extraLanguages: sanitizeAiExtraLanguages(settings.aiExtraLanguages),
      outputLanguages: aiOutputLanguages().map((l) => languageSectionFor(l)),
      languageMeta: aiLanguageMetaLabel(),
      allowedAppIds: AI_ALLOWED_APP_IDS,
      languages: AI_LANGUAGES,
      providers: aiProvidersForUi(),
      providerOrder: aiRoutePrefs().order,
      disabledProviders: aiRoutePrefs().disabledIds,
      routeOrder: aiConfiguredRouteOrderIds(),
      routeIsDefault:
        isDefaultAiProviderOrder(settings.aiProviderOrder) &&
        sanitizeAiDisabledProviders(settings.aiDisabledProviders).length === 0,
      defaultProviderOrder: [...AI_PROVIDER_TRY_ORDER],
    },
    settings: {
      ...settings,
      shortcuts: migrateShortcutsMap(settings.shortcuts || {}),
      lockPasswordHash: undefined,
      hasLockPassword: Boolean(settings.lockPasswordHash),
      errorReportGithubToken: settings.errorReportGithubToken
        ? '[configured]'
        : '',
      sentryDsn: settings.sentryDsn ? '[configured]' : '',
      hasErrorReportGithubToken: Boolean(settings.errorReportGithubToken),
      hasSentryDsnOverride: Boolean(settings.sentryDsn),
      zohoCrmDc: sanitizeZohoCrmDc(settings.zohoCrmDc),
      zohoCrmFleetUrl: String(settings.zohoCrmFleetUrl || ''),
      zohoCrmFleetSyncedAt: String(settings.zohoCrmFleetSyncedAt || ''),
      zohoCrm: {
        enabled: settings.zohoCrmEnabled !== false,
        dc: sanitizeZohoCrmDc(settings.zohoCrmDc),
        fleetUrl: String(settings.zohoCrmFleetUrl || ''),
        fleetSyncedAt: String(settings.zohoCrmFleetSyncedAt || ''),
        scopes: ZOHO_CRM_OAUTH_SCOPES,
        dataCenters: ZOHO_CRM_DCS.map((d) => ({ id: d.id, label: d.label })),
        ...zohoCrmAuthStatus(),
        ...zohoCrmFleetStatus(),
      },
    },
    locked,
    nav: activeNavState(),
  };
}

function activeNavState() {
  const wc = activeServiceId
    ? views.get(activeServiceId)?.view?.webContents
    : null;
  if (!wc || wc.isDestroyed()) {
    return { canGoBack: false, canGoForward: false };
  }
  return {
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  };
}

function pushActiveNavState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('dock:nav-state', activeNavState());
}

function scheduleActiveNavStatePush() {
  setTimeout(() => pushActiveNavState(), 80);
}

function broadcastState() {
  mainWindow?.webContents.send('dock:state', currentState());
  pushNotifCenterData();
}

function shortcutEntry(id) {
  return normalizeShortcutEntry(id, (settings.shortcuts || {})[id]);
}

function shortcutOn(id) {
  return shortcutEntry(id).enabled !== false;
}

function runMatchedShortcut(hit) {
  if (!hit) return false;
  if (hit.action === 'back') {
    if (activeServiceId) {
      const wc = views.get(activeServiceId)?.view.webContents;
      if (wc?.canGoBack()) {
        wc.goBack();
        scheduleActiveNavStatePush();
      }
    }
    return true;
  }
  if (hit.action === 'forward') {
    if (activeServiceId) {
      const wc = views.get(activeServiceId)?.view.webContents;
      if (wc?.canGoForward()) {
        wc.goForward();
        scheduleActiveNavStatePush();
      }
    }
    return true;
  }
  if (hit.action === 'switchTab') {
    const service = orderedServices()[(hit.digit || 1) - 1];
    if (service) activateService(service.id);
    return true;
  }
  if (hit.action === 'nextTab') {
    activateByOffset(1);
    return true;
  }
  if (hit.action === 'prevTab') {
    activateByOffset(-1);
    return true;
  }
  if (hit.action === 'run') return true;
  return false;
}

function attachShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (locked) {
      if (input.key === 'Escape') event.preventDefault();
      return;
    }

    const key = String(input.key || '').toLowerCase();

    // Escape closes the floating Find / Web-search popups from the guest page.
    if (key === 'escape' && isWebSearchOpen()) {
      event.preventDefault();
      closeWebSearchWindow();
      return;
    }
    if (key === 'escape' && isFindBarOpen()) {
      event.preventDefault();
      closeFindBarWindow({ clear: true });
      return;
    }

    // Always-on reload (not user-remappable — reserved).
    if (input.control && !input.alt && !input.meta && key === 'r' && !input.shift) {
      event.preventDefault();
      reloadActive();
      return;
    }

    const map = migrateShortcutsMap(settings.shortcuts || {});
    const order = [
      'backForward',
      'switchTab',
      'nextTab',
      'settings',
      'search',
      'webSearch',
      'find',
      'print',
      'focusMode',
      'mute',
      'hibernate',
      'lock',
    ];

    for (const id of order) {
      const entry = map[id];
      const hit = matchShortcut(entry, input);
      if (!hit) continue;
      // Never steal Ctrl+K from WhatsApp / Arattai chat search — even if the
      // user still has an old Web-search binding on Control+K.
      if (id === 'webSearch') {
        const accel = String(entry.accel || '').toLowerCase();
        const svc = getService(activeServiceId);
        const messaging =
          svc?.appId === 'whatsapp' || svc?.appId === 'arattai';
        if (messaging && /control\+k|commandorcontrol\+k/.test(accel)) {
          return;
        }
      }
      event.preventDefault();
      if (id === 'settings') {
        mainWindow?.webContents.send('dock:open-settings');
        return;
      }
      if (id === 'search') {
        mainWindow?.webContents.send('dock:open-search');
        return;
      }
      if (id === 'webSearch') {
        openWebSearchWindow();
        return;
      }
      if (id === 'find') {
        openFindBarWindow();
        return;
      }
      if (id === 'print') {
        printActivePage();
        return;
      }
      if (id === 'focusMode') {
        toggleFocusMode();
        return;
      }
      if (id === 'mute') {
        toggleMute();
        return;
      }
      if (id === 'hibernate') {
        hibernateBackground();
        return;
      }
      if (id === 'lock') {
        try {
          mainWindow?.webContents?.send('dock:request-lock');
        } catch {
          if (settings.lockEnabled && settings.lockPasswordHash) lockApp();
        }
        return;
      }
      runMatchedShortcut(hit);
      return;
    }
  });
}

function lockApp() {
  if (!settings.lockEnabled || !settings.lockPasswordHash) {
    return {
      ok: false,
      needSetup: true,
      error: 'Set a lock password first.',
    };
  }
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
  return { ok: true };
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
      label: 'asperahub.com',
      click: () => openExternalSafe(ASPERA_HUB_WEBSITE),
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

function clearGuestFindHighlights(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  findBarRequestId = 0;
  // clearSelection removes Chromium find markers; call twice — some Linux
  // builds keep the yellow paint after a single stop while a find is in flight.
  // Do NOT start a new findInPage here and do NOT call this on every keystroke —
  // that stole focus from WhatsApp compose after Find closed (v0.5.6 regression).
  for (let i = 0; i < 2; i++) {
    try {
      webContents.stopFindInPage('clearSelection');
    } catch {
      // ignore
    }
  }
}

function findInActivePage(text, options = {}) {
  const webContents = views.get(activeServiceId)?.view.webContents;
  if (!webContents || webContents.isDestroyed()) return { ok: false };

  // Never paint find marks while the Find popup is closed (chat-list search
  // in Arattai/WhatsApp is a different feature — yellow marks confuse users).
  if (!isFindBarOpen()) {
    findBarLastQuery = '';
    findBarRequestId = 0;
    clearGuestFindHighlights(webContents);
    return { ok: false, error: 'Find bar closed' };
  }

  const query = String(text || '').trim() ? String(text || '') : '';
  findBarLastQuery = query;
  const session = ++findBarSession;
  const findNext = !!options.findNext;

  if (!query) {
    clearGuestFindHighlights(webContents);
    // A prior findInPage can still emit found-in-page after clear and
    // re-paint yellow matches — stop again on the next ticks.
    setTimeout(() => {
      if (session !== findBarSession) return;
      clearGuestFindHighlights(webContents);
    }, 0);
    setTimeout(() => {
      if (session !== findBarSession) return;
      clearGuestFindHighlights(webContents);
    }, 50);
    setTimeout(() => {
      if (session !== findBarSession) return;
      clearGuestFindHighlights(webContents);
    }, 150);
    return { ok: true, cleared: true };
  }

  // New query (not Next/Prev): cancel any in-flight find for "a" before
  // starting "aspera", otherwise the late "a" paint sticks forever.
  if (!findNext) {
    try {
      webContents.stopFindInPage('clearSelection');
    } catch {
      // ignore
    }
  }

  const requestId = webContents.findInPage(query, {
    forward: options.forward !== false,
    findNext,
    matchCase: !!options.matchCase,
  });
  findBarRequestId = Number(requestId) || 0;
  return { ok: true, requestId: findBarRequestId };
}

function stopFindInActivePage() {
  findBarLastQuery = '';
  findBarRequestId = 0;
  findBarSession += 1;
  const session = findBarSession;
  // Clear on the active guest and every live guest — highlights can linger on
  // a view that was active when Find started if the user switched tabs.
  const targets = new Set();
  const active = views.get(activeServiceId)?.view?.webContents;
  if (active) targets.add(active);
  for (const entry of views.values()) {
    const wc = entry?.view?.webContents;
    if (wc && !wc.isDestroyed()) targets.add(wc);
  }
  for (const wc of targets) clearGuestFindHighlights(wc);
  setTimeout(() => {
    if (session !== findBarSession) return;
    for (const wc of targets) {
      if (!wc.isDestroyed()) clearGuestFindHighlights(wc);
    }
  }, 80);
  setTimeout(() => {
    if (session !== findBarSession) return;
    for (const wc of targets) {
      if (!wc.isDestroyed()) clearGuestFindHighlights(wc);
    }
  }, 200);
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
          click: () => openFindBarWindow(),
        },
        {
          label: 'Web search…',
          accelerator: 'CommandOrControl+E',
          click: () => openWebSearchWindow(),
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
          label: 'Visit asperahub.com',
          click: () => openExternalSafe(ASPERA_HUB_WEBSITE),
        },
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
      detail: aboutDetailText({
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
      }),
      buttons: ['Website', 'OK'],
      defaultId: 1,
      cancelId: 1,
      icon: getAppIcon(),
    })
    .then(({ response }) => {
      if (response === 0) openExternalSafe(ASPERA_HUB_WEBSITE);
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
  // Hard guarantee: never open a second main Hub window on this profile.
  if (mainWindow && !mainWindow.isDestroyed()) {
    raiseDockWindow();
    return;
  }
  // Do NOT adopt guest OAuth/SSO popups as the shell — they are parentless
  // BrowserWindows and would leave users without a real Hub chrome window.

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
  try {
    mainWindow.__asperaHubShell = true;
  } catch {
    // ignore
  }

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
dockHandle('dock:open-external', (_e, url) => {
  const ok = openExternalSafe(url);
  return { ok: !!ok };
});

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
dockHandle('dock:open-find-bar', (_e, payload) =>
  openFindBarWindow({
    dark: typeof payload?.dark === 'boolean' ? payload.dark : null,
  }),
);
dockHandle('dock:close-find-bar', () => {
  closeFindBarWindow({ clear: true });
  return { ok: true };
});
dockHandle('dock:open-web-search', (_e, payload) =>
  openWebSearchWindow({
    dark: typeof payload?.dark === 'boolean' ? payload.dark : null,
  }),
);
dockHandle('dock:close-web-search', () => {
  closeWebSearchWindow();
  return { ok: true };
});
findBarHandle('find-bar:find', (_e, text, options) =>
  findInActivePage(text, options || {}),
);
findBarHandle('find-bar:close', () => {
  closeFindBarWindow({ clear: true });
  return { ok: true };
});
webSearchHandle('web-search:go', (_e, text) => runWebSearch(text));
webSearchHandle('web-search:close', () => {
  closeWebSearchWindow();
  return { ok: true };
});
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
dockHandle('dock:open-inbox-chat', async (_e, payload) => {
  const serviceId = String(payload?.serviceId || '');
  const name = String(payload?.name || '');
  const chatKey = String(payload?.chatKey || '');
  let nativeId = String(payload?.nativeId || payload?.chid || '').trim();
  // Recover nativeId from saved pin when older UI clicks omit it.
  if (!nativeId) {
    const pin = sanitizePinnedPeople(settings.pinnedPeople || []).find(
      (p) =>
        p.serviceId === serviceId &&
        (p.chatKey === normalizeChatKey(chatKey || name) ||
          p.name === name),
    );
    if (pin?.nativeId) nativeId = pin.nativeId;
  }
  const result = await openMessagingChat(serviceId, { name, chatKey, nativeId });
  // Superseded by a newer pin click — do not toast "Could not open".
  if (result?.cancelled) return { ok: true, cancelled: true };
  return result;
});
dockHandle('dock:pin-person', (_e, payload) => pinPerson(payload || {}));
dockHandle('dock:unpin-person', (_e, pinId) => unpinPerson(pinId));
dockHandle('dock:search-chats', async (_e, query) =>
  searchChatsAcrossAccounts(query),
);
dockHandle('dock:quick-reply', async (_e, payload) =>
  sendQuickReply(String(payload?.serviceId || ''), {
    name: String(payload?.name || payload?.chatName || ''),
    chatKey: String(payload?.chatKey || ''),
    text: String(payload?.text || ''),
  }),
);
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
aiResultHandle('ai-result:read-clipboard', () => {
  try {
    return clipboard.readText() || '';
  } catch {
    return '';
  }
});
aiResultHandle('ai-result:paste-clipboard', () => pasteAiInboxFromClipboard());
aiResultHandle('ai-result:run-clipboard', async (_e, payload) => {
  const body = payload && typeof payload === 'object' ? payload : {};
  const skillRaw = String(body.skill || 'summarize');
  const skill =
    skillRaw === 'refine' || skillRaw === 'suggest-reply' ? skillRaw : 'summarize';
  const text = String(body.text || '').trim();
  const attachmentId = String(body.attachmentId || '').trim();
  const hasAttach =
    attachmentId &&
    aiInboxAttachment &&
    aiInboxAttachment.id === attachmentId;
  if (!text && !hasAttach) {
    return {
      ok: false,
      error: 'Paste text or a screenshot first, or attach a PDF/image for Summarize.',
    };
  }
  if (hasAttach && skill !== 'summarize') {
    return {
      ok: false,
      error:
        'PDF/image attachments only work with Summarize. Clear the file for Refine or Suggest reply.',
    };
  }
  return runAsperaAiSkill(skill, {
    selectionText: text,
    dark: !!body.dark,
    attachmentId: hasAttach ? attachmentId : '',
  });
});
aiResultHandle('ai-result:attach-file', (_e, payload) => {
  const body = payload && typeof payload === 'object' ? payload : {};
  return stageAiInboxAttachment({
    name: body.name,
    mime: body.mime,
    base64: body.base64,
  });
});
aiResultHandle('ai-result:clear-attachment', () => {
  clearAiInboxAttachment();
  return { ok: true };
});
aiResultHandle('ai-result:attachment-meta', () => ({
  ok: true,
  attachment: aiAttachmentPublicMeta(),
}));
aiResultHandle('ai-result:new-paste', () => {
  clearAiInboxAttachment();
  return openAsperaAiInbox({ dark: false });
});
crmLookupHandle('crm-lookup:copy', (_e, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});
crmLookupHandle('crm-lookup:prepare-copy', async (_e, payload = {}) => {
  const mode = String(payload?.mode || 'deal');
  let fallback = '';
  let prompt = '';
  if (mode === 'digest') {
    const deals = Array.isArray(payload?.deals) ? payload.deals : [];
    const query = String(payload?.query || '');
    fallback = formatDealsWhatsAppDigest(deals, query);
    prompt = buildDealsWhatsAppDigestPrepPrompt(deals, query);
  } else {
    const deal = payload?.deal && typeof payload.deal === 'object' ? payload.deal : {};
    fallback = formatDealWhatsAppMessage(deal);
    prompt = buildDealWhatsAppPrepPrompt(deal);
  }

  if (!fallback.trim()) {
    return { ok: false, error: 'Nothing to copy', text: '', usedAi: false };
  }

  if (settings.aiEnabled === false) {
    return { ok: true, text: fallback, usedAi: false, reason: 'ai-disabled' };
  }

  const { routeOrder } = aiSettingsSnapshot();
  if (!routeOrder.length) {
    return { ok: true, text: fallback, usedAi: false, reason: 'no-key' };
  }

  try {
    const result = await runAiCompletionWithFailover(prompt);
    syncPreferredAiProvider();
    const text = sanitizePreparedWhatsAppMessage(result?.text, fallback);
    if (!text || text === fallback) {
      return { ok: true, text: fallback, usedAi: false, reason: 'empty' };
    }
    return {
      ok: true,
      text,
      usedAi: true,
      provider: result.providerId,
      model: result.model,
    };
  } catch {
    return { ok: true, text: fallback, usedAi: false, reason: 'ai-failed' };
  }
});
crmLookupHandle('crm-lookup:close', () => {
  closeCrmLookupWindow();
  return { ok: true };
});
crmLookupHandle('crm-lookup:open-deal', (_e, url) => {
  const href = String(url || '').trim();
  if (!/^https?:\/\//i.test(href)) return { ok: false, error: 'Invalid deal URL' };
  closeCrmLookupWindow();
  const zoho =
    orderedServices().find((s) => s.appId === 'zoho-crm') ||
    orderedServices().find((s) => String(s.appId || '').startsWith('zoho')) ||
    null;
  const opened = openUrlAsHubAppTab(href, zoho);
  if (!opened?.ok) {
    activateService(zoho?.id || activeServiceId);
    const entry = views.get(zoho?.id || activeServiceId);
    entry?.view?.webContents?.loadURL(href).catch(() => {});
  }
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
aiResultHandle('ai-result:sync-refine', (_e, payload) => {
  if (!aiResultContext || aiResultContext.skill !== 'refine') {
    return { ok: false };
  }
  if (Array.isArray(payload?.sections)) {
    const refineSections = payload.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      label: s.label,
      text: String(s?.text || ''),
    }));
    aiResultContext = {
      ...aiResultContext,
      refineSections,
      refinedText: serializeRefinedDrafts(refineSections),
    };
    return { ok: true };
  }
  const rawText =
    payload && typeof payload === 'object' && 'text' in payload
      ? payload.text
      : payload;
  aiResultContext = {
    ...aiResultContext,
    refinedText: String(rawText || ''),
  };
  return { ok: true };
});
forwardPickerHandle('forward-picker:pick', (_e, serviceId) =>
  deliverForwardToTarget(String(serviceId || '')),
);
forwardPickerHandle('forward-picker:close', () => {
  closeForwardPickerWindow({ clearPayload: true });
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
  openExternalSafe(url);
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
  extraLanguages: sanitizeAiExtraLanguages(settings.aiExtraLanguages),
  outputLanguages: aiOutputLanguages().map((l) => languageSectionFor(l)),
  languageMeta: aiLanguageMetaLabel(),
  allowedAppIds: AI_ALLOWED_APP_IDS,
  languages: AI_LANGUAGES,
  providers: aiProvidersForUi(),
  providerOrder: aiRoutePrefs().order,
  disabledProviders: aiRoutePrefs().disabledIds,
  routeOrder: aiConfiguredRouteOrderIds(),
  routeIsDefault:
    isDefaultAiProviderOrder(settings.aiProviderOrder) &&
    sanitizeAiDisabledProviders(settings.aiDisabledProviders).length === 0,
  defaultProviderOrder: [...AI_PROVIDER_TRY_ORDER],
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
dockHandle('dock:zoho-crm-status', () => ({
  ok: true,
  enabled: settings.zohoCrmEnabled !== false,
  dc: sanitizeZohoCrmDc(settings.zohoCrmDc),
  fleetUrl: String(settings.zohoCrmFleetUrl || ''),
  fleetSyncedAt: String(settings.zohoCrmFleetSyncedAt || ''),
  scopes: ZOHO_CRM_OAUTH_SCOPES,
  dataCenters: ZOHO_CRM_DCS.map((d) => ({ id: d.id, label: d.label })),
  ...zohoCrmAuthStatus(),
  ...zohoCrmFleetStatus(),
}));
dockHandle('dock:zoho-crm-save', (_e, payload) => {
  const body = payload && typeof payload === 'object' ? payload : {};
  const dcId = sanitizeZohoCrmDc(body.dc || body.zohoCrmDc || settings.zohoCrmDc);
  const dc = resolveZohoCrmDc(dcId);
  const patch = { zohoCrmDc: dcId };
  if (typeof body.enabled === 'boolean') {
    patch.zohoCrmEnabled = body.enabled;
  }
  if (body.fleetUrl != null || body.zohoCrmFleetUrl != null) {
    patch.zohoCrmFleetUrl = normalizeFleetApiUrl(
      body.fleetUrl ?? body.zohoCrmFleetUrl,
    );
  }
  settings = saveSettings(patch);
  if (body.fleetToken != null) {
    setZohoCrmFleetToken(body.fleetToken);
  }
  const result = setZohoCrmAuth({
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    refreshToken: body.refreshToken,
    apiDomain: dc.apiDomain,
    accountsUrl: dc.accountsUrl,
    dcId: dc.id,
  });
  clearZohoCrmAccessCache();
  broadcastState();
  return {
    ok: true,
    ...result,
    ...zohoCrmFleetStatus(),
    dc: dcId,
    fleetUrl: String(settings.zohoCrmFleetUrl || ''),
  };
});
dockHandle('dock:zoho-crm-fleet-pull', async (_e, payload) => {
  const body = payload && typeof payload === 'object' ? payload : {};
  const urlFromBody = normalizeFleetApiUrl(
    body.fleetUrl ?? body.zohoCrmFleetUrl ?? '',
  );
  const fleetUrl = urlFromBody || normalizeFleetApiUrl(settings.zohoCrmFleetUrl);
  if (urlFromBody) {
    settings = saveSettings({ zohoCrmFleetUrl: fleetUrl });
  }
  if (body.fleetToken != null) {
    setZohoCrmFleetToken(body.fleetToken);
  }
  const token = getZohoCrmFleetToken();
  const credentialsUrl = buildFleetCredentialsUrl(fleetUrl);
  if (!credentialsUrl) {
    return {
      ok: false,
      error: 'Set a valid HTTPS Fleet API URL (your Vercel project URL).',
    };
  }
  if (!token) {
    return { ok: false, error: 'Set the Fleet token before fetching.' };
  }
  try {
    const response = await fetch(credentialsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (!response.ok) {
      const errMsg =
        (json && json.error) ||
        `Fleet API returned HTTP ${response.status}.`;
      return { ok: false, error: String(errMsg) };
    }
    const parsed = parseFleetCredentialsBody(json);
    if (!parsed.ok) return parsed;
    const dcId = sanitizeZohoCrmDc(parsed.dc);
    const dc = resolveZohoCrmDc(dcId);
    const auth = setZohoCrmAuth({
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      refreshToken: parsed.refreshToken,
      apiDomain: dc.apiDomain,
      accountsUrl: dc.accountsUrl,
      dcId: dc.id,
    });
    const syncedAt = new Date().toISOString();
    settings = saveSettings({
      zohoCrmEnabled: true,
      zohoCrmDc: dcId,
      zohoCrmFleetUrl: fleetUrl,
      zohoCrmFleetSyncedAt: syncedAt,
    });
    clearZohoCrmAccessCache();
    broadcastState();
    return {
      ok: true,
      ...auth,
      ...zohoCrmFleetStatus(),
      dc: dcId,
      fleetUrl,
      fleetSyncedAt: syncedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || 'Fleet fetch failed.'),
    };
  }
});
dockHandle('dock:zoho-crm-clear', () => {
  const result = clearZohoCrmAuth();
  clearZohoCrmAccessCache();
  broadcastState();
  return result;
});
dockHandle('dock:zoho-crm-test', async () => {
  if (settings.zohoCrmEnabled === false) {
    return { ok: false, error: 'Zoho CRM lookup is disabled.' };
  }
  return testZohoCrmConnection({
    dcId: sanitizeZohoCrmDc(settings.zohoCrmDc),
  });
});
dockHandle('dock:zoho-crm-connect', async (_e, payload) => {
  const body = payload && typeof payload === 'object' ? payload : {};
  const dcId = sanitizeZohoCrmDc(body.dc || settings.zohoCrmDc);
  const dc = resolveZohoCrmDc(dcId);
  const stored = getZohoCrmAuth({ dcId });
  try {
    const result = await exchangeGrantCode({
      clientId: String(body.clientId || '').trim() || stored.clientId,
      clientSecret: String(body.clientSecret || '').trim() || stored.clientSecret,
      code: body.code || body.grantCode,
      accountsUrl: dc.accountsUrl,
      apiDomain: dc.apiDomain,
      dcId: dc.id,
      redirectUri: body.redirectUri || '',
    });
    settings = saveSettings({
      zohoCrmEnabled: true,
      zohoCrmDc: dcId,
    });
    broadcastState();
    return result;
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});
dockHandle('dock:zoho-crm-lookup', async (_e, payload) => {
  const text = String(payload?.query || payload?.selectionText || '');
  const dark = !!payload?.dark;
  return lookupZohoCrmDeals(text, { dark });
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
  // Preference for display; failover uses custom/default order + enabled set.
  settings = saveSettings({ aiProvider: id });
  broadcastState();
  return { ok: true, provider: id };
});
dockHandle('dock:ai-set-route', (_e, payload) => {
  const body = payload && typeof payload === 'object' ? payload : {};
  return saveAiProviderRoute({
    order: body.order,
    disabledIds: body.disabledIds,
  });
});
dockHandle('dock:ai-reset-route', () =>
  saveAiProviderRoute({
    order: [...AI_PROVIDER_TRY_ORDER],
    disabledIds: [],
  }),
);
dockHandle('dock:ai-catch-up', (_e, opts) =>
  runAsperaAiSkill('catch-up', opts || {}),
);
dockHandle('dock:ai-open-inbox', (_e, opts) => openAsperaAiInbox(opts || {}));
dockHandle('dock:ai-summarize', (_e, opts) =>
  openAsperaAiInbox({ ...(opts || {}), skill: 'summarize' }),
);
dockHandle('dock:ai-refine', (_e, opts) =>
  openAsperaAiInbox({ ...(opts || {}), skill: 'refine' }),
);
dockHandle('dock:toggle-keep-warm', (_e, id) => toggleKeepWarm(id));
dockHandle('dock:save-app-config', (_e, id, incoming) => {
  if (!getService(id)) return { ok: false, error: 'Not found' };
  const patch = { ...(incoming || {}) };
  // Company default: injection only with allowPageInjection AND ASPERADOCK_ADMIN=1.
  if (!isPageInjectionEnabled(settings)) {
    delete patch.injectJs;
    delete patch.injectCss;
    delete patch.stylishUrl;
  } else if (patch.stylishUrl != null) {
    const httpsUrl = normalizeStylishHttpsUrl(patch.stylishUrl);
    if (String(patch.stylishUrl || '').trim() && !httpsUrl) {
      return { ok: false, error: 'Stylish URL must be HTTPS' };
    }
    patch.stylishUrl = httpsUrl || '';
  }

  if (patch.profileId != null) {
    const moved = setInstanceProfile(id, patch.profileId);
    if (!moved.ok) return moved;
    delete patch.profileId;
  }

  if ('linkHandling' in patch) {
    const raw = patch.linkHandling;
    if (raw == null || raw === '' || raw === 'default') patch.linkHandling = null;
    else patch.linkHandling = normalizeLinkHandling(raw, 'block');
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
  if (action === 'back' && wc.canGoBack()) {
    wc.goBack();
    scheduleActiveNavStatePush();
  } else if (action === 'forward' && wc.canGoForward()) {
    wc.goForward();
    scheduleActiveNavStatePush();
  } else if (action === 'reload') {
    wc.reload();
  } else if (action === 'home') {
    const service = getService(id);
    if (service) {
      wc.loadURL(startUrlForService(service) || service.url);
    }
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
dockHandle('dock:copy-active-link', () => copyActivePageLink());
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
  if (next.zohoCrmDc != null) {
    next.zohoCrmDc = sanitizeZohoCrmDc(next.zohoCrmDc);
  }
  if (next.zohoCrmFleetUrl != null) {
    next.zohoCrmFleetUrl = normalizeFleetApiUrl(next.zohoCrmFleetUrl);
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
  if (next.linkHandling != null) {
    next.linkHandling = normalizeLinkHandling(next.linkHandling, 'hub-tab');
  }
  if (next.updateChannel != null && next.updateChannel !== 'stable') {
    // Beta feed is unpublished on GitHub — keep custom mirrors via updateFeedUrl.
    if (!String(next.updateFeedUrl || settings.updateFeedUrl || '').trim()) {
      next.updateChannel = 'stable';
    }
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
    const wc = entry?.view?.webContents;
    if (!wc || wc.isDestroyed()) continue;
    applyFocusMode(wc, id);
    const cfg = getAppConfig(id);
    const langs = cfg.spellChecker || settings.spellChecker || ['en-US'];
    try {
      wc.session.setSpellCheckerLanguages(
        Array.isArray(langs) && langs.length ? langs : ['en-US'],
      );
      wc.setAudioMuted(settings.muted || !cfg.allowSounds);
    } catch {
      // ignore destroyed session races
    }
  }
  refreshBadge();
  broadcastState();
  return currentState();
});
dockHandle('dock:lock', () => lockApp());
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
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    else raiseDockWindow();
  });
});

app.on('second-instance', () => {
  // User launched Hub again (menu / .desktop / CLI). Focus the one window —
  // never create another; a second process sharing the profile can sign out
  // WhatsApp / Arattai.
  if (mainWindow && !mainWindow.isDestroyed()) {
    raiseDockWindow();
    return;
  }
  // Shell missing — recreate even if guest OAuth popups are still open.
  createWindow();
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