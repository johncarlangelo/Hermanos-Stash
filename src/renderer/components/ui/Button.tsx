import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Stash Button (Milestone 7 reconciliation).
 *
 * shadcn cva architecture + CSS-variable tokens (bg-primary, ring, …) with
 * the legacy Stash call surface preserved: primary/danger variants, sm/md
 * sizes and the loading spinner. All 50 tools keep compiling unchanged.
 */

const buttonVariants = cva(
  // shadcn base: layout, focus ring, disabled handling
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium outline-none transition-colors duration-150 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Legacy primary → accent fill via tokens. */
        primary:
          'border border-transparent bg-accent text-accent-contrast hover:bg-accent-hover active:bg-accent-hover/90',
        /* shadcn default maps to the same accent fill. */
        default:
          'border border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20',
        /* Legacy secondary → raised surface with line border. */
        secondary:
          'border border-line bg-raised text-ink hover:border-line-strong hover:bg-overlay active:bg-line/60',
        ghost: 'border border-transparent bg-transparent text-dim hover:bg-surface hover:text-ink',
        danger:
          'border border-danger/35 bg-transparent text-danger hover:border-danger/70 hover:bg-danger/10',
        outline:
          'border border-input bg-background shadow-xs hover:border-line-strong hover:bg-overlay',
        link: 'text-accent underline-offset-4 hover:underline'
      },
      size: {
        sm: 'h-7 gap-1.5 rounded-sm px-2.5 text-[12.5px]',
        md: 'h-8.5 gap-2 px-3.5',
        lg: 'h-9 rounded-md px-5',
        icon: 'size-8.5',
        'icon-sm': 'size-7 rounded-sm'
      }
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disabled, children, ...props },
  ref
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type="button"
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), isDisabled && 'cursor-not-allowed opacity-45', className)}
      {...props}
    >
      {/* Announce the busy state without relying on the visual spinner. */}
      {loading && (
        <span className="sr-only" role="status">
          Working…
        </span>
      )}
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export { buttonVariants }
