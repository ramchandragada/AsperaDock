/** Toolbar line icons (Lucide-style, stroked with currentColor). */
const GLYPHS = {
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.4-4.4"/>',
  focus: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  unmute:
    '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  ram: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>',
  reload:
    '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3.5V9h-5.5"/><path d="M3 20.5V15h5.5"/>',
  bell: '<path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5Z"/><path d="M10.3 20.5a2 2 0 0 0 3.4 0"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  folder:
    '<path d="M3 7.5A2 2 0 0 1 5 5.5h3.6l1.8 2.2H19a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  download:
    '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  back: '<path d="M15 18 9 12l6-6"/>',
  forward: '<path d="m9 18 6-6-6-6"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-5h4v5h5V10"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z"/>',
  flame:
    '<path d="M12 22c4.4 0 7-3 7-6.8 0-3.2-1.8-5.7-4.7-8.2.1 2.4-1.1 3.8-2.2 4.5.1-3.8-2-6.6-4.3-8.5.2 3.1-2.8 5.5-2.8 9.4C5 17.8 8 22 12 22Z"/><path d="M9.5 18.5c0-1.8 1.1-3.1 2.6-4.4.1 1.4.8 2.1 1.5 2.7.5.4.9 1 .9 1.7 0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5Z"/>',
  speaker: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3.5V9h-5.5"/><path d="M3 20.5V15h5.5"/>',
  keyboard:
    '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h4M16 14h.01M18 14h.01"/>',
  menu: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
  'layout-top':
    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18"/>',
  'layout-left':
    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 4v16"/>',
  'layout-right':
    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M14.5 4v16"/>',
};

export const ICONS = Object.fromEntries(
  Object.entries(GLYPHS).map(([name, glyph]) => [name, iconSvg(glyph)]),
);

function iconSvg(glyph) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg>`;
}

export function icon(name) {
  return ICONS[name] || '';
}
