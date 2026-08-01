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
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
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

const existing = spawnSync('gh', ['release', 'view', tag, '--repo', GITHUB_SLUG], {
  encoding: 'utf8',
  stdio: 'pipe',
});

if (existing.status === 0) {
  console.log(`Release ${tag} already exists — uploading / replacing assets…`);
  run('gh', [
    'release',
    'upload',
    tag,
    ...uploadPaths,
    '--repo',
    GITHUB_SLUG,
    '--clobber',
  ]);
} else {
  console.log(`Creating GitHub release ${tag}…`);
  const createArgs = [
    'release',
    'create',
    tag,
    ...uploadPaths,
    '--repo',
    GITHUB_SLUG,
    '--title',
    title,
    '--notes',
    body,
  ];
  if (isPrerelease) createArgs.push('--prerelease');
  if (channel !== 'stable') createArgs.push('--target', 'HEAD');
  run('gh', createArgs);
}

const latestUrl = `https://github.com/${GITHUB_SLUG}/releases/latest/download/${manifestName}`;
console.log(`\nDone. Clients will pick up the update from:`);
console.log(
  `  ${channel === 'stable' ? latestUrl : `https://github.com/${GITHUB_SLUG}/releases/download/${tag}/${manifestName}`}`,
);
console.log(`Release page: https://github.com/${GITHUB_SLUG}/releases/tag/${tag}`);
