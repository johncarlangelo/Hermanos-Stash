import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, FolderArchive, Plus, Settings2, Trash2, Workflow } from 'lucide-react'
import type {
  PortType,
  WorkflowEdge,
  WorkflowExecutionResult,
  WorkflowGraph,
  WorkflowNode,
  WorkflowTemplate
} from './types'
import {
  GRID_SIZE,
  NODE_HEIGHT,
  NODE_WIDTH,
  autoLayoutGraph,
  calculateBoundingBox,
  snapToGrid
} from './layout'
import { runWorkflowPipeline, validateEdge, wouldCreateCycle } from './execution'
import { WorkflowNodeCard } from './WorkflowNodeCard'
import { WorkflowEdgeRenderer } from './WorkflowEdgeRenderer'
import { WorkflowToolbar } from './WorkflowToolbar'
import { WorkflowToolDrawer } from './WorkflowToolDrawer'
import { WorkflowTemplateModal } from './WorkflowTemplateModal'
import { WorkflowTemplatesDrawer } from './WorkflowTemplatesDrawer'
import { WorkflowOutputDrawer } from './WorkflowOutputDrawer'
import { WorkflowNodeDetailDrawer } from './WorkflowNodeDetailDrawer'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { toastError, toastSuccess } from '../../stores/toasts'

const USER_TEMPLATES_PREF_KEY = 'workflow.userTemplates'

interface WorkflowCanvasProps {
  initialGraph?: WorkflowGraph
  onSwitchToLinearView?: () => void
}

