# CI Integration with WinCC OA Docker image

This document describes how GitHub Actions runs integration tests against the WinCC OA Docker image `mpokornyetm/winccoa:v3.19.9-full`.

Required repository/organization secrets:

- `DOCKER_USER` — Docker registry username.
- `DOCKER_PASSWORD` — Docker registry password or token.

Workflow file: `.github/workflows/integration-winccoa.yml`

How it runs:

- The workflow pulls the WinCC OA image, starts a container named `winccoa-ci`, mounts the repository into `/workspace`, and executes `npm ci` and the `ci:integration` script inside the container.
- The script `.github/scripts/wait-for-winccoa.sh` can be used to wait for the runtime to be ready before running tests.

Running manually:

1. Ensure secrets `DOCKER_USER` and `DOCKER_PASSWORD` are added to the repository or organization.
2. From the Actions tab, find `Integration Tests - WinCC OA` and click `Run workflow`.

Notes:

- The workflow executes tests inside the container to avoid requiring WinCC OA on the host runner.
- If the image requires additional environment variables (license acceptance, ports, or credentials), add them as repository secrets and pass them to the `docker run` step in the workflow.

Help / Safe Triggering

- **What to check before running**: Ensure repository secrets `DOCKER_USER` and `DOCKER_PASSWORD` are configured if you intend the workflow to push images. If you only want to build and run tests, you can run the workflow without those secrets — the job will build and run tests but will skip the push step when credentials are missing.
- **Avoid accidental pushes**: The build workflow accepts `docker_namespace` and `repo_name` inputs. Always supply your own Docker Hub namespace (or leave blank to default to the repository owner) so that images are not pushed into the upstream template namespace by mistake.
- **How to run safely (Actions UI)**: Open the repository Actions tab, select "Build WinCC OA image", click "Run workflow" and set `docker_namespace` to your Docker Hub username and `repo_name` to an appropriate repo name.
- **How to run safely (CLI)**: Use the GitHub CLI to dispatch a run and pass inputs. Example:

```powershell
# Run workflow and set your namespace/repo to avoid pushing into upstream
gh workflow run build-winccoa-image.yml \
    -f docker_namespace=your-docker-namespace \
    -f repo_name=your-repo-name \
    -f node_version=20
```

- **Dry-run locally**: You can run the integration tests locally without building the custom image by using Docker to run the official WinCC OA image and executing `npm ci && npm run ci:integration` inside the container; see the `integration-winccoa.yml` steps for the exact invocation.
