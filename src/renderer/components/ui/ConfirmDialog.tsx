import { Dialog, DialogClose, DialogContent, DialogFooter } from './Overlays'
import { Button } from './Button'

/**
 * Stash ConfirmDialog (ui-overhaul) — replaces the inline "Confirm clear?"
 * button-text-swap pattern with a real modal confirm.
 *
 * Declarative: render it with `open` + the action; it calls onConfirm and
 * closes itself. Cancel is always available; Esc and backdrop close too.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        className="w-[min(380px,calc(100vw-2rem))]"
      >
        {description && (
          <p className="px-4 py-3 text-[12.5px] leading-relaxed text-dim">{description}</p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={() => {
              void onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
