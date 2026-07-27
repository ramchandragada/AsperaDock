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
  const id = gradId('a');
  return `<svg class="aspera-mark" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}" x1="10" y1="56" x2="54" y2="10" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5A6EE6"/>
      <stop offset="1" stop-color="#A0AFFF"/>
    </linearGradient>
  </defs>
  <path fill="url(#${id})" d="M9.5 56.5 L29.6 10.5 H34.2 L18.8 56.5 Z"/>
  <path fill="url(#${id})" d="M54.5 56.5 L34.4 10.5 H29.8 L45.2 56.5 Z"/>
</svg>`;
}

export function asperaAppIconSvg(size = 24) {
  const id = gradId('icon');
  return `<svg class="aspera-app-icon" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}" x1="14" y1="48" x2="50" y2="16" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5A6EE6"/>
      <stop offset="1" stop-color="#A0AFFF"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#081230"/>
  <path fill="url(#${id})" d="M15.2 47.5 L29.4 18.2 H33.2 L21.5 47.5 Z"/>
  <path fill="url(#${id})" d="M48.8 47.5 L34.6 18.2 H30.8 L42.5 47.5 Z"/>
</svg>`;
}
