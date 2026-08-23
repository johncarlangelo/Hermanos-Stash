import type { CategoryId } from '../types/tool'

export interface CategoryMeta {
  id: CategoryId
  label: string
  description: string
  /** Lucide icon name. */
  icon: string
}

/**
 * Standardized category taxonomy (PRD §6). Categories are neutral — the UI
 * must not assign a different bright color to each (DESIGN.md).
 */
export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'files',
    label: 'Files & Archives',
    description: 'Inspect, hash, and organize files.',
    icon: 'folder'
  },
  {
    id: 'documents',
    label: 'Documents & PDF',
    description: 'Preview, merge, and reshape documents.',
    icon: 'file-text'
  },
  {
    id: 'images',
    label: 'Images',
    description: 'Convert, resize, and optimize images.',
    icon: 'image'
  },
  { id: 'video', label: 'Video', description: 'Transcode and trim video.', icon: 'film' },
  { id: 'audio', label: 'Audio', description: 'Convert and edit audio.', icon: 'music' },
  {
    id: 'text',
    label: 'Text & Data',
    description: 'Format, validate, and transform text.',
    icon: 'braces'
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Everyday developer utilities.',
    icon: 'code'
  },
  {
    id: 'future',
    label: 'Experiments',
    description: 'Local AI-adjacent utilities without external APIs.',
    icon: 'sparkles'
  }
] as const

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id: CategoryId): CategoryMeta | undefined {
  return BY_ID.get(id)
}

export function isValidCategory(value: unknown): value is CategoryId {
  return typeof value === 'string' && BY_ID.has(value as CategoryId)
}
