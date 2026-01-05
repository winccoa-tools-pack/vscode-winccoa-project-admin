# README für GitHub Copilot: WinCC OA Extensions

## Allgemeine Projektstruktur und Regeln

Wir nutzen mehrere VS Code Extensions für WinCC OA, darunter CTL Language, Control, LogViewer, ScriptActions und den TestExplorer.

Alle Extensions nutzen eine gemeinsame NPM-Shared-Library als Core, die die Kommunikation mit WinCC OA bereitstellt.

Wir haben ein einheitliches Logging-Format, ein gemeinsames Makefile für Build-Befehle und ähnliche Projektstrukturen in allen Repos.

## Workflow mit GitHub Copilot

Wenn ein neues Feature gestartet wird, soll Copilot automatisch `git flow feature start <Name>` ausführen.

Bevor ein Feature gemergt wird, tragen wir die Änderungen in den Changelog ein und machen einen finalen Commit.

Commit-Messages beginnen immer mit einem Präfix wie `feat:`, `fix:`, `perf:`, usw. und sind so knapp wie möglich.

**CRITICAL**: Erst wenn alles getestet ist und ich das "Go" gebe, soll Copilot committen und dann mit `git flow feature finish` mergen.

Es wird nach jeder Änderung kompiliert (`npm run compile`).

### Git Workflow Best Practices
- **Working Tree sauber halten**: Vor `git flow feature finish` immer `git status` prüfen
- **Runtime Changes stashen**: DB-Dateien, Build-Artefakte mit `git stash push -m "message"` entfernen
- **Nie ohne User-Freigabe committen**: User muss explizit "Go", "okay", "commit" o.ä. sagen
- **Feature finish blockiert**: Bei unstaged changes → stashen, dann retry

## Wichtige technische Details

### Script Actions Extension
- Command: `winccoa.executeScriptWithArgs` 
- **WICHTIG**: Arguments werden als PLAIN STRINGS übergeben - KEIN `-lflag`, KEINE `-` Präfixe, einfach nur die Argumente!
- Beispiel richtig: `testCaseId` → Command: `/opt/WinCC_OA/bin/WCCOActrl script.ctl -proj DevEnv testCaseId`
- Beispiel falsch: `-lflag testCaseId` oder `single start testCaseId`
- Die Extension hängt die Args direkt nach `-proj <projectName>` an

### Test Explorer Extension  
- Parst Test-Dateien nach `class X : OaTest` Pattern
- Einzelne Tests werden über `TestRunner.executeScriptWithArgs(fileUri, testCaseId)` ausgeführt
- **WICHTIG**: Nur die `testCaseId` als Argument übergeben, NICHT `single start testCaseId`
- File Watcher wurde optimiert: Nur geänderte Dateien werden neu geparst, nicht das ganze Projekt
- Bei File Create: Datei wird einzeln geparst und hinzugefügt
- Bei File Change: Nur diese Datei wird neu geparst und aktualisiert
- Bei File Delete: Nur diese Datei wird aus dem Test-Tree entfernt

### Performance-Optimierungen
- File Watcher nutzt `handleFileCreated()`, `handleFileChanged()`, `handleFileDeleted()` für inkrementelle Updates
- Kein vollständiges `discoverTests()` mehr bei Dateiänderungen
- `TestDiscovery.parseTestFile(uri)` für einzelne Dateien verwenden

## Project Admin Extension (ehemals Control)

### CRITICAL BUGS (Stand: 2026-01-05)

#### 1. Zyklisches PMON Polling (Performance-Killer!)
**Problem**: Extension pollt PMON zyklisch, extrem ressourcen-intensiv
**Symptome**:
- Hohe CPU-Last durch ständige PMON-Abfragen
- Möglicherweise werden bei jedem Poll neue Instanzen erzeugt
- Caching der shared library könnte zerstört werden

**Root Cause zu prüfen**:
- Wie wird in npm-shared-library-core (WinCC OA Core Lib) gecacht?
- Erzeugen wir bei jedem Poll neue Instanzen statt Singleton zu nutzen?
- Läuft ein Interval ohne Cleanup?

#### 2. Fehlendes Error Handling beim Polling
**Problem**: Extension ignoriert Fehler und pollt fröhlich weiter
**Symptome**:
- Bei PMON-Errors (z.B. Projekt down, PMON nicht erreichbar) wird weiter gepollt
- Keine Fehler-Anzeige im UI
- "Alles wird scheiße" - Extension-State korrupt durch ungültige Daten

