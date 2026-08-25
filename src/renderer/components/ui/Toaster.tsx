import { Toaster as SonnerToaster } from 'sonner'

/**
 * Sonner toaster themed to the Stash token system (Milestone 8).
 * Glass cards, top-right placement under the draggable titlebar,
 * rich colors from our status tokens.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      offset={56}
      theme="dark"
      closeButton
      toastOptions={{
        style: {
          background: 'var(--color-overlay)',
          border: '1px solid var(--color-line-strong)',
          color: 'var(--color-ink)',
          borderRadius: 'var(--radius-md)',
          backdropFilter: 'blur(18px) saturate(1.15)',
          boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.6)'
        },
        classNames: {
          description: 'text-dim',
          success: '[&[data-sonner-toast]]:[&>svg]:text-ok',
          error: '[&[data-sonner-toast]]:[&>svg]:text-danger'
        }
      }}
    />
  )
}
