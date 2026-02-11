# Language Model Tools Integration Plan - Project Admin v2.0.0

## Executive Summary

Integration der **WinCC OA Project Admin Extension** mit GitHub Copilot via Language Model Tools API. Dies ermöglicht AI-Assistenten autonomen Zugriff auf Projekt-Management-Funktionen.

**Version**: 2.0.0 (Major - neue AI Integration)
**Referenzen**: LogViewer v2.0.0, Script Actions v2.0.0

---

## 🎯 Ziele

1. **Autonomer Projekt-Zugriff**: Copilot kann Projekte auflisten, starten, stoppen
2. **Status-Abfragen**: Echtzeit-Informationen über PMON/Manager-Status
3. **Projekt-Management**: Register/Unregister via Natural Language
4. **Manager-Steuerung**: Start/Stop von einzelnen Managern

---

## 📊 Technologie-Analyse (basierend auf LogViewer & Script Actions)

### Architektur-Pattern (von LogViewer übernommen)

```typescript
// src/languageModelTools.ts
export class LanguageModelToolsService {
    private disposables: vscode.Disposable[] = [];
    
    register(context: vscode.ExtensionContext): void {
        // Register tools via vscode.lm.registerTool()
        this.disposables.push(
            vscode.lm.registerTool('tool_name', new ToolClass())
        );
    }
    
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
```

### Tool-Definition (package.json)

```json
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "tool_name",
        "displayName": "Human-Readable Name",
        "modelDescription": "Description for AI (when to use this tool)",
        "canBeReferencedInPrompt": true,
        "toolReferenceName": "short_name",
        "icon": "$(icon-name)",
        "userDescription": "Description for users",
        "inputSchema": {
          "type": "object",
          "properties": { /* JSON Schema */ },
          "required": ["field1", "field2"]
        }
      }
    ]
  }
}
```

### Tool-Implementierung Pattern

```typescript
class MyTool implements vscode.LanguageModelTool<MyInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<MyInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            // Business logic here
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ success: true, data: result }, null, 2)
                )
            ]);
        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    }, null, 2)
                )
            ]);
        }
    }
}
```

---

## 🛠️ Vorgeschlagene Tools für Project Admin

### 1. **Project Management Tools**

#### 1.1 `winccoa_list_projects`

**Zweck**: Liste alle registrierten WinCC OA Projekte mit Status

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "includeSubprojects": {
      "type": "boolean",
      "description": "Include subproject information (default: false)"
    },
    "statusFilter": {
      "type": "string",
      "enum": ["all", "running", "stopped", "error"],
      "description": "Filter by project status (default: 'all')"
    }
  }
}
```

**Output Example**:

```json
{
  "success": true,
  "projects": [
    {
      "id": "MyProject",
      "name": "MyProject",
      "version": "3.21",
      "status": "running",
      "path": "C:/Projects/MyProject",
      "subprojects": ["SubProj1", "SubProj2"]
    }
  ]
}
```

**Use Case**:

- "Show me all running WinCC OA projects"
- "Which projects are registered?"
- "List all projects with version 3.19"

---

#### 1.2 `winccoa_get_project_info`

**Zweck**: Detaillierte Informationen über ein spezifisches Projekt

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID or name"
    }
  },
  "required": ["projectId"]
}
```

**Output Example**:

```json
{
  "success": true,
  "project": {
    "id": "MyProject",
    "name": "MyProject",
    "version": "3.21",
    "status": "running",
    "projectDir": "C:/Projects/MyProject",
    "installDir": "C:/Siemens/Automation/WinCC_OA/3.21",
    "configPath": "C:/Projects/MyProject/config/config",
    "subprojects": ["SubProj1", "SubProj2"],
    "pmonStatus": {
      "running": true,
      "startTime": "2026-01-24T10:30:00Z"
    }
  }
}
```

**Use Case**:

- "What version is MyProject using?"
- "Show me details about the DevEnv project"
- "Where is MyProject installed?"

---

#### 1.3 `winccoa_register_project`

