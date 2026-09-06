import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Copy,
  Download,
  FilePlus2,
  FolderPlus,
  Pencil,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { ClearableTagInput, FieldRow, Input, TextArea } from '../../components/ui/Inputs'
import { EmptyState, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { normalizeError } from '../../../shared/errors'
import type { PromptRecord } from '../../../shared/ipc'
import { extractVariables, fillTemplate, parseLibraryImport, parseTagInput } from './logic'
import { PRESET_CATEGORIES, PROMPT_PRESETS, type PresetPrompt } from './presets'

interface EditorState {
  id?: number
  title: string
  body: string
  tagsRaw: string
}

interface ActiveFillingPrompt {
  id?: number | string
  title: string
  body: string
}

const EMPTY_EDITOR: EditorState = { title: '', body: '', tagsRaw: '' }

export default function PromptLibraryTool() {
  const [prompts, setPrompts] = useState<PromptRecord[] | null>(null)
  const [viewTab, setViewTab] = useState<'library' | 'presets'>('library')
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [presetCategory, setPresetCategory] = useState<string>('all')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [fillValues, setFillValues] = useState<Record<string, string>>({})
  const [activeFilling, setActiveFilling] = useState<ActiveFillingPrompt | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [importingPresets, setImportingPresets] = useState(false)

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

  const filteredPrompts = useMemo(() => {
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

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PROMPT_PRESETS.filter((p) => {
      if (presetCategory !== 'all' && p.category !== presetCategory) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
      )
    })
  }, [presetCategory, query])

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
      toastSuccess('Prompt duplicated')
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
      toastSuccess('Prompt deleted')
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

  const addPresetToLibrary = async (preset: PresetPrompt) => {
    try {
      await window.stash.prompts.save({
        title: preset.title,
        body: preset.body,
        tags: preset.tags
      })
      await reload()
      toastSuccess('Added to your library', preset.title)
    } catch (err) {
      toastError(err)
    }
  }

  const addAllPresets = async (categoryFilter?: string) => {
    setImportingPresets(true)
    try {
      const targets =
        categoryFilter && categoryFilter !== 'all'
          ? PROMPT_PRESETS.filter((p) => p.category === categoryFilter)
          : PROMPT_PRESETS
      for (const p of targets) {
        await window.stash.prompts.save({
          title: p.title,
          body: p.body,
          tags: p.tags
        })
      }
      await reload()
      toastSuccess(`Imported ${targets.length} presets into your library`)
      setViewTab('library')
    } catch (err) {
      toastError(err)
    } finally {
      setImportingPresets(false)
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

  // --- Main View -------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top Header Navigation & View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        {/* Segmented View Switcher */}
        <div className="flex items-center rounded-md border border-line bg-surface/60 p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => {
              setViewTab('library')
              setQuery('')
            }}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors cursor-pointer ${
              viewTab === 'library' ? 'bg-base text-accent shadow-xs' : 'text-dim hover:text-ink'
            }`}
          >
            <BookOpen size={13} />
            My Library
            <span className="ml-1 rounded-full bg-surface px-1.5 py-0.2 text-[10px] text-faint">
              {prompts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewTab('presets')
              setQuery('')
            }}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors cursor-pointer ${
              viewTab === 'presets' ? 'bg-base text-accent shadow-xs' : 'text-dim hover:text-ink'
            }`}
          >
            <Sparkles size={13} />
            Presets Hub
            <span className="ml-1 rounded-full bg-surface px-1.5 py-0.2 text-[10px] text-amber-400">
              {PROMPT_PRESETS.length}
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {viewTab === 'library' ? (
            <>
              <Button variant="primary" size="sm" onClick={() => setEditor({ ...EMPTY_EDITOR })}>
                <FilePlus2 size={13} aria-hidden />
                New custom prompt
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
              <Button variant="secondary" size="sm" onClick={() => setViewTab('presets')}>
                <Sparkles size={13} aria-hidden />
                Explore Presets ({PROMPT_PRESETS.length})
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={importingPresets}
                onClick={() => void addAllPresets(presetCategory)}
              >
                <FolderPlus size={13} aria-hidden />
                {presetCategory === 'all'
                  ? `Import All Presets (${PROMPT_PRESETS.length})`
                  : `Import Category (${filteredPresets.length})`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setViewTab('library')}>
                Back to My Library
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Shared Active Variable Fill Panel (Works for both custom prompts and presets) */}
      {activeFilling && (
        <Panel className="border-accent/40 bg-surface/90 px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <SectionHeading>Fill Template: “{activeFilling.title}”</SectionHeading>
            <span className="font-mono text-[11px] text-accent">
              {extractVariables(activeFilling.body).length} variable(s) required
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {extractVariables(activeFilling.body).map((variable) => (
              <FieldRow key={variable} label={variable} htmlFor={`var-${variable}`}>
                <TextArea
                  id={`var-${variable}`}
                  mono
                  rows={2}
                  value={fillValues[variable] ?? ''}
                  placeholder={`Enter value for ${variable}…`}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFillValues((v) => ({ ...v, [variable]: e.target.value }))
                  }
                />
              </FieldRow>
            ))}
          </div>

          {(() => {
            const filled = fillTemplate(activeFilling.body, fillValues)
            return filled.ok ? (
              <div className="mt-3.5 flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void copyText(filled.output, 'Filled prompt copied to clipboard')}
                >
                  <Copy size={13} aria-hidden />
                  Copy filled prompt
                </Button>
                <span className="tnum text-[11.5px] text-emerald-400">
                  Ready ({filled.output.length} characters)
                </span>
              </div>
            ) : (
              <p className="mt-3 text-[11.5px] text-faint">{filled.error}</p>
            )
          })()}

          <div className="mt-3 pt-1 border-t border-line/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveFilling(null)
                setFillValues({})
              }}
            >
              Close Fill Panel
            </Button>
          </div>
        </Panel>
      )}

      {/* ========================================================================= */}
      {/* VIEW: MY LIBRARY                                                          */}
      {/* ========================================================================= */}
      {viewTab === 'library' && (
        <>
          {prompts.length === 0 ? (
            <Panel className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-accent">
                <BookOpen size={24} />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">
                Your prompt library is empty
              </h3>
              <p className="mt-1 max-w-md text-[12.5px] text-dim">
                Create reusable templates with{' '}
                <code className="text-accent">&#123;&#123;variable&#125;&#125;</code> placeholders,
                or browse over 20+ engineering presets for code analysis, application building, and
                reports.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" size="sm" onClick={() => setViewTab('presets')}>
                  <Sparkles size={13} aria-hidden />
                  Explore Presets Hub ({PROMPT_PRESETS.length})
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void addAllPresets()}>
                  <Wand2 size={13} aria-hidden />
                  Load All Presets ({PROMPT_PRESETS.length})
                </Button>
              </div>
            </Panel>
          ) : (
            <>
              {/* Search & Tags Filter */}
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

              {/* User Prompts Grid */}
              <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {filteredPrompts.map((prompt) => (
                  <Panel
                    key={prompt.id}
                    className="group flex flex-col px-4 py-3.5 hover:border-line-strong transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilling({
                            id: prompt.id,
                            title: prompt.title,
                            body: prompt.body
                          })
                          setFillValues({})
                        }}
                        className="min-w-0 cursor-pointer text-left"
                        aria-label={`Use ${prompt.title}`}
                      >
                        <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-accent transition-colors">
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
                          title="Copy raw template"
                          onClick={() => void copyText(prompt.body)}
                        >
                          <Copy size={13} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          aria-label={`Edit ${prompt.title}`}
                          title="Edit prompt"
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
                          title="Duplicate prompt"
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
                          title="Delete prompt"
                          className={confirmDeleteId === prompt.id ? 'text-danger' : ''}
                          onClick={() => void remove(prompt.id)}
                        >
                          <Trash2 size={13} />
                        </IconButton>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-1.5 pt-2.5">
                      {prompt.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-xs border border-line bg-surface/50 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide text-faint uppercase"
                        >
                          {tag}
                        </span>
                      ))}
                      {extractVariables(prompt.body).length > 0 && (
                        <span className="ml-auto font-mono text-[10px] text-accent">
                          {extractVariables(prompt.body).length} variable(s)
                        </span>
                      )}
                    </div>
                  </Panel>
                ))}
              </ul>

              {filteredPrompts.length === 0 && (
                <EmptyState
                  icon="search"
                  title="No prompts match your search."
                  hint="Try different words or clear the tag filter."
                />
              )}
            </>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW: PRESETS HUB                                                         */}
      {/* ========================================================================= */}
      {viewTab === 'presets' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_CATEGORIES.map((cat) => {
              const count =
                cat.id === 'all'
                  ? PROMPT_PRESETS.length
                  : PROMPT_PRESETS.filter((p) => p.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPresetCategory(cat.id)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all ${
                    presetCategory === cat.id
                      ? 'border-accent bg-accent/15 text-accent shadow-xs'
                      : 'border-line bg-surface/40 text-dim hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {cat.label}
                  <span className="ml-1.5 opacity-60 text-[10px]">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Search Presets */}
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search presets by task, keyword, or language…"
              aria-label="Search preset prompts"
              className="max-w-md"
            />
            {query && (
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                Clear
              </Button>
            )}
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredPresets.map((preset) => {
              const varCount = extractVariables(preset.body).length
              return (
                <Panel
                  key={preset.id}
                  className="flex flex-col justify-between p-4 hover:border-line-strong transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13.5px] font-medium text-ink">{preset.title}</h4>
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-medium text-accent border border-accent/20">
                            {preset.categoryLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-dim">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {preset.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded border border-line bg-surface/60 px-1.5 py-0.5 font-mono text-[9.5px] text-faint"
                        >
                          #{t}
                        </span>
                      ))}
                      {varCount > 0 && (
                        <span className="ml-auto font-mono text-[10px] text-amber-400">
                          {varCount} variable{varCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setActiveFilling({
                            id: preset.id,
                            title: preset.title,
                            body: preset.body
                          })
                          setFillValues({})
                        }}
                      >
                        <Wand2 size={12} aria-hidden />
                        Fill & Use
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void copyText(preset.body, 'Preset template copied')}
                      >
                        <Copy size={12} aria-hidden />
                        Copy Raw
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void addPresetToLibrary(preset)}
                      title="Save a customizable copy to My Library"
                    >
                      <PlusIcon size={12} />
                      Save to My Library
                    </Button>
                  </div>
                </Panel>
              )
            })}
          </div>

          {filteredPresets.length === 0 && (
            <EmptyState
              icon="search"
              title="No presets match your query."
              hint="Try searching for terms like 'review', 'api', 'schema', 'report', or 'architecture'."
            />
          )}
        </div>
      )}
    </div>
  )
}

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
