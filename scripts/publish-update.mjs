#!/usr/bin/env node
/**
 * Publish Aspera Hub updates to GitHub Releases (no server required).
 *
 * From your laptop:
 *   1. Bump version in package.json
 *   2. npm run make
 *   3. npm run publish:update
 *      (or: npm run deploy  — make + publish in one step)
 *
 * In CI: set GH_TOKEN / GITHUB_TOKEN (Actions provides this automatically).
 *
 * Clients fetch:
 *   https://github.com/ramchandragada/AsperaDock/releases/latest/download/latest.json
 *
 * Publish flow (avoids update 404 races):
 *   draft release → upload .deb → upload latest.json → verify downloads → publish
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const GITHUB_SLUG = process.env.GITHUB_REPOSITORY || 'ramchandragada/AsperaDock';

function arg(name, fallback = '') {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  // npm often strips shell quotes — join tokens until the next flag.
  const parts = [];
  for (let j = i + 1; j < process.argv.length; j += 1) {
    if (String(process.argv[j]).startsWith('--')) break;
    parts.push(process.argv[j]);
  }
  return parts.length ? parts.join(' ') : next;
}

const channel = String(arg('channel', 'stable'));
const notes = String(arg('notes', `Aspera Hub ${pkg.version}`));
const mandatory = arg('mandatory', false) === true;
const dryRun = arg('dry-run', false) === true;
const skipGithub = arg('no-github', false) === true;
const customBase = String(arg('base-url', '')).replace(/\/+$/, '');

const version = pkg.version;
const tag = channel === 'stable' ? `v${version}` : channel;
const isPrerelease = channel !== 'stable';

const makeDir = path.join(root, 'out', 'make');
if (!fs.existsSync(makeDir)) {
  console.error(`No build output at ${makeDir}. Run "npm run make" first.`);
  process.exit(1);
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function hasGhAuth() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return true;
  const ghCheck = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return ghCheck.status === 0;
}

function ghPipe(args) {
  return spawnSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function urlReachable(url, { attempts = 10 } = {}) {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          Accept: 'application/octet-stream,*/*',
          'User-Agent': 'AsperaHub-Publish-Verify',
          'Cache-Control': 'no-cache',
        },
      });
      lastStatus = res.status;
      if (res.ok) return true;
    } catch {
      lastStatus = 0;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  console.error(`Verify failed for ${url} (last HTTP ${lastStatus || 'error'})`);
  return false;
}

/** Draft releases are not publicly downloadable — confirm assets via API instead. */
function assertDraftAssetsPresent(expectedNames) {
  const view = ghPipe([
    'release',
    'view',
    tag,
    '--repo',
    GITHUB_SLUG,
    '--json',
    'isDraft,assets',
  ]);
  if (view.status !== 0) {
    console.error(view.stderr || 'Could not read draft release assets');
    return false;
  }
  let data;
  try {
    data = JSON.parse(view.stdout || '{}');
  } catch {
    console.error('Could not parse release view JSON');
    return false;
  }
  const have = new Set(
    (Array.isArray(data.assets) ? data.assets : []).map((a) => String(a?.name || '')),
  );
  const missing = expectedNames.filter((n) => !have.has(n));
  if (missing.length) {
    console.error(`Draft release missing assets: ${missing.join(', ')}`);
    return false;
  }
  console.log(`✓ draft assets present: ${expectedNames.join(', ')}`);
  return true;
}

const artifacts = walk(makeDir).filter((f) => /\.(AppImage|deb|rpm)$/i.test(f));
if (!artifacts.length) {
  console.error('No .AppImage/.deb/.rpm artifacts found under out/make.');
  process.exit(1);
}

const publishDir = path.join(root, 'out', 'publish');
fs.mkdirSync(publishDir, { recursive: true });

const releaseBase =
  customBase ||
  `https://github.com/${GITHUB_SLUG}/releases/download/${encodeURIComponent(tag)}`;

const files = {};
const uploadPaths = [];

for (const artifact of artifacts) {
  const name = path.basename(artifact);
  const ext = path.extname(artifact).toLowerCase().replace('.', '');
  const kind = ext === 'appimage' ? 'appimage' : ext;
  const dest = path.join(publishDir, name);
  fs.copyFileSync(artifact, dest);
  files[kind] = {
    url: `${releaseBase}/${encodeURIComponent(name)}`,
    sha256: sha256(dest),
    size: fs.statSync(dest).size,
  };
  uploadPaths.push(dest);
  console.log(`+ ${kind}: ${name} (${files[kind].sha256.slice(0, 12)}…)`);
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  mandatory,
  channel,
  files,
};

