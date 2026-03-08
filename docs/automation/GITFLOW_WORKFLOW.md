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
2. Merges `main` into that branch (using `-X theirs` to auto-resolve conflicts in favour of main)
3. Creates/updates a PR into `develop` (draft if merge conflicts are detected)
4. Enables GitHub auto-merge (squash) on the PR so it merges automatically once required status checks pass

This keeps the upmerge conflict-friendly and auditable.

> **Note:** The auto-merge uses **squash** merge to comply with the `develop` branch's `required_linear_history` ruleset. The repo-level `allow_auto_merge` setting must be enabled (see `repository.settings.yml`).

## Creating release/hotfix branches

Workflow: `.github/workflows/create-release-branch.yml`

Use Actions → **Create Release Branch + PR**:

- `kind`: `release` or `hotfix`
- `version`: `X.Y.Z` (SemVer)
- It creates `release/vX.Y.Z` or `hotfix/vX.Y.Z`
- It bumps `package.json` version and refreshes `package-lock.json`
- It generates a `CHANGELOG.md` entry for the new version
- It opens a PR to `main`

The changelog entry is generated from git commit messages. You can also run it locally:

- `npm run generate:changelog` (prints the entry)
- `npm run generate:changelog:write` (inserts it into `CHANGELOG.md`)

For GitHub Actions, a local action is available:

- `.github/actions/generate-changelog`

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