**Anforderungen für Fix**:
- ✅ Reload-Buttons BEHALTEN (manuelles Refresh bleibt)
- 🔧 NEU: Setting für Auto-Reload deaktivieren (`winccoa.projectAdmin.autoRefresh: false`)
- 🔧 NEU: Bei Errors → Polling STOPPEN
- 🔧 NEU: Error-Message im Sidepanel anzeigen
- 🔧 NEU: User muss manuell "Reload" klicken nach Error

**Zu implementieren**:
1. Error-State tracking (`lastError`, `isPollingPaused`)
2. Setting: `"winccoa.projectAdmin.autoRefresh": { "type": "boolean", "default": true }`
3. UI: Error-Banner in TreeView mit "Retry" Button
4. Logging: Detaillierte Error-Logs für Debugging

### Analyse-Todos
- [x] npm-shared-library-core: Wie funktioniert PMON caching? → **KEIN Caching, jeder Call spawnt Prozess**
- [x] npm-shared-library-core: Gibt es Singleton-Pattern für PMON-Instanzen? → **NEIN, jedes ProjEnvProject hat eigene PmonComponent**
- [x] vscode-winccoa-control: Wo wird das Polling getriggert? → **setInterval 15000ms in projectManager.initialize()**
- [x] vscode-winccoa-control: Welche Interval/Timer laufen? → **1x Interval (15s), FileWatcher (pvssInst.conf)**
- [x] vscode-winccoa-control: Wie wird Error-Handling aktuell gemacht? → **Partial, siehe Bug #3**

### Root Cause Analysis (Stand: 2026-01-05)

**Performance-Impact:**
- Pro Refresh: 10 Projekte × isPmonRunning() = 10 Process Spawns
- Alle 15 Sekunden = 40 Spawns/min = 2400 Spawns/h = 57600/Tag
- Jeder Spawn: 30-170ms (Windows: +Antivirus Scan)
- **Prozesse werden korrekt geschlossen** (kein Process-Leak)
- **ABER**: Ständiges Spawning ist extrem ressourcen-intensiv

**Memory Impact:**
- Pro Refresh: ~100 KB neue Objekte (10x ProjEnvProject + Components)
- Garbage Collection: ~240 Cycles/Stunde
- **Kein Memory-Leak** bei normalem Betrieb

#### Bug #3: Missing Version crasht KOMPLETTEN Refresh (CRITICAL!)
**Reproduziert am:** 2026-01-05  
**Symptome:**
- Ein Projekt mit fehlender WinCC OA Version (z.B. config hat 3.18, aber nur 3.19/3.20 installiert)
- **KOMPLETTER Extension-Crash** - ALLE Projekte verschwinden
- Error: `WinCC OA version 3.18 not found on system to locate component WCCILpmon`

**Stack Trace:**
```
Error: WinCC OA version 3.18 not found on system to locate component WCCILpmon
    at WinCCOAComponent.getPath()
    at WinCCOAComponent.start()
    at PmonComponent.getStatus()
    at ProjEnvProject.isPmonRunning()
    at ProjectManager.refreshProjects()  ← KEIN try/catch um isPmonRunning()!
```

**Root Cause:**
```typescript
// projectManager.ts refreshProjects() - Zeile 122-126
for (const project of runnable) {
    if (await project.isPmonRunning()) {  // ← KEIN try/catch!
        running.push(project);
    }
}
// Wenn EIN Projekt fehlschlägt → Kompletter Refresh crasht
```

**Fix Required:**
```typescript
for (const project of runnable) {
    try {
        if (await project.isPmonRunning()) {
            running.push(project);
        }
    } catch (error) {
        ExtensionOutputChannel.warn('ProjectManager', 
            `Failed to check PMON for ${project.getId()}: ${error.message}`);
        // Continue mit nächstem Projekt
    }
}
```

**UI Enhancement:**
- Fehlerhafte Projekte in TreeView mit ⚠️ Icon anzeigen
- Tooltip: "Version 3.18 not installed"
- Projekt bleibt sichtbar, aber Status = unknown

