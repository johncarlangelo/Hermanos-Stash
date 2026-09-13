/**
 * Hermanos Stash — Visual Workflow Engine Types
 *
 * Defines the core data models for the Queue workflow canvas view:
 * nodes, ports, edges, graphs, execution status, and persisted templates.
 */

export type PortType = 'files' | 'text'
export type PortDirection = 'in' | 'out'

export interface WorkflowPort {
  id: string
  type: PortType
  direction: PortDirection
  label: string
}

export type NodeExecutionStatus = 'idle' | 'pending' | 'running' | 'success' | 'error'

export interface WorkflowNode {
  id: string
  toolId: string
  position: { x: number; y: number }
  params: Record<string, unknown>
  customLabel?: string
  status?: NodeExecutionStatus
  progress?: number // 0 to 100
  error?: string
  durationMs?: number
  inputFiles?: string[]
  outputFiles?: string[]
  inputText?: string
  outputText?: string
}

export interface WorkflowEdge {
  id: string
  fromNodeId: string
  fromPort: PortType
  toNodeId: string
  toPort: PortType
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category?: string
  tags: string[]
  graph: WorkflowGraph
  createdAt: number
  updatedAt: number
}

export interface WorkflowExecutionResult {
  success: boolean
  durationMs: number
  nodeResults: Record<
    string,
    {
      status: NodeExecutionStatus
      inputFiles: string[]
      outputFiles: string[]
      durationMs: number
      error?: string
    }
  >
  finalOutputFiles: string[]
  finalOutputText?: string
}
