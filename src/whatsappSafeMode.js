/**
 * WhatsApp Safe Mode — reduce ToS / ban risk by disabling Hub automation
 * that instruments WhatsApp Web (Store, CDP, scrape, auto-send, page patches).
 *
 * Multiple WhatsApp tabs are allowed when each uses a separate profile and
 * a separate phone number / account (human-driven web.whatsapp.com).
 *
 * Arattai and other apps are unaffected. Not a Meta certification — a product
 * posture that keeps WhatsApp as a human-driven web.whatsapp.com tab.
 */

export const WHATSAPP_APP_ID = 'whatsapp';

/** Default ON for safer office installs. */
export function isWhatsAppSafeMode(settings) {
  return !settings || settings.whatsappSafeMode !== false;
}

export function isWhatsAppAppId(appId) {
  return String(appId || '') === WHATSAPP_APP_ID;
}

/** True when Hub must not automate / scrape / patch this guest. */
export function whatsappAutomationBlocked(settings, appId) {
  return isWhatsAppSafeMode(settings) && isWhatsAppAppId(appId);
}

export function whatsappSafeModeBlockedMessage(action = 'this action') {
  return (
    `WhatsApp Safe Mode is on — ${action} is disabled. ` +
    'Turn it off in Settings → Security if you accept the ban risk.'
  );
}
