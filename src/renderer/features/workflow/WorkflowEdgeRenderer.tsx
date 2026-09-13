import { memo, useState } from 'react'
import type { PortType, WorkflowEdge, WorkflowNode } from './types'
import { NODE_HEIGHT, NODE_WIDTH } from './layout'

interface WorkflowEdgeRendererProps {
  edges: WorkflowEdge[]
  nodes: WorkflowNode[]
  selectedEdgeId: string | null
  onSelectEdge: (edgeId: string) => void
  onDeleteEdge: (edgeId: string) => void
  draggingWire: {
    fromNodeId: string
    fromPort: PortType
    currentPos: { x: number; y: number }
  } | null
  isRunning?: boolean
}

export const WorkflowEdgeRenderer = memo(function WorkflowEdgeRenderer({
  edges,
  nodes,
  selectedEdgeId,
  onSelectEdge,
  onDeleteEdge,
  draggingWire,
  isRunning
}: WorkflowEdgeRendererProps) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]))

  // Helper to calculate port anchor coordinate on canvas
  const getPortCoord = (node: WorkflowNode, _portType: PortType, direction: 'in' | 'out') => {
    // Left edge for in, Right edge for out
    const x = direction === 'in' ? node.position.x : node.position.x + NODE_WIDTH
    // Center vertically
    const y = node.position.y + NODE_HEIGHT / 2
    return { x, y }
  }

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-0">
      <defs>
        {/* Glow filter for active cables */}
        <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="wire-glow-active" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Render permanent edges */}
      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.fromNodeId)
        const toNode = nodeMap.get(edge.toNodeId)
        if (!fromNode || !toNode) return null

        const start = getPortCoord(fromNode, edge.fromPort, 'out')
        const end = getPortCoord(toNode, edge.toPort, 'in')

        const deltaX = Math.max(50, Math.abs(end.x - start.x) * 0.45)
        const pathData = `M ${start.x} ${start.y} C ${start.x + deltaX} ${start.y}, ${end.x - deltaX} ${end.y}, ${end.x} ${end.y}`

        const isFiles = edge.fromPort === 'files'
        const color = isFiles ? '#06b6d4' : '#a855f7' // Cyan for files, Purple for text
        const isSelected = selectedEdgeId === edge.id
        const isHovered = hoveredEdgeId === edge.id

        // Midpoint for delete handle
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2

        const sourceNodeRunning = fromNode.status === 'running' || toNode.status === 'running'

        return (
          <g key={edge.id} className="pointer-events-auto cursor-pointer">
            {/* Wider transparent hit-stroke for easy hover/click */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth={22}
              onClick={(e) => {
                e.stopPropagation()
                onSelectEdge(edge.id)
              }}
              onMouseEnter={() => setHoveredEdgeId(edge.id)}
              onMouseLeave={() => setHoveredEdgeId(null)}
            />

            {/* Glowing background shadow */}
            {(isSelected || isHovered || sourceNodeRunning) && (
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 6 : 4}
                strokeOpacity={0.4}
                filter="url(#wire-glow)"
              />
            )}

            {/* Main cable wire */}
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth={isSelected ? 3 : 2}
              strokeOpacity={isSelected ? 1 : 0.85}
              strokeLinecap="round"
            />

            {/* Animated flowing data pulse if running */}
            {(sourceNodeRunning || isRunning) && (
              <path
                d={pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.5}
                strokeDasharray="6 10"
                className="animate-[dash_1s_linear_infinite]"
                style={{
                  animation: 'wireDash 1.2s linear infinite'
                }}
              />
            )}

            {/* Hover disconnect button */}
            {isHovered && (
              <g
                transform={`translate(${midX}, ${midY})`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteEdge(edge.id)
                }}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                <circle r={10} fill="#1e2124" stroke="#ef4444" strokeWidth={1.5} />
                <path
                  d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        )
      })}

      {/* Render interactive dragging wire */}
      {draggingWire &&
        (() => {
          const fromNode = nodeMap.get(draggingWire.fromNodeId)
          if (!fromNode) return null

          const start = getPortCoord(fromNode, draggingWire.fromPort, 'out')
          const end = draggingWire.currentPos

          const deltaX = Math.max(50, Math.abs(end.x - start.x) * 0.45)
          const pathData = `M ${start.x} ${start.y} C ${start.x + deltaX} ${start.y}, ${end.x - deltaX} ${end.y}, ${end.x} ${end.y}`
          const color = draggingWire.fromPort === 'files' ? '#06b6d4' : '#a855f7'

          return (
            <g>
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeOpacity={0.4}
                filter="url(#wire-glow)"
              />
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
              <circle cx={end.x} cy={end.y} r={5} fill={color} />
            </g>
          )
        })()}
    </svg>
  )
})
