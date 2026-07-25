# Ship Aspera Dock (no private server required)

Recommended stack:

| Job | Service |
|-----|---------|
| Source + future changes | **GitHub** (push to `master`) |
| App updates (+ Electron) | **GitHub Releases** (auto via Actions) |
| Crash / freeze reports | **Sentry** (`zarpat/asperadock`) |

## Continuous deploy (no fragmentation)

Every push to `master` runs **Deploy Aspera Dock**:

1. Auto-bumps the patch version (`0.1.0` → `0.1.1` → …)
2. Builds the `.deb`
3. Publishes a GitHub Release with `latest.json` + the installer

Company PCs already running Aspera Dock download and install that release automatically.

You do **not** need to copy `.deb` files by hand after the first install.

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

Or trigger the workflow: GitHub → Actions → Deploy Aspera Dock → Run workflow.

## Sentry

DSN is baked into the app. Crashes appear at:
https://zarpat.sentry.io/issues/?project=asperadock
