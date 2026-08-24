#!/usr/bin/env node
/**
 * Hard gate: Aspera Hub releases may only ship from merged `master`.
 *
 * Prevents the live-fleet failure mode where agents published GitHub Releases
 * from feature branches while `master` stayed behind — later “latest” builds
 * then dropped WorkDrive, catalog × removal, multi-CRM isolation, etc.
 *
 * Usage:
 *   node scripts/assert-release-from-master.mjs
 *   npm run release:check
 *
 * Escape hatch (emergencies only — logged loudly):
 *   ASPERA_ALLOW_NON_MASTER_RELEASE=1
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`\n❌ RELEASE BLOCKED: ${message}\n`);
  console.error('Ship only from merged master. See docs/RELEASE-LINE.md');
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: root,
    ...opts,
  });
}

function gitOk(args) {
  const r = run('git', args);
  return r.status === 0 ? String(r.stdout || '').trim() : '';
}

const allowBypass = process.env.ASPERA_ALLOW_NON_MASTER_RELEASE === '1';
if (allowBypass) {
  console.warn(
    '⚠️  ASPERA_ALLOW_NON_MASTER_RELEASE=1 — skipping master gate (emergency only)',
  );
  process.exit(0);
}

// Prefer GitHub Actions context when present.
const ghRef = String(process.env.GITHUB_REF || '');
const ghRefName = String(process.env.GITHUB_REF_NAME || '');
const ghSha = String(process.env.GITHUB_SHA || '');
const eventName = String(process.env.GITHUB_EVENT_NAME || '');

const onMasterPush =
  (ghRef === 'refs/heads/master' || ghRef === 'refs/heads/main') &&
  (eventName === 'push' || eventName === 'workflow_dispatch');

if (ghRef && !onMasterPush && eventName === 'push') {
  fail(
    `GitHub ref is ${ghRef || '(empty)'} — releases must run on push to master/main`,
  );
}

// Local / agent path: branch must be master (or detached HEAD that is origin/master).
const branch = gitOk(['rev-parse', '--abbrev-ref', 'HEAD']);
const head = gitOk(['rev-parse', 'HEAD']);
if (!head) fail('Could not resolve git HEAD');

if (!onMasterPush) {
  if (branch && branch !== 'HEAD' && branch !== 'master' && branch !== 'main') {
    fail(
      `Current branch is "${branch}". Checkout merged master before releasing.\n` +
        `  git checkout master && git pull origin master`,
    );
  }
}

// Ensure we can see origin/master.
run('git', ['fetch', 'origin', 'master'], { stdio: 'ignore' });
const masterTip = gitOk(['rev-parse', 'origin/master']);
if (!masterTip) {
  // Fallback for repos that use main
  run('git', ['fetch', 'origin', 'main'], { stdio: 'ignore' });
}
const baseTip =
  gitOk(['rev-parse', 'origin/master']) || gitOk(['rev-parse', 'origin/main']);
if (!baseTip) fail('Could not resolve origin/master (or origin/main)');

const tip = ghSha || head;

// HEAD must be an ancestor of origin/master OR equal to it (already merged).
const isAncestor = run('git', ['merge-base', '--is-ancestor', tip, baseTip]);
const sameAsTip = tip === baseTip;
if (isAncestor.status !== 0 && !sameAsTip) {
  fail(
    `Commit ${tip.slice(0, 10)} is not on origin/master.\n` +
      `Merge the PR to master first, then release from that merge commit.\n` +
      `  origin/master = ${baseTip.slice(0, 10)}`,
  );
}

// Package version must look like a release version.
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(String(pkg.version || ''))) {
  fail(`package.json version must be x.y.z, got: ${pkg.version}`);
}

// Critical fleet guardrails (fast).
const tests = [
  'test/liveFleetGuardrails.test.mjs',
  'test/catalogTabClose.test.mjs',
  'test/zohoWorkdriveCatalog.test.mjs',
  'test/sharedProfileTabs.test.mjs',
].filter((f) => fs.existsSync(path.join(root, f)));

if (tests.length) {
  const t = run('node', ['--test', ...tests], { stdio: 'inherit' });
  if (t.status !== 0) {
    fail('Live-fleet guardrail tests failed — refusing to release');
  }
}

console.log(
  `✓ Release gate OK — ${tip.slice(0, 10)} is on master, v${pkg.version}, guardrails passed`,
);
