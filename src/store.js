import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getAppCatalogEntry,
  isKnownAppInstance,
  MAX_WARM_VIEWS_CAP,
  MAX_WARM_VIEWS_DEFAULT,
} from './services.js';
import { defaultShortcutsMap, migrateShortcutsMap } from './shortcutsConfig.js';
import { sanitizePinnedPeople } from './guestInbox.js';
import { isolateSharedZohoMailProfiles } from './zohoMailProfiles.js';
import { sanitizeNotes } from './notesStore.js';
import {
  getAiLanguage,
  sanitizeAiDisabledProviders,
  sanitizeAiExtraLanguages,
  sanitizeAiProviderOrder,
} from './ai/catalog.js';

export const PRIMARY_PROFILE_ID = 'primary';

export function makeProfileId() {
  return `p-${crypto.randomBytes(6).toString('hex')}`;
}

export function makeProfile(name, partition) {
  const id = makeProfileId();
  return {
    id,
    name: String(name || 'Profile').trim() || 'Profile',
    partition: partition || `persist:profile-${id}`,
  };
}

export const DEFAULTS = {
  // Top-bar presentation
  appsPosition: 'top',
  hideAppLabels: false,
  density: 'normal', // normal | large | huge — spacing / tile width only
  appIconSize: 'normal', // normal | large | huge
  theme: 'system', // system | light | dark | darkest | glossy | mint
  autoHideMenuBar: true,
  /** Let the app bar grow to a second row instead of scrolling. */
  wrapAppTabs: true,

  // Behaviour
  focusMode: false,
  muted: false,
  focusClearsBadges: false,
  showActiveInTitle: false,
  hideNotificationContent: false,

  // Downloads
  downloadPath: '',
  openFolderOnDownload: false,
  openFileOnDownload: false,

  // Startup & window
  autoStart: false,
  displayBehaviour: 'taskbar', // taskbar | tray | both
  closeBehaviour: 'quit', // quit | tray
  alwaysOnTop: false,
  trayUnreadIndicator: true,
  flashTaskbar: false,
  confirmQuit: false,

  // Security
  lockEnabled: false,
  lockPasswordHash: '',
  /**
   * When true (default), Hub disables high-risk WhatsApp Web automation:
   * pin-open Store/CDP, quick-reply Send, inbox scrape/search, Notification
   * patch, visibility spoof, and caps WhatsApp at 1 instance.
   */
  whatsappSafeMode: true,
  /** When true *and* ASPERADOCK_ADMIN=1, allow injectJs / stylishUrl. */
  allowPageInjection: false,
  /** When false (default), guest DevTools are blocked in packaged builds. */
  allowGuestDevTools: false,
  /**
   * Vendor workarounds (defaults ON — kill switches for breakage).
   * Not exposed in Settings UI; edit settings.json or ASPERADOCK_ADMIN=1.
   */
  googleSpoofEnabled: true,
  zohoReclaimEnabled: true,

  // Compatibility (needs relaunch)
  /**
   * GPU compositor. Default OFF on purpose — on many Linux Mint XFCE/Cinnamon
   * PCs (esp. NVIDIA / VM / older Intel) Electron dies at launch with
   * "GPU process isn't usable. Goodbye." Software rendering is stable.
   */
  hardwareAcceleration: false,
  hiDpiSupport: true,
  mediaKeys: true,

  // Proxy (applies to every app session)
  proxyMode: 'none', // none | system | manual
  proxyRules: '',
  proxyBypass: '<local>',

  /** Lock the dock when the OS locks or suspends (needs Lock app enabled). */
  lockOnSystemIdle: false,
  /** Sample per-app memory usage for the resource monitor. */
  consumptionMonitor: false,

  /**
   * Auto error / crash / freeze reporting.
   * Preferred: Sentry (paste DSN). Also saves local JSON reports.
   * Fallbacks: GitHub Issues, custom URL, or local-only.
   */
  errorReportingEnabled: true,
  /** sentry | github | url | none */
  errorReportTarget: 'sentry',
  /**
   * Sentry DSN override. Empty = use the built-in Aspera Hub project
   * (zarpat/asperadock) from sentryMain.js. ASPERADOCK_SENTRY_DSN wins over both.
   */
  sentryDsn: '',
  /** Optional override, e.g. owner/asperadock-errors */
  errorReportGithubRepo: '',
  /**
   * Fine-grained PAT with Issues: Write (only if errorReportTarget === 'github').
   * Never commit a real token — use Settings or ASPERADOCK_GITHUB_TOKEN.
   */
  errorReportGithubToken: '',
  /** Custom HTTPS endpoint (used when errorReportTarget === 'url'). */
  errorReportUrl: '',
  errorReportEmail: '',

  /**
   * Seamless self-update via GitHub Releases (incl. bundled Electron runtime).
   * Empty updateFeedUrl → https://github.com/ramchandragada/AsperaDock/releases/latest/download
   */
  autoUpdateEnabled: true,
  /** Override feed base URL. Leave empty to use GitHub Releases. */
  updateFeedUrl: '',
  updateChannel: 'stable', // stable | beta
  /** Download updates automatically in the background. */
  autoUpdateDownload: true,
  /** Install immediately after download (prompts for password on deb/rpm). */
  autoUpdateInstall: true,
  updateCheckMinutes: 30,

  /**
   * Aspera AI (BYOK) — employee skills for WhatsApp / Arattai / Gmail / Zoho Mail.
   * API keys are stored separately via OS encryption (ai-provider-keys.json).
   */
  aiEnabled: true,
  aiProvider: 'gemini', // gemini | grok | sambanova | deepseek | sarvam | openrouter | anthropic
  aiModel: '',
  /**
   * Per-provider model preference.
   * Use "auto" (or omit) to pick the best model from the provider's live list.
   * @type {Record<string, string>}
   */
  aiProviderModels: {},
  aiLanguage: 'en', // Catch me up language (any AI_LANGUAGE_CATALOG id)
  /**
   * Extra languages for Summarize / Refine / Suggest reply (max 2).
   * English is always included. Default Hindi + Marathi.
   * @type {string[]}
   */
  aiExtraLanguages: ['hi', 'mr'],
  /**
   * Custom Aspera AI failover sequence (provider ids).
   * Empty / omitted → built-in default (Gemini → … → Anthropic).
   * @type {string[]}
   */
  aiProviderOrder: [],
  /**
   * Provider ids excluded from failover (keys may still be saved).
   * @type {string[]}
   */
  aiDisabledProviders: [],

  /**
   * Zoho CRM Deals lookup (selection → right-click).
   * OAuth secrets live in userData/zoho-crm-oauth.json (encrypted).
   */
  zohoCrmEnabled: true,
  /** Data center: in | com | eu | com.au | jp | ca */
  zohoCrmDc: 'in',
  /**
   * Vercel fleet API base URL (HTTPS). Zoho secrets are pulled with a Bearer
   * token stored encrypted in zoho-crm-fleet.json — never in this file.
   */
  zohoCrmFleetUrl: '',
  /** ISO timestamp of last successful fleet pull (informational). */
  zohoCrmFleetSyncedAt: '',

  /**
   * Unpacked Chrome extensions for guest apps (WhatsApp, Arattai, …).
   * Loaded into each profile persist: partition via session.loadExtension.
   * @type {{ id: string, name: string, version: string, description: string, enabled: boolean, path: string, chromeId?: string }[]}
   */
  extensions: [],

  /**
   * Lean mode for refurbished / low-RAM PCs:
   * disables GPU accel, keeps fewer warm apps, hibernates faster.
   * Needs relaunch for hardwareAcceleration.
   * Off by default — on kills tab switching (apps reload every click).
   */
  lowMemoryMode: false,

  // Defaults for apps (spell/hibernate can still be per-app via Edit)
  // block | external | hub-tab | ask — see src/linkHandling.js
  // ONE Hub-wide rule for every app (never a floating popup).
  linkHandling: 'hub-tab',
  spellChecker: ['en-US'],
  /** Hibernate idle background apps (keepWarm apps like WhatsApp are skipped). */
  hibernateMinutes: 45,
  /**
   * How many apps stay fully loaded for instant switching (includes active).
   * Default 5; settings may raise up to MAX_WARM_VIEWS_CAP. Non-warm apps load on click.
   */
  maxWarmViews: MAX_WARM_VIEWS_DEFAULT,
  /** Legacy field — no longer parks warm apps (usability over RAM). */
  maxResidentViews: MAX_WARM_VIEWS_DEFAULT,

  /** Customizable global shortcuts: { [id]: { enabled, accel } } */
  shortcuts: defaultShortcutsMap(),

  /**
   * Named Electron session profiles (Rambox-style).
   * Each profile owns one persist: partition — assign different profiles
   * to multiple WhatsApp / Arattai / Gmail tabs for separate logins.
   * @type {{ id: string, name: string, partition: string }[]}
   */
  profiles: [
    {
      id: PRIMARY_PROFILE_ID,
      name: 'Primary',
      partition: `persist:profile-${PRIMARY_PROFILE_ID}`,
    },
  ],

  // Session
  lastActiveServiceId: null,
  /** Last non-login URL per service — restored after hibernate/relaunch. */
  lastServiceUrls: {},
  serviceOrder: [],
  /**
   * User-added app instances.
   * @type {{ id: string, appId: string, profileId: string, slot: number, partition?: string }[]}
   */
  serviceInstances: [],
  /** @type {Record<string, { name?: string, title?: string }>} */
  serviceLabels: {},
  /** @type {Record<string, object>} */
  serviceConfigs: {},

  /**
   * Pinned people / groups (WhatsApp & Arattai) shown above the account strip.
   * @type {{ id: string, serviceId: string, chatKey: string, name: string, appId?: string }[]}
   */
  pinnedPeople: [],

  /**
   * Local copy-pad notes (links / repeated text). This PC only.
   * @type {{ id: string, title: string, body: string, updatedAt: number }[]}
   */
  notes: [],
};

