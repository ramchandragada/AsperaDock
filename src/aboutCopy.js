/**
 * About Aspera Hub — shared copy for the in-app About dialog.
 */

export function aboutDetailText({
  electronVersion = '',
  chromeVersion = '',
} = {}) {
  const runtime = [
    electronVersion ? `Electron ${electronVersion}` : '',
    chromeVersion ? `Chrome ${chromeVersion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return [
    'Built with years of research and hard-won experience by Aspera Technologies Pte Ltd — crafted with Cursor AI on Linux.',
    '',
    'Long live Linux. Long live Linus Torvalds.',
    '',
    'Aspera Hub is open source and always free: use it, modify it, share it. 100% free, forever.',
    runtime ? `\n${runtime}` : '',
  ]
    .join('\n')
    .trim();
}
