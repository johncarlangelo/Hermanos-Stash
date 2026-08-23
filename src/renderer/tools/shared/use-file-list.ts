import { useCallback, useRef, useState } from 'react'

export interface FileListItem {
  id: number
  path: string
}

let nextItemId = 1

/**
 * Accumulating, de-duplicated file list shared by batch-processing tools.
 * Paths are the identity — re-adding an existing path is a no-op, removing
 * forgets it so it can be added again later.
 */
export function useFileList() {
  const [items, setItems] = useState<FileListItem[]>([])
  const knownPaths = useRef(new Set<string>())

  const addPaths = useCallback((paths: string[]) => {
    const fresh = paths.filter((p) => !knownPaths.current.has(p))
    if (fresh.length === 0) return
    fresh.forEach((p) => knownPaths.current.add(p))
    setItems((prev) => [...prev, ...fresh.map((path) => ({ id: nextItemId++, path }))])
  }, [])

  const removePath = useCallback((path: string) => {
    knownPaths.current.delete(path)
    setItems((prev) => prev.filter((item) => item.path !== path))
  }, [])

  const clearAll = useCallback(() => {
    knownPaths.current.clear()
    setItems([])
  }, [])

  return { items, addPaths, removePath, clearAll }
}

/** Basename of a path, tolerant of both separators (renderer-safe). */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}
