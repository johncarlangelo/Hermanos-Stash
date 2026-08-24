import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, FilePlus2, Pencil, Trash2, UploadCloud, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { ClearableTagInput, FieldRow, Input, TextArea } from '../../components/ui/Inputs'
import { EmptyState, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { normalizeError } from '../../../shared/errors'
import type { PromptRecord } from '../../../shared/ipc'
import { extractVariables, fillTemplate, parseLibraryImport, parseTagInput } from './logic'

interface EditorState {
  id?: number
  title: string
  body: string
  tagsRaw: string
}

const EMPTY_EDITOR: EditorState = { title: '', body: '', tagsRaw: '' }

const STARTER_PACK: Array<{ title: string; body: string; tags: string[] }> = [
  {
    title: 'Code review pass',
    body: 'Review the following {{language}} code for bugs, edge cases and readability.\n\nList issues by severity with short fixes, then suggest one refactor that improves clarity without changing behavior.\n\n```\n{{code}}\n```',
    tags: ['code', 'review']
  },
  {
    title: 'Bug report draft',
    body: 'Write a concise bug report from these notes:\n{{notes}}\n\nInclude: expected vs actual behavior, minimal reproduction steps, and environment details I may have missed.',
    tags: ['writing', 'debugging']
  },
  {
    title: 'Explain like a mentor',
    body: 'Explain {{concept}} to someone who knows {{background}}. Use one concrete analogy, one common misconception, and a 3-step mental model. Keep it under {{word_limit}} words.',
    tags: ['learning']
  },
  {
    title: 'Meeting summary',
    body: 'Summarize the meeting transcript below into: decisions made, action items (owner + deadline), and open questions.\n\nTranscript:\n{{transcript}}',
    tags: ['work']
  }
]

export default function PromptLibraryTool() {
  const [prompts, setPrompts] = useState<PromptRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [fillValues, setFillValues] = useState<Record<string, string>>({})
  const [fillingId, setFillingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const reload = async () => {
    try {
      setPrompts(await window.stash.prompts.list())
    } catch (err) {
      setPrompts([])
      toastError(err)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of prompts ?? []) {
      for (const tag of p.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [prompts])

  const filtered = useMemo(() => {
    if (!prompts) return []
    const q = query.trim().toLowerCase()
    return prompts.filter((p) => {
      if (tagFilter && !p.tags.includes(tagFilter)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
      )
    })
  }, [prompts, query, tagFilter])

  const save = async () => {
    if (!editor) return
    try {
      await window.stash.prompts.save({
        id: editor.id,
        title: editor.title,
        body: editor.body,
        tags: parseTagInput(editor.tagsRaw)
      })
      setEditor(null)
      await reload()
      toastSuccess('Prompt saved')
    } catch (err) {
      toastError(normalizeError(err))
    }
  }

  const duplicate = async (record: PromptRecord) => {
    try {
      await window.stash.prompts.save({
        title: `${record.title} (copy)`,
        body: record.body,
        tags: record.tags
      })
      await reload()
    } catch (err) {
      toastError(err)
    }
  }

  const remove = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId((c) => (c === id ? null : c)), 3000)
      return
    }
    try {
      await window.stash.prompts.delete(id)
      setConfirmDeleteId(null)
      await reload()
    } catch (err) {
      toastError(err)
    }
  }

  const copyText = async (text: string, label = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text)
      toastSuccess(label)
    } catch {
      toastError('Clipboard write was blocked by the system.')
    }
  }

  const exportLibrary = async () => {
    if (!prompts?.length) return
    try {
      const dialog = await window.stash.dialogs.saveFile({
        title: 'Export prompt library',
        defaultName: 'prompt-library.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (dialog.cancelled || !dialog.path) return
      await window.stash.fs.writeTextFile({
        path: dialog.path,
        content: JSON.stringify({ prompts }, null, 2)
      })
      toastSuccess(`Exported ${prompts.length} prompts`)
    } catch (err) {
      toastError(err)
    }
  }

  const importLibrary = async () => {
    try {
      const dialog = await window.stash.dialogs.openFile({
        title: 'Import prompt library',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (dialog.cancelled || dialog.paths.length === 0) return
      const file = await window.stash.fs.readTextFile({
        path: dialog.paths[0],
        maxBytes: 4 * 1024 * 1024
      })
      const parsed = parseLibraryImport(file.content)
      if (!parsed.ok) {
        toastError(parsed.error)
        return
      }
      for (const p of parsed.value.prompts) {
        await window.stash.prompts.save(p)
      }
      await reload()
      toastSuccess(
        `Imported ${parsed.value.prompts.length} prompts` +
          (parsed.value.skipped ? ` · skipped ${parsed.value.skipped} invalid` : '')
      )
    } catch (err) {
      toastError(err)
    }
  }

  const addStarters = async () => {
    try {
      for (const p of STARTER_PACK) await window.stash.prompts.save(p)
      await reload()
      toastSuccess(`Added ${STARTER_PACK.length} starter prompts`)
    } catch (err) {
      toastError(err)
    }
  }

  if (!prompts) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner label="Loading prompt library" />
      </div>
    )
  }

  // --- Editor mode ----------------------------------------------------------
  if (editor) {
    const variables = extractVariables(editor.body)
    const invalid = !editor.title.trim() || !editor.body.trim()
    return (
      <div className="space-y-4">
        <Panel className="space-y-3 px-4 py-4">
          <SectionHeading>{editor.id === undefined ? 'New prompt' : 'Edit prompt'}</SectionHeading>
          <FieldRow label="Title" htmlFor="prompt-title">
            <Input
              id="prompt-title"
              value={editor.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEditor({ ...editor, title: e.target.value })
              }
              placeholder="e.g. Code review pass"
              className="max-w-md"
            />
          </FieldRow>
          <FieldRow label="Tags" htmlFor="prompt-tags">
            <ClearableTagInput
              id="prompt-tags"
              value={editor.tagsRaw}
              onChange={(tagsRaw) => setEditor({ ...editor, tagsRaw })}
              placeholder="comma separated, e.g. writing, code"
            />
          </FieldRow>
        </Panel>

        <Panel className="px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionHeading>Prompt body</SectionHeading>
            {variables.length > 0 && (
              <p className="text-[11px] text-dim" aria-live="polite">
                Variables detected:{' '}
                {variables.map((v) => (
                  <span
                    key={v}
                    className="ml-1 rounded-xs border border-accent/40 bg-accent-soft px-1 font-mono text-[10.5px] text-accent"
                  >
                    {v}
                  </span>
                ))}
              </p>
            )}
          </div>
          <TextArea
            mono
            rows={12}
            value={editor.body}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setEditor({ ...editor, body: e.target.value })
            }
            placeholder={
              'Write your prompt here.\n\nWrap replaceable parts in double braces: {{code}}, {{topic}}, …'
            }
          />
          {invalid && (
            <p role="alert" className="mt-2 text-[12px] text-danger">
              A title and a body are required.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" onClick={() => void save()} disabled={invalid}>
              Save prompt
            </Button>
            <Button variant="ghost" onClick={() => setEditor(null)}>
              Cancel
            </Button>
          </div>
        </Panel>
      </div>
    )
  }

  const filling = fillingId !== null ? (prompts.find((p) => p.id === fillingId) ?? null) : null

  // --- Library mode -----------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setEditor({ ...EMPTY_EDITOR })}>
          <FilePlus2 size={13} aria-hidden />
          Create custom prompt
        </Button>
        {prompts.length > 0 && (
          <>
            <Button variant="secondary" size="sm" onClick={() => void importLibrary()}>
              <UploadCloud size={13} aria-hidden />
              Import
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void exportLibrary()}>
              <Download size={13} aria-hidden />
              Export
            </Button>
          </>
        )}
        {prompts.length === 0 && STARTER_PACK.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void addStarters()}>
            <Wand2 size={13} aria-hidden />
            Add starter pack
          </Button>
        )}
      </div>

      {prompts.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="Your prompt library is empty."
          hint="Create reusable prompts with {{variable}} placeholders you can fill in before copying — or start from the starter pack above."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search titles, bodies and tags…"
              aria-label="Search prompts"
              className="max-w-xs"
            />
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tagFilter === tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] transition-colors duration-150 ease-out ${
                  tagFilter === tag
                    ? 'border-accent/60 bg-accent-soft text-accent'
                    : 'border-line text-dim hover:border-line-strong hover:text-ink'
                }`}
              >
                {tag}
                <span className="tnum ml-1 text-faint">{count}</span>
              </button>
            ))}
          </div>

          {filling && (
            <Panel className="px-4 py-4">
              <SectionHeading>Fill in “{filling.title}”</SectionHeading>
              <div className="mt-3 space-y-2.5">
                {extractVariables(filling.body).map((variable) => (
                  <FieldRow key={variable} label={variable} htmlFor={`var-${variable}`}>
                    <TextArea
                      id={`var-${variable}`}
                      mono
                      rows={2}
                      value={fillValues[variable] ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFillValues((v) => ({ ...v, [variable]: e.target.value }))
                      }
                    />
                  </FieldRow>
                ))}
              </div>
              {(() => {
                const filled = fillTemplate(filling.body, fillValues)
                return filled.ok ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void copyText(filled.output, 'Filled prompt copied')}
                    >
                      <Copy size={13} aria-hidden />
                      Copy filled prompt
                    </Button>
                    <span className="tnum text-[11px] text-faint">
                      {filled.output.length} characters
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-[11.5px] text-faint">{filled.error}</p>
                )
              })()}
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFillingId(null)
                    setFillValues({})
                  }}
                >
                  Cancel
                </Button>
              </div>
            </Panel>
          )}

          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {filtered.map((prompt) => (
              <Panel key={prompt.id} className="group flex flex-col px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setFillingId(prompt.id)}
                    className="min-w-0 cursor-pointer text-left"
                    aria-label={`Use ${prompt.title}`}
                  >
                    <span className="block truncate text-[13px] font-medium text-ink group-hover:text-accent">
                      {prompt.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-dim">
                      {prompt.body.split('\n')[0]}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton
                      size="sm"
                      aria-label={`Copy ${prompt.title}`}
                      onClick={() => void copyText(prompt.body)}
                    >
                      <Copy size={13} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label={`Edit ${prompt.title}`}
                      onClick={() =>
                        setEditor({
                          id: prompt.id,
                          title: prompt.title,
                          body: prompt.body,
                          tagsRaw: prompt.tags.join(', ')
                        })
                      }
                    >
                      <Pencil size={13} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label={`Duplicate ${prompt.title}`}
                      onClick={() => void duplicate(prompt)}
                    >
                      <FilePlus2 size={13} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label={
                        confirmDeleteId === prompt.id
                          ? `Confirm delete ${prompt.title}`
                          : `Delete ${prompt.title}`
                      }
                      className={confirmDeleteId === prompt.id ? 'text-danger' : ''}
                      onClick={() => void remove(prompt.id)}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1 pt-2">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xs border border-line px-1 py-px font-mono text-[9.5px] tracking-wide text-faint uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                  {extractVariables(prompt.body).length > 0 && (
                    <span className="ml-auto font-mono text-[9.5px] text-accent">
                      {extractVariables(prompt.body).length} variable(s)
                    </span>
                  )}
                </div>
              </Panel>
            ))}
          </ul>
          {filtered.length === 0 && (
            <EmptyState
              icon="search"
              title="No prompts match your search."
              hint="Try different words or clear the tag filter."
            />
          )}
        </>
      )}
    </div>
  )
}
