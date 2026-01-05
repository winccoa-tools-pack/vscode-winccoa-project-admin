# Project Admin Extension - Bug Fix Status (2026-01-05)

## Übersicht

Feature Branch: **feature/fix-project-loading-errors-1.0.8**  
Version: 1.0.7 → 1.0.8 (PATCH - Bug Fixes)

## Identifizierte Bugs

### Bug #1: Zyklisches PMON Polling (Performance-Killer)
**Status:** ⚠️ NICHT BEHOBEN  
**Priorität:** HIGH  
**Root Cause:**
- Extension pollt PMON alle 15 Sekunden via `setInterval()`
- Pro Refresh: 10 Projekte × isPmonRunning() = 10 Process Spawns
- Jeder Spawn: 30-170ms (Windows: +Antivirus Scan)
- **40 Spawns/min = 2400/h = 57600/Tag**
- Prozesse schließen korrekt (kein Process-Leak), aber Spawning-Overhead ist massiv

**Betroffene Files:**
- `src/projectManager.ts`: Line 118 - `setInterval(refreshProjects, 15000)`
- `npm-winccoa-core/src/types/project/ProjEnvProject.ts`: Line 731-734 - `isPmonRunning()`
- `npm-winccoa-core/src/types/components/implementations/PmonComponent.ts`: Line 81-86 - `getStatus()`

**Fix-Strategie (TODO):**
- Caching-Layer für PMON Status (5-10 Sekunden Cache)
- Setting: `winccoa.projectAdmin.refreshInterval` (default: 15000ms)
- Lazy Loading: Nur aktuelles Projekt pollen, Rest on-demand

---

### Bug #2: Fehlendes Error Handling beim Polling
**Status:** ⚠️ NICHT BEHOBEN  
**Priorität:** HIGH  
**Root Cause:**
- Bei PMON-Errors (Projekt down, PMON nicht erreichbar) wird fröhlich weiter gepollt
- Keine Error-Anzeige im UI
- Extension-State korrupt durch ungültige Daten

**Fix-Strategie (TODO):**
- Setting: `winccoa.projectAdmin.autoRefresh` (default: true) - User kann Auto-Polling deaktivieren
- Error-State Tracking: `lastError`, `isPollingPaused`
- UI: Error-Banner in TreeView mit "Retry" Button
- Bei Error: Polling STOPPEN, User muss manuell "Reload" klicken
- Reload-Buttons BEHALTEN (manuelles Refresh bleibt)

---

### Bug #3: Missing Version crasht KOMPLETTEN Refresh (CRITICAL!)
**Status:** ✅ BEHOBEN (Code fertig, nicht getestet)  
**Priorität:** CRITICAL  
**Root Cause:**
```typescript
// projectManager.ts:122-126 - VORHER (BROKEN)
for (const project of runnable) {
    if (await project.isPmonRunning()) {  // ← NO try/catch!
        running.push(project);
    }
}
// Wenn EIN Projekt mit fehlender Version → GANZER Refresh crasht
```

**Error Stack:**
```
Error: WinCC OA version 3.18 not found on system to locate component WCCILpmon
    at WinCCOAComponent.getPath()
    at WinCCOAComponent.start()
    at PmonComponent.getStatus()
    at ProjEnvProject.isPmonRunning()
    at ProjectManager.refreshProjects()  ← KEIN try/catch!
```

**Implementierte Lösung:**
1. **types.ts - ProjectInfo Interface erweitert:**
```typescript
export interface ProjectInfo {
    id: string;
    name: string;
    // ... existing fields
    isRunning: boolean;
    error?: string;        // ← NEW: Error message
    hasError?: boolean;    // ← NEW: Error flag
}
```

2. **types.ts - toProjectInfo() Signature erweitert:**
```typescript
export function toProjectInfo(
    project: ProjEnvProject, 
    isRunning = true, 
    error?: string  // ← NEW
): ProjectInfo {
    // ...
    return {
        // ... existing fields
        isRunning: isRunning,
        error: error,         // ← NEW
        hasError: !!error     // ← NEW
    };
}
```

