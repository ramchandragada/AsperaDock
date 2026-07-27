# Contributing to Aspera Dock

## Develop

```bash
npm install
npm start                 # Forge + Vite (may use --no-sandbox on Linux)
npm test                  # Fast pure unit tests (no Electron window)
npm run make              # Package .deb under out/make/
```

Install locally:

```bash
pkexec dpkg -i out/make/deb/x64/asperadock_<version>_amd64.deb
```

Fully quit the running app (including tray) before testing a new build.

## Version bump

Ship user-facing changes with a `package.json` version bump in the same commit (see `.cursor/rules/bump-version-on-change.mdc`). Mention the version in the commit message.

## Tests / CI

`npm test` runs `node --test test/**/*.mjs` — pure modules only (nav policy, password crypto, Google headers, HTTPS checks). Keep new pure logic out of Electron imports so CI stays fast and does not launch the UI.

## Architecture notes

Read [ARCHITECTURE.md](./ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md) before changing IPC, guests, updates, or fuses.

## Do not

- Run the packaged app as root.
- Re-enable `GrantFileProtocolExtraPrivileges` without a custom chrome protocol.
- Add guest `contextIsolation: false` preloads.
- Skip SHA-256 on update install paths.
