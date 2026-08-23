import { lazy } from 'react'
import { toolRegistry } from '../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../shared/types/tool'

/**
 * Single registration point for every tool in the catalog.
 *
 * A tool ships as:
 *   1. a `ToolDefinition` (this file) — searchable metadata,
 *   2. a view component mapped in `componentMap` below,
 *   3. pure logic + tests colocated with the implementation.
 *
 * The shell discovers everything through the shared registry; adding a tool
 * never requires touching unrelated application code (ARCHITECTURE.md).
 */

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'json-format',
    name: 'JSON Formatter',
    category: 'text',
    description: 'Pretty-print, minify and validate JSON with precise error locations.',
    tags: ['json', 'format', 'validate', 'minify', 'pretty'],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'base64-codec',
    name: 'Base64 Encoder / Decoder',
    category: 'text',
    description: 'Convert text to Base64 and back, with correct Unicode handling.',
    tags: ['base64', 'encode', 'decode', 'text', 'binary'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'file-metadata',
    name: 'File Metadata Viewer',
    category: 'files',
    description: 'Inspect size, dates, MIME type and full path for any local file.',
    tags: ['metadata', 'properties', 'size', 'dates', 'inspect'],
    icon: 'folder',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      supportsBatch: true
    }
  }
]

for (const definition of TOOL_DEFINITIONS) {
  toolRegistry.register(definition)
}

/** Lazily-loaded view per tool id. */
const JsonFormatTool = lazy(() => import('./json-format/JsonFormatTool'))
const Base64Tool = lazy(() => import('./base64/Base64Tool'))
const FileMetadataTool = lazy(() => import('./file-metadata/FileMetadataTool'))

export const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'json-format': JsonFormatTool,
  'base64-codec': Base64Tool,
  'file-metadata': FileMetadataTool
}
