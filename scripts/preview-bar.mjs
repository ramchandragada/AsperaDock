/**
 * Dev helper: build scripts/preview-bar.html — empty dock chrome with catalog logos.
 */
import { writeFileSync } from 'node:fs';
import { LOGOS } from '../src/logos.js';
import { APP_CATALOG } from '../src/services.js';
import { ICONS } from '../src/icons.js';

const demos = APP_CATALOG.slice(0, 5).map((a, i) => ({
  ...a,
  name: a.appId === 'whatsapp' ? 'WA' : a.name,
  id: a.appId,
  active: i === 0,
  unread: i === 0 ? 3 : 0,
}));

const tab = (s) => {
  const badge = s.unread
    ? `<span class="app-badge">${s.unread}</span>`
    : '';
  return `<button class="app-tab ${s.active ? 'active' : ''}">
    <span class="app-icon has-logo">${LOGOS[s.logo] || ''}</span>
    <span class="app-label">${s.name}</span>${badge}
  </button>`;
};

const actions = [
  ['search', 'Search'],
  ['focus', 'Focus'],
  ['mute', 'Mute'],
  ['ram', 'Free RAM'],
  ['reload', 'Reload'],
  ['bell', 'Unread'],
  ['settings', 'Settings'],
]
  .map(
    ([iconName, title]) =>
      `<button class="icon-btn ${iconName === 'bell' ? 'badge-host' : ''}" title="${title}">${ICONS[iconName]}${iconName === 'bell' ? '<span class="global-badge">3</span>' : ''}</button>`,
  )
  .join('');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="../src/index.css">
<style>body{zoom:${process.env.ZOOM || 1}}</style></head>
<body class="theme-light layout-top density-comfortable">
  <div class="shell">
    <header class="app-bar app-bar-top">
      <nav class="apps-track">${demos.map(tab).join('')}</nav>
      <button class="icon-btn add-app-btn" title="Add app">${ICONS.plus}</button>
      <div class="chrome-actions">${actions}</div>
    </header>
    <div class="body-row"><main class="content-slot"></main></div>
  </div>
</body></html>`;

writeFileSync(new URL('./preview-bar.html', import.meta.url), html);
console.log('wrote scripts/preview-bar.html');
