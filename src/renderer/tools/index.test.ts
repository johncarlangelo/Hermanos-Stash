import { describe, expect, it } from 'vitest'
import { TOOL_COMPONENTS, TOOL_DEFINITIONS } from './index'
import { toolRegistry } from '../../shared/tool-registry/registry'

/**
 * Guards against definition/component drift (AGENTS.md principle 11):
 * a tool may never be searchable in the catalog without a shipped view.
 */
describe('tool catalog integrity', () => {
  it('registers every definition exactly once', () => {
    const seen = new Set<string>()
    for (const def of TOOL_DEFINITIONS) {
      expect(seen.has(def.id)).toBe(false)
      seen.add(def.id)
    }
    for (const id of TOOL_DEFINITIONS.map((d) => d.id)) {
      expect(toolRegistry.get(id), `registry must contain ${id}`).toBeDefined()
    }
  })

  it('has a view component for every registered definition', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(TOOL_COMPONENTS[def.id], `missing view component for "${def.id}"`).toBeDefined()
    }
  })

  it('has no orphan components without a definition', () => {
    const ids = new Set(TOOL_DEFINITIONS.map((d) => d.id))
    for (const componentId of Object.keys(TOOL_COMPONENTS)) {
      expect(ids.has(componentId), `orphan component for unknown tool "${componentId}"`).toBe(true)
    }
  })
})
