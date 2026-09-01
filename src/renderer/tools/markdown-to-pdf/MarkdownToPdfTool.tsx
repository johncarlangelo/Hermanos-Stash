import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { DEFAULT_MD_PDF_CONFIG, convertMarkdownToPdf, type MarkdownPdfConfig } from './logic'

const SAMPLES = {
  rfc: `# RFC 104 — Local-First Workstation Storage

## Abstract
This document proposes a unified local SQLite storage and file-based cache architecture for desktop utility workflows.

## Motivation
1. Complete user data sovereignty
2. Zero-latency query performance without remote API hops
3. Predictable offline durability across power cycles

## Technical Architecture
- Local SQLite database stored in application data root
- Secure IPC boundary for file descriptor streaming
- Clean memory buffers for large vector operations

\`\`\`typescript
interface StashStore {
  saveProfile(name: string, payload: Uint8Array): Promise<void>;
  getMetrics(): Promise<UsageMetrics>;
}
\`\`\`

## Rollout Plan
- Phase 1: SQLite schema migrations
- Phase 2: Renderer IPC client bridge`,

  brief: `# Product Scope Brief — Hermanos Stash

## Overview
A high-craft, local-first desktop utility suite replacing scattered browser tools with an integrated dark workstation.

## Core Pillars
- **Local-First:** All processing executes on the client device
- **Dark-Only Workstation:** Refined ergonomics, high contrast, subtle borders
- **Modular Extensibility:** Clean tool registry without shell rewrites

## Target Domains
1. Files & Archives (ZIP, Tar, Metadata, Renaming)
2. Vector & SVG Studio (Shape generation, icon libraries)
3. Developer & Security (Keypairs, SemVer, cURL converter)
4. Audio & Media Utilities (Lossless trimming, normalization)`
}

export default function MarkdownToPdfTool() {
  const [markdown, setMarkdown] = useState<string>(SAMPLES.rfc)
  const [config, setConfig] = useState<MarkdownPdfConfig>(DEFAULT_MD_PDF_CONFIG)
  const [generating, setGenerating] = useState(false)

  const handleDownloadPdf = async () => {
    if (!markdown.trim()) return
    setGenerating(true)
    try {
      const pdfBytes = await convertMarkdownToPdf(markdown, config)
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.title?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'document'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Exported styled PDF document')
      recordHistoryQuietly('markdown-to-pdf', 'Markdown to PDF Exporter', 'documents')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to generate PDF: ${message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">Markdown / Text → PDF Document Exporter</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Styled Vector Typography
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          <button
            type="button"
            onClick={() => setMarkdown(SAMPLES.rfc)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Technical RFC
          </button>
          <button
            type="button"
            onClick={() => setMarkdown(SAMPLES.brief)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Product Brief
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left: Markdown Source Editor & Options */}
        <Panel className="lg:col-span-6 p-3.5 flex flex-col gap-3 overflow-hidden">
          {/* Header metadata inputs */}
          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
            <div className="space-y-1">
              <span className="text-faint block text-[10.5px]">Document Title</span>
              <input
                type="text"
                value={config.title || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Document Title..."
                className="w-full rounded border border-line bg-base px-2.5 py-1 text-ink text-[12px] font-semibold outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <span className="text-faint block text-[10.5px]">Author / Organization</span>
              <input
                type="text"
                value={config.author || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, author: e.target.value }))}
                placeholder="Author Name"
                className="w-full rounded border border-line bg-base px-2.5 py-1 text-ink text-[11.5px] outline-none"
              />
            </div>
          </div>

          {/* Page Setup Options */}
          <div className="grid grid-cols-3 gap-2 text-[11px] border-y border-line/60 py-2">
            <div className="space-y-1">
              <span className="text-faint block">Page Size</span>
              <select
                value={config.pageSize}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    pageSize: e.target.value as 'A4' | 'Letter'
                  }))
                }
                className="w-full rounded border border-line bg-base px-1.5 py-1 text-ink outline-none"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">US Letter (8.5 × 11 in)</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-faint block">Base Font Size</span>
              <select
                value={config.fontSize}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))
                }
                className="w-full rounded border border-line bg-base px-1.5 py-1 text-ink outline-none"
              >
                <option value={9.5}>9.5 pt (Compact)</option>
                <option value={10.5}>10.5 pt (Standard)</option>
                <option value={12}>12 pt (Large)</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={config.includePageNumbers}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, includePageNumbers: e.target.checked }))
                }
                className="rounded border-line accent-accent"
              />
              <span>Page Numbers</span>
            </label>
          </div>

          {/* Markdown Content Editor */}
          <div className="flex-1 flex flex-col gap-1.5 min-h-0">
            <span className="text-[11px] uppercase font-semibold text-faint">
              Markdown Body Content
            </span>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Type or paste Markdown content here..."
              className="flex-1 w-full rounded border border-line bg-base p-3 font-mono text-[11.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed select-all"
            />
          </div>
        </Panel>

        {/* Right: Document Layout Simulation & Export */}
        <Panel className="lg:col-span-6 p-3.5 flex flex-col justify-between gap-3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">
              Vector PDF Page Preview
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={generating || !markdown.trim()}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Download size={13} />
              {generating ? 'Exporting PDF...' : 'Download Styled PDF'}
            </Button>
          </div>

          {/* Styled Document Paper Simulation */}
          <div className="flex-1 rounded border border-line bg-black/50 p-4 flex items-center justify-center overflow-auto">
            <div className="w-[360px] min-h-[460px] bg-white text-zinc-900 rounded shadow-2xl p-6 flex flex-col justify-between text-[11px] font-sans leading-relaxed select-none">
              <div>
                {config.title && (
                  <div className="border-b border-zinc-200 pb-2 mb-3">
                    <h1 className="text-[18px] font-bold text-zinc-950 tracking-tight leading-tight">
                      {config.title}
                    </h1>
                    {config.author && (
                      <div className="text-[10px] text-zinc-500 mt-0.5">{config.author}</div>
                    )}
                  </div>
                )}

                <div className="space-y-2 text-zinc-800 text-[10.5px]">
                  {markdown
                    .split('\n')
                    .slice(0, 14)
                    .map((l, i) => {
                      if (l.startsWith('# ')) {
                        return (
                          <div key={i} className="font-bold text-[14px] text-zinc-950 pt-1">
                            {l.slice(2)}
                          </div>
                        )
                      }
                      if (l.startsWith('## ')) {
                        return (
                          <div key={i} className="font-bold text-[12px] text-zinc-900 pt-1">
                            {l.slice(3)}
                          </div>
                        )
                      }
                      if (l.startsWith('- ')) {
                        return (
                          <div key={i} className="flex gap-1.5 pl-2">
                            <span>•</span>
                            <span>{l.slice(2)}</span>
                          </div>
                        )
                      }
                      if (l.startsWith('```')) {
                        return (
                          <div
                            key={i}
                            className="bg-zinc-100 p-1.5 rounded font-mono text-[9.5px] text-zinc-700 border border-zinc-200"
                          >
                            [Code Block]
                          </div>
                        )
                      }
                      return <p key={i}>{l}</p>
                    })}
                </div>
              </div>

              {config.includePageNumbers && (
                <div className="text-center text-[9px] font-mono text-zinc-400 border-t border-zinc-100 pt-2">
                  1 / 1
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
