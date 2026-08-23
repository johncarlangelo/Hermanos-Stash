import type { StashBridge } from '../shared/ipc'

declare global {
  interface Window {
    stash: StashBridge
  }
}

export {}
