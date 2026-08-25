import { cn } from '@/lib/utils'
import { Slider as SliderPrimitive } from 'radix-ui'

/**
 * Stash Slider (ui-overhaul) — Radix slider styled to the token system.
 *
 * Drop-in for the native `<input type="range">`: keeps value/onChange,
 * min/max/step, aria-label. Renders an accent-filled track with a thumb
 * that grows slightly on hover — state-reporting motion only.
 */

export interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onValueChange: (value: number) => void
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  className,
  ...rest
}: SliderProps) {
  const clamped = Math.min(max, Math.max(min, value))
  const fillPct = max > min ? ((clamped - min) / (max - min)) * 100 : 0

  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-4 w-full touch-none items-center select-none', className)}
      value={[clamped]}
      min={min}
      max={max}
      step={step}
      onValueChange={(values: number[]) => onValueChange(values[0] ?? min)}
      {...rest}
    >
      {/* Track */}
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-line">
        {/* Range fill */}
        <SliderPrimitive.Range
          className="absolute h-full bg-accent"
          style={{ width: `${fillPct}%` }}
        />
      </SliderPrimitive.Track>
      {/* Thumb */}
      <SliderPrimitive.Thumb
        className={cn(
          'block h-3 w-3 rounded-full border border-line-strong bg-ink shadow-sm transition-[transform,border-color] duration-150 ease-out',
          'hover:scale-115 hover:border-accent',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-45'
        )}
        aria-label={rest['aria-label']}
      />
    </SliderPrimitive.Root>
  )
}
