/** Sarvam REST sync limit — keep recordings short. */
export const VOICE_MAX_DURATION_SEC = 30;

export function normalizeAudioMime(mime) {
  const m = String(mime || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  if (
    m === 'audio/webm' ||
    m === 'audio/ogg' ||
    m === 'audio/wav' ||
    m === 'audio/x-wav' ||
    m === 'audio/mpeg' ||
    m === 'audio/mp4' ||
    m === 'audio/flac'
  ) {
    return m === 'audio/x-wav' ? 'audio/wav' : m;
  }
  return 'audio/webm';
}

export function audioFileExtension(mime) {
  const m = normalizeAudioMime(mime);
  if (m.includes('ogg')) return 'recording.ogg';
  if (m.includes('wav')) return 'recording.wav';
  if (m.includes('mpeg')) return 'recording.mp3';
  if (m.includes('mp4')) return 'recording.m4a';
  if (m.includes('flac')) return 'recording.flac';
  return 'recording.webm';
}
