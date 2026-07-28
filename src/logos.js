/**
 * Brand logos for the dock bar.
 * WhatsApp / Gmail: Simple Icons paths (CC0).
 * Zoho One / Zoho Mail / Zoho CRM / Arattai: official marks from assets.
 */

import arattaiImg from './assets/logos/arattai.png';
import zohoMailImg from './assets/logos/zoho-mail.png';
import zohoCrmImg from './assets/logos/zoho-crm.png';
import zohoOneImg from './assets/logos/zoho-one.png';

const PATHS = {
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  gmail:
    'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
};

function brandMark(id, hex) {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="${hex}" d="${PATHS[id]}"/>
</svg>`;
}

function solidTile(hex, inner) {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="24" height="24" rx="6" fill="${hex}"/>
  ${inner}
</svg>`;
}

function imgLogo(src) {
  return `<img class="app-logo-img" src="${src}" alt="" draggable="false" />`;
}

const ZOHO_GREEN = '#089949';
const CHATGPT_GREEN = '#10A37F';
const CLAUDE_ORANGE = '#D97706';

export const LOGOS = {
  whatsapp: brandMark('whatsapp', '#25D366'),

  gmail: solidTile(
    '#FFFFFF',
    `<path fill="#EA4335" d="${PATHS.gmail}" transform="translate(2.2 2.2) scale(0.8167)"/>`,
  ),

  arattai: imgLogo(arattaiImg),
  'zoho-mail': imgLogo(zohoMailImg),
  'zoho-crm': imgLogo(zohoCrmImg),
  'zoho-one': imgLogo(zohoOneImg),
  chatgpt: solidTile(
    CHATGPT_GREEN,
    `<path fill="#fff" d="M12 4.4a3 3 0 0 1 2.98 2.66A3 3 0 0 1 17.6 12a3 3 0 0 1-2.62 4.94A3 3 0 0 1 12 19.6a3 3 0 0 1-2.98-2.66A3 3 0 0 1 6.4 12a3 3 0 0 1 2.62-4.94A3 3 0 0 1 12 4.4Zm0 1.7a1.3 1.3 0 0 0-1.28 1.1l-.1.67-.66.12a1.3 1.3 0 0 0-.56 2.3l.52.44-.18.66a1.3 1.3 0 0 0 1.6 1.6l.66-.18.44.52a1.3 1.3 0 0 0 2.3-.56l.12-.66.67-.1a1.3 1.3 0 0 0 .55-2.3l-.52-.44.18-.66a1.3 1.3 0 0 0-1.6-1.6l-.66.18-.44-.52A1.3 1.3 0 0 0 12 6.1Z"/>`,
  ),
  claude: solidTile(
    CLAUDE_ORANGE,
    `<path fill="#fff" d="M7.2 6.2h9.6a2.2 2.2 0 0 1 2.2 2.2v7.2a2.2 2.2 0 0 1-2.2 2.2H7.2A2.2 2.2 0 0 1 5 15.6V8.4a2.2 2.2 0 0 1 2.2-2.2Zm0 1.8a.4.4 0 0 0-.4.4v7.2c0 .22.18.4.4.4h9.6c.22 0 .4-.18.4-.4V8.4a.4.4 0 0 0-.4-.4H7.2Zm2.3 2.1h1.7l1.1 1.8 1.1-1.8H15l-2 3 2 3h-1.7l-1.1-1.8-1.1 1.8H9.4l2-3-1.9-3Z"/>`,
  ),

  'zoho-books': solidTile(
    ZOHO_GREEN,
    `<rect x="4.5" y="3.5" width="15" height="17" rx="2" fill="#fff"/>
    <rect x="7.2" y="7" width="9.6" height="1.7" rx=".7" fill="${ZOHO_GREEN}"/>
    <rect x="7.2" y="11" width="9.6" height="1.7" rx=".7" fill="${ZOHO_GREEN}"/>
    <rect x="7.2" y="15" width="5.5" height="1.7" rx=".7" fill="${ZOHO_GREEN}"/>`,
  ),

  custom: solidTile(
    '#3D5A80',
    `<circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff" stroke-width="1.6"/>
    <ellipse cx="12" cy="12" rx="3.2" ry="7.5" fill="none" stroke="#fff" stroke-width="1.4"/>
    <path fill="none" stroke="#fff" stroke-width="1.4" d="M4.5 12h15M12 4.5c2.2 2.4 2.2 12.6 0 15M12 4.5c-2.2 2.4-2.2 12.6 0 15"/>`,
  ),

  mail: solidTile(
    '#5F6368',
    `<rect x="3" y="5.5" width="18" height="13" rx="2" fill="#fff"/>
    <path fill="#5F6368" d="M4 7.2h16L12 13.1z"/>`,
  ),
};

export function logoHtml(logoId, fallbackLetter = '?', color = '#4f8cff') {
  const svg = LOGOS[logoId];
  if (svg) return svg.trim();
  return `<span class="app-icon-fallback" style="background:${color}">${fallbackLetter}</span>`;
}
