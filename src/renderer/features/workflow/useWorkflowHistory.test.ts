import { describe, expect, it } from 'vitest'
import {
  cloneWorkflowGraph,
  workflowHistoryReducer,
  MAX_WORKFLOW_HISTORY,
  type HistoryState
} from './useWorkflowHistory'
import type { WorkflowGraph, WorkflowNode } from './types'

describe('workflowHistoryReducer', () => {
  const emptyGraph: WorkflowGraph = { nodes: [], edges: [] }

  const makeNode = (id: string, x = 0, y = 0): WorkflowNode => ({
    id,
    toolId: 'json-format',
    position: { x, y },
    params: {}
  })

  it('initializes with empty past and future and cloned present', () => {
    const nodeA = makeNode('node-1')
    const initialGraph: WorkflowGraph = { nodes: [nodeA], edges: [] }
    const cloned = cloneWorkflowGraph(initialGraph)

    expect(cloned).toEqual(initialGraph)
    expect(cloned).not.toBe(initialGraph)
    expect(cloned.nodes[0]).not.toBe(initialGraph.nodes[0])
  })

  it('records previous graph in past when setGraph is called with addToHistory=true', () => {
    const state0: HistoryState = {
      past: [],
      present: emptyGraph,
      future: []
    }

    const graph1: WorkflowGraph = { nodes: [makeNode('node-1')], edges: [] }
    const state1 = workflowHistoryReducer(state0, {
      type: 'SET_GRAPH',
      updater: graph1,
      addToHistory: true
    })

    expect(state1.past.length).toBe(1)
    expect(state1.past[0]).toEqual(emptyGraph)
    expect(state1.present.nodes.length).toBe(1)
    expect(state1.present.nodes[0].id).toBe('node-1')
    expect(state1.future.length).toBe(0)
  })

  it('handles functional updaters correctly', () => {
    const state0: HistoryState = {
      past: [],
      present: { nodes: [makeNode('node-1')], edges: [] },
      future: []
    }

    const state1 = workflowHistoryReducer(state0, {
      type: 'SET_GRAPH',
      updater: (prev) => ({
        ...prev,
        nodes: [...prev.nodes, makeNode('node-2')]
      }),
      addToHistory: true
    })

    expect(state1.past.length).toBe(1)
    expect(state1.present.nodes.length).toBe(2)
    expect(state1.present.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2'])
  })

  it('does not touch past or future when addToHistory=false (transient update)', () => {
    const state0: HistoryState = {
      past: [emptyGraph],
      present: { nodes: [makeNode('node-1', 10, 10)], edges: [] },
      future: []
    }

    const state1 = workflowHistoryReducer(state0, {
      type: 'SET_GRAPH',
      updater: { nodes: [makeNode('node-1', 50, 50)], edges: [] },
      addToHistory: false
    })

    expect(state1.past.length).toBe(1)
    expect(state1.past[0]).toEqual(emptyGraph)
    expect(state1.present.nodes[0].position.x).toBe(50)
    expect(state1.future.length).toBe(0)
  })

  it('records pre-drag snapshot cleanly via RECORD_SNAPSHOT', () => {
    const preDragGraph: WorkflowGraph = { nodes: [makeNode('node-1', 0, 0)], edges: [] }
    const postDragGraph: WorkflowGraph = { nodes: [makeNode('node-1', 100, 200)], edges: [] }

    const state0: HistoryState = {
      past: [],
      present: postDragGraph,
      future: []
    }

    const state1 = workflowHistoryReducer(state0, {
      type: 'RECORD_SNAPSHOT',
      snapshot: preDragGraph
    })

    expect(state1.past.length).toBe(1)
    expect(state1.past[0].nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(state1.present.nodes[0].position).toEqual({ x: 100, y: 200 })

    // When undone, position reverts to 0,0
    const undone = workflowHistoryReducer(state1, { type: 'UNDO' })
    expect(undone.present.nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(undone.future.length).toBe(1)
    expect(undone.future[0].nodes[0].position).toEqual({ x: 100, y: 200 })

    // When redone, position restores to 100,200
    const redone = workflowHistoryReducer(undone, { type: 'REDO' })
    expect(redone.present.nodes[0].position).toEqual({ x: 100, y: 200 })
    expect(redone.future.length).toBe(0)
  })

  it('performs undo and redo cycles predictably', () => {
    let state: HistoryState = {
      past: [],
      present: emptyGraph,
      future: []
    }

    // Add node 1
    state = workflowHistoryReducer(state, {
      type: 'SET_GRAPH',
      updater: { nodes: [makeNode('node-1')], edges: [] }
    })
    // Add node 2
    state = workflowHistoryReducer(state, {
      type: 'SET_GRAPH',
      updater: { nodes: [makeNode('node-1'), makeNode('node-2')], edges: [] }
    })

    expect(state.past.length).toBe(2)
    expect(state.present.nodes.length).toBe(2)

    // Undo 1: back to 1 node
    state = workflowHistoryReducer(state, { type: 'UNDO' })
    expect(state.present.nodes.length).toBe(1)
    expect(state.future.length).toBe(1)

    // Undo 2: back to 0 nodes
    state = workflowHistoryReducer(state, { type: 'UNDO' })
    expect(state.present.nodes.length).toBe(0)
    expect(state.past.length).toBe(0)
    expect(state.future.length).toBe(2)

    // Redo 1: back to 1 node
    state = workflowHistoryReducer(state, { type: 'REDO' })
    expect(state.present.nodes.length).toBe(1)
    expect(state.past.length).toBe(1)
    expect(state.future.length).toBe(1)

    // Redo 2: back to 2 nodes
    state = workflowHistoryReducer(state, { type: 'REDO' })
    expect(state.present.nodes.length).toBe(2)
    expect(state.past.length).toBe(2)
    expect(state.future.length).toBe(0)
  })

  it('invalidates future branch when a new action is performed after undo', () => {
    let state: HistoryState = {
      past: [],
      present: emptyGraph,
      future: []
    }

    // Step 1: Add node 1
    state = workflowHistoryReducer(state, {
      type: 'SET_GRAPH',
      updater: { nodes: [makeNode('node-1')], edges: [] }
    })

    // Step 2: Add node 2
    state = workflowHistoryReducer(state, {
      type: 'SET_GRAPH',
      updater: { nodes: [makeNode('node-1'), makeNode('node-2')], edges: [] }
    })

    // Undo: Back to node 1 (node 2 is in future)
    state = workflowHistoryReducer(state, { type: 'UNDO' })
    expect(state.future.length).toBe(1)

    // Now branch: Add node 3 instead
    state = workflowHistoryReducer(state, {
      type: 'SET_GRAPH',
      updater: { nodes: [makeNode('node-1'), makeNode('node-3')], edges: [] }
    })

    // Future must be cleared
    expect(state.future.length).toBe(0)
    expect(state.present.nodes.map((n) => n.id)).toEqual(['node-1', 'node-3'])
  })

  it('caps history stack at MAX_WORKFLOW_HISTORY (40)', () => {
    let state: HistoryState = {
      past: [],
      present: emptyGraph,
      future: []
    }

    for (let i = 0; i < 50; i++) {
      state = workflowHistoryReducer(state, {
        type: 'SET_GRAPH',
        updater: { nodes: [makeNode(`node-${i}`)], edges: [] }
      })
    }

    expect(state.past.length).toBe(MAX_WORKFLOW_HISTORY)
  })

  it('resets past and future on RESET', () => {
    const state: HistoryState = {
      past: [emptyGraph],
      present: { nodes: [makeNode('node-1')], edges: [] },
      future: [emptyGraph]
    }

    const reset = workflowHistoryReducer(state, {
      type: 'RESET',
      newGraph: { nodes: [makeNode('fresh-node')], edges: [] }
    })

    expect(reset.past).toEqual([])
    expect(reset.future).toEqual([])
    expect(reset.present.nodes[0].id).toBe('fresh-node')
  })
})
