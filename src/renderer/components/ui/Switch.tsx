import { cn } from '@/lib/utils'
import { Switch as SwitchPrimitive } from 'radix-ui'

/**
 * Stash Switch (ui-overhaul) — Radix switch replacing the hand-rolled Toggle.
 * Same call surface: checked / onCheckedChange / label / disabled.
 */

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onCheckedChange, className, ...rest }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 ease-out',
        checked ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...rest}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block h-3 w-3 rounded-full transition-all duration-150 ease-out',
          checked ? 'translate-x-4.5 bg-accent' : 'translate-x-0.5 bg-faint'
        )}
      />
    </SwitchPrimitive.Root>
  )
}
