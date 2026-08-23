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

export const TOOL_DEFINITIONS: ToolDefinition[] = []

for (const definition of TOOL_DEFINITIONS) {
  toolRegistry.register(definition)
}

/** Lazily-loaded view per tool id. */
export const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {}
