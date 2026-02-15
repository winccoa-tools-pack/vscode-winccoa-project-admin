# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] - 2026-02-14

### Fixed
- **System View Button Visibility**: Start/Stop/Restart buttons no longer appear on "Projects" folder or "Project Information" section
  - Fixed regex in package.json menu conditions from `/^project/` to `/^project(-favorite|-nonfavorite)?$/`
  - Buttons now only appear on actual project items in the tree

## [2.2.0] - 2026-02-13

### Added
- **GitHub Copilot Language Model Tools** (3 new autonomous manager lifecycle operations):
  - `winccoa_add_manager`: Add managers directly via Copilot without wizard UI
    - Accepts all manager parameters (component, startMode, startOptions, secondToKill, resetMin, resetStartCounter)
    - Defaults: startMode=2 (Always), secondToKill=30, resetMin=1, resetStartCounter=3
    - Example: "Add WCCOActrl manager with -num 5 -f test.ctl"
  - `winccoa_delete_manager`: Delete managers autonomously via Copilot
    - Safety check: Cannot delete PMON or Data Manager (index 0-1)
    - Auto-stops running managers before deletion
    - Example: "Delete manager 4"
  - `winccoa_configure_manager`: Update manager settings directly via Copilot
    - Partial updates supported (only changed fields required)
    - Stop → Delete → Insert → Restart workflow
    - Cannot configure PMON or Data Manager (index 0-1)
    - Example: "Configure manager 3 to start mode always with 60 seconds kill timeout"
- **Direct Manager Operations** (new internal methods for Copilot integration):
  - `ManagerTreeProvider.addManagerDirect()`: Bypasses wizard, adds manager directly from parameters
  - `ManagerTreeProvider.updateManagerDirect()`: Bypasses settings panel, updates manager from partial options
  - Both methods query live PMON state (not cached) for accurate positioning

### Changed
- **Manager Add Position Fix**: `addManagerDirect()` now queries current manager list from PMON instead of using cached array
  - Ensures managers are always appended at the correct end position
  - Prevents off-by-one insertion errors

## [2.1.0] - 2026-02-13

### Added
- **Manager Delete Feature**: Complete manager deletion functionality with safety checks
  - Delete managers via context menu (trash icon)
  - Safety protection: Cannot delete critical managers at index 0-1 (PMON/Data Manager)
  - Auto-stop running managers before deletion with extended 5-second wait time
  - Simple confirmation dialog: "Delete manager 'X' - are you sure?"
  - Automatic manager list refresh after successful deletion
  - Command: `winccoa.manager.delete` registered in Manager View
- **Manager Add Feature**: Complete manager addition wizard with intelligent defaults
  - 4-step wizard: Type → Name → Start Mode → Options
  - 12 predefined WinCC OA manager types (WCCOActrl, WCCOAui, WCCILevent, etc.) + Custom option
  - Intelligent `-num X` auto-suggestion finds next free manager number
  - Duplicate detection prevents adding same component+options combination
  - Start mode selection: Manual (0), Once (1), Always (2) with corrected mapping
  - Always appends managers at end of list (simplified from 5-step wizard)
  - Command: `winccoa.manager.add` registered with $(add) icon in Manager View title bar

### Fixed
- **Manager Start Modes**: Corrected swapped Once/Always values in wizard (Once=1, Always=2)
- **Manager Stop Timing**: Increased wait time from 1 second to 5 seconds for safer state transitions

## [2.0.4] - 2026-02-13

### Changed
- **npm-winccoa-core Migration**: Switched from local file dependency to published npm package `@winccoa-tools-pack/npm-winccoa-core@^0.2.3`
  - Cleaner dependency management
  - Automatic updates via npm
  - No longer requires local npm-winccoa-core build

### Fixed
- **API Breaking Change**: Added missing `resetMin` property to `ProjEnvManagerOptions` in Manager TreeView
  - Required by npm-winccoa-core v0.2.3 API changes
  - Prevents "Property 'resetMin' is missing" TypeScript errors
