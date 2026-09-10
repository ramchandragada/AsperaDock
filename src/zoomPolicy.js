/** Shared zoom clamp / label helpers for Hub page zoom. */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.1;

export function clampZoomFactor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
}

export function formatZoomPercent(factor) {
  const clamped = clampZoomFactor(factor);
  return `${Math.round(clamped * 100)}%`;
}

export function nextZoomFactor(current, { delta = 0, exact = null } = {}) {
  if (exact != null) return clampZoomFactor(exact);
  return clampZoomFactor(Number(current) + Number(delta));
}
