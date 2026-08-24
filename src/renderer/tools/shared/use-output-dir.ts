import { useCallback, useEffect, useState } from 'react'

/** Prefs key under which a tool's last output folder is remembered. */
export function outputDirPrefKey(toolId: string): string {
  return `outDir:${toolId}`
}

/**
 * Per-tool remembered output folder. Loads the persisted choice on mount
 * (default ''), and the setter both updates state and persists so the next
 * visit pre-fills the folder picker.
 */
export function useOutputDir(toolId: string): [string, (dir: string) => void] {
  const [dir, setDir] = useState('')

  useEffect(() => {
    let active = true
    void window.stash.prefs
      .get<string>(outputDirPrefKey(toolId))
      .then((value) => {
        if (active && typeof value === 'string' && value.length > 0) setDir(value)
      })
      .catch(() => {
        // A missing/broken pref just means "no remembered folder".
      })
    return () => {
      active = false
    }
  }, [toolId])

  const update = useCallback(
    (next: string) => {
      setDir(next)
      void window.stash.prefs.set(outputDirPrefKey(toolId), next).catch(() => {})
    },
    [toolId]
  )

  return [dir, update]
}
