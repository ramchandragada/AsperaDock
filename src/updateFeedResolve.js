/**
 * Pure updater feed / version helpers (no Electron — unit-testable).
 */
import { GITHUB_UPDATE_FEED } from './github.js';

/** Compare semver-ish strings. Returns 1 if a>b, -1 if a<b, 0 equal. */
export function compareVersions(a, b) {
  const parse = (v) =>
    String(v || '0')
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

/**
 * Resolve the update manifest URL.
 * Unpublished beta channel on GitHub falls back to stable latest.json.
 */
export function resolveUpdateFeedUrl(cfg = {}, defaultFeed = GITHUB_UPDATE_FEED) {
  const channel = String(cfg.updateChannel || 'stable');
  const custom = String(cfg.updateFeedUrl || '').replace(/\/+$/, '');
  if (custom) {
    const file =
      channel && channel !== 'stable' ? `${channel}.json` : 'latest.json';
    return `${custom}/${file}`;
  }
  return `${defaultFeed}/latest.json`;
}