let cache = null;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

/** Drop saved instances of apps that are no longer in the catalog (keep custom URLs). */
function dropRetiredApps(settings) {
  const instances = (settings.serviceInstances || []).filter((i) =>
    isKnownAppInstance(i),
  );
  if (instances.length === (settings.serviceInstances || []).length) return settings;

  const kept = new Set(instances.map((i) => i.id));
  return {
    ...settings,
    serviceInstances: instances,
    serviceOrder: (settings.serviceOrder || []).filter((id) => kept.has(id)),
    lastActiveServiceId: kept.has(settings.lastActiveServiceId)
      ? settings.lastActiveServiceId
      : null,
  };
}

/**
 * One-shot: remove the retired Canva catalog app from persisted docks so
 * existing installs lose the Canva icon (link tabs to canva.com still work).
 */
function migrateRemoveCanvaApp(settings) {
  if (settings.removeCanvaAppV1) return settings;
  const instances = settings.serviceInstances || [];
  const canvaIds = new Set(
    instances.filter((i) => i?.appId === 'canva').map((i) => i.id),
  );
  if (!canvaIds.size) {
    return { ...settings, removeCanvaAppV1: true };
  }

  const serviceLabels = { ...(settings.serviceLabels || {}) };
  const serviceConfigs = { ...(settings.serviceConfigs || {}) };
  const lastServiceUrls = { ...(settings.lastServiceUrls || {}) };
  for (const id of canvaIds) {
    delete serviceLabels[id];
    delete serviceConfigs[id];
    delete lastServiceUrls[id];
  }

  return {
    ...settings,
    removeCanvaAppV1: true,
    serviceInstances: instances.filter((i) => !canvaIds.has(i.id)),
    serviceOrder: (settings.serviceOrder || []).filter((id) => !canvaIds.has(id)),
    serviceLabels,
    serviceConfigs,
    lastServiceUrls,
    lastActiveServiceId: canvaIds.has(settings.lastActiveServiceId)
      ? null
      : settings.lastActiveServiceId,
  };
}

