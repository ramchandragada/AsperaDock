/**
 * Brand logos for the dock bar.
 * WhatsApp / Telegram / Gmail / Messages: Simple Icons paths (CC0).
 * Zoho One / Zoho Mail / Zoho CRM / Arattai: official marks from assets.
 */

import arattaiImg from './assets/logos/arattai.png';
import zohoMailImg from './assets/logos/zoho-mail.png';
import zohoCrmImg from './assets/logos/zoho-crm.png';
import zohoOneImg from './assets/logos/zoho-one.png';

const PATHS = {
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  telegram:
    'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  gmail:
    'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
  messages:
    'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zM4.911 7.089h11.456a2.197 2.197 0 0 1 2.165 2.19v5.863a2.213 2.213 0 0 1-2.177 2.178H8.04c-1.174 0-2.04-.99-2.04-2.178v-4.639L4.503 7.905c-.31-.42-.05-.816.408-.816zm3.415 2.19c-.347 0-.68.21-.68.544 0 .334.333.544.68.544h7.905c.346 0 .68-.21.68-.544 0-.334-.334-.545-.68-.545zm0 2.177c-.347 0-.68.21-.68.544 0 .334.333.544.68.544h7.905c.346 0 .68-.21.68-.544 0-.334-.334-.544-.68-.544zm-.013 2.19c-.346 0-.68.21-.68.544 0 .334.334.544.68.544h5.728c.347 0 .68-.21.68-.544 0-.334-.333-.545-.68-.545z',
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

export const LOGOS = {
  whatsapp: brandMark('whatsapp', '#25D366'),
  telegram: brandMark('telegram', '#26A5E4'),
  messages: brandMark('messages', '#1A73E8'),

  gmail: solidTile(
    '#FFFFFF',
    `<path fill="#EA4335" d="${PATHS.gmail}" transform="translate(2.2 2.2) scale(0.8167)"/>`,
  ),

  arattai: imgLogo(arattaiImg),
  'zoho-mail': imgLogo(zohoMailImg),
  'zoho-crm': imgLogo(zohoCrmImg),
  'zoho-one': imgLogo(zohoOneImg),

  'zoho-books': solidTile(
    ZOHO_GREEN,
    `<rect x="4.5" y="3.5" width="15" height="17" rx="2" fill="#fff"/>
    <rect x="7.2" y="7" width="9.6" height="1.7" rx=".7" fill="${ZOHO_GREEN}"/>
    <rect x="7.2" y="11" width="9.6" height="1.7" rx=".7" fill="${ZOHO_GREEN}"/>
    <rect x="7.2" y="15" width="5.5" height="1.7" rx=".7" fill="${ZOHO_GREEN}"/>`,
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
