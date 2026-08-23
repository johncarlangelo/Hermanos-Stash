import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { toastError, toastSuccess } from '../../stores/toasts'
import { countWordsAndChars, renderMarkdown, sanitizeHtml, markdownToHtml } from './logic'

/**
 * Minimal prose styling applied once to the preview surface. Kept local so
 * the tool owns its typography without a global CSS dependency.
 */
const PROSE_CLASSES = [
  '[&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:tracking-tight',
  '[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-tight',
  '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold',
  '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-[13.5px] [&_h4]:font-semibold',
  '[&_p]:my-3 [&_p]:leading-relaxed',
  '[&_code]:rounded-xs [&_code]:bg-base [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-line [&_pre]:bg-base [&_pre]:p-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_ul]:my-3 [&_ol]:my-3 [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal',
  '[&_li]:my-1 [&_li]:leading-relaxed',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-dim',
  '[&_a]:text-accent [&_a]:underline [&_hr]:my-4 [&_hr]:border-line'
].join(' ')

export default function MarkdownPreviewTool() {
  const [markdown, setMarkdown] = useState('')

  const inputId = useId()
  const hasInput = markdown.length > 0

  const html = useMemo(() => (hasInput ? renderMarkdown(markdown) : ''), [markdown, hasInput])
  const counts = useMemo(() => countWordsAndChars(markdown), [markdown])

  const copyHtml = async () => {
    if (!hasInput) return
    try {
      await navigator.clipboard.writeText(sanitizeHtml(markdownToHtml(markdown)))
      toastSuccess('HTML copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="flex flex-col p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Markdown</SectionHeading>
            <span role="status" className="truncate font-mono text-[10.5px] text-faint tnum">
              {counts.words} words · {counts.chars} chars
            </span>
          </div>
          <label htmlFor={inputId} className="sr-only">
            Markdown source text
          </label>
          <TextArea
            id={inputId}
            mono
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={'# Heading\n\nWrite **Markdown** here and see it rendered live…'}
            className="min-h-56 flex-1"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Preview</SectionHeading>
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Copy sanitized HTML source"
              disabled={!hasInput}
              title="Copy HTML"
              onClick={() => void copyHtml()}
            >
              <Copy size={13} />
            </IconButton>
          </div>

          {!hasInput ? (
            <EmptyState
              icon="file-text"
              title="Type Markdown on the left to see it rendered."
              hint="Headings, emphasis, lists, code blocks and blockquotes are supported — rendering happens locally."
            />
          ) : (
            <output
              aria-label="Rendered Markdown preview"
              // Content is sanitized through DOMPurify before it reaches here.
              dangerouslySetInnerHTML={{ __html: html }}
              className={`max-h-[26rem] min-h-56 overflow-y-auto rounded-md border border-line bg-base p-4 text-[13px] leading-normal text-ink ${PROSE_CLASSES}`}
            />
          )}
        </Panel>
      </div>

      {hasInput && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setMarkdown('')}>
            Clear input
          </Button>
        </div>
      )}
    </div>
  )
}
