import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * Drop-in replacement for the legacy native <select>.
 *
 * Keeps the exact call surface the tools already use:
 *   value / onChange({ target: { name, value } }) / id / className
 * with <option value="...">label</option> children.
 *
 * Backed by Radix Select for proper keyboard nav, typeahead,
 * focus management, and portal rendering inside the frameless window.
 */

type SelectTriggerElement = React.ComponentRef<typeof SelectPrimitive.Trigger>

export interface SelectProps extends Omit<
  React.ComponentPropsWithoutRef<'select'>,
  'onChange' | 'children' | 'multiple' | 'required'
> {
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
}

interface OptionMeta {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

function collectOptions(children: React.ReactNode): OptionMeta[] {
  const options: OptionMeta[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: React.ReactNode; disabled?: boolean }
    const value = props.value == null ? '' : String(props.value)
    const label =
      typeof props.children === 'string' || typeof props.children === 'number'
        ? String(props.children)
        : props.children
    options.push({ value, label, disabled: props.disabled })
  })
  return options
}

export function Select({
  className,
  value,
  defaultValue,
  onChange,
  children,
  ...rest
}: SelectProps) {
  const options = collectOptions(children)
  const name = rest.name
  // Radix requires `value` to always be controlled or uncontrolled — mirror the
  // native semantics by forwarding both, letting undefined fall through.
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    defaultValue != null ? String(defaultValue) : undefined
  )
  const currentValue = value !== undefined ? String(value) : internalValue

  const handleValueChange = (next: string) => {
    setInternalValue(next)
    if (onChange) {
      // Synthesize the event shape every tool already consumes.
      onChange({
        target: { name, value: next }
      } as React.ChangeEvent<HTMLSelectElement>)
    }
  }

  return (
    <SelectPrimitive.Root value={currentValue} onValueChange={handleValueChange}>
      <SelectPrimitive.Trigger
        data-slot="select"
        {...(rest as Record<string, unknown>)}
        className={cn(
          'flex h-8.5 w-full cursor-pointer items-center justify-between gap-1.5 rounded-md border border-line bg-base px-2.5 text-[13px] whitespace-nowrap text-ink transition-colors duration-150 ease-out select-none',
          'hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:border-accent/70',
          'data-[state=open]:bg-surface',
          'disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-danger/70',
          className
        )}
      >
        <SelectPrimitive.Value placeholder="" />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={13} className="shrink-0 text-faint" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          avoidCollisions
          className={cn(
            'z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-line-strong bg-overlay shadow-lg shadow-black/30',
            'data-[state=open]:anim-pop'
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-pointer items-center rounded-sm py-1.5 pr-7 pl-2.5 text-[12.5px] text-dim outline-none select-none',
                  'data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent',
                  'data-[state=checked]:text-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40'
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center justify-center text-accent">
                  <Check size={12} aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

// Keep the trigger element type discoverable for consumers that need it.
export type { SelectTriggerElement }
