# Hermanos Stash — Tool Architecture Specification

## Purpose

This document defines how tools are added so Stash can grow without becoming a monolith.

## Tool identity

Every tool requires:

- `id`: stable machine identifier (e.g. `pdf-merge`, `image-convert`)
- `name`: user-facing tool title
- `category`: standard category ID (`files` | `documents` | `images` | `video` | `audio` | `text` | `developer` | `future`)
- `description`: concise explanation of tool function
- `tags`: array of searchable keywords
- `icon`: Lucide icon name or SVG representation
- `version`: semantic version string (e.g. `1.0.0`)

IDs should not change after release.

## Capability model

A tool should declare capabilities such as:

- acceptsFiles
- acceptsMultipleFiles
- acceptsText
- producesFiles
- producesText
- supportsProgress
- supportsCancellation
- supportsBatch
- requiresNativeProcessor

## Tool lifecycle

```text
DISCOVER
   ↓
INPUT
   ↓
VALIDATE
   ↓
PROCESS
   ↓
VERIFY RESULT
   ↓
PRESENT RESULT
   ↓
HISTORY
```

## Standard states

Every file-processing tool should consider:

- idle
- dragOver
- validating
- ready
- processing
- success
- partialSuccess
- cancelled
- error

## Errors

Errors must be structured.

Prefer:

```text
{
  code,
  userMessage,
  technicalMessage,
  recoverable,
  cause
}
```

Users should see actionable language.

Do not expose raw stack traces in normal UI.

## Results

Results should describe:

- output path;
- output filename;
- MIME type;
- size;
- duration where useful;
- warnings;
- whether the output was verified.

## History integration

A successful or failed tool operation should optionally emit an activity record.

The tool should not directly manipulate the database. Use a shared history service.

## UI contract

Tools should use shared components for:

- file input;
- drop surfaces;
- buttons;
- progress;
- result cards;
- errors;
- notifications;
- metadata;
- empty states.

Do not duplicate these components inside every tool.

## Tool testing

Each tool should have tests appropriate to its behavior.

For file processors, include:

- valid input;
- invalid input;
- empty input;
- boundary case;
- output existence;
- output validity where practical;
- cleanup behavior;
- cancellation if supported.

## Adding a tool checklist

- [ ] Define stable ID.
- [ ] Choose category and tags.
- [ ] Add metadata.
- [ ] Implement processor/service.
- [ ] Implement UI.
- [ ] Handle all relevant states.
- [ ] Add tests.
- [ ] Register tool.
- [ ] Add searchable metadata.
- [ ] Verify favorite/recent behavior.
- [ ] Verify history integration.
- [ ] Run build and verification.
