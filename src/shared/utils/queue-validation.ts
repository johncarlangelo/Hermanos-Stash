import type { ToolDefinition } from '../../shared/types/tool'

/**
 * Queue capability validation (Milestone 9).
 *
 * Validates that a sequence of tools can be chained together by checking
 * capability compatibility: each step's outputs must satisfy the next step's
 * inputs. Runs in both renderer (preview) and main (enforcement).
 */

export interface ValidationError {
  stepIndex: number
  toolId: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * Check if tool A's outputs can feed tool B's inputs.
 */
function canChain(
  from: ToolDefinition,
  to: ToolDefinition
): { ok: boolean; reason?: string } {
  const acceptsFiles = to.capabilities.acceptsFiles
  const acceptsText = to.capabilities.acceptsText
  const producesFiles = from.capabilities.producesFiles
  const producesText = from.capabilities.producesText

  // Tool B must accept at least one thing
  if (!acceptsFiles && !acceptsText) {
    return {
      ok: false,
      reason: `"${to.name}" does not accept files or text input`
    }
  }

  // At least one accepted input type must match a produced output type
  const hasFileMatch = acceptsFiles && producesFiles
  const hasTextMatch = acceptsText && producesText

  if (!hasFileMatch && !hasTextMatch) {
    const needed = []
    if (acceptsFiles) needed.push('files')
    if (acceptsText) needed.push('text')
    const provided = []
    if (producesFiles) provided.push('files')
    if (producesText) provided.push('text')
    
    // Match expected test messages: "requires files" or "requires text"
    if (needed.length === 1) {
      return {
        ok: false,
        reason: `"${to.name}" requires ${needed[0]} but "${from.name}" does not produce ${needed[0]}`
      }
    }
    
    return {
      ok: false,
      reason: `"${to.name}" needs ${needed.join(' or ')} but "${from.name}" provides ${provided.length ? provided.join(' or ') : 'neither'}`
    }
  }

  return { ok: true }
}

/**
 * Validate an entire queue chain.
 */
export function validateQueueChain(tools: ToolDefinition[]): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (tools.length === 0) {
    return { valid: true, errors: [], warnings: [] }
  }

  // Check warnings for single-tool and multi-tool chains
  const hasFileProducer = tools.some((t) => t.capabilities.producesFiles)
  const hasFileConsumer = tools.some((t) => t.capabilities.acceptsFiles)
  const hasTextProducer = tools.some((t) => t.capabilities.producesText)
  const hasTextConsumer = tools.some((t) => t.capabilities.acceptsText)

  if (hasFileConsumer && !hasFileProducer) {
    warnings.push({
      stepIndex: 0,
      toolId: tools[0].id,
      message: 'Chain consumes files but no step produces files — drop a file to start'
    })
  }

  if (hasTextConsumer && !hasTextProducer && !hasFileProducer) {
    warnings.push({
      stepIndex: 0,
      toolId: tools[0].id,
      message: 'Chain consumes text but no step produces text — provide text input'
    })
  }

  if (tools.length < 2) {
    return { valid: true, errors: [], warnings }
  }

  for (let i = 0; i < tools.length - 1; i++) {
    const from = tools[i]
    const to = tools[i + 1]
    const result = canChain(from, to)

    if (!result.ok) {
      errors.push({
        stepIndex: i + 1,
        toolId: to.id,
        message: result.reason ?? 'Incompatible tools'
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get the list of tools that can follow a given tool (for UI picker filtering).
 */
export function getCompatibleNextTools(
  currentTool: ToolDefinition,
  allTools: ToolDefinition[]
): ToolDefinition[] {
  return allTools.filter((t) => canChain(currentTool, t).ok)
}

/**
 * Get the list of tools that can precede a given tool (for UI picker filtering).
 */
export function getCompatiblePreviousTools(
  currentTool: ToolDefinition,
  allTools: ToolDefinition[]
): ToolDefinition[] {
  return allTools.filter((t) => canChain(t, currentTool).ok)
}