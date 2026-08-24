import { Copy, FolderOpen } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from './use-file-list'

/**
 * Tiny result-row actions for saved outputs: reveal the item in the OS file
 * manager and copy its full absolute path.
 */

export function RevealButton({ path }: { path: string }): React.JSX.Element {
  const reveal = async (): Promise<void> => {
    try {
      await window.stash.shell.revealPath(path)
    } catch (err) {
      toastError(err)
    }
  }
  return (
    <IconButton
      variant="surface"
      size="sm"
      aria-label={`Show ${fileNameOf(path)} in Explorer`}
      title="Show in Explorer"
      onClick={() => void reveal()}
    >
      <FolderOpen size={13} />
    </IconButton>
  )
}

export function CopyPathButton({ path }: { path: string }): React.JSX.Element {
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path)
      toastSuccess('Path copied', fileNameOf(path))
    } catch (err) {
      toastError(err)
    }
  }
  return (
    <IconButton
      variant="surface"
      size="sm"
      aria-label={`Copy full path of ${fileNameOf(path)}`}
      title="Copy path"
      onClick={() => void copy()}
    >
      <Copy size={13} />
    </IconButton>
  )
}