3. **projectManager.ts - Try/Catch um isPmonRunning():**
```typescript
// projectManager.ts - refreshProjects() - FIXED
async refreshProjects(): Promise<void> {
    try {
        const runnable: ProjEnvProject[] = await getRunnableProjects();
        const running: ProjEnvProject[] = [];
        const failed: ProjectInfo[] = [];
        
        for (const project of runnable) {
            try {
                if (await project.isPmonRunning()) {
                    running.push(project);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                ExtensionOutputChannel.warn('ProjectManager', 
                    `Failed to check PMON status for ${project.getId()}: ${errorMsg}`);
                
                // Add project with error status (visible but marked as broken)
                failed.push(toProjectInfo(project, false, errorMsg));
            }
        }
        
        // Include both running and failed projects
        this._runningProjects = [
            ...running.map(p => toProjectInfo(p, true)),
            ...failed
        ];
        // ... rest of method
```

4. **systemTreeProvider.ts - Error Icons/Tooltips:**
```typescript
// systemTreeProvider.ts - getChildren() 'projects' branch
return allProjects.map(project => {
    // Determine icon and description based on error status
    let description: string;
    let tooltip: string;
    let iconPath: vscode.ThemeIcon | undefined;
    
    if (project.hasError) {
        description = '⚠ Error';
        tooltip = `Project: ${project.name}\nError: ${project.error}`;
        iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('errorForeground'));
    } else {
        description = project.isRunning ? '● Running' : '○ Stopped';
        tooltip = `Project: ${project.name}`;
        iconPath = undefined;
    }
    
    return new SystemItem(
        project.name,
        vscode.TreeItemCollapsibleState.None,
        'project',
        description,
        tooltip,
        project.isRunning,
        project.projectDir,
        project,
        undefined,
        iconPath  // ← NEW parameter
    );
});
```

5. **systemTreeProvider.ts - SystemItem Constructor erweitert:**
```typescript
class SystemItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'systemStatus' | 'projectInfo' | 'info' | 'projects' | 'project' | 'subprojects' | 'subproject',
        public readonly description?: string,
        public readonly tooltipText?: string,
        public readonly isRunning?: boolean,
        public readonly projectPath?: string,
        public readonly projectData?: any,
        public readonly subprojectPath?: string,
        public readonly customIconPath?: vscode.ThemeIcon  // ← NEW
    ) {
        super(label, collapsibleState);
        
        // ... existing icon logic
        
        } else if (itemType === 'project') {
            // Use custom icon if provided (e.g., error icon)
            if (customIconPath) {
                this.iconPath = customIconPath;
            } else if (isRunning) {
                this.iconPath = new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconPassed'));
            // ... rest
```

**Geänderte Files:**
- ✅ `src/types.ts` - ProjectInfo interface + toProjectInfo() signature
- ✅ `src/projectManager.ts` - try/catch in refreshProjects()
- ✅ `src/views/systemTreeProvider.ts` - Error icons/tooltips

**UX Verbesserungen:**
- Fehlerhafte Projekte werden NICHT ausgeblendet (Option B gewählt)
- ⚠️ Icon mit rotem Warning-Symbol
- Tooltip zeigt Error-Message
- Projekt bleibt in TreeView sichtbar
- Status = `⚠ Error` statt `● Running` / `○ Stopped`

---

### Bug #4: Infinite Loop / Memory Leak bei pvssInst.conf Errors (CRITICAL!)
**Status:** ⚠️ NICHT BEHOBEN  
**Priorität:** CRITICAL  
**Root Cause:**
```typescript
// npm-winccoa-core/src/types/project/ProjEnvProjectRegistry.ts:168
reloadTimeout = setTimeout(() => {
    parseProjRegistryFile(configPath);  // ← NO try/catch!
    console.log('Project registries reloaded...');
}, 100);
```

**Problem-Szenario:**
1. pvssInst.conf File Change Event
2. `parseProjRegistryFile()` wird gecalled
3. **Parsing Error** (corrupted file, permission denied)
4. Exception wird NICHT gefangen
5. Timeout bleibt im Event-Loop
6. Nächstes File Change Event → **Neuer Timeout**
7. **Loop**: Error → Timeout → Error → Timeout → ...

