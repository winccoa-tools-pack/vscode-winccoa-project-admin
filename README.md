# WinCC OA Control

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.107.1-007ACC.svg)

**Project management and control for WinCC OA in Visual Studio Code**

[Features](#-features) • [Installation](#-installation) • [Known Issues](#-known-issues)

</div>

---

> **Disclaimer:**
> This is the first stable release (v1.0.0) of the WinCC OA Control extension. Not all features are fully implemented and some functions may not work perfectly yet. Please report any issues you encounter.

---

## ✨ Features

### 🔍 Automatic Project Detection
- Scans workspace for WinCC OA project structures (`config/config` file)
- Detects WinCC OA version from installation
- Finds subprojects automatically
- Resolves script paths and library paths

### 🎯 Project Management
- **Status Bar UI**: Click to switch between projects
- **Quick Pick Menu**: Browse all available WinCC OA projects in workspace
- **Auto-Selection**: Automatically selects first project on startup
- **Context Menu Actions**: Set active project, add to workspace, open in explorer

### ⚙️ Manager Control (PMON)
- Start/stop WinCC OA projects via PMON
- Automatic manager detection and control
- Proper startup/shutdown sequence (PMON → Managers)
- Real-time status updates

### 🔔 Extension API for Developers
- `getCurrentProject()`: Get active project information
- `setCurrentProject(path)`: Switch to different project
- `onDidChangeProject`: Event fired when project changes
- TypeScript interfaces for type-safe integration

---

## 🚀 Installation

1. **Install from VSIX** (Recommended):
   ```bash
   code --install-extension winccoa-control-1.0.0.vsix
   ```

2. **Or via VS Code Extensions**:
   - Open Extensions (`Ctrl+Shift+X`)
   - Search for "WinCC OA Control"
   - Click Install

3. **Open your WinCC OA project**:
   - Extension auto-detects projects with `config/config` file
   - Select active project from status bar

---

## ⚙️ Configuration

### Essential Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoa.core.pathSource` | `workspace` | Project detection: `workspace` (auto-detect) or `manual` |
| `winccoa.core.autoSwitch` | `true` | Automatically switch project when workspace changes |

### Logging (for debugging)

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoa.core.logLevel` | `INFO` | Log verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |

💡 **Tip**: Set log level to `DEBUG` when reporting bugs for detailed diagnostics.

---

## 🐛 Known Issues

### Current Limitations

1. **Project Switching**:
   - May require VS Code reload in some cases
   - Especially when switching between projects with different WinCC OA versions

2. **Multi-root Workspaces**:
   - Limited support for multiple WinCC OA projects simultaneously
   - Recommended: Use single project per workspace

3. **PMON Control**:
   - Requires WinCC OA to be properly installed and configured
   - PATH environment variable must include WinCC OA binaries
   - Some manager types may not be detected automatically

### Reporting Bugs

Found an issue? Please report it with:
- WinCC OA version
- Extension version (`1.0.0`)
- Steps to reproduce the issue
- Enable `DEBUG` logging and attach log output

[Report Issue on GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-control/issues)

---

## 📝 Commands

Access via `Ctrl+Shift+P`:

| Command | Description |
|---------|-------------|
| `WinCC OA: Select Project` | Choose active project from list |
| `WinCC OA: Refresh Projects` | Re-scan workspace for projects |
| `WinCC OA: Start Project (PMON)` | Start WinCC OA project |
| `WinCC OA: Stop Project (PMON)` | Stop WinCC OA project |

---

## 🛠️ Requirements

- **VS Code:** 1.80.0 or higher
- **WinCC OA:** 3.19+ installed on your system
- **Project Structure:** Workspace must contain a `config/config` file for auto-detection

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 📜 Disclaimer

WinCC OA and Siemens are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project.

---

<div align="center">

Made with ❤️ for the WinCC OA community

[GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-control) • [Issues](https://github.com/winccoa-tools-pack/vscode-winccoa-control/issues) • [WinCC OA Docs](https://www.winccoa.com)

</div>
}
```

---

## 🛠️ Requirements

- Visual Studio Code 1.107.1 or higher
- WinCC OA 1.19+
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

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

<div align="center">

**Made with ❤️ for the WinCC OA community**

</div>
