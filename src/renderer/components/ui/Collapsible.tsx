import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible as CollapsiblePrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * Stash Collapsible (ui-overhaul) — the compact disclosure row used for
 * option groups and secondary content. Header shows a chevron that rotates
 * 90° when open; content animates in with a 150ms fade+slide.
 */

export function Collapsible({
  title,
  badge,
  defaultOpen = false,
  children,
  className
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} className={className}>
      <CollapsiblePrimitive.Trigger
        className={cn(
          'group flex w-full cursor-pointer items-center gap-1.5 rounded-sm py-1 text-left transition-colors duration-150',
          'text-[11px] font-semibold tracking-[0.08em] text-faint uppercase select-none',
          'hover:text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        )}
      >
        <ChevronRight
          size={11}
          aria-hidden
          className="shrink-0 transition-transform duration-150 ease-out group-data-[state=open]:rotate-90"
        />
        {title}
        {badge && <span className="tnum ml-auto font-mono text-[10px] normal-case">{badge}</span>}
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content
        className={cn('overflow-hidden data-[state=open]:anim-fade-in', open ? 'pt-2' : '')}
      >
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
