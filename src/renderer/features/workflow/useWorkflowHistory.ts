import { useReducer, useCallback, useMemo } from 'react'
import type { WorkflowGraph } from './types'

export const MAX_WORKFLOW_HISTORY = 40

export interface HistoryState {
  past: WorkflowGraph[]
  present: WorkflowGraph
  future: WorkflowGraph[]
}

export type HistoryAction =
  | {
      type: 'SET_GRAPH'
      updater: WorkflowGraph | ((prev: WorkflowGraph) => WorkflowGraph)
      addToHistory?: boolean
    }
  | { type: 'RECORD_SNAPSHOT'; snapshot: WorkflowGraph }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; newGraph: WorkflowGraph }

/**
 * Deep clones a WorkflowGraph (nodes and edges) to guarantee immutability
 * across undo/redo stack transitions.
 */
export function cloneWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      params: { ...node.params },
      inputFiles: node.inputFiles ? [...node.inputFiles] : undefined,
      outputFiles: node.outputFiles ? [...node.outputFiles] : undefined
    })),
    edges: graph.edges.map((edge) => ({ ...edge }))
  }
}

/**
 * Pure history reducer managing past/present/future stacks for workflow canvas graphs.
 */
export function workflowHistoryReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'SET_GRAPH': {
      const { updater, addToHistory = true } = action
      const newGraph = typeof updater === 'function' ? updater(state.present) : updater

      if (!addToHistory) {
        return {
          ...state,
          present: newGraph
        }
      }

      return {
        past: [...state.past.slice(-(MAX_WORKFLOW_HISTORY - 1)), cloneWorkflowGraph(state.present)],
        present: cloneWorkflowGraph(newGraph),
        future: []
      }
    }

    case 'RECORD_SNAPSHOT': {
      return {
        past: [...state.past.slice(-(MAX_WORKFLOW_HISTORY - 1)), cloneWorkflowGraph(action.snapshot)],
        present: state.present,
        future: []
      }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, state.past.length - 1)
      return {
        past: newPast,
        present: cloneWorkflowGraph(previous),
        future: [cloneWorkflowGraph(state.present), ...state.future].slice(0, MAX_WORKFLOW_HISTORY)
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const newFuture = state.future.slice(1)
      return {
        past: [...state.past.slice(-(MAX_WORKFLOW_HISTORY - 1)), cloneWorkflowGraph(state.present)],
        present: cloneWorkflowGraph(next),
        future: newFuture
      }
    }

    case 'RESET': {
      return {
        past: [],
        present: cloneWorkflowGraph(action.newGraph),
        future: []
      }
    }

    default:
      return state
  }
}

export interface UseWorkflowHistoryReturn {
  graph: WorkflowGraph
  setGraph: (
    action: WorkflowGraph | ((prev: WorkflowGraph) => WorkflowGraph),
    addToHistory?: boolean
  ) => void
  recordSnapshot: (snapshot: WorkflowGraph) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  resetHistory: (newGraph: WorkflowGraph) => void
  historyCounts: { past: number; future: number }
}

/**
 * Custom React hook providing bounded Undo/Redo history tracking for visual workflow graphs.
 */
export function useWorkflowHistory(initialGraph: WorkflowGraph): UseWorkflowHistoryReturn {
  const [state, dispatch] = useReducer(workflowHistoryReducer, undefined, () => ({
    past: [],
    present: cloneWorkflowGraph(initialGraph),
    future: []
  }))

  const setGraph = useCallback(
    (
      action: WorkflowGraph | ((prev: WorkflowGraph) => WorkflowGraph),
      addToHistory = true
    ) => {
      dispatch({
        type: 'SET_GRAPH',
        updater: action,
        addToHistory
      })
    },
    []
  )

  const recordSnapshot = useCallback((snapshot: WorkflowGraph) => {
    dispatch({ type: 'RECORD_SNAPSHOT', snapshot })
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

  const resetHistory = useCallback((newGraph: WorkflowGraph) => {
    dispatch({ type: 'RESET', newGraph })
  }, [])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0

  return useMemo(
    () => ({
      graph: state.present,
      setGraph,
      recordSnapshot,
      undo,
      redo,
      canUndo,
      canRedo,
      resetHistory,
      historyCounts: { past: state.past.length, future: state.future.length }
    }),
    [
      state.present,
      state.past.length,
      state.future.length,
      setGraph,
      recordSnapshot,
      undo,
      redo,
      resetHistory,
      canUndo,
      canRedo
    ]
  )
}
