# WinCC OA Project Admin

<div align="center">

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.107.1-007ACC.svg)

**Project management and control for WinCC OA in Visual Studio Code**

[Features](#-features) • [Installation](#-installation) • [Known Issues](#-known-issues)

</div>

---

> **⚠️ Early Access Notice**  
> This extension is in active development. While core features are stable, you may encounter:
> - **Performance issues on Windows** (especially with many projects) - We're actively optimizing!
> - **Edge cases** not yet fully covered
> 
> **🐛 Found a bug?** Please report it on our [GitHub Issues](https://github.com/winccoa-tools-pack/vscode-winccoa-project-admin/issues)!  
> Your feedback helps us make this extension better for everyone. 🙏
>
> **Quick Fix:** If something doesn't work, try `Ctrl+Shift+P` → `Reload Window`

---

## 🎬 See It In Action

![WinCC OA Project Admin Demo](https://github.com/winccoa-tools-pack/vscode-winccoa-project-admin/blob/develop/images/Animation.gif?raw=true)

---

## ✨ Features

### 🔍 Automatic Project Detection
- List all runnable Projects
- Detects WinCC OA version from installation
- Finds subprojects automatically


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

---

## ⚙️ Configuration

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

4. **Add New Manager:**
   - did not work correctly. 

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

## 🐛 Known Issues

### Performance

**Windows Performance:**  
The extension may run slower on Windows with longer loading times. Linux performs significantly better.

**Large Projects:**  
Very large projects (many subprojects, managers) may experience slower detection and startup times.

### Custom Projects Not Appearing

**Symptom:** Some users see basic WinCC OA projects but not custom projects they've added.

**Root Cause:** Projects are loaded from `pvssInst.conf` (Windows: `C:\ProgramData\Siemens\WinCC_OA\pvssInst.conf`). Each project has a `notRunnable` field that controls visibility:
- `notRunnable=0` → Project appears in list (runnable)
- `notRunnable=1` → Project is filtered out (not runnable)

**Troubleshooting:**
1. Enable Debug Logging:
   - Open VS Code Output Panel (`Ctrl+Shift+U`)
   - Select "WinCC OA Project Admin" from dropdown
   - Look for `[PROJECT DISCOVERY]` and `[PVSS REGISTRY]` log messages
   - Check which projects are being filtered out and why

2. Check pvssInst.conf:
   - Open `C:\ProgramData\Siemens\WinCC_OA\pvssInst.conf` (Windows) or equivalent on Linux
   - Find your custom project section: `[Software\<Company>\<Product>\Configs\<ProjectID>]`
   - Verify `notRunnable=0` (not `notRunnable=1`)

3. Example Debug Output:
   ```
   [PVSS REGISTRY] Parsed pvssInst.conf:
   [PVSS REGISTRY]   Total projects: 5
   [PVSS REGISTRY]   Project: MyProject - notRunnable=true (FILTERED OUT)  ← Problem!
   [PVSS REGISTRY]   Project: DevEnv - notRunnable=false (WILL SHOW)
   ```

4. Fix:
   - Edit pvssInst.conf and change `notRunnable=1` to `notRunnable=0` for your project
   - Reload VS Code or wait 15 seconds for auto-refresh

**Note:** The `notRunnable` field is set when projects are registered in WinCC OA. If your project is marked as a sub-project or template, it may be automatically set to `notRunnable=1`.

### General

**Extension Not Responding:**  
If the extension doesn't work as expected (project not detected, PMON commands fail), reload VS Code:  
1. Press `Ctrl+Shift+P`
2. Type and select `Reload Window`
3. This refreshes the extension

### Current Limitations

- **Add Manager**: Feature currently disabled (not yet implemented)
- **Version Detection**: Legacy projects without version in registry may show warnings

---

## 🛠️ Requirements

- **VS Code:** 1.107.1 or higher
- **WinCC OA:** 3.19+ installed on your system

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Related Extensions

This core library is used by:
- [WinCC OA Script Actions](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-script-actions) - Execute CTRL scripts
- [WinCC OA Test Explorer](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-vscode-tests) - Run unit tests
- [WinCC OA CTRL Language](https://marketplace.visualstudio.com/items?itemName=mPokornyETM.wincc-oa-ctrl-lang) - Language support
- [WinCC OA LogViewer](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-logviewer) - View log files

---

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

<div align="center">

Made with ❤️ for the WinCC OA community

[GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-control) • [Issues](https://github.com/winccoa-tools-pack/vscode-winccoa-control/issues) • [WinCC OA Docs](https://www.winccoa.com)

</div>
