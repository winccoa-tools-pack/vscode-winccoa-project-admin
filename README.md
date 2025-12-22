# WinCC OA Core

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.80.0-007ACC.svg)

**Shared core library for WinCC OA VS Code extensions**

⚠️ *Pre-Release Version - Core functionality for WinCC OA extension ecosystem*

</div>

---

## 📋 Overview

WinCC OA Core provides shared services and APIs for all WinCC OA VS Code extensions, including:

- **Project Management** - Automatic detection and configuration of WinCC OA projects
- **Centralized Configuration** - Single source of truth for project paths and settings  
- **Event System** - Real-time notifications for project changes across extensions
- **Status Bar Integration** - Visual project selector UI

This extension is typically installed automatically as a dependency of other WinCC OA extensions.

---

## ✨ Features

### 🔍 Automatic Project Detection
- Scans workspace for WinCC OA project structures (`config/config` file)
- Detects WinCC OA version from installation
- Finds subprojects automatically
- Resolves script paths and library paths

### 🎯 Project Selection
- **Status Bar UI** - Click to switch between projects
- **Quick Pick** - Browse available projects
- **Auto-detection** - Automatically selects project from workspace
- **Manual Configuration** - Override with manual settings

### 🔔 Extension API
- `getCurrentProject()` - Get active project information
- `setCurrentProject(path)` - Switch to different project
- `onDidChangeProject` - Event fired when project changes
- TypeScript interfaces for type-safe integration

### 🎨 UI Components
- Status bar item showing current project and version
- Quick Pick menu for project selection
- Auto-detection notifications

---

## 🚀 Getting Started

### Installation

**Automatic (Recommended):**
This extension is automatically installed as a dependency when you install any WinCC OA extension (e.g., WinCC OA Script Actions, Test Explorer, etc.).

**Manual:**
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "WinCC OA Core"
4. Click Install

### Configuration

The extension works automatically in most cases. Open a WinCC OA project folder and it will:
1. Auto-detect the project structure
2. Show project info in the status bar
3. Provide project context to other extensions

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoa.core.pathSource` | `workspace` | How to detect projects: `workspace` (auto) or `manual` (static config) |
| `winccoa.core.autoSwitch` | `true` | Automatically switch project when workspace changes |

---

## 📋 Usage

### For End Users

1. Open a WinCC OA project workspace in VS Code
2. The extension automatically detects your project
3. Click the status bar item to switch projects if needed
4. Other WinCC OA extensions will use the selected project

### For Extension Developers

```typescript
import * as vscode from 'vscode';

// Get the Core API
const coreExt = vscode.extensions.getExtension('winccoa.core');
await coreExt?.activate();
const core = coreExt?.exports;

// Get current project
const project = core.getCurrentProject();
console.log(`Active project: ${project.name} (${project.version})`);

// Listen for project changes
core.onDidChangeProject(project => {
    console.log(`Project changed to: ${project.name}`);
    // Update your extension's configuration
});
```

---

## 🏗️ API Reference

### ProjectInfo Interface

```typescript
export interface ProjectInfo {
    path: string;              // Absolute path to project root
    name: string;              // Project name
    version: string;           // WinCC OA version (e.g., "3.19", "3.20")
    installPath: string;       // WinCC OA installation directory
    configPath: string;        // Path to config/config file
    logPath: string;           // Path to log directory
    subProjects: string[];     // Paths to subprojects
    scriptsPaths: string[];    // All resolved scripts directories
}
```

### WinCCOACoreAPI Interface

```typescript
export interface WinCCOACoreAPI {
    // State
    getCurrentProject(): ProjectInfo | undefined;
    getAvailableProjects(): ProjectInfo[];
    
    // Actions
    setCurrentProject(projectPath: string): Promise<void>;
    refreshProjects(): Promise<void>;
    
    // Events
    onDidChangeProject: vscode.Event<ProjectInfo>;
}
```

---

## 🛠️ Requirements

- Visual Studio Code 1.80.0 or higher
- WinCC OA project with valid `config/config` file

---

## 🔗 Related Extensions

This core library is used by:
- [WinCC OA Script Actions](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-script-actions) - Execute CTRL scripts
- [WinCC OA Test Explorer](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-vscode-tests) - Run unit tests
- [WinCC OA CTRL Language](https://marketplace.visualstudio.com/items?itemName=mPokornyETM.wincc-oa-ctrl-lang) - Language support
- [WinCC OA LogViewer](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-logviewer) - View log files

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

**winccoa-tools-pack**
- GitHub: [@winccoa-tools-pack](https://github.com/winccoa-tools-pack)

---

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

<div align="center">

**Made with ❤️ for the WinCC OA community**

</div>
