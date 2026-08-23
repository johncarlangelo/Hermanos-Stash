import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent text-[#241a0c] hover:bg-accent-hover active:bg-accent-hover/90 font-medium border border-transparent',
  secondary:
    'bg-raised text-ink border border-line hover:border-line-strong hover:bg-overlay active:bg-line/60',
  ghost: 'bg-transparent text-dim border border-transparent hover:text-ink hover:bg-surface',
  danger:
    'bg-transparent text-danger border border-danger/35 hover:border-danger/70 hover:bg-danger/10'
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12.5px] rounded-sm gap-1.5',
  md: 'h-8.5 px-3.5 text-[13px] rounded-md gap-2'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      className={`inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150 ease-out select-none ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${isDisabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
