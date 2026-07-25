/**
 * App catalog for Aspera Dock.
 * Users add instances from this list (max 3 of the same app).
 * The entire app bar can sit on Top or Left — not per-app.
 */

export const MAX_INSTANCES_PER_APP = 3;
export const MAX_WARM_VIEWS_DEFAULT = 3;

/** @typedef {{
 *   appId: string,
 *   name: string,
 *   title: string,
 *   url: string,
 *   color: string,
 *   logo: string,
 *   keepWarm?: boolean,
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
    keepWarm: true,
  },
  {
    appId: 'arattai',
    name: 'Arattai',
    title: 'Arattai',
    url: 'https://web.arattai.in',
    color: '#F5A623',
    logo: 'arattai',
    keepWarm: true,
  },
  {
    appId: 'telegram',
    name: 'Telegram',
    title: 'Telegram',
    url: 'https://web.telegram.org/k/',
    color: '#26A5E4',
    logo: 'telegram',
  },
  {
    appId: 'gmessages',
    name: 'Messages',
    title: 'Google Messages',
    url: 'https://messages.google.com/web',
    color: '#1A73E8',
    logo: 'messages',
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
    url: 'https://one.zoho.com',
    color: '#226DB4',
    logo: 'zoho-one',
  },
];

export function getAppCatalogEntry(appId) {
  return APP_CATALOG.find((a) => a.appId === appId) || null;
}

/** Short label for an instance, e.g. WhatsApp → WA 1 */
export function defaultInstanceName(entry, index) {
  const short = {
    whatsapp: 'WA',
    arattai: 'Arattai',
    telegram: 'Telegram',
    gmessages: 'Messages',
    gmail: 'Gmail',
    'zoho-mail': 'ZMail',
    'zoho-crm': 'CRM',
    'zoho-books': 'Books',
    'zoho-one': 'Zoho One',
  }[entry.appId] || entry.name;

  if (index <= 1) return short;
  return `${short} ${index}`;
}

export function defaultInstanceTitle(entry, index) {
  if (index <= 1) return entry.title;
  return `${entry.title} ${index}`;
}

/** Layout chrome sizes (px) — must match CSS */
export const TOP_APP_BAR = 54;
export const TOP_APP_BAR_NORMAL = 50;
export const TOP_APP_BAR_COMPACT = 46;
export const TOP_APP_BAR_NO_LABEL = 48;
export const LEFT_APP_BAR = 84;
export const LEFT_APP_BAR_NORMAL = 76;
export const LEFT_APP_BAR_COMPACT = 68;
export const LEFT_APP_BAR_NO_LABEL = 58;
export const TOOL_STRIP = 54;

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
  'telegram.org',
  'telegram.me',
  'accounts.youtube.com',
];

export function getChromeMetrics(settings) {
  const density = settings.density || 'comfortable';
  const hide = settings.hideAppLabels;
  const side = settings.appsPosition === 'left' || settings.appsPosition === 'right';

  if (side) {
    let apps = LEFT_APP_BAR;
    if (hide) apps = LEFT_APP_BAR_NO_LABEL;
    else if (density === 'compact') apps = LEFT_APP_BAR_COMPACT;
    else if (density === 'normal') apps = LEFT_APP_BAR_NORMAL;
    const onLeft = settings.appsPosition === 'left';
    return {
      top: TOOL_STRIP,
      left: onLeft ? apps : 0,
      right: onLeft ? 0 : apps,
      appsWidth: apps,
      appsHeight: TOOL_STRIP,
    };
  }

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
