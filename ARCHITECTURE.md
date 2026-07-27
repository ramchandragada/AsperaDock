# Aspera Hub architecture

Company multi-app Electron workspace (WhatsApp, Arattai, Gmail, Zoho) on Linux.

## Runtime shape

```
BrowserWindow (dock chrome)
  └─ asperadock://ui  →  Vite renderer (tabs, settings, lock UI)
WebContentsView guests (one per warm/active app)
  └─ persist: partitions (profiles)
IPC: dockHandle + assertShellSender (shell only)
```

Chrome is **not** loaded via `file://`. Packaged UI uses the `asperadock://` custom protocol so Electron fuses can keep `GrantFileProtocolExtraPrivileges` **off**.

## Main-process modules

| Module | Role |
|--------|------|
| `main.js` | Boot, window lifecycle, IPC wiring, view orchestration |
| `guestNav.js` | URL allow/deny policy (pure, tested) |
| `vendors/google.js` | Gmail/Google spoof quarantine |
| `vendors/zoho.js` | Wrong-product reclaim quarantine |
| `chromeProtocol.js` | `asperadock://` handler |
| `safeShell.js` | `openExternal` scheme allowlist |
| `passwordCrypto.js` | scrypt lock hashes (pure, tested) |
| `updater.js` | Manifest + SHA-256 + elevated install |
| `store.js` | settings.json |
| `errorReporter.js` / `sentryMain.js` | crashes / freezes |

Vendor workarounds are **isolated** and kill-switchable (`googleSpoofEnabled`, `zohoReclaimEnabled`, default **on**). They are not in the Settings UI — edit `settings.json` or use `ASPERADOCK_ADMIN=1`.

## Performance / usability constraints

- Guests use `WebContentsView` with explicit bounds under the top bar (no full-window cover).
- Warm view cap + hibernate keep RAM bounded; messaging apps stay warm only when the user opts in.
- No CDP debugger for Google spoof (Linux flicker).
- Overlay attach/detach is no-op when unchanged (avoids paint thrash).

## Security snapshot

See [SECURITY.md](./SECURITY.md).
