/**
 * Local Aspera Notes — copy pad for links and repeated text.
 * Stored on this PC only. Hub never sends for you.
 */

export const NOTES_MAX = 80;
export const NOTE_TITLE_MAX = 80;
export const NOTE_BODY_MAX = 20_000;

export function makeNoteId() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_TITLE_MAX);
}

function trimBody(value) {
  return String(value || '').slice(0, NOTE_BODY_MAX);
}

export function sanitizeNote(raw, { fallbackId } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = trimTitle(raw.title);
  const body = trimBody(raw.body);
  if (!title && !body.trim()) return null;
  const id = String(raw.id || fallbackId || '').trim() || makeNoteId();
  const updatedAt = Number(raw.updatedAt);
  return {
    id,
    title,
    body,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  };
}

export function sanitizeNotes(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const note = sanitizeNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out.slice(0, NOTES_MAX);
}

export function upsertNote(list, payload) {
  const current = sanitizeNotes(list);
  const incoming = sanitizeNote(payload, { fallbackId: payload?.id });
  if (!incoming) {
    return { ok: false, error: 'Type a title or some text first.', notes: current };
  }
  incoming.updatedAt = Date.now();
  const rest = current.filter((n) => n.id !== incoming.id);
  const notes = sanitizeNotes([incoming, ...rest]);
  return { ok: true, note: incoming, notes };
}

export function deleteNote(list, id) {
  const want = String(id || '').trim();
  const notes = sanitizeNotes(list).filter((n) => n.id !== want);
  return { ok: true, notes };
}

/** Text placed on the clipboard — body first, else title. */
export function noteCopyText(note, { includeTitle = false } = {}) {
  const title = String(note?.title || '').trim();
  const body = String(note?.body || '').trim();
  if (includeTitle && title && body) return `${title}\n${body}`;
  return body || title;
}
