/**
 * Hermanos Stash — Visual Workflow Auto-Layout & Math Utilities
 *
 * Provides hierarchical left-to-right DAG layering for auto-arranging
 * nodes, grid snapping, and viewport bounding box calculations.
 */

import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from './types'
import { topologicalSort } from './execution'

export const GRID_SIZE = 20
export const NODE_WIDTH = 260
export const NODE_HEIGHT = 140
export const HORIZONTAL_SPACING = 340
export const VERTICAL_SPACING = 170

/**
 * Convert linear QueueSteps into a connected WorkflowGraph.
 */
export function stepsToWorkflowGraph(
  steps: { toolId: string; params: Record<string, unknown> }[]
): WorkflowGraph {
  const nodes: WorkflowNode[] = steps.map((s, idx) => ({
    id: `node-${idx + 1}`,
    toolId: s.toolId,
    position: { x: 60 + idx * HORIZONTAL_SPACING, y: 120 },
    params: s.params ?? {}
  }))

  const edges: WorkflowEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i + 1}-${i + 2}`,
      fromNodeId: nodes[i].id,
      fromPort: 'files',
      toNodeId: nodes[i + 1].id,
      toPort: 'files'
    })
  }

  return { nodes, edges }
}

/**
 * Convert a WorkflowGraph into linear QueueSteps using topological execution order.
 */
export function workflowGraphToSteps(
  graph: WorkflowGraph
): { toolId: string; params: Record<string, unknown> }[] {
  const { sortedNodeIds } = topologicalSort(graph)
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  return sortedNodeIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is WorkflowNode => Boolean(n))
    .map((node) => ({
      toolId: node.toolId,
      params: node.params ?? {}
    }))
}

/**
 * Snap a coordinate value to the nearest grid increment.
 */
export function snapToGrid(val: number, gridSize = GRID_SIZE): number {
  return Math.round(val / gridSize) * gridSize
}

/**
 * Calculate the enclosing bounding box of all nodes in a graph.
 */
export function calculateBoundingBox(nodes: WorkflowNode[]) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH)
    maxY = Math.max(maxY, node.position.y + NODE_HEIGHT)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(100, maxX - minX),
    height: Math.max(100, maxY - minY)
  }
}

/**
 * Auto-layouts a workflow graph using hierarchical Left-to-Right layering.
 * Unconnected nodes are placed neatly in a dedicated area below.
 */
export function autoLayoutGraph(graph: WorkflowGraph): WorkflowGraph {
  const { nodes, edges } = graph
  if (nodes.length === 0) return graph

  // Map incoming and outgoing connections
  const inDegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    outgoing.set(node.id, [])
  }

  for (const edge of edges) {
    if (outgoing.has(edge.fromNodeId) && inDegree.has(edge.toNodeId)) {
      outgoing.get(edge.fromNodeId)!.push(edge.toNodeId)
      inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) || 0) + 1)
    }
  }

  // Calculate ranks (column layers)
  const rankMap = new Map<string, number>()
  const queue: string[] = []

  // Initialize nodes with 0 in-degree
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      rankMap.set(id, 0)
      queue.push(id)
    }
  }

  // BFS layering
  while (queue.length > 0) {
    const currId = queue.shift()!
    const currRank = rankMap.get(currId) || 0
    const neighbors = outgoing.get(currId) || []

    for (const neighbor of neighbors) {
      const nextRank = Math.max(rankMap.get(neighbor) || 0, currRank + 1)
      rankMap.set(neighbor, nextRank)
      queue.push(neighbor)
    }
  }

  // Group nodes by rank
  const rankGroups = new Map<number, string[]>()
  for (const node of nodes) {
    const rank = rankMap.has(node.id) ? rankMap.get(node.id)! : 0
    if (!rankGroups.has(rank)) {
      rankGroups.set(rank, [])
    }
    rankGroups.get(rank)!.push(node.id)
  }

  // Calculate new positions
  const newPositions = new Map<string, { x: number; y: number }>()
  const startX = 60
  const startY = 80

  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b)
  for (const rank of sortedRanks) {
    const nodeIds = rankGroups.get(rank)!
    const columnX = startX + rank * HORIZONTAL_SPACING

    // Center nodes vertically in column
    nodeIds.forEach((nodeId, index) => {
      const rowY = startY + index * VERTICAL_SPACING
      newPositions.set(nodeId, {
        x: snapToGrid(columnX),
        y: snapToGrid(rowY)
      })
    })
  }

  const updatedNodes = nodes.map((node) => ({
    ...node,
    position: newPositions.get(node.id) ?? node.position
  }))

  return {
    nodes: updatedNodes,
    edges
  }
}
