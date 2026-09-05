/** Zoho CRM data-center endpoints (accounts + APIs + CRM web UI). */

export const ZOHO_CRM_DCS = Object.freeze([
  {
    id: 'in',
    label: 'India',
    accountsUrl: 'https://accounts.zoho.in',
    apiDomain: 'https://www.zohoapis.in',
    crmHost: 'https://crm.zoho.in',
  },
  {
    id: 'com',
    label: 'United States',
    accountsUrl: 'https://accounts.zoho.com',
    apiDomain: 'https://www.zohoapis.com',
    crmHost: 'https://crm.zoho.com',
  },
  {
    id: 'eu',
    label: 'Europe',
    accountsUrl: 'https://accounts.zoho.eu',
    apiDomain: 'https://www.zohoapis.eu',
    crmHost: 'https://crm.zoho.eu',
  },
  {
    id: 'com.au',
    label: 'Australia',
    accountsUrl: 'https://accounts.zoho.com.au',
    apiDomain: 'https://www.zohoapis.com.au',
    crmHost: 'https://crm.zoho.com.au',
  },
  {
    id: 'jp',
    label: 'Japan',
    accountsUrl: 'https://accounts.zoho.jp',
    apiDomain: 'https://www.zohoapis.jp',
    crmHost: 'https://crm.zoho.jp',
  },
  {
    id: 'ca',
    label: 'Canada',
    accountsUrl: 'https://accounts.zohocloud.ca',
    apiDomain: 'https://www.zohoapis.ca',
    crmHost: 'https://crm.zohocloud.ca',
  },
]);

export const ZOHO_CRM_OAUTH_SCOPES =
  'ZohoCRM.modules.deals.READ,ZohoSearch.securesearch.READ';

export function resolveZohoCrmDc(dcId = 'in') {
  const id = String(dcId || 'in').trim().toLowerCase();
  return ZOHO_CRM_DCS.find((d) => d.id === id) || ZOHO_CRM_DCS[0];
}

export function sanitizeZohoCrmDc(dcId) {
  return resolveZohoCrmDc(dcId).id;
}
