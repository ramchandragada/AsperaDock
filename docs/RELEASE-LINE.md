# Release line (live fleet)

**Ship only from `master` after the fix PR is merged.** Do not cut a GitHub release from an unmerged feature branch.

## Why

v0.5.54–v0.5.64 were often published from agent branches while `master` stayed behind. Later “latest” builds then dropped WorkDrive, the catalog × removal, and multi-CRM isolation.

## Required before every release

1. PR merged to `master` (not draft-only).
2. `git checkout master && git pull`
3. `npm test` — includes `test/liveFleetGuardrails.test.mjs`
4. Bump `package.json`, build `.deb`, verify in the package:
   - `zoho-workdrive` present
   - catalog close gated (`linkTab||isCustom`)
5. `gh release create` from that same commit on `master`

## Guardrails

- `test/liveFleetGuardrails.test.mjs`
- `test/catalogTabClose.test.mjs`
- `test/zohoWorkdriveCatalog.test.mjs`
- `test/sharedProfileTabs.test.mjs`
