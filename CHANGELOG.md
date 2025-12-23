# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2025-12-23

### Added
- **Sidebar Integration**: Consolidated sidebar features from vscode-winccoa-sidepanel
- **System Status View**: Monitor WinCC OA system status, project information, and running projects
- **Manager View**: Manager control interface (implementation pending)
- Tree view context menus for manager control actions
- Toolbar refresh buttons for both views
- Activity bar icon for WinCC OA Control
- Project information display (name, version, paths)
- Running projects overview

### Changed
- **Extension renamed** from "WinCC OA Core" to "WinCC OA Control"
- Description updated to reflect unified project management and monitoring capabilities
- System and manager views automatically update when project changes
- Manager view shows placeholder for upcoming pmon integration

### Removed
- REST API dependency (no longer needed for future implementation)

### Technical Notes
- Manager control functionality marked as TODO - will be implemented with direct pmon communication
- ProjEnvProject integration prepared for future manager control
- Views are fully functional with project information display
- Manager start/stop/restart commands registered but show "coming soon" message

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