/**
 * One Hub-wide link rule: promote old per-app hub-tab choices to global,
 * clear per-app overrides so WhatsApp/Arattai/Gmail/Zoho cannot diverge.
 * Also force update channel to stable (beta feed is unpublished).
 */
function migrateUnifyLinkHandling(settings) {
  const configs = { ...(settings.serviceConfigs || {}) };
  let anyHubTab = settings.linkHandling === 'hub-tab';
  let cleared = false;
  for (const [id, cfg] of Object.entries(configs)) {
    if (!cfg || typeof cfg !== 'object') continue;
    if (cfg.linkHandling === 'hub-tab') anyHubTab = true;
    if (cfg.linkHandling != null && cfg.linkHandling !== '') {
      configs[id] = { ...cfg, linkHandling: null };
      cleared = true;
    }
  }
  const nextGlobal =
    anyHubTab || !settings.linkHandling || settings.linkHandling === 'block'
      ? 'hub-tab'
      : settings.linkHandling;
  const channel = String(settings.updateChannel || 'stable');
  const nextChannel = channel === 'stable' ? 'stable' : 'stable';
  if (
    nextGlobal === settings.linkHandling &&
    !cleared &&
    channel === nextChannel
  ) {
    return settings;
  }
  return {
    ...settings,
    linkHandling: nextGlobal,
    updateChannel: nextChannel,
    serviceConfigs: configs,
  };
}

