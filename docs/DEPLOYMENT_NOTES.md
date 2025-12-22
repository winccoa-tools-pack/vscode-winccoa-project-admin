# Deployment Notes

## Current State (v0.1.0)

### Problem: Packaging with `file:` Dependencies

VS Code Extension Packaging (`vsce`) validiert alle Dependencies rekursiv mit `npm list --production`. Bei `file:` Dependencies werden diese als "invalid" markiert und das Packaging schlägt fehl.

### Lösung: Webpack Bundling

**Was wir gemacht haben:**
1. Webpack installiert: `webpack`, `webpack-cli`, `ts-loader`
2. `webpack.config.js` erstellt mit target: 'node' und externals: vscode
3. package.json scripts angepasst:
   - `vscode:prepublish`: "npm run package"
   - `package`: "webpack --mode production --devtool hidden-source-map"
   - `compile`: "webpack"
   - `watch`: "webpack --watch"
4. `.vscodeignore` erweitert: `node_modules/**` und `webpack.config.js` excluded

**Resultat:**
- Gesamter Code + npm-shared-library-core wird in EINE Datei gebundelt: `dist/extension.js` (35.3 KB)
- KEINE node_modules im VSIX Package nötig
- Package Größe: 73.65 KB (54 Dateien)

### Fix in npm-shared-library-core

**Problem:** `overrides` in package.json verursachte Konflikte
```json
"overrides": {
  "glob": "^9.0.0"
}
```

**Fix:** 
- `overrides` Sektion aus `/npm-shared-library-core/package.json` entfernt
- `npm install` neu ausgeführt
- glob dependency sauber aufgelöst

## TODO: Cleanup für Production Release

### Wenn npm-shared-library-core über npm/git verfügbar ist:

1. **package.json dependencies ändern:**
   ```json
   "dependencies": {
     "@winccoa-tools-pack/core-utils": "^0.1.0"  // statt file:../npm-shared-library-core
   }
   ```
   
   ODER via git:
   ```json
   "dependencies": {
     "@winccoa-tools-pack/core-utils": "git+https://github.com/winccoa-tools-pack/npm-shared-library-core.git#v0.1.0"
   }
   ```

2. **Webpack Bundling beibehalten:**
   - Auch mit npm/git Dependencies ist Webpack die beste Lösung
   - Performance: Nur eine Datei laden statt hunderte Module
   - Keine Runtime Dependency Resolution nötig
   - Schnellere Extension Aktivierung
   
   **→ NICHT zurück zu node_modules packaging gehen!**

3. **npm install testen:**
   ```bash
   npm install
   npm run package
   npx vsce package --out bin/winccoa-core-0.1.0.vsix
   ```

4. **Publish Workflow:**
   - npm-shared-library-core zu npm registry publishen: `npm publish --access public`
   - ODER: GitHub Packages verwenden
   - package.json dependency aktualisieren
   - CI/CD Pipeline anpassen

## Empfohlener Workflow für andere Extensions

1. **Extension Dependencies:**
   ```json
   "extensionDependencies": [
     "winccoa-tools-pack.winccoa-core"
   ]
   ```

2. **API Usage:**
   ```typescript
   import * as vscode from 'vscode';
   
   const coreExtension = vscode.extensions.getExtension('winccoa-tools-pack.winccoa-core');
   if (coreExtension) {
     const api = coreExtension.exports;
     const currentProject = api.getCurrentProject();
     // ...
   }
   ```

3. **Auch für andere Extensions Webpack verwenden:**
   - Konsistente Build-Strategie
   - Bessere Performance
   - Kleinere Package-Größen

## Notes

- **Webpack ist die langfristige Lösung**, nicht ein Workaround
- Die `file:` dependency war nur für lokale Entwicklung/Testing
- Production Extensions sollten IMMER gebundelt werden
- Source Maps sind inkludiert für Debugging (`hidden-source-map`)
