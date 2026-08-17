/**
 * Pure updater feed / version helpers (no Electron — unit-testable).
 */
import { GITHUB_UPDATE_FEED, GITHUB_SLUG } from './github.js';

/** @typedef {{ url: string, sha256?: string, size?: number }} UpdateArtifactMeta */

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

/**
 * Build an update manifest from a GitHub Releases API payload when latest.json
 * was not uploaded (common when a release is created with only a .deb attached).
 * SHA-256 is omitted — clients must hash the download before install.
 *
 * @param {object} release GitHub /releases/latest JSON
 * @returns {object|null}
 */
export function synthesizeManifestFromGithubRelease(release) {
  const version = String(release?.tag_name || '')
    .replace(/^v/, '')
    .trim();
  if (!version) return null;

  const assets = Array.isArray(release?.assets) ? release.assets : [];
  /** @type {Record<string, UpdateArtifactMeta>} */
  const files = {};

  for (const asset of assets) {
    const name = String(asset?.name || '');
    const url = String(asset?.browser_download_url || '').trim();
    if (!url) continue;
    const lower = name.toLowerCase();
    const meta = { url, size: Number(asset?.size) || 0 };
    if (lower.endsWith('.deb')) files.deb = meta;
    else if (lower.endsWith('.appimage')) files.appimage = meta;
    else if (lower.endsWith('.rpm')) files.rpm = meta;
  }

  if (!Object.keys(files).length) return null;

  return {
    version,
    notes: String(release?.body || '').trim() || `Aspera Hub ${version}`,
    pub_date: release?.published_at || new Date().toISOString(),
    mandatory: false,
    files,
    synthesized: true,
  };
}

/** Direct latest.json URL for a release tag (bypasses /releases/latest redirect). */
export function githubTaggedManifestUrl(tag) {
  const clean = String(tag || '')
    .replace(/^v/, '')
    .trim();
  if (!clean) return '';
  return `https://github.com/${GITHUB_SLUG}/releases/download/v${encodeURIComponent(clean)}/latest.json`;
}
