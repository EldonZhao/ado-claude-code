# Releasing

## Installing a Specific Version

```bash
# Latest (from main)
claude plugin add EldonZhao/ado-claude-code

# Specific release tag
claude plugin add EldonZhao/ado-claude-code@v1.2.0

# Specific release branch (latest patch on that minor)
claude plugin add EldonZhao/ado-claude-code@release/1.2
```

Version pinning works because each release tag has a `marketplace.json` with `source.ref` pointing to that exact tag. The `@ref` syntax tells Claude Code which git ref to check out.

## Branch Strategy

```
main                   (ongoing development)
  └── release/1.2      (stable, tags: v1.2.0, v1.2.1)
  └── release/1.3      (next release)
```

- **`main`** — active development; PRs validated by CI
- **`release/X.Y`** — stable release branches; each tag triggers a GitHub Release

## New Release

1. Merge features to `main` via PRs (CI validates automatically)
2. Create a `release/X.Y` branch from `main`:
   ```bash
   git checkout -b release/X.Y main
   ```
3. Bump version, install, and build:
   ```bash
   npm run version:bump -- X.Y.0
   npm install
   npm run build
   ```
4. Commit, tag, and push:
   ```bash
   git add -A
   git commit -m "chore: release vX.Y.0"
   git tag vX.Y.0
   git push -u origin release/X.Y --tags
   ```
5. GitHub Actions creates the Release with `dist/cli.js` as an asset
6. Merge the release branch back to `main` to keep `dist/cli.js` in sync:
   ```bash
   git checkout main
   git merge release/X.Y
   git push
   ```

## Hotfix

1. Check out the release branch and apply the fix:
   ```bash
   git checkout release/X.Y
   # ... make fix ...
   ```
2. Bump patch version, build, commit, tag, and push:
   ```bash
   npm run version:bump -- X.Y.Z
   npm install
   npm run build
   git add -A
   git commit -m "fix: description of hotfix"
   git tag vX.Y.Z
   git push --tags
   ```
3. Merge the fix back to `main`

## Version Sync

All three config files must stay in sync:

| File | Field |
|------|-------|
| `package.json` | `version` |
| `.claude-plugin/plugin.json` | `version` |
| `.claude-plugin/marketplace.json` | `plugins[0].version` |

The `npm run version:bump -- X.Y.Z` command updates all three at once.

## CI/CD

- **CI** (`.github/workflows/ci.yml`) — runs on pushes to `main` and PRs to `main`/`release/**`
- **Release** (`.github/workflows/release.yml`) — runs on `v*` tag push, creates GitHub Release with `dist/cli.js`