**Zweck**: Registriere ein neues WinCC OA Projekt

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectPath": {
      "type": "string",
      "description": "Absolute path to project directory"
    },
    "autoDetectVersion": {
      "type": "boolean",
      "description": "Auto-detect version from config file (default: true)"
    },
    "version": {
      "type": "string",
      "description": "WinCC OA version (e.g., '3.21'), required if autoDetectVersion=false"
    }
  },
  "required": ["projectPath"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Project 'MyProject' registered successfully",
  "projectId": "MyProject",
  "version": "3.21"
}
```

**Use Case**:

- "Register the project at C:/Projects/NewProject"
- "Add the WinCC OA project in D:/WinCCProjects/Test"

---

#### 1.4 `winccoa_unregister_project`

**Zweck**: Deregistriere ein WinCC OA Projekt

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID to unregister"
    },
    "stopIfRunning": {
      "type": "boolean",
      "description": "Stop project if currently running (default: true)"
    }
  },
  "required": ["projectId"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Project 'OldProject' unregistered successfully",
  "wasStopped": true
}
```

**Use Case**:

- "Unregister the OldProject"
- "Remove TestProject from registry"

---

### 2. **PMON Control Tools**

#### 2.1 `winccoa_start_project`

**Zweck**: Starte PMON für ein Projekt (inklusive aller Manager)

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID to start"
    },
    "waitForStartup": {
      "type": "boolean",
      "description": "Wait for PMON to fully start (default: false)"
    }
  },
  "required": ["projectId"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Project 'MyProject' started successfully",
  "pmonStatus": "running"
}
```

**Use Case**:

- "Start the MyProject"
- "Launch DevEnv project"

---

#### 2.2 `winccoa_stop_project`

**Zweck**: Stoppe PMON für ein Projekt

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID to stop"
    },
    "timeout": {
      "type": "number",
      "description": "Timeout in seconds (default: 10)"
    }
  },
  "required": ["projectId"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Project 'MyProject' stopped successfully"
}
```

**Use Case**:

- "Stop the MyProject"
- "Shutdown DevEnv"

---

#### 2.3 `winccoa_get_pmon_status`

**Zweck**: PMON Status-Abfrage für ein Projekt

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID to check"
    }
  },
  "required": ["projectId"]
}
```

**Output Example**:

```json
{
  "success": true,
  "projectId": "MyProject",
  "pmonStatus": {
    "running": true,
    "startTime": "2026-01-24T10:30:00Z",
    "uptime": "3h 45m",
    "mode": "normal"
  }
}
```

**Use Case**:

- "Is MyProject running?"
- "Check PMON status for DevEnv"

---

### 3. **Manager Control Tools**

#### 3.1 `winccoa_list_managers`

**Zweck**: Liste alle Manager eines Projekts

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID (uses current project if not specified)"
    },
    "statusFilter": {
      "type": "string",
      "enum": ["all", "running", "stopped"],
      "description": "Filter by manager status (default: 'all')"
    }
  }
}
```

**Output Example**:

```json
{
  "success": true,
  "projectId": "MyProject",
  "managers": [
    {
      "name": "DIST_1",
      "num": 1,
      "state": "running",
      "mode": "always",
      "secKill": 30,
      "restartCount": 2
    },
    {
      "name": "EVENT_1",
      "num": 2,
      "state": "running",
      "mode": "manual"
    }
  ]
}
```

**Use Case**:

- "Show all managers in MyProject"
- "Which managers are running?"
- "List stopped managers"

---

#### 3.2 `winccoa_start_manager`

**Zweck**: Starte einen einzelnen Manager

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID (uses current project if not specified)"
    },
    "managerNum": {
      "type": "number",
      "description": "Manager number (e.g., 1 for DIST_1)"
    }
  },
  "required": ["managerNum"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Manager DIST_1 started successfully"
}
```

**Use Case**:

- "Start manager DIST_1"
- "Launch the Event manager"

---

#### 3.3 `winccoa_stop_manager`

**Zweck**: Stoppe einen einzelnen Manager

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID (uses current project if not specified)"
    },
    "managerNum": {
      "type": "number",
      "description": "Manager number"
    }
  },
  "required": ["managerNum"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Manager EVENT_1 stopped successfully"
}
```

**Use Case**:

- "Stop manager EVENT_1"
- "Kill the UI manager"

---

#### 3.4 `winccoa_restart_manager`

