#!/usr/bin/env node
/**
 * One-command ship from your laptop → all Aspera Hub users via GitHub.
 *
 *   npm run deploy -- --notes "What changed"
 *
 * Steps: make packages → publish release (artifacts + latest.json) with gh.
 * Bump package.json "version" before running.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function run(cmd, args) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

const passthrough = process.argv.slice(2);
console.log(`Deploying Aspera Hub v${pkg.version} to GitHub Releases…`);
run('npm', ['run', 'make']);
run('node', ['scripts/publish-update.mjs', ...passthrough]);
console.log('\nAll company PCs will auto-update on next check (or Help → Check for updates).');