/**
 * Migrate pre-profile instances onto named profiles without losing logins.
 * Old `persist:<instanceId>` partitions are preserved on dedicated profiles.
 */
function migrateProfiles(settings) {
  let profiles = Array.isArray(settings.profiles) ? [...settings.profiles] : [];
  if (!profiles.length) {
    profiles = [
      {
        id: PRIMARY_PROFILE_ID,
        name: 'Primary',
        partition: `persist:profile-${PRIMARY_PROFILE_ID}`,
      },
    ];
  }

  // Ensure Primary always exists.
  if (!profiles.some((p) => p.id === PRIMARY_PROFILE_ID)) {
    profiles.unshift({
      id: PRIMARY_PROFILE_ID,
      name: 'Primary',
      partition: `persist:profile-${PRIMARY_PROFILE_ID}`,
    });
  }

  // Normalize profile shape.
  profiles = profiles.map((p) => ({
    id: String(p.id),
    name: String(p.name || 'Profile').trim() || 'Profile',
    partition:
      p.partition && String(p.partition).startsWith('persist:')
        ? String(p.partition)
        : `persist:profile-${p.id}`,
  }));

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const instances = (settings.serviceInstances || []).map((inst) => {
    const next = { ...inst };

    // Already on a known profile.
    if (next.profileId && byId.has(next.profileId)) {
      delete next.partition;
      return next;
    }

    // Legacy instance with its own partition — wrap as a dedicated profile
    // so existing WhatsApp/Gmail logins stay signed in.
    if (next.partition && String(next.partition).startsWith('persist:')) {
      const label =
        settings.serviceLabels?.[next.id]?.name ||
        getAppCatalogEntry(next.appId)?.name ||
        'Profile';
      const profile = {
        id: makeProfileId(),
        name: String(label),
        partition: String(next.partition),
      };
      profiles.push(profile);
      byId.set(profile.id, profile);
      next.profileId = profile.id;
      delete next.partition;
      return next;
    }

    // Fallback: Primary.
    next.profileId = PRIMARY_PROFILE_ID;
    delete next.partition;
    return next;
  });

  return { ...settings, profiles, serviceInstances: instances };
}

/**
 * Older builds defaulted to 1 warm view + low-memory mode, which destroys
 * every background tab on switch (WhatsApp reloads every time). One-shot migrate
 * existing installs to high-performance keep-alive (Rambox/Ferdium-style).
 */
