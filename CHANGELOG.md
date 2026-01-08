# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
