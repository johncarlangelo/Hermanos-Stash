import * as React from 'react'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * Stash dialog + tooltip primitives on Radix (Milestone 7).
 *
 * Styled to DESIGN.md: overlay surface, subtle border, modest radius,
 * 150ms pop entry. Portal-rendered so frameless-window drag regions
 * never clip them.
 */

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string
  /** Optional sr-only description (Radix wires aria-describedby). */
  description?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="anim-fade-in fixed inset-0 z-[45] bg-base/75" />
      <DialogPrimitive.Content
        className={cn(
          'anim-pop fixed top-1/2 left-1/2 z-[46] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-line-strong bg-overlay shadow-2xl shadow-black/40 focus:outline-none',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <DialogPrimitive.Title className="text-[13px] font-medium text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <X size={14} />
          </DialogPrimitive.Close>
        </div>
        {description ? (
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-line px-4 py-3', className)}
      {...props}
    />
  )
}

/**
 * Keyboard-accessible help hint replacing the custom CSS-only popover.
 * Shows on hover AND keyboard focus; Radix handles positioning/collision.
 */
function Hint({ text }: { text: string }) {
  return (
    // Provider is hoisted to the app root (App.tsx); Root works standalone.
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`About ${text}`}
          className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-line text-faint transition-colors duration-150 hover:border-line-strong hover:text-dim focus-visible:border-accent/60 focus-visible:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span aria-hidden className="font-mono text-[9px] leading-none">
            ?
          </span>
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          collisionPadding={12}
          className="anim-fade-in z-50 max-w-56 rounded-md border border-line-strong bg-overlay px-2.5 py-2 text-[11.5px] leading-snug font-normal text-dim shadow-lg shadow-black/25"
        >
          {text}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogFooter, Hint }
