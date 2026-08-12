/**
 * Known Chrome Web Store public keys so Electron keeps stable extension IDs
 * without blocking on a CRX re-download (needed for OAuth redirect_uri).
 */
export const KNOWN_EXTENSION_PUBLIC_KEYS = {
  // Grammarly: AI Writing Assistant
  kbfnbcaeplbcioakkpcpgfkobkghlhen:
    'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXGarzPXVb5UpkDTsw4cdApsrQvPTNTMXdz/7j9QVuQZoPm5R9l3o9ppfGYeae7sZRaJiueBEO/LA8s7KCuE9icPl72xSqdei3Jo0PTTUlmNQIysl9PZy6Xd520sS5wNFhPaxOy1ApHZ6+o+yMEXWmjx2fX0tHJd7dKTii47MTnQIDAQAB',
};

export function knownPublicKeyForChromeId(chromeId) {
  const id = String(chromeId || '').trim().toLowerCase();
  return KNOWN_EXTENSION_PUBLIC_KEYS[id] || '';
}
