/**
 * Semantic file-domain classification for workflow file-passthrough validation.
 *
 * The old `areFileCategoriesCompatible` inferred media domains from a tool's
 * UI category, which let cross-category tools (icon-pack, qr-decoder,
 * image-ocr — all `developer`/`documents` sidebar categories) silently accept
 * mismatched media. This table classifies every file-bearing tool by its
 * ACTUAL media domain, independent of sidebar category (TASKS.md audit).
 *
 * Bridges are first-class: a tool whose input domain differs from its output
 * domain (extract-audio, video-to-gif, pdf-to-images, images-to-pdf) is
 * classified per side, so the derived ID sets stay authoritative in both
 * directions. Adding a tool = one table entry, not N set edits.
 */

export type ToolFileDomain = 'image' | 'audio' | 'video' | 'document' | 'any'

export const FILE_DOMAINS: ToolFileDomain[] = ['image', 'audio', 'video', 'document', 'any']

/**
 * Per-tool input/output media domains. `null` = tool does not handle files on
 * that side (text-only or view-only). `any` = universal file tool that
 * accepts/produces arbitrary media.
 */
export const TOOL_FILE_DOMAINS: Record<
  string,
  { input: ToolFileDomain | null; output: ToolFileDomain | null }
> = {
  // --- image consumers (category varies; domain is what counts) ---
  'image-convert': { input: 'image', output: 'image' },
  'image-compress': { input: 'image', output: 'image' },
  'image-preview': { input: 'image', output: null },
  'image-exif': { input: 'image', output: null },
  'image-watermark': { input: 'image', output: 'image' },
  'image-palette': { input: 'image', output: null }, // produces text (CSS/Tailwind)
  'image-slicer': { input: 'image', output: 'image' },
  'image-grid': { input: 'image', output: 'image' },
  'id-photo-maker': { input: 'image', output: 'image' },
  'image-to-ascii': { input: 'image', output: null }, // produces TEXT art
  'social-resizer': { input: 'image', output: 'image' },
  // --- documents (PDF manipulators) ---
  'pdf-merge': { input: 'document', output: 'document' },
  'pdf-split': { input: 'document', output: 'document' },
  'pdf-rotate': { input: 'document', output: 'document' },
  'pdf-compress': { input: 'document', output: 'document' },
  'pdf-reorder': { input: 'document', output: 'document' },
  'pdf-numberer': { input: 'document', output: 'document' },
  'pdf-watermark': { input: 'document', output: 'document' },
  'pdf-preview': { input: 'document', output: null },
  'pdf-to-text': { input: 'document', output: null },
  'pdf-to-images': { input: 'document', output: 'image' }, // bridge: doc → image
  'images-to-pdf': { input: 'image', output: 'document' }, // bridge: image → doc
  'markdown-to-pdf': { input: null, output: 'document' }, // consumes TEXT
  // --- video / audio ---
  'video-convert': { input: 'video', output: 'video' },
  'video-compress': { input: 'video', output: 'video' },
  'video-to-gif': { input: 'video', output: 'image' }, // bridge: video → image
  'extract-audio': { input: 'video', output: 'audio' }, // bridge: video → audio
  'audio-convert': { input: 'audio', output: 'audio' },
  'audio-trimmer': { input: 'audio', output: 'audio' },
  'audio-normalize': { input: 'audio', output: 'audio' },
  // --- universal file tools (accept/produce arbitrary media) ---
  'file-metadata': { input: 'any', output: null },
  'zip-create': { input: 'any', output: 'any' },
  'zip-extract': { input: 'any', output: 'any' },
  'archive-inspect': { input: 'any', output: 'any' },
  'checksum-verifier': { input: 'any', output: null },
  'duplicate-finder': { input: 'any', output: null },
  'folder-analyzer': { input: 'any', output: null },
  'hash-generator': { input: 'any', output: null },
  // --- image OUTPUT despite non-image sidebar category ---
  'qr-generator': { input: null, output: 'image' },
  'icon-pack': { input: 'image', output: 'image' },
  // --- file exports from design tools ---
  'svg-creator': { input: null, output: 'image' },
  'gradient-studio': { input: null, output: 'image' },
  // --- image in → text out ---
  'image-ocr': { input: 'image', output: null },
  'qr-decoder': { input: 'image', output: null },
  // --- token estimation accepts arbitrary files, produces text ---
  'token-counter': { input: 'any', output: null }
}

export function fileInputDomain(id: string): ToolFileDomain | null {
  return TOOL_FILE_DOMAINS[id]?.input ?? null
}

export function fileOutputDomain(id: string): ToolFileDomain | null {
  return TOOL_FILE_DOMAINS[id]?.output ?? null
}

function toolsWhere(side: 'input' | 'output', domain: ToolFileDomain): string[] {
  return Object.entries(TOOL_FILE_DOMAINS)
    .filter(([, domains]) => domains[side] === domain)
    .map(([id]) => id)
}

export const IMAGE_CONSUMING_TOOL_IDS = toolsWhere('input', 'image')
export const IMAGE_PRODUCING_TOOL_IDS = toolsWhere('output', 'image')
export const AUDIO_CONSUMING_TOOL_IDS = toolsWhere('input', 'audio')
export const AUDIO_PRODUCING_TOOL_IDS = toolsWhere('output', 'audio')
export const VIDEO_CONSUMING_TOOL_IDS = toolsWhere('input', 'video')
export const VIDEO_PRODUCING_TOOL_IDS = toolsWhere('output', 'video')
export const DOC_CONSUMING_TOOL_IDS = toolsWhere('input', 'document')
export const DOC_PRODUCING_TOOL_IDS = toolsWhere('output', 'document')
export const UNIVERSAL_CONSUMING_TOOL_IDS = toolsWhere('input', 'any')
export const UNIVERSAL_PRODUCING_TOOL_IDS = toolsWhere('output', 'any')
