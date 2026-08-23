# Hermanos Stash — Product Requirements Document

## 1. Product

**Hermanos Stash** is a local-first desktop application that bundles practical file, document, media, text, developer, and general-purpose utilities into one cohesive workspace.

The name is tentative and should not constrain the product's visual identity.

## 2. Product thesis

People repeatedly encounter small file and data problems:

- "I need this PDF split."
- "Make these images smaller."
- "Convert this file."
- "Preview this document."
- "Format this JSON."
- "Extract audio from this video."
- "Turn these files into a ZIP."
- "What is this file's metadata?"

Instead of visiting a different website for every task, Stash should provide a single trusted local workspace.

## 3. Target users

Primary target: everyone who needs practical utilities.

The product should remain approachable to casual users while being powerful enough for developers, creators, students, office workers, and power users.

If universal UX becomes too complex, prioritize power-user efficiency without turning the product into a developer-only application.

## 4. Product constraints

- Installed desktop application, not a hosted website.
- Local processing by default.
- No account required.
- No cloud dependency for MVP.
- No paid AI API.
- Dark theme only for MVP.
- Tools remain inside the same application window.
- The application must remain useful offline for supported tools.

## 5. Core UX

The main workspace should make three actions obvious:

1. find a tool;
2. use the tool;
3. get the result.

Global search should be first-class.

Users should be able to:

- search tools;
- filter by category;
- filter by tags;
- favorite tools;
- see recent tools/history;
- navigate between tools without opening new windows;
- drag and drop files into supported tools.

## 6. Tool categories

Standardized categories:

### Files & Archives (`files`)
- File metadata viewer
- File hash generator
- ZIP create/extract
- Archive inspection
- Batch file utilities

### Documents & PDF (`documents`)
- PDF preview
- Merge PDF
- Split PDF
- Extract pages
- Rotate/reorder pages
- Compress PDF
- PDF → images
- Images → PDF
- PDF metadata

### Images (`images`)
- Image preview
- Convert formats
- Compress
- Resize
- Crop
- Rotate/flip
- Image metadata / EXIF
- Base64 ↔ image
- WebP conversion

### Video (`video`)
- Preview
- Convert
- Compress
- Trim
- Video → GIF
- Extract frames
- Change resolution/FPS
- Media metadata

### Audio (`audio`)
- Preview
- Convert
- Compress
- Trim
- Extract audio from video
- Metadata

### Text & Data (`text`)
- JSON formatter/validator/minifier
- XML formatter
- YAML ↔ JSON
- CSV ↔ JSON
- Markdown preview
- Markdown ↔ HTML
- Text diff
- Case converter
- Word/character counter
- URL encoder/decoder
- Base64 encoder/decoder
- Regex tester

### Developer (`developer`)
- JWT decoder
- Unix timestamp converter
- UUID generator
- Hash generator
- Color converter
- SQL formatter
- CSS/JS/JSON formatters
- URL parser
- MIME type lookup
- HTTP status reference
- QR generator

### Future (`future`)
Potential AI-adjacent utilities without requiring a paid API:

- prompt template organizer;
- prompt formatter;
- prompt variable/template builder;
- system-prompt playground;
- structured prompt generator;
- token estimation where practical;
- local prompt history.

These are candidates, not MVP commitments.

## 7. Recommended MVP

Do not attempt the entire catalog first.

### Milestone 1 — Foundation

- Electron shell
- React + TypeScript + Vite
- Tailwind CSS + CSS Modules + design tokens
- Secure preload/native bridge
- Design system & controls
- Routing/view system
- Tool registry
- Global search
- Category filters
- Tag filters
- Favorites
- Recent tool history
- Settings shell
- Error/notification system
- Drag/drop foundation
- File picker & save dialogs
- Temporary workspace manager & cleanup
- Progress & cancellation IPC event model
- Structured error normalization
- Local SQLite persistence

### Milestone 2 — Demonstration tools

Implement representative tools on top of the established processing foundation:

1. PDF preview
2. Image preview
3. JSON formatter/validator
4. Image converter
5. Image compressor
6. PDF merger
7. PDF splitter
8. ZIP creator/extractor
9. File metadata viewer
10. Base64 encoder/decoder
11. QR generator

### Milestone 3 — Native Media & Heavy Processing

- FFmpeg native integration
- Heavy media conversion & streaming
- Large-file background worker handling
- Advanced PDF/media optimization pipelines

### Milestone 4 — Expansion

Add tools by category without redesigning the core.

## 8. History / audit log

Include a lightweight local activity history.

It should record useful user-facing information such as:

- timestamp;
- tool used;
- input filename(s);
- operation;
- success/failure;
- output filename(s), where known;
- duration, where useful.

Do not store file contents.

History should be easy to clear and should never become a surveillance-style activity tracker.

## 9. Non-goals

For MVP, do not build:

- user accounts;
- cloud sync;
- subscriptions;
- remote processing;
- paid AI APIs;
- social features;
- collaboration;
- complex workflow automation;
- unnecessary telemetry.

## 10. Success criteria

Stash succeeds when:

- a user can discover a tool in seconds;
- supported files can be processed locally;
- tools behave consistently;
- adding a new tool is predictable;
- the UI feels like one product;
- the application remains responsive during long-running processing;
- failures are understandable and recoverable;
- the codebase can grow to dozens or hundreds of tools without becoming a monolith.
