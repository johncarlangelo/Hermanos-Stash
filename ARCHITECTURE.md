# Hermanos Stash — Architecture

## Recommended stack

### Desktop runtime
**Electron**

Reason: Stash is an installed desktop application requiring local filesystem access and native processing. Electron provides a mature Chromium + Node.js runtime and is especially practical for a JavaScript/TypeScript-heavy utility suite.

### Frontend
- React
- TypeScript
- Vite

### Styling
- Tailwind CSS + CSS Modules
- Global design tokens in CSS variables (derived from `DESIGN.md` and installed skills like `taste-skill`, `ui-ux-pro-max`, `awesome-design-md`)
- Consistent component primitives and utility styling

### Persistence
- SQLite
- local-only
- use a mature Node-compatible SQLite package

Store preferences, favorites, recent tools, and activity history. Never store file contents in the database.

### File/media processing
Use mature local libraries and native tools.

Likely examples:

- PDF.js for rendering;
- FFmpeg for media;
- appropriate PDF libraries for PDF manipulation;
- Sharp for image processing where appropriate;
- native Node filesystem APIs behind the preload bridge;
- ZIP/archive libraries as appropriate.

## Why Electron instead of a hosted web app?

Stash is explicitly an installed local application. A normal browser-based web app cannot reliably provide the same filesystem/native processing experience.

Electron's architecture separates the renderer from native APIs. The renderer should not receive unrestricted Node access.

## Process boundaries

```text
React Renderer
      │
      │ typed preload API
      ▼
Preload Bridge
      │
      ▼
Electron Main Process
      │
      ├── filesystem
      ├── child processes
      ├── SQLite
      ├── native dialogs
      └── processing services
```

Never expose arbitrary Node/Electron APIs to the renderer.

## Security

Use:

- context isolation;
- sandboxing where compatible;
- secure preload bridge;
- narrow IPC channels;
- explicit input validation;
- no arbitrary shell commands from renderer input;
- safe temporary directories;
- cleanup of temporary files.

## Tool registry

The application shell must not hard-code every tool.

Conceptual structure:

```text
ToolRegistry
 ├── discover()
 ├── get(id)
 ├── search(query)
 ├── byCategory(category)
 ├── byTag(tag)
 └── favorites()
```

Each tool declares metadata and behavior through a stable interface.

## Suggested project shape

```text
src/
  main/
    ipc/
    services/
    processing/
    storage/
  preload/
  renderer/
    app/
    components/
    features/
    tools/
    styles/
    routes/
  shared/
    types/
    constants/
    tool-registry/
```

Exact folders may evolve if the implementation has a better justified structure.

## Long-running work

Never freeze the renderer while processing files.

Long-running operations should:

- execute outside the renderer;
- report progress when possible;
- support cancellation when feasible;
- return structured results;
- handle failures;
- clean up temporary resources.

## File lifecycle

Prefer:

```text
input
  ↓
validate
  ↓
temporary workspace
  ↓
process
  ↓
verify output
  ↓
user chooses/save output
  ↓
cleanup
```

Do not leave abandoned temporary files.

## Future extensibility

A future tool should ideally require:

- a tool definition;
- processing service;
- UI;
- tests;
- registration.

It should not require modifications across unrelated parts of the application.

## Performance

- lazy-load heavy tool modules where useful;
- do not preload every heavyweight processor;
- avoid reading entire large files into renderer memory unnecessarily;
- stream or use temporary files for large media when possible;
- keep the main UI responsive.
