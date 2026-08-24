# Hard gate for Aspera Hub releases (live company fleet)

## Non‑negotiable

**Never publish a GitHub Release from an unmerged feature branch.**

`master` is the only release line. Draft PRs are not shipped.

## Why

v0.5.54–v0.5.64 were often tagged from agent branches while `master` stayed behind.
Later “latest” builds then **silently dropped** WorkDrive, the catalog × removal,
and multi-CRM isolation — flooding support and interrupting work.

## How releases must ship

### Preferred (automatic)

1. Open PR → merge to **`master`**
2. Push to `master` runs **Deploy Aspera Hub** (`.github/workflows/deploy.yml`)
3. That workflow builds the `.deb` and publishes via `scripts/publish-update.mjs`
4. `publish-update` runs **`scripts/assert-release-from-master.mjs`** first

### Manual (laptop / agent)

```bash
git checkout master && git pull origin master
npm run release:check          # fails if not on master / guardrails fail
npm run make
npm run publish:update         # also re-runs the master gate
```

Do **not** run bare `gh release create` from a feature branch.

## Safety nets

| Gate | What it does |
|------|----------------|
| `npm run release:check` | Branch must be master; HEAD on `origin/master`; fleet tests pass |
| `scripts/publish-update.mjs` | Calls the same gate before uploading |
| `.github/workflows/release-guard.yml` | If a release is published off-master, it is **forced back to draft** and CI fails |
| `test/liveFleetGuardrails.test.mjs` | Fails if WorkDrive / catalog × / multi-CRM regress |

Emergency bypass only: `ASPERA_ALLOW_NON_MASTER_RELEASE=1` (logged; do not use for fleet).

## Required before every release

1. PR **merged** to `master` (not draft-only)
2. `git checkout master && git pull`
3. `npm run release:check`
4. Build `.deb` and confirm in package when practical: WorkDrive present, no catalog ×
5. Publish via Deploy workflow or `npm run publish:update` — **not** ad-hoc `gh release create` from a feature branch

## Guardrail tests

- `test/liveFleetGuardrails.test.mjs`
- `test/catalogTabClose.test.mjs`
- `test/zohoWorkdriveCatalog.test.mjs`
- `test/sharedProfileTabs.test.mjs`