**Zweck**: Restart einen Manager (Stop + Start)

**Input Schema**:

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project ID (uses current project if not specified)"
    },
    "managerNum": {
      "type": "number",
      "description": "Manager number"
    }
  },
  "required": ["managerNum"]
}
```

**Output Example**:

```json
{
  "success": true,
  "message": "Manager CTRL_1 restarted successfully"
}
```

**Use Case**:

- "Restart manager CTRL_1"
- "Reload the Data manager"

---

## 📋 Tool-Übersicht (Prioritäten)

| Priority | Tool Name | Category | Complexity | Impact |
| ---------- | ----------- | ---------- | ------------ | -------- |
| **P0** | `winccoa_list_projects` | Project Mgmt | Low | High |
| **P0** | `winccoa_get_project_info` | Project Mgmt | Low | High |
| **P0** | `winccoa_start_project` | PMON Control | Medium | High |
| **P0** | `winccoa_stop_project` | PMON Control | Medium | High |
| **P1** | `winccoa_get_pmon_status` | PMON Control | Low | Medium |
| **P1** | `winccoa_list_managers` | Manager Control | Medium | High |
| **P2** | `winccoa_start_manager` | Manager Control | Medium | Medium |
| **P2** | `winccoa_stop_manager` | Manager Control | Medium | Medium |
| **P2** | `winccoa_restart_manager` | Manager Control | Medium | Medium |
| **P3** | `winccoa_register_project` | Project Mgmt | High | Low |
| **P3** | `winccoa_unregister_project` | Project Mgmt | High | Low |

**Gesamt**: 11 Tools (6 P0/P1, 3 P2, 2 P3)

---

## 🎨 Use Case Szenarien

### Scenario 1: Projekt-Übersicht

```text
User: "Show me all WinCC OA projects and their status"

Copilot:
1. Calls: winccoa_list_projects({ statusFilter: "all" })
2. Presents: Table with project names, versions, status
```

### Scenario 2: Projekt starten/stoppen

```text
User: "Start the DevEnv project"

Copilot:
1. Calls: winccoa_get_project_info({ projectId: "DevEnv" })
2. Checks: Status is "stopped"
3. Calls: winccoa_start_project({ projectId: "DevEnv", waitForStartup: true })
4. Confirms: "Project started successfully"
```

### Scenario 3: Manager-Debugging

```text
User: "Which managers are running in MyProject?"

Copilot:
1. Calls: winccoa_list_managers({ projectId: "MyProject", statusFilter: "running" })
2. Presents: List of running managers with numbers
```

### Scenario 4: Manager-Neustart

```text
User: "Restart the CTRL manager in MyProject"

Copilot:
1. Calls: winccoa_list_managers({ projectId: "MyProject" })
2. Finds: CTRL_1 has num=5
3. Calls: winccoa_restart_manager({ projectId: "MyProject", managerNum: 5 })
4. Confirms: "Manager restarted"
```

### Scenario 5: Projekt-Registrierung

```text
User: "Register the project at C:/Projects/NewProj"

Copilot:
1. Calls: winccoa_register_project({ 
     projectPath: "C:/Projects/NewProj",
     autoDetectVersion: true
   })
