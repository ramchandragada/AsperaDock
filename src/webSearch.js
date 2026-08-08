/**
 * Resolve typed Web-search input to a URL.
 * Plain text → Google Search. http(s) URLs open as-is.
 */
export function resolveWebSearchInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

/** Short Hub tab label from the typed query (or "Google"). */
export function webSearchTabName(raw) {
  const text = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!text || /^https?:\/\//i.test(text)) return 'Google';
  return text.length > 18 ? `${text.slice(0, 17)}…` : text;
}
