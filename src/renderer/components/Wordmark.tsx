/**
 * Giant workspace wordmark — the "HERMANOS" backdrop, Hermes-style.
 *
 * Rendered once per view surface, absolutely positioned behind all content
 * (z-0, pointer-events-none). Cards sit above it; their translucent fills
 * let the letterforms ghost through.
 */
export function Wordmark({ text = 'HERMANOS' }: { text?: string }) {
  return (
    <div className="wordmark" aria-hidden>
      <span>{text}</span>
    </div>
  )
}
