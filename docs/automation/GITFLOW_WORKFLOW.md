# Git Flow Workflow

This repository follows a Git Flow style branching model and provides GitHub Actions workflows to:

- validate branch naming + PR targets
- keep `develop` up to date with `main`
- create release/hotfix branches via workflow dispatch
- produce tested prereleases and publish stable releases

## Branch model

- `main`: stable, release-ready
- `develop`: integration branch
- `feature/*`: feature work (target `develop`)
- `bugfix/*`: bug fixes during development (target `develop`)
- `release/vX.Y.Z`: release preparation (target `main`)
- `hotfix/vX.Y.Z`: hotfix preparation (target `main`)

## Validation (PR guardrails)

Workflow: `.github/workflows/gitflow-validation.yml`

On each PR, it validates:

- branch naming conventions (e.g. `feature/*`, `release/*`, `hotfix/*`)
- PR base branch (e.g. `feature/*` must target `develop`, `release/*` must target `main`)
- PR title follows Conventional Commits (used for squash merges)

## Upmerge main → develop (via PR)

Workflow: `.github/workflows/gitflow.yml`

Whenever `main` gets new commits, the workflow:

1. Updates/creates `feature/upmerge-main-to-develop`
2. Merges `main` into that branch
3. Creates/updates a PR into `develop` (draft if merge conflicts are detected)

This keeps the upmerge conflict-friendly and auditable.

## Creating release/hotfix branches

Workflow: `.github/workflows/create-release-branch.yml`

Use Actions → **Create Release Branch + PR**:

- `kind`: `release` or `hotfix`
- `version`: `X.Y.Z` (SemVer)
- It creates `release/vX.Y.Z` or `hotfix/vX.Y.Z`
- It bumps `package.json` version and refreshes `package-lock.json`
- It opens a PR to `main`

Important: this workflow does **not** update `CHANGELOG.md`.

## Pre-release + release pipeline

- **Pre-Release (Alpha)** (`.github/workflows/pre-release.yml`)
  - Runs for PRs targeting `main`
  - Creates a GitHub pre-release tag like `vX.Y.Z-<sha>` with a tested VSIX asset

- **Release** (`.github/workflows/release.yml` → `release-reusable.yml`)
  - Runs on successful workflow runs on `main`
  - Requires a matching tested prerelease asset for the version
  - Creates the stable tag `vX.Y.Z`, attaches the tested VSIX, and optionally publishes to Marketplace (`VSCE_PAT`)

## Branch protection / rulesets

Rulesets are defined in `.github/rulesets/` and can be applied automatically.

Workflow: `.github/workflows/apply-settings-and-rulesets.yml`

- Source of truth:
  - `.github/repository.settings.yml`
  - `.github/rulesets/*.yml`
- Requires an admin-capable token (`REPO_ADMIN_TOKEN`) to apply settings/rulesets.

Note: the provided rulesets require these status check contexts:

- `CI/CD Pipeline - Required`
- `PR Labels - Required`
- `Git Flow Validation - Required`

If you keep these rulesets enabled, ensure your workflows emit these check names (or adjust the rulesets to match your repo).

---

## Quick Links

• [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mPokornyETM.wincc-oa-tools-pack)

---

<center>Made with ❤️ for and by the WinCC OA community</center>
