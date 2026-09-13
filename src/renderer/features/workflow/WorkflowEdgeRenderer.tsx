import { memo } from 'react'
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
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-10">
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

        // Midpoint for delete handle
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2

        const sourceNodeRunning = fromNode.status === 'running' || toNode.status === 'running'

        return (
          <g
            key={edge.id}
            className="group pointer-events-auto cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Wide transparent hit-stroke for selection & double-click disconnect */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth={32}
              style={{ pointerEvents: 'stroke' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onSelectEdge(edge.id)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onDeleteEdge(edge.id)
              }}
            >
              <title>Connection cable — Click to select, Double-click to disconnect</title>
            </path>

            {/* Glowing background shadow on group hover, running, or selected */}
            <path
              d={pathData}
              fill="none"
              stroke={isSelected ? '#ef4444' : color}
              strokeWidth={isSelected ? 6 : 4}
              strokeOpacity={isSelected ? 0.6 : 0.3}
              filter="url(#wire-glow)"
              className={`transition-opacity duration-150 ${
                isSelected || sourceNodeRunning ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />

            {/* Main cable wire */}
            <path
              d={pathData}
              fill="none"
              stroke={isSelected ? '#ef4444' : color}
              strokeWidth={isSelected ? 3 : 2}
              strokeOpacity={isSelected ? 1 : 0.85}
              strokeLinecap="round"
            />

            {/* Selected dashed warning overlay */}
            {isSelected && (
              <path
                d={pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.8}
              />
            )}

            {/* Animated flowing data pulse if running */}
            {(sourceNodeRunning || isRunning) && !isSelected && (
              <path
                d={pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2.5}
                strokeDasharray="6 10"
                style={{
                  animation: 'wireDash 1.2s linear infinite'
                }}
              />
            )}

            {/* Permanent Midpoint Disconnect Badge with stable hit-target (no jitter) */}
            <g
              transform={`translate(${midX}, ${midY})`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onDeleteEdge(edge.id)
              }}
              style={{ pointerEvents: 'all' }}
            >
              <title>Click to disconnect these two tools</title>
              {/* Invisible stable shield circle preventing mouseleave flutter */}
              <circle r={16} fill="transparent" />

              {/* Outer hover halo */}
              <circle
                r={14}
                fill="#ef4444"
                className={`transition-opacity duration-150 ${
                  isSelected ? 'opacity-30' : 'opacity-0 group-hover:opacity-20'
                }`}
              />

              {/* Badge circle */}
              <circle
                r={10}
                className={`transition-all duration-150 ${
                  isSelected
                    ? 'fill-[#2b1517] stroke-red-500 stroke-2'
                    : 'fill-[#141618] stroke-[#4b5563] stroke-[1.25] group-hover:fill-[#2b1517] group-hover:stroke-red-500 group-hover:stroke-2'
                }`}
              />

              {/* X icon mark */}
              <path
                d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
                strokeLinecap="round"
                className={`transition-colors duration-150 ${
                  isSelected
                    ? 'stroke-red-500 stroke-2'
                    : 'stroke-[#9ca3af] stroke-[1.75] group-hover:stroke-red-500 group-hover:stroke-2'
                }`}
              />
            </g>
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
