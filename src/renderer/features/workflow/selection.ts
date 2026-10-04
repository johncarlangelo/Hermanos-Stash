/**
 * Hermanos Stash — Visual Workflow Marquee Selection & Batch Operations
 *
 * Provides marquee bounding box intersection tests, multi-node dragging,
 * batch node deletion, and batch node duplication for the Queue Workflow canvas.
 */

import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from './types'
import { NODE_HEIGHT, NODE_WIDTH, snapToGrid } from './layout'

export interface MarqueeBox {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

/**
 * Find all workflow node IDs whose bounding box intersects the marquee selection area.
 * Handles normal and inverted dragging directions seamlessly.
 */
export function getNodesIntersectingMarquee(
  nodes: WorkflowNode[],
  marquee: MarqueeBox,
  nodeWidth = NODE_WIDTH,
  nodeHeight = NODE_HEIGHT
): string[] {
  const minX = Math.min(marquee.startX, marquee.currentX)
  const maxX = Math.max(marquee.startX, marquee.currentX)
  const minY = Math.min(marquee.startY, marquee.currentY)
  const maxY = Math.max(marquee.startY, marquee.currentY)

  return nodes
    .filter((node) => {
      const nodeLeft = node.position.x
      const nodeRight = node.position.x + nodeWidth
      const nodeTop = node.position.y
      const nodeBottom = node.position.y + nodeHeight

      return nodeLeft < maxX && nodeRight > minX && nodeTop < maxY && nodeBottom > minY
    })
    .map((n) => n.id)
}

/**
 * Remove multiple nodes and all connected edges from a WorkflowGraph in a single atomic operation.
 */
export function deleteNodesFromGraph(
  graph: WorkflowGraph,
  nodeIds: string[] | Set<string>
): { nextGraph: WorkflowGraph; deletedNodeCount: number; deletedEdgeCount: number } {
  const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)
  if (idSet.size === 0) {
    return { nextGraph: graph, deletedNodeCount: 0, deletedEdgeCount: 0 }
  }

  const nextNodes = graph.nodes.filter((n) => !idSet.has(n.id))
  const nextEdges = graph.edges.filter(
    (e) => !idSet.has(e.fromNodeId) && !idSet.has(e.toNodeId)
  )

  return {
    nextGraph: { nodes: nextNodes, edges: nextEdges },
    deletedNodeCount: graph.nodes.length - nextNodes.length,
    deletedEdgeCount: graph.edges.length - nextEdges.length
  }
}

/**
 * Clone multiple nodes and their internal interconnecting edges in a WorkflowGraph.
 * External connections (connecting to unselected nodes) are intentionally omitted to keep
 * duplicated clusters clean and isolated.
 */
export function duplicateNodesInGraph(
  graph: WorkflowGraph,
  nodeIds: string[] | Set<string>,
  offset = { x: 40, y: 40 }
): { nextGraph: WorkflowGraph; newSelectedNodeIds: string[] } {
  const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)
  const nodesToDuplicate = graph.nodes.filter((n) => idSet.has(n.id))
  if (nodesToDuplicate.length === 0) {
    return { nextGraph: graph, newSelectedNodeIds: [] }
  }

  const idMap = new Map<string, string>()
  const newNodes: WorkflowNode[] = []

  nodesToDuplicate.forEach((original, idx) => {
    const newId = `node-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`
    idMap.set(original.id, newId)

    newNodes.push({
      ...original,
      id: newId,
      position: {
        x: snapToGrid(original.position.x + offset.x),
        y: snapToGrid(original.position.y + offset.y)
      },
      status: 'idle',
      outputFiles: undefined,
      error: undefined
    })
  })

  // Clone internal edges connecting duplicated nodes
  const newEdges: WorkflowEdge[] = []
  for (const edge of graph.edges) {
    const newFrom = idMap.get(edge.fromNodeId)
    const newTo = idMap.get(edge.toNodeId)
    if (newFrom && newTo) {
      newEdges.push({
        ...edge,
        id: `edge-${Date.now()}-${newEdges.length}-${Math.random().toString(36).substring(2, 6)}`,
        fromNodeId: newFrom,
        toNodeId: newTo
      })
    }
  }

  return {
    nextGraph: {
      nodes: [...graph.nodes, ...newNodes],
      edges: [...graph.edges, ...newEdges]
    },
    newSelectedNodeIds: newNodes.map((n) => n.id)
  }
}