- **Version Detection Fallback**: Robust handling of projects with missing/invalid WinCC OA versions
  - Automatically parses version from `config/config` file when `project.getVersion()` returns "unknown"
  - Validates parsed version against installed WinCC OA versions on system
  - Normalizes version format (e.g., "3.21.1" → "3.21")
  - Prevents "WinCC OA version unknown not found on system" errors in all PMON operations
  - Fixes errors in: Progressive Loading, Smart Polling, Manager TreeView, System TreeView (Start/Stop)
- **ProjEnvProject Instance Caching**: Eliminated redundant object creation and config parsing
  - Caches `ProjEnvProject` instances in `_projectCache` Map during initial project discovery
  - Reuses cached instances in: `loadProjectStatusProgressive()`, `refreshSmartPolling()`, `verifyCurrentProject()`
  - Preserves `setVersion()` state across multiple method calls
  - Config file is now parsed only **once** per project at startup instead of repeatedly every 15 seconds

### Performance
- Eliminated redundant file I/O: Config file parsing reduced from ~240 times/hour to 1 time per project
- Smart polling (every 15 seconds) no longer creates new ProjEnvProject instances
- Reduced memory churn by reusing cached objects

## [2.0.3] - 2026-01-31

### Fixed

- Start/Stop inline buttons now appear correctly for all projects (fixed viewItem context matching)

## [2.0.2] - 2026-01-31

### Added

- **Favorites Feature**: Users can now pin favorite projects for faster access
  - Context menu commands: "Add to Favorites" and "Remove from Favorites"
  - Favorite projects are sorted to the top of the project list
  - Progressive loading prioritizes favorites (loads status first)
  - Visual indicator: ⭐ prefix in project description
  - Favorites are persisted per workspace using workspaceState
  - Original status icons (running/stopped) remain visible

### Changed

- Project list now shows favorites first, then other projects (alphabetically within each group)
- Project tooltips include favorite status indicator

## [2.0.1] - 2026-01-24

### Fixed

- Status bar now updates correctly when stopped project becomes running (polling includes current project)
- Tool name collision: Renamed `winccoa_list_managers` to `winccoa_project_managers` to avoid conflict with MCP Server extension

### Changed

- Optimized project picker: Uses cached list instead of full reload (90% reduction in spawns)
- Current project is now always polled even when stopped, ensuring status bar stays in sync
- Project picker now only verifies current project status (fast check) instead of reloading all projects

### Performance

- Reduced process spawns in project picker from 10 to 1 per invocation
- Smart polling now includes current project regardless of status

## [2.0.0] - 2026-01-24

### Added

- **Language Model Tools Integration**: GitHub Copilot can now autonomously control WinCC OA projects
  - `winccoa_list_projects`: Query all registered projects with status
  - `winccoa_get_project_info`: Get detailed information about a project
  - `winccoa_set_active_project`: Set active project for operations
  - `winccoa_start_project`: Start PMON for a project
  - `winccoa_stop_project`: Stop PMON for a project
  - `winccoa_get_pmon_status`: Query PMON status
  - `winccoa_list_managers`: List all managers with status
  - `winccoa_start_manager`: Start a specific manager by number
  - `winccoa_stop_manager`: Stop a specific manager by number
  - `winccoa_restart_manager`: Restart a specific manager (stop + start)

### Changed

- **BREAKING**: Minimum VS Code version bumped to 1.107.1 (Language Model Tools API required)

## [1.3.0] - 2026-01-24

### Added

- **Project Unregister UI**: Context menu option to unregister WinCC OA projects
  - Single confirmation dialog with clear explanation
  - Automatic PMON stop if project is running before unregister
  - Clear warning that files will NOT be deleted (only registry entry removed)
  - Progress indicator during unregister process
  - Automatic refresh of project list after successful unregister
  - Context menu entry in "danger" group (separated from other actions)
- **Explorer Context Menu Registration**: Register projects directly from VS Code Explorer
  - Right-click on any folder in Explorer
  - "Register as WinCC OA Project" option
  - Same validation and auto-detection as UI registration
  - Seamless integration with existing registration workflow

## [1.2.0] - 2026-01-24

### Added

