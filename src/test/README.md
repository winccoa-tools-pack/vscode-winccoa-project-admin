# Tests

This folder contains unit tests, integration tests, test helpers, and WinCC OA fixture projects.

## Structure

- `unit/` – fast Mocha unit tests (pure TS/JS, minimal VS Code API usage)
- `integration/` – VS Code extension-host integration tests
- `fixtures/` – WinCC OA fixture projects used by integration tests (copied to `out/` via `npm run compile:tsc`)
- `test-project-helpers.ts` – helper utilities to register/unregister fixture projects

## Running tests

- `npm run test:unit` – run unit tests (label: `unitTests`)
- `npm run test:integration` – run integration tests (label: `integrationTests`)
- `npm test` – run unit + integration

## Coverage

Coverage is generated via `vscode-test --coverage`.

- `npm run test:unit:coverage` → `coverage/unitTests/`
- `npm run test:integration:coverage` → `coverage/integrationTests/`
- `npm run test:coverage` → both

Useful outputs per suite:

- `coverage/<suite>/index.html` (HTML report)
- `coverage/<suite>/lcov.info` (LCOV for CI tooling)
- `coverage/<suite>/coverage-summary.json` (summary used by CI summary script)

## Deterministic test discovery (important)

Test selection is intentionally *deterministic* via `.vscode-test.mjs` labels.
This prevents stale compiled artifacts in `out/test/**` from being discovered/executed (which can cause flakiness on Windows due to file locks and old test outputs).

Current compiled entry points:

- Unit: `out/test/unit/index.js`
- Integration: `out/test/integration/vscode-integration.test.js`

## Test helpers

### `test-project-helpers.ts`

Helper functions for working with WinCC OA fixture projects in integration tests.

#### `registerRunnableTestProject()`

Creates and registers a runnable WinCC OA test project from `src/test/fixtures/projects/runnable`.

Returns a `ProjEnvProject` instance that is registered with WinCC OA.

