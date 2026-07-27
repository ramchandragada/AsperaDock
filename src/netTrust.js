/** Shared HTTPS-only URL checks (updates, error endpoints). */
export function assertHttpsUrl(url, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must be HTTPS`);
  }
  return parsed;
}