const manifestName = channel === 'stable' ? 'latest.json' : `${channel}.json`;
const manifestPath = path.join(publishDir, manifestName);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
uploadPaths.push(manifestPath);

console.log(`\nWrote ${path.relative(root, manifestPath)} for v${version} (${channel}).`);

if (skipGithub || dryRun) {
  console.log(dryRun ? 'Dry run — not uploading.' : 'Skipped GitHub upload (--no-github).');
  console.log(`Upload these files to a release tagged ${tag}:`);
  for (const p of uploadPaths) console.log(`  - ${p}`);
  process.exit(0);
}

if (!hasGhAuth()) {
  console.error('GitHub CLI not authenticated. Run: gh auth login');
  console.error('Or set GH_TOKEN / GITHUB_TOKEN for CI.');
  process.exit(1);
}

const title = `Aspera Hub ${version}`;
const notesBlock = String(notes || '').trim() || `Aspera Hub ${version}`;
const body = [
  "## What's new",
  notesBlock,
  '',
  '## Install',
  '- **Debian / Ubuntu / Mint:** download the `.deb` and install (or let Aspera Hub auto-update).',
  '',
  '_Electron runtime is bundled — users never update Electron separately._',
].join('\n');

const existing = ghPipe(['release', 'view', tag, '--repo', GITHUB_SLUG]);

// Upload the .deb/.AppImage first, then latest.json last so clients that
// race a publish never see a new manifest pointing at a missing artifact.
const manifestUploads = uploadPaths.filter((p) => /\.json$/i.test(p));
const artifactUploads = uploadPaths.filter((p) => !/\.json$/i.test(p));

function uploadClobber(paths) {
  if (!paths.length) return;
  run('gh', [
    'release',
    'upload',
    tag,
    ...paths,
    '--repo',
    GITHUB_SLUG,
    '--clobber',
  ]);
}

if (existing.status === 0) {
  console.log(`Release ${tag} already exists — uploading / replacing assets…`);
  // Keep it draft while replacing so /releases/latest cannot serve a half-ready set.
  run('gh', ['release', 'edit', tag, '--repo', GITHUB_SLUG, '--draft']);
  uploadClobber(artifactUploads);
  uploadClobber(manifestUploads);
} else {
  console.log(`Creating draft GitHub release ${tag}…`);
  // Create as draft with artifacts only; attach manifest after, then publish.
  const createArgs = [
    'release',
    'create',
    tag,
    ...artifactUploads,
    '--repo',
    GITHUB_SLUG,
    '--title',
    title,
    '--notes',
    body,
    '--draft',
  ];
  if (isPrerelease) createArgs.push('--prerelease');
  if (channel !== 'stable') createArgs.push('--target', 'HEAD');
  run('gh', createArgs);
  uploadClobber(manifestUploads);
}

const expectedAssetNames = [
  ...artifactUploads.map((p) => path.basename(p)),
  ...manifestUploads.map((p) => path.basename(p)),
];
if (!assertDraftAssetsPresent(expectedAssetNames)) {
  console.error('Leaving the release as a draft.');
  console.error(`Fix uploads, then: gh release edit ${tag} --draft=false --latest`);
  process.exit(1);
}

console.log(`Publishing release ${tag}…`);
run('gh', [
  'release',
  'edit',
  tag,
  '--repo',
  GITHUB_SLUG,
  '--draft=false',
  '--latest',
  '--title',
  title,
  '--notes',
  body,
]);

console.log('Verifying public download URLs…');
const verifyUrls = [
  ...Object.values(files).map((f) => f.url),
  `${releaseBase}/${encodeURIComponent(manifestName)}`,
];
for (const url of verifyUrls) {
  // eslint-disable-next-line no-await-in-loop
  const ok = await urlReachable(url);
  if (!ok) {
    console.error(
      'Published, but public download verify failed — check GitHub CDN lag / assets.',
    );
    console.error(`Release page: https://github.com/${GITHUB_SLUG}/releases/tag/${tag}`);
    process.exit(1);
  }
  console.log(`✓ ${url}`);
}

const latestUrl = `https://github.com/${GITHUB_SLUG}/releases/latest/download/${manifestName}`;
console.log(`\nDone. Clients will pick up the update from:`);
console.log(
  `  ${channel === 'stable' ? latestUrl : `https://github.com/${GITHUB_SLUG}/releases/download/${tag}/${manifestName}`}`,
);
console.log(`Release page: https://github.com/${GITHUB_SLUG}/releases/tag/${tag}`);
