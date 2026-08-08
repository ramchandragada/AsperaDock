/**
 * About Aspera Hub — shared copy for the in-app About dialog.
 */

/** Product website (display + openExternal). */
export const ASPERA_HUB_WEBSITE = 'https://asperahub.com';
export const ASPERA_HUB_WEBSITE_HOST = 'asperahub.com';

/** Early supporters listed in About (alphabetical by given name). Cap: 25. */
export const EARLY_CONTRIBUTORS = [
  'Amar Vallakati',
  'Diksha Garade',
  'Tarun Pandal',
];

export const EARLY_CONTRIBUTORS_MAX = 25;

/**
 * Sorted unique contributor names (alphabetical).
 * @param {string[]} [names]
 */
export function sortedContributors(names = EARLY_CONTRIBUTORS) {
  return [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }),
  );
}

export function aboutDetailText({
  electronVersion = '',
  chromeVersion = '',
  contributors = EARLY_CONTRIBUTORS,
} = {}) {
  const runtime = [
    electronVersion ? `Electron ${electronVersion}` : '',
    chromeVersion ? `Chrome ${chromeVersion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const people = sortedContributors(contributors);
  const contributorsBlock =
    people.length === 0
      ? ''
      : [
          '',
          'Early contributors (alphabetical order):',
          ...people.map((name) => `• ${name}`),
        ].join('\n');

  return [
    'Built with years of research and hard-won experience by Aspera Technologies Pte Ltd — crafted with Cursor AI on Linux.',
    '',
    'Long live Linux. Long live Linus Torvalds.',
    '',
    'Aspera Hub is open source and always free: use it, modify it, share it. 100% free, forever.',
    '',
    `Website: ${ASPERA_HUB_WEBSITE}`,
    contributorsBlock,
    runtime ? `\n${runtime}` : '',
  ]
    .join('\n')
    .trim();
}
