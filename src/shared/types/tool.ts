export type CategoryId =
  'files' | 'documents' | 'images' | 'video' | 'audio' | 'text' | 'developer' | 'future'

export interface ToolCapabilities {
  /** Tool consumes files selected or dropped by the user. */
  acceptsFiles?: boolean
  acceptsMultipleFiles?: boolean
  acceptsText?: boolean
  producesFiles?: boolean
  producesText?: boolean
  supportsProgress?: boolean
  supportsCancellation?: boolean
  supportsBatch?: boolean
}

/**
 * Static metadata for a tool. The renderer registry holds definitions only;
 * behavior is attached separately so this module stays environment-agnostic.
 */
export interface ToolDefinition {
  /** Stable machine identifier. Must never change after release. */
  id: string
  name: string
  category: CategoryId
  description: string
  tags: string[]
  /** Lucide icon name. */
  icon: string
  version: string
  capabilities: ToolCapabilities
  /** Whether this tool is currently in beta status. */
  isBeta?: boolean
}