**Symptome (Kollegen-PC):**
- VS Code CPU 100% (ein Core voll)
- RAM steigt kontinuierlich
- Projekte werden nicht gefunden
- Extension unbenutzbar

**Fix-Strategie (TODO):**
```typescript
// 1. Try/Catch um parseProjRegistryFile()
reloadTimeout = setTimeout(() => {
    try {
        parseProjRegistryFile(configPath);
    } catch (error) {
        console.error('Failed to parse pvssInst.conf:', error);
        registeredProjectsCache = [];  // Clear cache on error
        registeredProducts = [];
    }
}, 100);

// 2. FileWatcher Error Handling
fileWatcher.on('error', (error) => {
    console.error('File watcher error:', error);
    fileWatcher?.close();
    fileWatcher = undefined;
});
```

**Betroffene Files:**
- `npm-winccoa-core/src/types/project/ProjEnvProjectRegistry.ts`: Line 160-172

---

## Compile Status

**PROBLEM:** npm-winccoa-core release/v0.2.0 hat nicht die benötigten Exports!

```bash
# Release Branch v0.2.0 exportiert nur:
export * from './utils/winccoa-paths';

# MISSING:
- ProjEnvProject
- getRunnableProjects
- PmonComponent
- ProjEnvPmonStatus
- ProjEnvManagerInfo
- etc.
```

**Nächster Schritt:**
- npm-winccoa-core auf develop-Branch wechseln
- **ABER:** User hat auf Windows lokal einen Fix für develop-Branch
- **Daher:** User macht auf Windows weiter

---

## Testing-Plan (TODO)

### Bug #3 Fix Testing:
1. **Setup:** Projekt mit fehlender WinCC OA Version (z.B. config hat 3.18, aber nur 3.19/3.20 installiert)
2. **Expected:** 
   - Projekt wird in TreeView mit ⚠️ Icon angezeigt
   - Tooltip: "Error: WinCC OA version 3.18 not found on system"
   - Andere Projekte funktionieren weiterhin
   - KEIN kompletter Extension-Crash
3. **Verify:**
   - Extension Output zeigt Warning-Log
   - TreeView zeigt alle Projekte (fehlerhafte + funktionierende)
   - Refresh funktioniert weiterhin

### Bug #4 Fix Testing (nach Implementation):
1. **Setup:** pvssInst.conf korrumpieren (invalid syntax)
2. **Expected:**
   - Error-Log im Console
   - Kein CPU/RAM Spike
   - Extension bleibt responsive
3. **Verify:**
   - FileWatcher schließt korrekt
   - Keine Timeout-Accumulation

---

## Nächste Schritte

1. **Auf Windows-Rechner:**
   - npm-winccoa-core develop-Branch nutzen (mit lokalem Fix)
   - vscode-winccoa-control kompilieren
   - Bug #3 Fix testen (Missing Version Scenario)

2. **Nach erfolgreichem Test:**
   - CHANGELOG.md updaten:
     ```markdown
     ## [1.0.8] - 2026-01-05
     ### Fixed
     - **CRITICAL:** Missing WinCC OA version no longer crashes entire project list
     - Projects with errors now display with warning icon and error tooltip
     - Error handling in project refresh prevents cascading failures
     ```
   
   - package.json Version bump: `1.0.7` → `1.0.8`
   
   - Commit & Feature Finish:
     ```bash
     git add src/types.ts src/projectManager.ts src/views/systemTreeProvider.ts
     git commit -m "fix: add error handling for missing WinCC OA versions (Bug #3)"
     git flow feature finish fix-project-loading-errors-1.0.8
     ```

3. **Bug #4 Fix (nächster Feature Branch):**
   - Feature: `fix-infinite-loop-pvss-config-1.0.9`
   - File: npm-winccoa-core (muss dort gefixt werden!)
   - Nach Fix: npm-winccoa-core Version bump + Release

4. **Bug #1 & #2 (Performance & Error Handling):**
   - Feature: `improve-polling-performance-1.1.0` (MINOR - neue Settings)
   - Caching-Layer implementieren
   - Settings hinzufügen
   - UI Error-Banner

