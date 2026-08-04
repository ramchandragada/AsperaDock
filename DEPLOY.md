# Ship Aspera Hub (no private server required)

Recommended stack:

| Job | Service |
|-----|---------|
| Source + future changes | **GitHub** (push to `master`) |
| App updates (+ Electron) | **GitHub Releases** (via Actions) |
| Crash / freeze reports | **Sentry** (`zarpat/asperadock`) |

## Public repository required for auto-update

Office PCs fetch updates **without a GitHub token** from:

`https://github.com/ramchandragada/AsperaDock/releases/latest/download/latest.json`

That URL (and the `.deb` it points at) must be world-readable. Keep this repository **public**. If the repo is private, unauthenticated clients get HTTP **404** and show “Update check failed / Feed responded 404”.

Do **not** flip visibility back to private unless you first ship a different public feed URL into every installed Hub (manual `.deb` once per PC, or a new default feed + fleet reinstall).

## Continuous deploy

Every push to `master` / `main` that touches app code runs **Deploy Aspera Hub**:

1. Reads the version from **`package.json`** (no CI auto-bump — bump the version in the same commit as the change)
2. Builds the `.deb`
3. Publishes a GitHub Release with `latest.json` + the installer

`cursor/**` branches do **not** auto-deploy (local agent branches stay offline until merged).

Company PCs already running Aspera Hub download and install that release automatically.

You do **not** need to copy `.deb` files by hand after the first install.

### Version bumps

Before shipping user-facing changes, bump `package.json` `version` to the next patch (or minor/major if warranted) in the same commit. CI stamps the release from that value.

### First install on a PC

```bash
sudo apt install ./asperadock_X.Y.Z_amd64.deb
```

After that, updates arrive via the app itself (Help → Check for updates, or background check).

### Manual deploy (laptop)

```bash
gh auth login          # once
npm run deploy -- --notes "What changed"
```

Or trigger the workflow: GitHub → Actions → Deploy Aspera Hub → Run workflow.

## Local-only test builds

For Mint QA before a global ship: `npm run make` then `pkexec dpkg -i out/make/deb/x64/asperadock_*.deb`. Do not push/release until the office PC smoke test passes.

## Sentry

DSN is baked into the app. Crashes appear at:
https://zarpat.sentry.io/issues/?project=asperadock