```ts
const project = await registerRunnableTestProject();
try {
        await project.start();
        // ... test code
} finally {
        # Tests

        This folder contains unit tests, integration tests, test helpers, and WinCC OA fixture projects.

        ## Structure

        - `unit/` – fast Mocha unit tests (pure TS/JS, minimal VS Code API usage)
        - `integration/` – VS Code extension-host integration tests
        - `fixtures/` – WinCC OA fixture projects used by integration tests (copied to `out/` via `npm run compile:tsc`)
        - `test-project-helpers.ts` – helper utilities to register/unregister fixture projects

        ## Running tests

        - `npm run test:unit` – run unit tests (label: `unitTests`)
        - `npm run test:integration` – run integration tests (label: `integrationTests`)
        - `npm test` – run unit + integration

        ## Coverage

        Coverage is generated via `vscode-test --coverage`.

        - `npm run test:unit:coverage` → `coverage/unitTests/`
        - `npm run test:integration:coverage` → `coverage/integrationTests/`
        - `npm run test:coverage` → both

        Useful outputs per suite:

        - `coverage/<suite>/index.html` (HTML report)
        - `coverage/<suite>/lcov.info` (LCOV for CI tooling)
        - `coverage/<suite>/coverage-summary.json` (summary used by CI summary script)

        ## Deterministic test discovery (important)

        Test selection is intentionally deterministic via `.vscode-test.mjs` labels.
        This prevents stale compiled artifacts in `out/test/**` from being discovered/executed (which can cause flakiness on Windows due to file locks and old test outputs).

        Current compiled entry points:

        - Unit: `out/test/unit/index.js`
        - Integration: `out/test/integration/vscode-integration.test.js`

        ## Test helpers

        ### test-project-helpers.ts

        Helper functions for working with WinCC OA fixture projects in integration tests.

        #### registerRunnableTestProject()

        Creates and registers a runnable WinCC OA test project from `src/test/fixtures/projects/runnable`.

        Returns a `ProjEnvProject` instance that is registered with WinCC OA.

        ```ts
        const project = await registerRunnableTestProject();
        try {
            await project.start();
            // ... test code
        } finally {
            await unregisterTestProject(project);
        }
        ```

        #### unregisterTestProject(project: ProjEnvProject)

        Unregisters and cleans up a test project (and stops it if it is running).

        #### withRunnableTestProject(testFn: (project) => Promise<void>)

        Convenience wrapper that automatically registers a test project, runs your test function, and cleans up afterwards.

        ```ts
        await withRunnableTestProject(async (project) => {
            await project.start();
        });
        ```

        #### getFixturesPath() / getTestProjectPath(projectName: string)

        Resolves absolute paths for fixture access.

        ## CCM / code map (what matters most)

        “CCM” here means a quick categorization of the code into Core, Commands/Glue, and Model/UI (plus infra), to decide what to test first.

        - **Core (state + WinCC OA integration)**: `src/projectManager.ts`
            - Project discovery, status tracking, favorites persistence, smart polling.
            - Already has the most unit tests today.
        - **Commands/Glue (extension bootstrap)**: `src/extension.ts`
            - Registers commands, wires up providers/services, lifecycle + disposables.
        - **Model / types**: `src/types.ts`, `src/const.ts`
            - DTOs and helpers like `toProjectInfo()`.
        - **UI (TreeViews + StatusBar)**: `src/views/systemTreeProvider.ts`, `src/views/managerTreeProvider.ts`, `src/statusBarManager.ts`
            - Most user-facing logic; currently under-tested compared to ProjectManager.
        - **Infra (logging)**: `src/extensionOutput.ts`
            - Consistent logging and log-level handling.

        ### Usage hotspots (as of 2026-02)

        Symbol matches across `src/**/*.ts` (includes tests):

        - `ProjectManager`: 226
        - `ExtensionOutputChannel`: 202
        - `SystemTreeProvider`: 78
        - `ManagerTreeProvider`: 68
        - `toProjectInfo`: 22
        - `StatusBarManager`: 11
        - `LanguageModelToolsService`: 7
        - `getRunnableProjects`: 6

        ## ToDo test (next high-value additions)

        Prioritized list of test gaps based on the CCM map and usage hotspots.

        ### High priority (core stability)

        - Add unit tests for `ProjectManager.refreshProjects()` error paths (one project throws → refresh continues, project stays visible with status `error/unknown`).
        - Add unit tests for polling lifecycle: interval created only when enabled, and always disposed/stopped on `dispose()`.
        - Add unit tests for favorites: load/save persistence and sorting behavior (favorites first) via `SystemTreeProvider` list building.

        ### Medium priority (UI correctness)

        - Add unit tests for `SystemTreeProvider` item building:
            - Sorting/grouping of projects (running/stopped/unknown), favorites, current-project highlighting.
            - Command availability per item state (start/stop/register/unregister).
        - Add unit tests for `ManagerTreeProvider` item building and `getManagers()` / `getCurrentProjectId()` contract.
        - Add unit tests for `StatusBarManager`:
            - Status text formatting.
            - `showProjectPicker()` behavior when no projects / multiple running projects.

        ### Medium priority (commands + LLM tools)

        - Add unit test coverage for `extension.ts` command wiring:
            - Registers expected command IDs and disposables.
            - Defensive behavior when `ProjectManager` is not ready (activation failures).
        - Add unit tests for `LanguageModelToolsService.register()`:
            - Tools are registered and return structured outputs.
            - Input validation for tool schemas (e.g. required fields, bad IDs).

        ### Integration tests (end-to-end)

        - Add integration test for favorites persistence across reload (write to `globalState`, recreate ProjectManager, verify favorites restored).
        - Add integration test for “active project” selection reflected in TreeView + status bar (if feasible in extension host).
        - Add integration test covering “no WinCC OA installed / registry missing” behavior (should not crash activation; show actionable error).