---

## Wichtige Code-Locations

### projectManager.ts
- Line 118: `setInterval(refreshProjects, 15000)` - Polling-Trigger
- Line 122-143: `refreshProjects()` - Bug #3 Fix hier implementiert

### types.ts
- Line 1-15: `ProjectInfo` interface - error/hasError fields hinzugefügt
- Line 40-65: `toProjectInfo()` - error parameter hinzugefügt

### systemTreeProvider.ts
- Line 147-183: `getChildren() 'projects' branch` - Error icon logic
- Line 585-650: `SystemItem constructor` - customIconPath parameter

### npm-winccoa-core (EXTERNAL)
- `src/types/project/ProjEnvProject.ts:731-734` - isPmonRunning() (Bug #1 Performance)
- `src/types/project/ProjEnvProjectRegistry.ts:168` - Timeout ohne try/catch (Bug #4)
- `src/types/components/implementations/PmonComponent.ts:81-86` - getStatus() spawning

---

## Dependency-Status

**npm-winccoa-core:**
- ❌ release/v0.2.0 - Zu alt, fehlt Exports
- ✅ develop - Hat alle nötigen Exports, aber Error auf Linux
- ✅ Windows (lokal) - develop mit User-Fix funktioniert

**Action:** Windows-Rechner nutzen für weiteres Development

---

## Offene Fragen

1. **Bug #4 Fix Location:**
   - Muss in npm-winccoa-core gefixt werden (ProjEnvProjectRegistry.ts)
   - Benötigt separaten PR/Feature in npm-winccoa-core Repo
   - Danach npm-winccoa-core Version bump + alle Extensions updaten

2. **Caching-Strategie (Bug #1):**
   - TTL: 5-10 Sekunden für PMON Status?
   - Nur Current Project cachen oder alle?
   - Cache invalidation bei Manual Refresh?

3. **Error Recovery (Bug #2):**
   - Retry-Strategie: Exponential Backoff?
   - Max Retries bevor Polling stoppt?
   - User Notification: Toast vs. TreeView Banner?

---

## Git Status

```bash
# Feature Branch
feature/fix-project-loading-errors-1.0.8

# Modified Files (uncommitted)
M  src/types.ts
M  src/projectManager.ts
M  src/views/systemTreeProvider.ts
A  BUG_FIX_STATUS.md (diese Datei)

# Untracked
?? .github/copilot-instructions.md (modified während feature start)
```

**Nächster Commit:**
```bash
git add src/types.ts src/projectManager.ts src/views/systemTreeProvider.ts BUG_FIX_STATUS.md
git commit -m "fix: add error handling for missing WinCC OA versions (Bug #3)

- Add error/hasError fields to ProjectInfo interface
- Wrap isPmonRunning() calls in try/catch in refreshProjects()
- Display error projects with warning icon and tooltip in TreeView
- Prevent cascading failures when single project has missing version
- Projects with errors remain visible for better debuggability

Resolves: Bug #3 (Missing Version crashes entire refresh)
Ref: BUG_FIX_STATUS.md for full analysis"
```

---

## Zusammenfassung für Copilot

**Was du wissen musst:**
- 4 CRITICAL Bugs identifiziert (2 Performance, 2 Crash/Leak)
- Bug #3 wurde implementiert (Error Handling für fehlende Versionen)
- Code ist fertig, aber NICHT kompiliert (npm-winccoa-core develop-Branch Problem auf Linux)
- User hat Fix auf Windows-Rechner
- Du musst auf Windows weiterarbeiten

**Was du tun musst:**
1. npm-winccoa-core develop-Branch nutzen (mit lokalem Fix)
2. vscode-winccoa-control kompilieren
3. Bug #3 Fix testen (Projekt mit missing version)
4. Bei Erfolg: CHANGELOG updaten, Version bumpen, commiten, feature finishen
5. Danach: Bug #4 Fix planen (nächster Feature Branch)

**Files zum Review:**
- `src/types.ts` - Interface Änderungen
- `src/projectManager.ts` - Try/Catch Logic
- `src/views/systemTreeProvider.ts` - UI Changes

Good luck! 🚀
