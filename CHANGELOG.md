# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
