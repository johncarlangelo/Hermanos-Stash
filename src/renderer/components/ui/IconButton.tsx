import { forwardRef } from 'react'

type Variant = 'surface' | 'ghost'
type Size = 'sm' | 'md'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Accessible label — required, since icon buttons have no visible text. */
  'aria-label': string
}

const VARIANT: Record<Variant, string> = {
  surface:
    'bg-surface border border-line text-dim hover:text-ink hover:border-line-strong active:bg-line/50',
  ghost: 'bg-transparent border border-transparent text-faint hover:text-ink hover:bg-surface'
}

const SIZE: Record<Size, string> = {
  sm: 'h-6.5 w-6.5 rounded-sm',
  md: 'h-8 w-8 rounded-md'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center transition-colors duration-150 ease-out cursor-pointer ${
        VARIANT[variant]
      } ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})