#### Bug #4: Infinite Loop / Memory Leak bei pvssInst.conf Errors (CRITICAL!)
**Beobachtet am:** 2026-01-05 (Kollegen-PC)  
**Symptome:**
- VS Code CPU-Last sehr hoch (100% Core)
- RAM steigt kontinuierlich an
- Projekte werden nicht gefunden (obwohl in config vorhanden)
- Extension wird unbenutzbar

**Root Cause:**
```typescript
// ProjEnvProjectRegistry.ts - Zeile 160-172
reloadTimeout = setTimeout(() => {
    parseProjRegistryFile(configPath);  // ← KEIN try/catch!
    console.log('Project registries reloaded...');
}, 100);
```

**Problem-Szenario:**
1. pvssInst.conf File Change Event
2. `parseProjRegistryFile()` wird gecalled
3. **Parsing Error** (z.B. corrupted file, permission denied)
4. Exception wird NICHT gefangen
5. Timeout bleibt im Event-Loop
6. Nächstes File Change Event → **Neuer Timeout**
7. **Loop**: Error → Timeout bleibt → Neuer Timeout → Error → ...

**Zusätzliches Problem:**
```typescript
// ProjEnvProjectRegistry.ts - Zeile 186-190
if (!fs.existsSync(configPath)) {
    throw new Error('The WinCC OA is probably not installed...');
}
```

**Wenn pvssInst.conf gelöscht wird:**
- FileWatcher triggert 'change' Event
- `parseProjRegistryFile()` wirft Error
- **ABER**: FileWatcher bleibt aktiv!
- Loop bei jedem weiteren File-Event

**Fix Required:**
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

## Aktuelle Probleme und To-Dos

Der LogViewer zeigt aktuell nicht immer die neueste Änderung an, es gibt ein Parsing-Problem.

~~Im TestExplorer sollen Tests auch einzelerkennbar sein~~ ✅ ERLEDIGT (v0.2.1)

~~Der File-Watcher muss so angepasst werden, dass nur die geänderten Dateien neu geparst werden~~ ✅ ERLEDIGT (v0.2.2)

Für die CTL-Language-Extension soll das Go-to-Feature für Variablen integriert werden, bevor wir den Language-Server später refactoren.

Ein Bug im File-Watcher-Menü sorgt dafür, dass aktuell alle Einträge verschwinden, wenn man versucht, Dateien auszuwählen, die ignoriert werden sollen.

### Project Admin TODOs
- **Add Manager Feature**: Aktuell nicht funktionsfähig - Command `winccoa.manager.add` wurde aus package.json entfernt (2026-01-04)
  - Button im Manager View wurde deaktiviert
  - Feature muss implementiert werden bevor es wieder aktiviert wird
  - Implementierung muss Manager-Konfiguration in config-Datei schreiben können

### Known Issues
**WinCC OA Limitation**: Beim Ausführen einzelner Testfälle generiert WinCC OA aktuell keinen vollständigen Test-Report. Die Infrastruktur in den Extensions ist vorbereitet, aber die volle Funktionalität hängt von zukünftigen WinCC OA Verbesserungen ab.

## Makefile Automation

### Version Badge Auto-Update (seit 2026-01-04)
Alle Extensions haben automatische Version Badge Updates:

```makefile
package: build
	@echo "Packaging production release..."
	@-$(MKDIR) $(BIN_DIR) 2>nul || echo "" >nul
	@echo "Updating version badge in README.md..."
	@node -e "const fs=require('fs'); let c=fs.readFileSync('README.md','utf8'); c=c.replace(/!\\[Version\\]\\(https:\\/\\/img\\.shields\\.io\\/badge\\/version-[^)]*\\)/,'![Version](https://img.shields.io/badge/version-$(VERSION)-blue.svg)'); fs.writeFileSync('README.md',c);"
	@$(VSCE) package -o $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Extension packaged to $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"
```

**Best Practice:**
- Version nur in package.json pflegen
- README.md Badge wird automatisch bei `make package` aktualisiert
- Cross-platform (Windows + Linux) via Node.js

## Versionsstände (Stand: 2026-01-04)
- **Project Admin**: Latest - Version badge automation
- **CTL Language**: v1.2.0 - Scope-aware rename + keywords + version badge automation
- **LogViewer**: v1.0.3 - Backend file watching + version badge automation
- **Script Actions**: v0.4.0 - Default commands + version badge automation
- **Test Explorer**: v0.2.4 - Cancel/Stop + version badge automation
- **Core Extension**: v0.2.3 - PMON start/stop sequence fix