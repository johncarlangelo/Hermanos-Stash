import { create } from 'zustand'
import { toolRegistry } from '../../shared/tool-registry/registry'
import { toastSuccess } from './toasts'
import { useNav } from './nav'

interface AssetTransferState {
  pendingFiles: Record<string, string[]>
  setPendingFiles: (toolId: string, files: string[]) => void
  consumePendingFiles: (toolId: string) => string[] | null
  routeToTool: (toolId: string, filePath: string) => void
}

export const useAssetTransfer = create<AssetTransferState>((set, get) => ({
  pendingFiles: {},

  setPendingFiles: (toolId, files) =>
    set((state) => ({
      pendingFiles: {
        ...state.pendingFiles,
        [toolId]: files
      }
    })),

  consumePendingFiles: (toolId) => {
    const files = get().pendingFiles[toolId]
    if (!files || files.length === 0) return null
    set((state) => {
      const next = { ...state.pendingFiles }
      delete next[toolId]
      return { pendingFiles: next }
    })
    return files
  },

  routeToTool: (toolId, filePath) => {
    const tool = toolRegistry.get(toolId)
    const toolName = tool?.name ?? toolId
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath

    // Set pending file for the tool
    get().setPendingFiles(toolId, [filePath])

    // Copy to clipboard as convenient fallback
    try {
      void navigator.clipboard.writeText(filePath)
    } catch {
      // ignore if clipboard unavailable
    }

    // Navigate to tool
    useNav.getState().openTool(toolId)
    toastSuccess(`Opened ${fileName} in ${toolName}`)
  }
}))