function migrateWarmKeepAlive(settings) {
  let next = { ...settings };
  if (!next.warmKeepAliveV1) {
    const maxWarm = Number(next.maxWarmViews);
    const needsFix =
      next.lowMemoryMode === true || !Number.isFinite(maxWarm) || maxWarm <= 1;
    next = {
      ...next,
      warmKeepAliveV1: true,
      lowMemoryMode: false,
      maxWarmViews: Math.max(5, Number.isFinite(maxWarm) ? maxWarm : 5),
      hibernateMinutes:
        Math.max(needsFix ? 30 : 0, Number(next.hibernateMinutes) || 0) || 30,
    };
  }
  if (!next.highPerfDefaultV1) {
    // Second pass: low-memory strictly opt-in for earlier installs.
    // Do NOT force hardwareAcceleration on — that made Aspera Hub refuse to
    // start on Linux Mint GPUs ("GPU process isn't usable. Goodbye.").
    next = {
      ...next,
      highPerfDefaultV1: true,
      lowMemoryMode: false,
      maxWarmViews: Math.max(5, Number(next.maxWarmViews) || 5),
    };
  }
  // App bar is top-only — drop legacy left/right layout preferences.
  if (next.appsPosition !== 'top') {
    next = { ...next, appsPosition: 'top' };
  }
  if (!next.displaySizingV1) {
    const legacyDensity = String(next.density || 'comfortable');
    const legacyMap = {
      compact: { density: 'normal', appIconSize: 'normal' },
      normal: { density: 'normal', appIconSize: 'normal' },
      comfortable: { density: 'large', appIconSize: 'large' },
    };
    const migrated =
      legacyMap[legacyDensity] ||
      {
        density: ['normal', 'large', 'huge'].includes(legacyDensity)
          ? legacyDensity
          : 'large',
        appIconSize: ['normal', 'large', 'huge'].includes(next.appIconSize)
          ? next.appIconSize
          : 'large',
      };
    next = { ...next, ...migrated, displaySizingV1: true };
  }
  // Company defaults: compact spacing so 10 apps fit on 24" screens.
  if (!next.displaySizingV2) {
    next = {
      ...next,
      density: 'normal',
      appIconSize: 'normal',
      displaySizingV2: true,
    };
  }
  if (!next.displaySizingV3) {
    next = {
      ...next,
      density: 'normal',
      appIconSize: 'normal',
      displaySizingV3: true,
    };
  }
  // Historical: older caps forced lower ceilings; keep one-shot flags.
  if (!next.warmCap6V1) {
    next = {
      ...next,
      maxWarmViews: MAX_WARM_VIEWS_DEFAULT,
      warmCap6V1: true,
      warmCap4V1: true,
    };
  }
  if (!next.warmCap5V1) {
    next = {
      ...next,
      warmCap5V1: true,
      maxWarmViews: Math.min(
        5,
        Math.max(1, Number(next.maxWarmViews) || MAX_WARM_VIEWS_DEFAULT),
      ),
      // Stop parking flame apps for RAM — UX wins.
      maxResidentViews: Math.min(
        5,
        Math.max(5, Number(next.maxWarmViews) || MAX_WARM_VIEWS_DEFAULT),
      ),
    };
  }
  // Raise hard ceiling to 7; keep each user's current value (default stays 5).
  if (!next.warmCap7V1) {
    next = {
      ...next,
      warmCap7V1: true,
    };
  }
  // Performance-first rollout defaults:
  // keep 4 background warm apps (+1 active = 5 loaded), avoid low-memory compromises.
  // Do not force GPU on — that crashes many Linux Mint desktops at launch.
  if (!next.performanceDefaultsV1) {
    next = {
      ...next,
      performanceDefaultsV1: true,
      lowMemoryMode: false,
      autoUpdateEnabled: true,
      autoUpdateDownload: true,
      autoUpdateInstall: true,
      updateCheckMinutes: Math.min(
        60,
        Math.max(30, Number(next.updateCheckMinutes) || 30),
      ),
    };
  }
  // Restore 5 warm apps (ChatGPT/Claude removed from catalog — they were the RAM spike).
  if (!next.warmDefaultsV3) {
    next = {
      ...next,
      warmDefaultsV3: true,
      warmDefaultsV2: true,
      maxWarmViews: MAX_WARM_VIEWS_DEFAULT,
      maxResidentViews: MAX_WARM_VIEWS_DEFAULT,
      hibernateMinutes: Math.max(45, Number(next.hibernateMinutes) || 45),
    };
  }
  // Final clamp: default remains 5; users may raise up to MAX_WARM_VIEWS_CAP (7).
  next.maxWarmViews = Math.min(
    MAX_WARM_VIEWS_CAP,
    Math.max(1, Number(next.maxWarmViews) || MAX_WARM_VIEWS_DEFAULT),
  );
  next.maxResidentViews = next.maxWarmViews;
  // CRITICAL: many Linux Mint XFCE/Cinnamon PCs die at launch with Electron's
  // "GPU process isn't usable. Goodbye." after migrations forced GPU on.
  // One-shot disable HW accel so the dock starts again; users can re-enable
  // in Settings → Compatibility after confirming their GPU works.
  if (!next.linuxGpuSafeV1) {
    next = {
      ...next,
      linuxGpuSafeV1: true,
      ...(process.platform === 'linux' ? { hardwareAcceleration: false } : {}),
    };
  }
  // Keep legacy keys so older migrations stay idempotent.
  if (!next.residentCapV1) next = { ...next, residentCapV1: true };
  if (!next.residentCapV2) next = { ...next, residentCapV2: true };
  return next;
}