2. Confirms: "Project 'NewProj' registered with version 3.21"
```

---

## 🏗️ Implementierungs-Plan

### Phase 1: Core Infrastructure (Week 1)

- [ ] Create `src/languageModelTools.ts`
- [ ] Implement `LanguageModelToolsService` base class
- [ ] Add registration in `extension.ts`
- [ ] Update `package.json` with `languageModelTools` contributions

### Phase 2: P0 Tools (Week 1-2)

- [ ] `winccoa_list_projects`
- [ ] `winccoa_get_project_info`
- [ ] `winccoa_start_project`
- [ ] `winccoa_stop_project`

### Phase 3: P1 Tools (Week 2)

- [ ] `winccoa_get_pmon_status`
- [ ] `winccoa_list_managers`

### Phase 4: P2 Tools (Week 3)

- [ ] `winccoa_start_manager`
- [ ] `winccoa_stop_manager`
- [ ] `winccoa_restart_manager`

### Phase 5: P3 Tools (Week 3-4)

- [ ] `winccoa_register_project`
- [ ] `winccoa_unregister_project`

### Phase 6: Testing & Documentation (Week 4)

- [ ] Integration Tests mit GitHub Copilot
- [ ] User Documentation
- [ ] Update CHANGELOG.md für v2.0.0
- [ ] Release Notes

---

## 🔒 Security Considerations

### 1. **Destructive Operations**

Tools wie `winccoa_stop_project`, `winccoa_unregister_project` sind **destructive**.

**Mitigation**:

- Confirmation Dialogs vor Ausführung
- Clear warnings in `modelDescription`
- Read-only mode toggle in settings

### 2. **Path Validation**

`winccoa_register_project` nimmt User-Paths entgegen.

**Mitigation**:

- Validate path exists
- Check for valid `config/config` file
- Prevent directory traversal attacks

### 3. **Error Handling**

PMON-Calls können fehlschlagen (z.B. Permission denied, Version mismatch).

**Mitigation**:

- Try/Catch um alle PMON-Calls
- Detaillierte Error-Messages
- Graceful degradation

---

## 📊 Metrics & Success Criteria

### Technical Metrics

- **Tool Invocation Success Rate**: >95%
- **Average Response Time**: <500ms
- **Error Rate**: <2%

### User Metrics

- **Tool Discovery**: 80% of users try at least one tool in first week
- **Repeat Usage**: 50% of users use tools 5+ times per week
- **User Satisfaction**: >4.5/5 stars

---

## 🔄 Dependencies

### Required Extensions

- `RichardJanisch.winccoa-project-admin` (this extension)
- VS Code Engine: `^1.107.1` (Language Model Tools API)

### NPM Packages

- `@winccoa-tools-pack/npm-winccoa-core` (existing dependency)

### API Requirements

- `vscode.lm.registerTool()` (VS Code 1.107+)
- `vscode.LanguageModelTool` interface
- `vscode.LanguageModelToolResult` class

---

## 📝 Documentation Requirements

### User Documentation

1. **README.md**: Add "AI Integration" section
2. **GitHub Wiki**: Create "Using with GitHub Copilot" page
3. **Examples**: Sample prompts for each tool

### Developer Documentation

1. **Architecture.md**: Document Language Model Tools design
2. **API.md**: Tool schemas and response formats
3. **Testing.md**: How to test tools with Copilot

---

## 🚀 Release Strategy

### v2.0.0 Breaking Changes

- **Minimum VS Code Version**: Bump to 1.107.1
- **Activation Events**: Add Language Model Tool activation

### Migration Path

- v1.x users auto-upgrade (no config changes needed)
- New tools are opt-in (work alongside existing UI)

### Rollout

1. **Beta**: Limited user group (internal testing)
2. **RC**: Public release candidate (1 week)
3. **GA**: General Availability
4. **Monitoring**: Track tool usage metrics

---

## 🎯 Future Enhancements (v2.1+)

### Additional Tools

- `winccoa_get_datapoint_value` - Datapoint value queries
- `winccoa_set_datapoint_value` - Write to datapoints
- `winccoa_get_alarms` - Query alarm list
- `winccoa_export_project_config` - Export project configuration

### Advanced Features

- **Batch Operations**: Start/stop multiple managers at once
- **Scheduled Tasks**: Schedule PMON restarts
- **Health Monitoring**: Automatic issue detection
- **Performance Metrics**: CPU/Memory usage via tools

---

## ✅ Acceptance Criteria

### Minimum Viable Product (MVP)

- [ ] All P0 tools implemented and tested
- [ ] Package.json contributions complete
- [ ] Basic documentation available
- [ ] Integration tests pass with GitHub Copilot

### Full Release

- [ ] All P0-P2 tools implemented
- [ ] Comprehensive error handling
- [ ] Full documentation (user + developer)
- [ ] Performance benchmarks met
- [ ] Security review completed

---

## 📞 Stakeholder Sign-off

- [ ] Product Owner: Approve tool selection
- [ ] Engineering Lead: Approve architecture
- [ ] Security Team: Approve security mitigations
- [ ] Documentation Team: Approve docs plan

---

**Document Version**: 1.0
**Last Updated**: 2026-01-24
**Author**: GitHub Copilot Analysis
**Status**: 🟡 Planning Phase
