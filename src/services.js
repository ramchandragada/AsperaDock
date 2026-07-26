/**
 * App catalog for Aspera Dock.
 * Limits: max 10 apps total, up to 10 of the same app, tab names ≤ 10 chars.
 * Each instance is bound to a Profile (Electron session partition),
 * so multiple WhatsApp / Arattai / Gmail accounts stay signed in side by side.
 * The app bar is fixed at the top of the window.
 */

export const MAX_INSTANCES_PER_APP = 10;
export const MAX_APPS_TOTAL = 10;
export const MAX_APP_NAME_LENGTH = 10;
/** Only the active tab stays warm by default — critical for 8–16 GB PCs. */
export const MAX_WARM_VIEWS_DEFAULT = 5;

/** Synthetic catalog id for user-defined URLs (intranet, HRMS, Jira, …). */
export const CUSTOM_APP_ID = 'custom';

export function isCustomAppId(appId) {
  return appId === CUSTOM_APP_ID;
}

/** @typedef {{
 *   appId: string,
 *   name: string,
 *   title: string,
 *   url: string,
 *   color: string,
 *   logo: string,
 * }} AppCatalogEntry
 */

/** @type {AppCatalogEntry[]} */
export const APP_CATALOG = [
  {
    appId: 'whatsapp',
    name: 'WhatsApp',
    title: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    color: '#25D366',
    logo: 'whatsapp',
  },
  {
    appId: 'arattai',
    name: 'Arattai',
    title: 'Arattai',
    url: 'https://web.arattai.in',
    color: '#F5A623',
    logo: 'arattai',
  },
  {
    appId: 'gmail',
    name: 'Gmail',
    title: 'Gmail',
    url: 'https://mail.google.com',
    color: '#EA4335',
    logo: 'gmail',
  },
  {
    appId: 'zoho-mail',
    name: 'Zoho Mail',
    title: 'Zoho Mail',
    url: 'https://mail.zoho.com',
    color: '#E42527',
    logo: 'zoho-mail',
  },
  {
    appId: 'zoho-crm',
    name: 'CRM',
    title: 'Zoho CRM',
    url: 'https://crm.zoho.com',
    color: '#F2801C',
    logo: 'zoho-crm',
  },
  {
    appId: 'zoho-books',
    name: 'Books',
    title: 'Zoho Books',
    url: 'https://books.zoho.com',
    color: '#089949',
    logo: 'zoho-books',
  },
  {
    appId: 'zoho-one',
    name: 'Zoho One',
    title: 'Zoho One',
    // India DC portal. Unauthenticated users are redirected to
    // accounts.zoho.in/signin?servicename=ZohoOne&signupurl=…
    // Using the portal (not the sign-in page) as home so hibernate/crash
    // recreate restores the session instead of showing OneAuth QR again.
    url: 'https://one.zoho.in/',
    color: '#226DB4',
    logo: 'zoho-one',
  },
];

export function getAppCatalogEntry(appId) {
  if (isCustomAppId(appId)) {
    return {
      appId: CUSTOM_APP_ID,
      name: 'Custom',
      title: 'Custom app',
      url: 'https://',
      color: '#3D5A80',
      logo: 'custom',
    };
  }
  return APP_CATALOG.find((a) => a.appId === appId) || null;
}

/** True if this instance is still valid (catalog app or custom with URL). */
export function isKnownAppInstance(inst) {
  if (!inst?.appId) return false;
  if (isCustomAppId(inst.appId)) {
    return Boolean(inst.url && String(inst.url).startsWith('http'));
  }
  return Boolean(APP_CATALOG.find((a) => a.appId === inst.appId));
}

/** Clamp tab labels so the bar stays compact and readable. */
export function clampAppName(value, max = MAX_APP_NAME_LENGTH) {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return text.slice(0, max);
}

/** Short label for an instance, e.g. WhatsApp → WA 1 (always ≤ 10 chars) */
export function defaultInstanceName(entry, index) {
  const short = {
    whatsapp: 'WA',
    arattai: 'Arattai',
    gmail: 'Gmail',
    'zoho-mail': 'ZMail',
    'zoho-crm': 'CRM',
    'zoho-books': 'Books',
    'zoho-one': 'ZohoOne',
    custom: 'Custom',
  }[entry.appId] || clampAppName(entry.name, 7);

  if (index <= 1) return clampAppName(short);
  return clampAppName(`${short} ${index}`);
}

export function defaultInstanceTitle(entry, index) {
  // Tooltip / full title can be longer; tab name stays short via defaultInstanceName.
  if (index <= 1) return entry.title;
  return `${entry.title} ${index}`;
}

/** Layout chrome sizes (px) — must match CSS */
export const TOP_APP_BAR = 96;
export const TOP_APP_BAR_NORMAL = 86;
export const TOP_APP_BAR_COMPACT = 78;
export const TOP_APP_BAR_NO_LABEL = 74;

export const INTERNAL_HOSTS = [
  'google.com',
  'googleapis.com',
  'googleusercontent.com',
  'gstatic.com',
  'zoho.com',
  'zoho.in',
  'zohocdn.com',
  'zohostatic.com',
  'zohopublic.com',
  'arattai.in',
  'whatsapp.com',
  'whatsapp.net',
  'accounts.youtube.com',
];

export function getChromeMetrics(settings) {
  const density = settings.density || 'comfortable';
  const hide = settings.hideAppLabels;

  let top = TOP_APP_BAR;
  if (hide) top = TOP_APP_BAR_NO_LABEL;
  else if (density === 'compact') top = TOP_APP_BAR_COMPACT;
  else if (density === 'normal') top = TOP_APP_BAR_NORMAL;
  return {
    top,
    left: 0,
    right: 0,
    appsWidth: 0,
    appsHeight: top,
  };
}
