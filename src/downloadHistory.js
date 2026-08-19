/**
 * Recent guest download history for the Chrome-like download shelf.
 * Persistence path is injected from the main process (Electron userData).
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_COMPLETED = 50;

/** @type {Map<string, object>} */
const active = new Map();
/** @type {object[]} */
let completed = [];
/** @type {string} */
let userDataDir = '';

export function configureDownloadHistory(userDataRoot) {
  userDataDir = String(userDataRoot || '').trim();
}

function historyPath() {
  const root = userDataDir || '.';
  return path.join(root, 'download-history.json');
}

export function initDownloadHistory(userDataRoot) {
  configureDownloadHistory(userDataRoot);
  try {
    const raw = fs.readFileSync(historyPath(), 'utf8');
    const parsed = JSON.parse(raw);
    completed = Array.isArray(parsed?.completed) ? parsed.completed : [];
    completed = completed
      .filter((entry) => entry && typeof entry === 'object' && entry.id && entry.name)
      .slice(0, MAX_COMPLETED);
  } catch {
    completed = [];
  }
}

function persistCompleted() {
  if (!userDataDir) return;
  try {
    fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      historyPath(),
      JSON.stringify({ completed: completed.slice(0, MAX_COMPLETED) }, null, 2),
      { mode: 0o600 },
    );
  } catch {
    // ignore — in-memory history still works this session
  }
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) {
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatRelativeTime(at) {
  const diff = Math.max(0, Date.now() - (Number(at) || 0));
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function normalizeName(name) {
  return String(name || 'download').trim() || 'download';
}

export function beginDownload(id, name, totalBytes = 0) {
  const key = String(id || '').trim();
  if (!key) return;
  active.set(key, {
    id: key,
    name: normalizeName(name),
    path: '',
    bytes: 0,
    totalBytes: Math.max(0, Number(totalBytes) || 0),
    receivedBytes: 0,
    at: Date.now(),
    state: 'progressing',
  });
}

export function updateDownload(id, receivedBytes = 0, totalBytes = 0) {
  const entry = active.get(String(id || ''));
  if (!entry) return;
  entry.receivedBytes = Math.max(0, Number(receivedBytes) || 0);
  if (totalBytes > 0) entry.totalBytes = totalBytes;
  entry.at = Date.now();
}

export function finishDownload(id, { filePath = '', name = '', bytes = 0, state = 'completed' } = {}) {
  const key = String(id || '').trim();
  const prev = active.get(key);
  active.delete(key);
  if (state !== 'completed') return null;

  const abs = String(filePath || '').trim();
  if (!abs) return null;

  let size = Math.max(0, Number(bytes) || 0);
  if (!size) {
    try {
      size = fs.statSync(abs).size;
    } catch {
      size = prev?.receivedBytes || 0;
    }
  }

  const entry = {
    id: key || `dl-${Date.now()}`,
    name: normalizeName(name || prev?.name || path.basename(abs)),
    path: abs,
    bytes: size,
    at: Date.now(),
    state: 'completed',
    exists: fs.existsSync(abs),
  };
  completed.unshift(entry);
  if (completed.length > MAX_COMPLETED) completed.length = MAX_COMPLETED;
  persistCompleted();
  return entry;
}

export function listDownloadsForUi() {
  const inProgress = [...active.values()]
    .sort((a, b) => b.at - a.at)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      path: '',
      bytes: entry.receivedBytes || 0,
      receivedBytes: entry.receivedBytes || 0,
      totalBytes: entry.totalBytes || 0,
      at: entry.at,
      state: entry.state,
      exists: true,
      progress:
        entry.totalBytes > 0
          ? Math.min(100, Math.round((entry.receivedBytes / entry.totalBytes) * 100))
          : null,
    }));

  const done = completed.map((entry) => ({
    id: entry.id,
    name: entry.name,
    path: entry.path,
    bytes: entry.bytes || 0,
    receivedBytes: entry.bytes || 0,
    totalBytes: entry.bytes || 0,
    at: entry.at,
    state: 'completed',
    exists: fs.existsSync(entry.path),
    progress: 100,
  }));

  return [...inProgress, ...done].slice(0, MAX_COMPLETED);
}

export function lookupDownload(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const activeEntry = active.get(key);
  if (activeEntry) {
    return {
      id: activeEntry.id,
      name: activeEntry.name,
      path: activeEntry.path,
      bytes: activeEntry.receivedBytes || 0,
      state: activeEntry.state,
    };
  }
  return completed.find((entry) => entry.id === key) || null;
}

export function clearCompletedHistory() {
  completed = [];
  persistCompleted();
}

/** Test helper — reset in-memory state. */
export function resetDownloadHistoryForTests() {
  active.clear();
  completed = [];
  userDataDir = '';
}
