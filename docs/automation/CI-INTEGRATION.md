# CI + Integration (WinCC OA)

This repository runs a standard Node/TypeScript CI pipeline on GitHub-hosted runners and (optionally) runs integration tests inside a WinCC OA Docker container.

## Workflows

### CI/CD Pipeline

Workflow: `.github/workflows/ci-cd.yml`

- Triggers:
  - `push` to `main`, `develop`, and `release/**`
  - `pull_request` to `main` and `develop`
- What it does:
  - `npm ci`
  - `npm run lint` + `npm run lint:md`
  - `npm run format:check`
  - matrix tests via `npm run test:unit`

### Integration Tests - WinCC OA

Integration tests are part of the CI/CD workflow.

Workflow: `.github/workflows/ci-cd.yml` (job: `Integration Tests - WinCC OA`)

- Triggers:
  - same triggers as `CI/CD Pipeline`
- What it does:
  - pulls a WinCC OA Docker image
  - runs the repo inside the container
  - executes `npm run ci:integration` (which runs `npm ci`, `npm run compile`, and `npm run test:integrationt`)

By default, the integration job is a no-op unless an image is configured.

## Docker image selection

The integration workflow determines the image like this:

1. If `package.json` defines `config.winccoaImage`, that value is used.
2. If repository variable `WINCCOA_IMAGE` is set, it overrides the package.json value.

If you publish your own WinCC OA image, set it explicitly in `package.json` to avoid surprises.

## Required secrets (optional)

These are used only for private pulls from Docker Hub:

- `DOCKER_USER`
- `DOCKER_PASSWORD`

If you reference a public image, the workflow can work without credentials.

## Enabling integration in a new repo

Set one of the following:

- `package.json` → `config.winccoaImage`
- Repository variable `WINCCOA_IMAGE`

## Manual runs (recommended for first setup)

From the Actions tab:

1. Run **CI/CD Pipeline** once to validate the build.
2. Run **Integration Tests - WinCC OA** via `Run workflow`.

## Troubleshooting

- `npm ci` fails: ensure `package-lock.json` matches `package.json` and commit the updated lockfile.
- Container pull fails: verify your image name (and Docker credentials if private).
