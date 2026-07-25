/** Default per-app settings (Rambox-style). */
export const DEFAULT_APP_CONFIG = {
  enabled: true,
  showNameInTab: true,
  allowSounds: true,
  allowNotifications: true,
  hideNotificationContent: false,
  displayUnreadInTab: true,
  includeUnreadInGlobal: true,
  /** 0 = use global hibernate setting */
  hibernateMinutes: 0,
  startHibernated: false,
  /** 0 = disabled — after hibernate, soft-wake in background after N minutes */
  autoWakeMinutes: 0,
  /** Per-app page zoom (0.5–2). */
  zoomFactor: 1,
  injectJs: '',
  injectCss: '',
  stylishUrl: '',
  userAgent: '',
  forceMobile: false,
  preventBasicAuth: false,
  /** null = use global */
  spellChecker: null,
  /** null = use global: block | external */
  linkHandling: null,
};

export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

export function mergeAppConfig(partial = {}) {
  return { ...DEFAULT_APP_CONFIG, ...partial };
}
