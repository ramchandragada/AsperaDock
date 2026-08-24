/**
 * Aspera brand assets for the renderer.
 * App icon = stylized open "A" only (no wordmark).
 */
import wordmarkUrl from './assets/brand/aspera-wordmark.png';
import markUrl from './assets/brand/aspera-a.png';
import iconUrl from './assets/brand/icon.png';

export const BRAND = {
  name: 'Aspera',
  product: 'Aspera Hub',
  wordmarkUrl,
  markUrl,
  iconUrl,
};

let _gid = 0;
function gradId(prefix) {
  _gid += 1;
  return `${prefix}-${_gid}`;
}

/** Inline SVG of the open-A mark (crisp at any size). */
export function asperaMarkSvg(size = 24) {
  const left = gradId('aL');
  const right = gradId('aR');
  return `<svg class="aspera-mark" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${left}" x1="14" y1="10" x2="32" y2="54" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9AABFF"/><stop offset="1" stop-color="#6B7FE8"/>
    </linearGradient>
    <linearGradient id="${right}" x1="32" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B8C4FF"/><stop offset="1" stop-color="#8095FF"/>
    </linearGradient>
  </defs>
  <path fill="url(#${left})" d="M14 54 L28 10 H33 L22.5 54 Z"/>
  <path fill="url(#${right})" d="M50 54 L36 10 H31 L41.5 54 Z"/>
</svg>`;
}

export function asperaAppIconSvg(size = 24) {
  const left = gradId('iL');
  const right = gradId('iR');
  return `<svg class="aspera-app-icon" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${left}" x1="18" y1="14" x2="32" y2="50" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9AABFF"/><stop offset="1" stop-color="#6B7FE8"/>
    </linearGradient>
    <linearGradient id="${right}" x1="32" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B8C4FF"/><stop offset="1" stop-color="#8095FF"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#081230"/>
  <path fill="url(#${left})" d="M18 48 L29.1 17 H33.1 L24.6 48 Z"/>
  <path fill="url(#${right})" d="M46 48 L34.9 17 H30.9 L39.4 48 Z"/>
</svg>`;
}
