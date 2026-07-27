/**
 * Zoho vendor quarantine.
 *
 * WHY: Shared Zoho SSO often dumps Mail tabs onto Cliq/Meeting/One. We reclaim
 * the catalog home URL when the loaded host is clearly the wrong product.
 *
 * Kill switch: settings.zohoReclaimEnabled === false.
 */
import { logBreadcrumb } from '../errorReporter.js';
import { isAuthOrLoginUrl, isUrlForService } from '../guestNav.js';

const reclaimInFlight = new Set();
const reclaimNoted = new Set();

export function isZohoService(service) {
  if (!service) return false;
  const id = String(service.appId || '');
  if (id.startsWith('zoho')) return true;
  try {
    const host = new URL(service.url).hostname.toLowerCase();
    return host.includes('zoho.');
  } catch {
    return false;
  }
}

/**
 * If the guest landed on the wrong Zoho product, navigate home once.
 * @returns {boolean} whether a reclaim was started
 */
export function reclaimServiceHomeIfWrongProduct(webContents, service, url, { enabled = true } = {}) {
  if (!enabled || !webContents || webContents.isDestroyed() || !service) return false;
  if (!url || isAuthOrLoginUrl(url)) return false;
  if (!isZohoService(service)) return false;
  // Zoho One is a multi-app portal — never force-navigate away from in-portal pages.
  if (service.appId === 'zoho-one') return false;
  if (isUrlForService(service, url)) return false;
  if (reclaimInFlight.has(service.id)) return false;

  let home = service.url;
  try {
    home = new URL(service.url).toString();
  } catch {
    // keep
  }

  reclaimInFlight.add(service.id);
  if (!reclaimNoted.has(service.id)) {
    reclaimNoted.add(service.id);
    logBreadcrumb('zoho-reclaim-wrong-product', {
      serviceId: service.id,
      from: String(url || '').slice(0, 200),
      to: String(home).slice(0, 200),
    });
  }

  webContents
    .loadURL(home)
    .catch(() => {})
    .finally(() => {
      setTimeout(() => reclaimInFlight.delete(service.id), 1500);
    });
  return true;
}
