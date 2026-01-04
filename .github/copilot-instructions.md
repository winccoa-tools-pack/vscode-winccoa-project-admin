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