- **Project Registration UI**: New "+" button in System View to register WinCC OA projects
  - User-friendly folder picker dialog to select project directory
  - Automatic version detection from config file (pvss_path)
  - Validation of project structure (checks for config/config file)
  - Confirmation dialog before registration
  - Progress indicator during registration process
  - Automatic handling of already-registered projects (unregister + re-register)
  - Automatic refresh of project list after successful registration

### Changed

- **npm-winccoa-core**: Updated to latest version with improved error handling in `ProjEnvProjectRegistry`
  - Better error handling for pvssInst.conf file changes
  - File watcher error handling to prevent crashes
  - Enhanced debug logging for project discovery

## [1.1.1] - 2026-01-05

### Added

- **Enhanced Project Discovery Debug Logging**: Added comprehensive debug output to trace why projects might not appear
  - `[PVSS REGISTRY]` logs show all projects parsed from pvssInst.conf with `notRunnable` field values
  - `[PROJECT DISCOVERY]` logs show filtering chain: registered → runnable → final list
  - Logs explicitly list projects that are filtered out and why
  - Helps diagnose why custom projects might not appear for some users

### Fixed

- **Project Discovery Documentation**: Added detailed Known Issues section for "Custom Projects Not Appearing"
  - Root cause explanation: `notRunnable` field in pvssInst.conf
  - Step-by-step troubleshooting guide with debug log examples
  - How to fix: change `notRunnable=1` to `notRunnable=0` in pvssInst.conf

## [1.1.0] - 2026-01-05

### Added

- **Progressive Project Loading**: Instant UI with "Unknown" status, then sequential status updates
  - Projects appear immediately on extension activation instead of waiting 1-2 seconds
  - Status icons update progressively (⚪ Loading → ● Running / ● Stopped / ⚠ Error)
  - Smooth user experience with real-time feedback
- **Enhanced Debug Logging**: Detailed logging with [PROGRESSIVE LOAD], [SMART POLL], [UPDATE] prefixes
  - Shows which projects are being polled and why
  - Displays status changes and skip counts for better debugging
  - Visibility into polling behavior for performance analysis

### Changed

- **Smart Polling Optimization**: Only running/transitioning projects are polled every 15 seconds
  - Stopped projects no longer polled (massive performance improvement)
  - Reduces PMON process spawns by 75-85% (from ~57,600/day to ~7,200-14,400/day)
  - Error projects with cached errors are skipped
  - Status changes detected: running → stopped (via polling), stopped → running (via start command + force refresh)
- **Refresh Button Behavior**: Now triggers full project reload instead of just re-rendering TreeView
  - Clears error cache and reloads all projects with progressive loading
  - Useful for detecting manually started projects or retrying failed projects
- **Status Bar Project Picker**: Only shows running projects in quick pick menu
  - Cleaner UX - only selectable (active) projects displayed
  - "No WinCC OA project selected" shown in red when no project active
- **Stopped Project Icons**: Changed from gray circle-outline to red circle-filled (testing.iconFailed)
  - Better visual distinction between running (green) and stopped (red) projects

### Performance

- **PMON Spawn Reduction**: From 40 spawns/min to 5-10 spawns/min (75-85% reduction)
  - Initial load: ~150ms faster (instant UI vs waiting for all PMON checks)
  - Daily spawns: ~57,600 → ~7,200-14,400 (saves ~50,000 process spawns per day)
  - Windows antivirus impact minimized (fewer WCCILpmon.exe spawns)

### Fixed

- Status bar now correctly filters to running projects only
- TreeView refresh events properly fire on project status changes
- Progressive loading subscriptions work correctly with onDidChangeProjects event

## [1.0.8] - 2026-01-05

### Fixed

- **CRITICAL: Project Loading Errors**: Projects with errors no longer crash entire extension
  - Missing WinCC OA versions now handled gracefully with error caching
  - Failed projects displayed with warning icon and error tooltip in TreeView
  - Prevents cascading failures when single project has configuration issues
  - Error projects cached to prevent repeated PMON polling (performance fix)
  - TreeView now uses cached project list instead of re-polling on every refresh
  - All projects (running, stopped, failed) remain visible for better debuggability

