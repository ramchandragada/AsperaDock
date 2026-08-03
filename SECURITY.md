# Aspera Hub security

Threat model: company desktop dock embedding third-party web apps. Trust the dock shell; treat guest pages as untrusted.

## Hardening in force

- **IPC:** all `dock:*` channels via `dockHandle` → sender must be the shell `webContents`.
- **Guests:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- **Lock:** scrypt (`scrypt$salt$hash`); legacy SHA-256 accepted until unlock upgrades.
- **Updates:** HTTPS feed + HTTPS artifacts; SHA-256 required on download, cache reuse, and install.
- **openExternal:** only `http:`, `https:`, `mailto:` via `openExternalSafe` (no raw `shell.openExternal`).
- **Settings IPC:** allowlisted keys; `allowPageInjection` / `allowGuestDevTools` / vendor kill switches blocked unless `ASPERADOCK_ADMIN=1`.
- **Page injection:** runtime requires **both** `allowPageInjection: true` in settings **and** `ASPERADOCK_ADMIN=1`. Editing `settings.json` alone is not enough. Stylish URLs must be HTTPS.
- **Guest navigation:** fail-closed; block `file:`, `javascript:`, and other non-web schemes.
- **Fuses:** `RunAsNode` off, cookie encryption on, asar integrity + OnlyLoadAppFromAsar on, **GrantFileProtocolExtraPrivileges off** (chrome via `asperadock://`).
- **Root:** packaged start as root is refused.
- **userData / updates:** directory mode `0700` best-effort.

## Secrets

GitHub tokens and Sentry DSN are redacted in renderer state (`[configured]`). Saving that placeholder must not overwrite the real value.

## Vendor quarantine

Google UA spoof and Zoho reclaim live under `src/vendors/`. Disable via settings if a vendor change breaks login:

```json
{
  "googleSpoofEnabled": false,
  "zohoReclaimEnabled": false
}
```

## Reporting

Local JSON under `userData/error-reports/`. Optional Sentry DSN / GitHub Issues.
