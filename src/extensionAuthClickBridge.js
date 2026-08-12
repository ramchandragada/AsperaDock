/** Backup click bridge injected into guest pages when extensions are enabled. */
export const EXTENSION_AUTH_CLICK_BRIDGE_JS = String.raw`(() => {
  if (window.__asperaExtAuthClickBridge) return;
  window.__asperaExtAuthClickBridge = true;
  const authRe = /^(https?:\\/\\/)?(account\\.)?grammarly\\.com/i;
  document.addEventListener('click', (event) => {
    try {
      for (const node of event.composedPath()) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLAnchorElement && node.href && authRe.test(node.href)) {
          event.stopImmediatePropagation();
          event.preventDefault();
          window.open(node.href, '_blank', 'noopener,noreferrer');
          return;
        }
        const part = node.getAttribute && node.getAttribute('data-grammarly-part');
        if (part === 'sign-in-button' || part === 'login-reminder-popup-sign-in-button') {
          const anchor = node.closest('a[href]');
          if (anchor && anchor.href && authRe.test(anchor.href)) {
            event.stopImmediatePropagation();
            event.preventDefault();
            window.open(anchor.href, '_blank', 'noopener,noreferrer');
            return;
          }
        }
      }
    } catch (_) {}
  }, true);
})();`;
