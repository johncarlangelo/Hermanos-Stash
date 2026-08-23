import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.use({ gfm: true, breaks: true })

/**
 * Renders Markdown to HTML with GitHub-flavored Markdown and hard line breaks.
 * Pure string transformation — safe to unit test without a DOM.
 */
export function markdownToHtml(md: string): string {
  if (!md) return ''
  return marked.parse(md, { async: false })
}

const SANITIZE_CONFIG: Record<string, unknown> = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
  FORBID_ATTR: ['style']
}

/**
 * Sanitizes rendered HTML through DOMPurify so untrusted input can never
 * inject scripts or event handlers. Runs in the renderer where a window
 * exists; callers must never render unsanitized output.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, SANITIZE_CONFIG)
}

/** Full pipeline: Markdown → sanitized HTML ready for `dangerouslySetInnerHTML`. */
export function renderMarkdown(md: string): string {
  return sanitizeHtml(markdownToHtml(md))
}

/** Word/character counts for the footer status line. */
export function countWordsAndChars(text: string): { words: number; chars: number } {
  const trimmed = text.trim()
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    chars: text.length
  }
}