## [1.0.7] - 2026-01-04

### Fixed

- **Version Handling**: Projects without version in registry now gracefully handled
  - Added error handling for missing project versions before PMON status check
  - Prevents "WinCC OA version must be specified" errors for legacy projects
  - Projects without version are shown but PMON status check is skipped
- **PMON Timeout**: Added explicit timeout parameter to all `stopProjectAndPmon()` calls
  - Prevents TypeScript signature mismatch errors

### Removed

- **Add Manager Button**: Removed non-functional Add Manager feature from Manager View
  - Button and command removed until proper implementation available
  - Marked as TODO in copilot-instructions.md

## [1.0.6] - 2026-01-02

### Changed

- **Project/Subproject Click Behavior**: Removed click-to-open action from project/subproject items
  - Projects and subprojects no longer open in Explorer when clicked
  - Use context menu "Open in Explorer" instead (right-click)
  - Prevents accidental folder navigation when selecting projects

## [1.0.5] - 2026-01-02

### Fixed

- **onDidChangeProject Event Spam**: Fixed event firing every 15 seconds even when project unchanged
  - Now only fires when project actually changes or running status changes (running ↔ stopped)
  - Prevents unnecessary cache clears and reloads in dependent extensions (e.g., CTL Language)
  - Added debug logging for actual status changes
- **Makefile**: Fixed `make package` for Windows compatibility

## [1.0.4] - 2026-01-01

### Changed

- **Extension Rename**: Renamed from `winccoa-control` to `winccoa-project-admin`
- **Extension ID**: Now `RichardJanisch.winccoa-project-admin` (was `RichardJanisch.winccoa-control`)
- **Repository URL**: Updated to reflect new name

**BREAKING**: Other extensions must update their dependencies from `RichardJanisch.winccoa-control` to `RichardJanisch.winccoa-project-admin`

## [1.0.3] - 2026-01-01

### Changed

- **Core Library**: Updated to @winccoa-tools-pack/npm-winccoa-core v0.1.3 with multi-version support
- **Dependencies**: Switched to local file dependency for development workflow

### Fixed

- **Multi-Version Support**: Manager operations now use correct WinCC OA version when multiple versions installed
- **Type Exports**: Fixed module resolution errors with core library types

## [1.0.2] - 2025-12-31

### Added

- **Stopped Projects**: Allow setting stopped (non-running) projects as active project
- **Visual Indicator**: Status bar shows yellow background for stopped projects vs. normal for running

### Changed

- **Project Selection**: Active project remains selected even when stopped
- **Status Display**: Different icon for stopped (`$(server-environment)`) vs running (`$(server-process)`) projects

## [1.0.1] - 2025-12-30

### Fixed

- **Package Name**: Changed from `winccoa-core` to `winccoa-control` for correct extension ID
- **Extension ID**: Now `RichardJanisch.winccoa-control` (was `RichardJanisch.winccoa-core`)
- **Repository URL**: Updated to match new package name

**BREAKING**: Extensions depending on this must update their `extensionDependencies` from `RichardJanisch.winccoa-core` to `RichardJanisch.winccoa-control`

## [1.0.0] - 2025-12-30

### First Stable Release

**Core Features:**

- Automatic WinCC OA project detection via `config/config` file
- Project management with status bar UI and quick pick menu
- Auto-selection of first project on startup
- PMON manager control (start/stop projects)
- Extension API for other WinCC OA extensions
- Context menu actions for projects and subprojects

**Current Limitations:**

- Project switching may require VS Code reload in some cases
- Limited support for multi-root workspaces with multiple WinCC OA projects
- PMON control requires proper WinCC OA installation and configuration

### Changed

- Renamed from "WinCC OA Core" to "WinCC OA Control"
- Updated icon to `wincc_oa_control_512.png`
- Improved documentation with real-world usage examples
- Added disclaimer about first stable release status

---

## [0.2.3] - 2025-12-28

### Fixed

