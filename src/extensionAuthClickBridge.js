/** Backup click bridge injected into guest pages when extensions are enabled. */
export const EXTENSION_AUTH_CLICK_BRIDGE_JS = String.raw`(() => {
  if (window.__asperaExtAuthClickBridge) return;
  window.__asperaExtAuthClickBridge = true;
  const authRe = /^https?:\/\/([\w-]+\.)*grammarly\.com(\/|$)/i;
  const openAuth = (url) => {
    if (window.__asperaExtBridge?.tabsCreate) {
      window.__asperaExtBridge.tabsCreate({ url, active: true }).catch(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  document.addEventListener('click', (event) => {
    try {
      for (const node of event.composedPath()) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLAnchorElement && node.href && authRe.test(node.href)) {
          event.stopImmediatePropagation();
          event.preventDefault();
          openAuth(node.href);
          return;
        }
        const part = node.getAttribute && node.getAttribute('data-grammarly-part');
        if (part === 'sign-in-button' || part === 'login-reminder-popup-sign-in-button') {
          const anchor = node.closest('a[href]');
          if (anchor && anchor.href && authRe.test(anchor.href)) {
            event.stopImmediatePropagation();
            event.preventDefault();
            openAuth(anchor.href);
            return;
          }
        }
      }
    } catch (_) {}
  }, true);
})();`;