export function WorkflowCanvas({ initialGraph, onSwitchToLinearView }: WorkflowCanvasProps) {
  // Master graph state
  const [graph, setGraph] = useState<WorkflowGraph>(() => {
    if (initialGraph && initialGraph.nodes.length > 0) return initialGraph
    return { nodes: [], edges: [] }
  })

  const [workflowName, setWorkflowName] = useState<string>('Untitled Workflow')

  // Pan & Zoom state
  const [pan, setPan] = useState({ x: 80, y: 80 })
  const [zoom, setZoom] = useState(1.0)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })

  // Node Dragging state
  const draggingNodeRef = useRef<{
    nodeId: string
    startX: number
    startY: number
    initialNodePos: { x: number; y: number }
  } | null>(null)
  const [activeDraggingNodeId, setActiveDraggingNodeId] = useState<string | null>(null)

  // rAF throttling refs for instant 60/120/144fps interaction
  const rafIdRef = useRef<number | null>(null)
  const pendingPanPosRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pendingNodeDragPosRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pendingWirePosRef = useRef<{ clientX: number; clientY: number } | null>(null)

  // Wire Connection state
  const [draggingWire, setDraggingWire] = useState<{
    fromNodeId: string
    fromPort: PortType
    currentPos: { x: number; y: number }
  } | null>(null)

  // Selection & Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [inspectingNodeId, setInspectingNodeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(
    null
  )

  // Drawers & Modals
  const [toolDrawerOpen, setToolDrawerOpen] = useState(false)
  const [templatesDrawerOpen, setTemplatesDrawerOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [outputDrawerOpen, setOutputDrawerOpen] = useState(false)

  // Execution state
  const [isRunning, setIsRunning] = useState(false)
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionResult | null>(null)

  // User saved templates
  const [userTemplates, setUserTemplates] = useState<WorkflowTemplate[]>([])

  const canvasRef = useRef<HTMLDivElement>(null)

  // Load user templates from persistent storage
  useEffect(() => {
    async function loadStoredTemplates() {
      try {
        const stored = await window.stash.prefs.get<WorkflowTemplate[]>(USER_TEMPLATES_PREF_KEY)
        if (stored && Array.isArray(stored)) {
          setUserTemplates(stored)
        }
      } catch {
        // Non-fatal
      }
    }
    void loadStoredTemplates()
  }, [])

  // Helper to persist user templates
  const persistUserTemplates = async (templates: WorkflowTemplate[]) => {
    setUserTemplates(templates)
    try {
      await window.stash.prefs.set(USER_TEMPLATES_PREF_KEY, templates)
    } catch {
      // Non-fatal
    }
  }

  // Convert client viewport coordinates to canvas coordinates
  const clientToCanvasCoord = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 }
      const rect = canvasRef.current.getBoundingClientRect()
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      }
    },
    [pan, zoom]
  )

  // Pan handlers
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    setContextMenu(null)
    if (e.target !== e.currentTarget && (e.target as HTMLElement).id !== 'canvas-grid-bg') return
    isPanningRef.current = true
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }

  // Master pointer move handler for canvas pan, node drag, and wire drag
  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      pendingPanPosRef.current = { clientX: e.clientX, clientY: e.clientY }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (!isPanningRef.current || !pendingPanPosRef.current) return
          setPan({
            x: pendingPanPosRef.current.clientX - panStartRef.current.x,
            y: pendingPanPosRef.current.clientY - panStartRef.current.y
          })
        })
      }
      return
    }

    if (draggingNodeRef.current) {
      pendingNodeDragPosRef.current = { clientX: e.clientX, clientY: e.clientY }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (!draggingNodeRef.current || !pendingNodeDragPosRef.current) return
          const { nodeId, startX, startY, initialNodePos } = draggingNodeRef.current
          const { clientX, clientY } = pendingNodeDragPosRef.current
          const deltaX = (clientX - startX) / zoom
          const deltaY = (clientY - startY) / zoom

          const newX = snapToGrid(initialNodePos.x + deltaX)
          const newY = snapToGrid(initialNodePos.y + deltaY)

          setGraph((prev) => {
            const currentNode = prev.nodes.find((n) => n.id === nodeId)
            if (currentNode && currentNode.position.x === newX && currentNode.position.y === newY) {
              return prev
            }
            return {
              ...prev,
              nodes: prev.nodes.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      position: { x: newX, y: newY }
                    }
                  : n
              )
            }
          })
        })
      }
      return
    }

    if (draggingWire) {
      pendingWirePosRef.current = { clientX: e.clientX, clientY: e.clientY }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (!pendingWirePosRef.current) return
          const canvasPos = clientToCanvasCoord(
            pendingWirePosRef.current.clientX,
            pendingWirePosRef.current.clientY
          )
          setDraggingWire((prev) => (prev ? { ...prev, currentPos: canvasPos } : null))
        })
      }
    }
  }

  const handleCanvasPointerUp = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    // Flush final drag position if there was a pending move
    if (draggingNodeRef.current && pendingNodeDragPosRef.current) {
      const { nodeId, startX, startY, initialNodePos } = draggingNodeRef.current
      const { clientX, clientY } = pendingNodeDragPosRef.current
      const deltaX = (clientX - startX) / zoom
      const deltaY = (clientY - startY) / zoom
      const finalX = snapToGrid(initialNodePos.x + deltaX)
      const finalY = snapToGrid(initialNodePos.y + deltaY)

      setGraph((prev) => {
        const currentNode = prev.nodes.find((n) => n.id === nodeId)
        if (currentNode && currentNode.position.x === finalX && currentNode.position.y === finalY) {
          return prev
        }
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId ? { ...n, position: { x: finalX, y: finalY } } : n
          )
        }
      })
    }

    isPanningRef.current = false
    draggingNodeRef.current = null
    pendingNodeDragPosRef.current = null
    pendingPanPosRef.current = null
    pendingWirePosRef.current = null
    setActiveDraggingNodeId(null)
    if (draggingWire) {
      setDraggingWire(null)
    }
  }

  // Window-level safety reset to prevent stuck dragging/panning states if pointerup fires outside canvas
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isPanningRef.current || draggingNodeRef.current || draggingWire) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        isPanningRef.current = false
        draggingNodeRef.current = null
        pendingNodeDragPosRef.current = null
        pendingPanPosRef.current = null
        pendingWirePosRef.current = null
        setActiveDraggingNodeId(null)
        if (draggingWire) {
          setDraggingWire(null)
        }
      }
    }

    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [draggingWire])

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    // Prevent zooming canvas when scrolling inside drawers, modals, toolbars, or context menus
    const target = e.target as HTMLElement | null
    if (
      target &&
      target.closest(
        '[data-drawer], [data-modal], [data-toolbar], [data-context-menu], [data-prevent-canvas-zoom]'
      )
    ) {
      return
    }

    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    setZoom((curr) => Math.min(2.0, Math.max(0.3, curr * zoomFactor)))
  }

  // Add tool from palette
  const handleAddTool = (toolId: string) => {
    // Spawn in center of current visible canvas
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const centerCanvas = clientToCanvasCoord(rect.left + rect.width / 2, rect.top + rect.height / 2)

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      toolId,
      position: {
        x: snapToGrid(centerCanvas.x - NODE_WIDTH / 2),
        y: snapToGrid(centerCanvas.y - NODE_HEIGHT / 2)
      },
      params: {}
    }

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }))

    setSelectedNodeId(newNode.id)
    toastSuccess(`Added "${toolRegistry.get(toolId)?.name ?? toolId}"`)
  }

  // Drop tool onto canvas from drag-and-drop
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const toolId = e.dataTransfer.getData('text/stash-tool-id')
    if (!toolId) return

    const canvasPos = clientToCanvasCoord(e.clientX, e.clientY)
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      toolId,
      position: {
        x: snapToGrid(canvasPos.x - NODE_WIDTH / 2),
        y: snapToGrid(canvasPos.y - NODE_HEIGHT / 2)
      },
      params: {}
    }

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }))

    setSelectedNodeId(newNode.id)
    toastSuccess(`Placed "${toolRegistry.get(toolId)?.name ?? toolId}" on canvas`)
  }

  // Node actions
  const handleDeleteNode = useCallback((nodeId: string) => {
    setGraph((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId)
    }))
    setSelectedNodeId((curr) => (curr === nodeId ? null : curr))
  }, [])

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const newId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    setGraph((prev) => {
      const original = prev.nodes.find((n) => n.id === nodeId)
      if (!original) return prev

      const duplicate: WorkflowNode = {
        ...original,
        id: newId,
        position: {
          x: snapToGrid(original.position.x + 40),
          y: snapToGrid(original.position.y + 40)
        },
        status: 'idle',
        outputFiles: undefined
      }

      return {
        ...prev,
        nodes: [...prev.nodes, duplicate]
      }
    })
    setSelectedNodeId(newId)
  }, [])

  const handleStartNodeDrag = useCallback(
    (nodeId: string, e: React.PointerEvent) => {
      e.stopPropagation()
      const node = graph.nodes.find((n) => n.id === nodeId)
      if (!node) return
      setSelectedNodeId(nodeId)
      setActiveDraggingNodeId(nodeId)
      draggingNodeRef.current = {
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        initialNodePos: { ...node.position }
      }
      pendingNodeDragPosRef.current = { clientX: e.clientX, clientY: e.clientY }
    },
    [graph.nodes]
  )

  // Wiring actions
  const handleStartWire = (
    fromNodeId: string,
    fromPort: PortType,
    _direction: 'out',
    clientPos: { x: number; y: number }
  ) => {
    const canvasPos = clientToCanvasCoord(clientPos.x, clientPos.y)
    setDraggingWire({
      fromNodeId,
      fromPort,
      currentPos: canvasPos
    })
  }

  const handleEndWire = (toNodeId: string, toPort: PortType, _direction: 'in') => {
    if (!draggingWire) return

    if (draggingWire.fromNodeId === toNodeId) {
      toastError('Cannot connect a node to itself')
      setDraggingWire(null)
      return
    }

    // Check circular dependency DAG loop
    if (wouldCreateCycle(graph, draggingWire.fromNodeId, toNodeId)) {
      toastError('Cannot connect: this would create a circular loop in the workflow.')
      setDraggingWire(null)
      return
    }

    // Check duplicate
    const exists = graph.edges.some(
      (e) =>
        e.fromNodeId === draggingWire.fromNodeId &&
        e.toNodeId === toNodeId &&
        e.fromPort === draggingWire.fromPort &&
        e.toPort === toPort
    )
    if (exists) {
      toastError('This connection already exists.')
      setDraggingWire(null)
      return
    }

    const fromNode = graph.nodes.find((n) => n.id === draggingWire.fromNodeId)
    const toNode = graph.nodes.find((n) => n.id === toNodeId)
    const fromTool = fromNode ? toolRegistry.get(fromNode.toolId) : null
    const toTool = toNode ? toolRegistry.get(toNode.toolId) : null

    if (fromTool && toTool) {
      const validation = validateEdge(fromTool, toTool, draggingWire.fromPort, toPort)
      if (!validation.valid) {
        toastError(validation.reason ?? 'Incompatible port connection')
        setDraggingWire(null)
        return
      }
    }

    const newEdge: WorkflowEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fromNodeId: draggingWire.fromNodeId,
      fromPort: draggingWire.fromPort,
      toNodeId,
      toPort
    }

    setGraph((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }))

    setDraggingWire(null)
    toastSuccess('Connected tools successfully')
  }

  const handleDropWireOnCard = (toNodeId: string) => {
    if (!draggingWire) return

    if (draggingWire.fromNodeId === toNodeId) {
      toastError('Cannot connect a node to itself')
      setDraggingWire(null)
      return
    }

    const fromNode = graph.nodes.find((n) => n.id === draggingWire.fromNodeId)
    const toNode = graph.nodes.find((n) => n.id === toNodeId)
    const fromTool = fromNode ? toolRegistry.get(fromNode.toolId) : null
    const toTool = toNode ? toolRegistry.get(toNode.toolId) : null

    if (!toTool) {
      setDraggingWire(null)
      return
    }

    // Check circular dependency DAG loop
    if (wouldCreateCycle(graph, draggingWire.fromNodeId, toNodeId)) {
      toastError('Cannot connect: this would create a circular loop in the workflow.')
      setDraggingWire(null)
      return
    }

    const targetPort: PortType = draggingWire.fromPort
    const acceptsPort =
      targetPort === 'files' ? toTool.capabilities.acceptsFiles : toTool.capabilities.acceptsText

    if (!acceptsPort) {
      toastError(
        `Cannot connect "${fromTool?.name || 'tool'}" to "${toNode?.customLabel || toTool.name}": tool does not accept "${targetPort}" inputs.`
      )
      setDraggingWire(null)
      return
    }

    // Check duplicate
    const exists = graph.edges.some(
      (e) =>
        e.fromNodeId === draggingWire.fromNodeId &&
        e.toNodeId === toNodeId &&
        e.fromPort === draggingWire.fromPort &&
        e.toPort === targetPort
    )
    if (exists) {
      toastError('This connection already exists.')
      setDraggingWire(null)
      return
    }

    if (fromTool) {
      const validation = validateEdge(fromTool, toTool, draggingWire.fromPort, targetPort)
      if (!validation.valid) {
        toastError(validation.reason ?? 'Incompatible port connection')
        setDraggingWire(null)
        return
      }
    }

    const newEdge: WorkflowEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fromNodeId: draggingWire.fromNodeId,
      fromPort: draggingWire.fromPort,
      toNodeId,
      toPort: targetPort
    }

    setGraph((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }))

    setDraggingWire(null)
    toastSuccess(`Connected to "${toNode?.customLabel || toTool.name}"`)
  }

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setGraph((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId)
    }))
    setSelectedEdgeId((curr) => (curr === edgeId ? null : curr))
  }, [])

  // Toolbar Actions
  const handleAutoLayout = () => {
    const laidOut = autoLayoutGraph(graph)
    setGraph(laidOut)
    toastSuccess('Nodes auto-arranged in dependency order')
  }

  const handleFitView = () => {
    if (graph.nodes.length === 0 || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const bbox = calculateBoundingBox(graph.nodes)

    const scaleX = (rect.width - 160) / bbox.width
    const scaleY = (rect.height - 160) / bbox.height
    const newZoom = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)))

    const centerBboxX = bbox.minX + bbox.width / 2
    const centerBboxY = bbox.minY + bbox.height / 2

    setZoom(newZoom)
    setPan({
      x: rect.width / 2 - centerBboxX * newZoom,
      y: rect.height / 2 - centerBboxY * newZoom
    })
  }

  const handleClearCanvas = () => {
    if (graph.nodes.length === 0) return
    if (graph.nodes.length > 1) {
      const confirmed = window.confirm(
        `Are you sure you want to clear the canvas? This will remove all ${graph.nodes.length} nodes and their connections.`
      )
      if (!confirmed) return
    }
    setGraph({ nodes: [], edges: [] })
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setExecutionResult(null)
    toastSuccess('Canvas cleared')
  }

  // Template Actions
  const handleSaveTemplate = (details: {
    name: string
    description: string
    category?: string
    tags: string[]
  }) => {
    const newTemplate: WorkflowTemplate = {
      id: `template-${Date.now()}`,
      name: details.name,
      description: details.description,
      category: details.category,
      tags: details.tags,
      graph: { ...graph },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    const updated = [newTemplate, ...userTemplates]
    void persistUserTemplates(updated)
    setWorkflowName(details.name)
    toastSuccess(`Template "${details.name}" saved`)
  }

  const handleDeleteTemplate = (templateId: string) => {
    const updated = userTemplates.filter((t) => t.id !== templateId)
    void persistUserTemplates(updated)
    toastSuccess('Template removed')
  }

  const handleLoadTemplate = (loadedGraph: WorkflowGraph, templateName: string) => {
    setGraph(loadedGraph)
    setWorkflowName(templateName)
    setExecutionResult(null)
    setTimeout(() => handleFitView(), 50)
  }

  const handleImportTemplate = (template: WorkflowTemplate) => {
    const updated = [template, ...userTemplates]
    void persistUserTemplates(updated)
    setGraph(template.graph)
    setWorkflowName(template.name)
    setTimeout(() => handleFitView(), 50)
  }

  const handleUpdateNodeInputs = useCallback(
    (nodeId: string, updates: { inputFiles?: string[]; inputText?: string }) => {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                inputFiles: updates.inputFiles !== undefined ? updates.inputFiles : n.inputFiles,
                inputText: updates.inputText !== undefined ? updates.inputText : n.inputText
              }
            : n
        )
      }))
    },
    []
  )

  const handleUpdateNodeLabel = useCallback((nodeId: string, customLabel: string) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, customLabel } : n))
    }))
  }, [])

  const handleUpdateNodeParams = useCallback((nodeId: string, params: Record<string, unknown>) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, params } : n))
    }))
  }, [])

  // Execution Pipeline
  const handleRunPipeline = async () => {
    if (graph.nodes.length === 0 || isRunning) return

    // Strict Input Validation (Item 4: tool should not run if missing required input)
    for (const node of graph.nodes) {
      const tool = toolRegistry.get(node.toolId)
      if (!tool) continue

      const incomingEdges = graph.edges.filter((e) => e.toNodeId === node.id)
      const hasFileWire = incomingEdges.some((e) => e.fromPort === 'files')
      const hasTextWire = incomingEdges.some((e) => e.fromPort === 'text')

      if (tool.capabilities.acceptsFiles && !hasFileWire) {
        if (!node.inputFiles || node.inputFiles.length === 0) {
          toastError(
            `"${node.customLabel || tool.name}" requires input file(s). Please attach files to the tool card or connect an input wire.`
          )
          setSelectedNodeId(node.id)
          return
        }
      }

      if (tool.capabilities.acceptsText && !tool.capabilities.acceptsFiles && !hasTextWire) {
        if (!node.inputText || !node.inputText.trim()) {
          toastError(
            `"${node.customLabel || tool.name}" requires text input. Please enter text in the tool card or connect an input wire.`
          )
          setSelectedNodeId(node.id)
          return
        }
      }
    }

    setIsRunning(true)
    setOutputDrawerOpen(false)

    // Reset node execution statuses
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => ({
        ...n,
        status: 'pending',
        outputFiles: undefined,
        error: undefined
      }))
    }))

    try {
      // Execute without synthetic sample inputs (Item 5: pass empty defaults)
      const result = await runWorkflowPipeline(graph, [], '', {
        onNodeStart: (nodeId) => {
          setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, status: 'running' } : n))
          }))
        },
        onNodeSuccess: (nodeId, outputFiles, durationMs) => {
          setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    status: 'success',
                    outputFiles,
                    durationMs
                  }
                : n
            )
          }))
        },
        onNodeError: (nodeId, error) => {
          setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, status: 'error', error } : n))
          }))
        }
      })

      setExecutionResult(result)
      setOutputDrawerOpen(true)
      if (result.success) {
        toastSuccess(`Pipeline executed: ${result.finalOutputFiles.length} outputs generated`)
      } else {
        toastError('Pipeline finished with errors')
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      if (isTyping) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault()
          handleDeleteNode(selectedNodeId)
        } else if (selectedEdgeId) {
          e.preventDefault()
          handleDeleteEdge(selectedEdgeId)
        }
      } else if (e.key === 'Enter' && selectedNodeId) {
        e.preventDefault()
        setInspectingNodeId(selectedNodeId)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedNodeId) {
        e.preventDefault()
        handleDuplicateNode(selectedNodeId)
      } else if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null)
        } else if (inspectingNodeId) {
          setInspectingNodeId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedNodeId,
    selectedEdgeId,
    contextMenu,
    inspectingNodeId,
    handleDeleteNode,
    handleDeleteEdge,
    handleDuplicateNode
  ])

  const handleOpenDetails = useCallback((id: string) => {
    setInspectingNodeId(id)
  }, [])

  const handleContextMenu = useCallback((id: string, e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: id })
    setSelectedNodeId(id)
  }, [])

  const incomingEdgeMap = useMemo(() => {
    const map = new Map<string, { files: boolean; text: boolean }>()
    for (const edge of graph.edges) {
      let entry = map.get(edge.toNodeId)
      if (!entry) {
        entry = { files: false, text: false }
        map.set(edge.toNodeId, entry)
      }
      if (edge.fromPort === 'files') entry.files = true
      if (edge.fromPort === 'text') entry.text = true
    }
    return map
  }, [graph.edges])

  return (
    <div
      ref={canvasRef}
      data-dropzone="workflow-canvas"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onWheel={handleWheel}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleCanvasDrop}
      className="relative h-full w-full overflow-hidden bg-shell select-none cursor-default"
      style={{
        backgroundImage: `radial-gradient(circle, var(--color-line) 1px, transparent 1px)`,
        backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
    >
      {/* Top Floating Toolbar */}
      <WorkflowToolbar
        workflowName={workflowName}
        onRename={setWorkflowName}
        nodeCount={graph.nodes.length}
        edgeCount={graph.edges.length}
        isRunning={isRunning}
        onRun={handleRunPipeline}
        onToggleToolDrawer={() => setToolDrawerOpen((o) => !o)}
        onToggleTemplatesDrawer={() => setTemplatesDrawerOpen((o) => !o)}
        onOpenSaveModal={() => setSaveModalOpen(true)}
        onAutoLayout={handleAutoLayout}
        onFitView={handleFitView}
        onZoomIn={() => setZoom((z) => Math.min(2.0, z + 0.1))}
        onZoomOut={() => setZoom((z) => Math.max(0.3, z - 0.1))}
        onResetZoom={() => setZoom(1.0)}
        zoom={zoom}
        onClearCanvas={handleClearCanvas}
        onSwitchToLinearView={onSwitchToLinearView}
      />

      {/* Scaled & Panned Canvas Viewport */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {/* SVG Cable Wires Layer */}
        <WorkflowEdgeRenderer
          edges={graph.edges}
          nodes={graph.nodes}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={setSelectedEdgeId}
          onDeleteEdge={handleDeleteEdge}
          draggingWire={draggingWire}
          isRunning={isRunning}
        />

        {/* Node Cards Layer (cards themselves have pointer-events-auto) */}
        <div className="pointer-events-none">
          {graph.nodes.map((node) => {
            const incoming = incomingEdgeMap.get(node.id)
            const hasIncomingFileEdge = incoming?.files ?? false
            const hasIncomingTextEdge = incoming?.text ?? false

            let wireStatus: 'compatible' | 'incompatible' | 'source' | null = null
            let wireReason: string | undefined = undefined

            if (draggingWire) {
              if (node.id === draggingWire.fromNodeId) {
                wireStatus = 'source'
              } else {
                const fromNode = graph.nodes.find((n) => n.id === draggingWire.fromNodeId)
                const fromTool = fromNode ? toolRegistry.get(fromNode.toolId) : null
                const toTool = toolRegistry.get(node.toolId)

                if (wouldCreateCycle(graph, draggingWire.fromNodeId, node.id)) {
                  wireStatus = 'incompatible'
                  wireReason = 'Connecting would create a circular dependency loop.'
                } else if (!toTool) {
                  wireStatus = 'incompatible'
                  wireReason = 'Tool definition not found.'
                } else {
                  const port = draggingWire.fromPort
                  const accepts =
                    port === 'files'
                      ? toTool.capabilities.acceptsFiles
                      : toTool.capabilities.acceptsText
                  if (!accepts) {
                    wireStatus = 'incompatible'
                    wireReason = `Tool does not accept "${port}" inputs.`
                  } else if (fromTool) {
                    const validation = validateEdge(fromTool, toTool, port, port)
                    if (!validation.valid) {
                      wireStatus = 'incompatible'
                      wireReason = validation.reason
                    } else {
                      wireStatus = 'compatible'
                    }
                  } else {
                    wireStatus = 'compatible'
                  }
                }
              }
            }

            return (
              <WorkflowNodeCard
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                isDragging={activeDraggingNodeId === node.id}
                hasIncomingFileEdge={hasIncomingFileEdge}
                hasIncomingTextEdge={hasIncomingTextEdge}
                wireStatus={wireStatus}
                wireReason={wireReason}
                activeWirePort={draggingWire?.fromPort}
                onSelect={setSelectedNodeId}
                onOpenDetails={handleOpenDetails}
                onContextMenu={handleContextMenu}
                onDelete={handleDeleteNode}
                onDuplicate={handleDuplicateNode}
                onUpdateInputs={handleUpdateNodeInputs}
                onStartWire={handleStartWire}
                onEndWire={handleEndWire}
                onDropWireOnCard={handleDropWireOnCard}
                onStartDrag={handleStartNodeDrag}
              />
            )
          })}
        </div>
      </div>

      {/* Slide-over Tool Palette Drawer */}
      <WorkflowToolDrawer
        open={toolDrawerOpen}
        onClose={() => setToolDrawerOpen(false)}
        onAddTool={handleAddTool}
      />

      {/* Slide-over Templates Drawer */}
      <WorkflowTemplatesDrawer
        open={templatesDrawerOpen}
        onClose={() => setTemplatesDrawerOpen(false)}
        userTemplates={userTemplates}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onImportTemplate={handleImportTemplate}
      />

      {/* Save Template Dialog */}
      <WorkflowTemplateModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        graph={graph}
        onSave={handleSaveTemplate}
      />

      {/* Execution Output Inspector Drawer */}
      <WorkflowOutputDrawer
        open={outputDrawerOpen}
        onClose={() => setOutputDrawerOpen(false)}
        result={executionResult}
      />

      {/* Node Detail & Parameters Drawer (n8n style) */}
      <WorkflowNodeDetailDrawer
        open={inspectingNodeId !== null}
        nodeId={inspectingNodeId}
        graph={graph}
        onClose={() => setInspectingNodeId(null)}
        onUpdateLabel={handleUpdateNodeLabel}
        onUpdateParams={handleUpdateNodeParams}
        onUpdateInputs={handleUpdateNodeInputs}
        onDisconnectEdge={handleDeleteEdge}
      />

      {/* Empty Canvas Guidance */}
      {graph.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line/80 bg-surface/70 text-accent shadow-xl">
            <Workflow size={28} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-ink">Empty Workflow Canvas</h3>
          <p className="mt-1 max-w-sm text-xs text-dim leading-relaxed">
            Drag tools from the tool palette or open pre-built recipes to compose your automated
            multi-step pipeline.
          </p>
          <div className="mt-5 flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setToolDrawerOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-base shadow-sm hover:opacity-95"
            >
              <Plus size={13} /> Open Tool Palette
            </button>
            <button
              type="button"
              onClick={() => setTemplatesDrawerOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface/80 px-4 py-2 text-xs font-semibold text-ink hover:bg-surface"
            >
              <FolderArchive size={13} /> Browse Recipes
            </button>
          </div>
        </div>
      )}

      {/* Node Context Menu */}
      {contextMenu && (
        <div
          data-context-menu="true"
          onWheel={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-[175px] rounded-lg border border-line-strong bg-overlay/95 p-1 shadow-2xl backdrop-blur-md select-none"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 185),
            top: Math.min(contextMenu.y, window.innerHeight - 155)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setInspectingNodeId(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink hover:bg-surface hover:text-accent transition-colors"
          >
            <Settings2 size={13} className="text-accent" />
            <span>Configure & Details</span>
            <span className="ml-auto font-mono text-[9px] text-faint">↵</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleDuplicateNode(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
          >
            <Copy size={13} className="text-dim" />
            <span>Duplicate Node</span>
            <span className="ml-auto font-mono text-[9px] text-faint">Ctrl+D</span>
          </button>
          <div className="my-1 h-px bg-line/60" />
          <button
            type="button"
            onClick={() => {
              handleDeleteNode(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete Node</span>
            <span className="ml-auto font-mono text-[9px] text-faint">Del</span>
          </button>
        </div>
      )}
    </div>
  )
}