- **PMON Start/Stop Sequence**: Correct order for starting and stopping projects
  - Start: Check PMON status → Start PMON if needed → Wait → Start all managers
  - Stop: Stop all managers → Wait → Stop PMON
  - Ensures reliable project startup and shutdown

## [0.3.0] - 2025-12-26

### Added

- Context menu for projects: Set as Active Project
- Context menu for projects: Add Project to Workspace
- Context menu for projects: Open in Explorer
- Context menu for subprojects: Add Subproject to Workspace
- Context menu for subprojects: Open in Explorer

### Fixed

- Subproject navigation now opens correct folder instead of parent directory
- Test workspace path in Makefile (DevEnv.code-workspace)

## [0.2.2] - 2025-12-25

### Fixed

- Status bar no longer shows warning on startup before project initialization completes
- Status bar displays loading indicator during initial project discovery
- Eliminated false "No project" warnings during extension activation

## [0.2.1] - 2025-12-25

### Changed

- Auto-select first available project on startup if no project is selected
- Improved project selection: now automatically selects first running project instead of only when exactly one project is running
- Added logging for auto-selected projects

## [0.2.0] - 2025-12-23

### Added

- **Sidebar Integration**: Consolidated sidebar features from vscode-winccoa-sidepanel
- **System Status View**: Monitor WinCC OA system status, project information, and running projects
- **Manager View**: Real-time manager monitoring and control
- **Manager Control**: Start, stop, and restart managers using ProjEnvProject API- **System Control**: Start, stop, and restart entire WinCC OA system
  - startProject(), stopProject(), restartProject() via PmonComponent
  - Inline buttons on system status item
  - Confirmation dialogs for stop/restart
  - Automatic status refresh after operations- Tree view context menus for manager control actions
- Toolbar refresh buttons for both views
- Activity bar icon for WinCC OA Control
- Auto-refresh of manager status (5-second polling)
- Manager information display (PID, state, start mode, start time)
- Project information display (name, version, paths)
- Running projects overview
- Direct integration with npm-shared-library-core ProjEnvProject class

### Changed

- **Extension renamed** from "WinCC OA Core" to "WinCC OA Control"
- Description updated to reflect unified project management and monitoring capabilities
- Manager control now uses ProjEnvProject from npm-shared-library-core
- System and manager views automatically update when project changes
- Manager states properly displayed: Running, NotRunning, Init, Blocked
- Icons reflect manager status with color coding

### Technical Implementation

- ProjEnvProject integration for manager operations
- startManager(idx), stopManager(idx), restartManager(idx) methods
- getProjectStatus() for real-time manager information
- ProjEnvManagerInfo for detailed manager data
- ProjEnvManagerState enum for status display
- Automatic project environment initialization from ProjectManager

## [0.1.0] - 2025-12-22

### Added

- Initial release of WinCC OA Core extension
- Automatic WinCC OA project detection from workspace
- Project management with state persistence
- Extension API for inter-extension communication
- Event system (`onDidChangeProject`) for real-time project change notifications
- Status bar UI showing current project and version
- Quick Pick menu for project selection
- Support for workspace and manual path configuration modes
- Auto-detection of WinCC OA version and installation path
- Subproject resolution from config files
- Script paths resolution (libs, scripts folders)
- TypeScript interfaces for type-safe integration
- Structured logging with ExtensionOutputChannel
- Configurable log levels: ERROR, WARN, INFO, DEBUG, TRACE
- WorkspaceState persistence for last selected project
- Cross-platform support (Windows, Linux, macOS)

### Features for Extension Developers

- `getCurrentProject()` - Get active project information
- `setCurrentProject(path)` - Switch active project
- `getAvailableProjects()` - List all detected projects
- `refreshProjects()` - Re-scan workspace for projects
- `onDidChangeProject` - Event emitter for project changes
- Full TypeScript type definitions

### Configuration

- `winccoa.core.pathSource` - Project detection mode (workspace/manual)
- `winccoa.core.autoSwitch` - Auto-switch on workspace changes
- `winccoa.core.logLevel` - Logging verbosity

### Documentation

- Comprehensive README with usage examples
- API reference for extension developers
- Type definitions and interfaces