export function loadSettings() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = isolateSharedZohoMailProfiles(
      migrateWarmKeepAlive(
        migrateUnifyLinkHandling(
          migrateProfiles(
            dropRetiredApps(
              migrateRemoveCanvaApp({
                ...DEFAULTS,
                ...parsed,
                shortcuts: migrateShortcutsMap(parsed.shortcuts || {}),
                serviceLabels: parsed.serviceLabels || {},
                serviceConfigs: parsed.serviceConfigs || {},
                serviceInstances: parsed.serviceInstances || [],
                profiles: parsed.profiles,
                pinnedPeople: sanitizePinnedPeople(parsed.pinnedPeople || []),
                notes: sanitizeNotes(parsed.notes || []),
                aiProviderOrder: sanitizeAiProviderOrder(parsed.aiProviderOrder),
                aiDisabledProviders: sanitizeAiDisabledProviders(
                  parsed.aiDisabledProviders,
                ),
                aiLanguage: getAiLanguage(parsed.aiLanguage || 'en').id,
                aiExtraLanguages: sanitizeAiExtraLanguages(
                  Object.prototype.hasOwnProperty.call(parsed, 'aiExtraLanguages')
                    ? parsed.aiExtraLanguages
                    : undefined,
                ),
              }),
            ),
          ),
        ),
      ),
      { makeProfile },
    );
    // Persist migration so partitions/profileIds are stable next launch.
    try {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      fs.writeFileSync(settingsPath(), JSON.stringify(cache, null, 2), 'utf8');
    } catch {
      // ignore
    }
  } catch {
    cache = { ...DEFAULTS, profiles: [...DEFAULTS.profiles] };
  }
  return cache;
}

export function saveSettings(patch) {
  cache = { ...loadSettings(), ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'shortcuts')) {
    cache.shortcuts = migrateShortcutsMap(patch.shortcuts || {});
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'aiProviderOrder')) {
    cache.aiProviderOrder = sanitizeAiProviderOrder(patch.aiProviderOrder);
  }
  if (
    patch &&
    Object.prototype.hasOwnProperty.call(patch, 'aiDisabledProviders')
  ) {
    cache.aiDisabledProviders = sanitizeAiDisabledProviders(
      patch.aiDisabledProviders,
    );
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'aiLanguage')) {
    cache.aiLanguage = getAiLanguage(patch.aiLanguage || 'en').id;
  }
  if (
    patch &&
    Object.prototype.hasOwnProperty.call(patch, 'aiExtraLanguages')
  ) {
    cache.aiExtraLanguages = sanitizeAiExtraLanguages(patch.aiExtraLanguages);
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'notes')) {
    cache.notes = sanitizeNotes(patch.notes);
  }
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // ignore write failures
  }
  return cache;
}

export {
  hashPassword,
  verifyPassword,
  isLegacyPasswordHash,
} from './passwordCrypto.js';
