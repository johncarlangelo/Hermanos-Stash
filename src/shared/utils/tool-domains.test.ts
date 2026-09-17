import { describe, expect, it } from 'vitest'
import {
  AUDIO_CONSUMING_TOOL_IDS,
  AUDIO_PRODUCING_TOOL_IDS,
  DOC_CONSUMING_TOOL_IDS,
  DOC_PRODUCING_TOOL_IDS,
  FILE_DOMAINS,
  IMAGE_CONSUMING_TOOL_IDS,
  IMAGE_PRODUCING_TOOL_IDS,
  TOOL_FILE_DOMAINS,
  UNIVERSAL_CONSUMING_TOOL_IDS,
  UNIVERSAL_PRODUCING_TOOL_IDS,
  VIDEO_CONSUMING_TOOL_IDS,
  VIDEO_PRODUCING_TOOL_IDS,
  fileInputDomain,
  fileOutputDomain
} from './tool-domains'

describe('tool file-domain classification', () => {
  it('classifies every entry with a valid domain pair and kebab-case id', () => {
    for (const [id, domains] of Object.entries(TOOL_FILE_DOMAINS)) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      // Every entry must classify at least one side of the file lifecycle.
      expect(domains.input ?? domains.output).toBeDefined()
      if (domains.input) expect(FILE_DOMAINS).toContain(domains.input)
      if (domains.output) expect(FILE_DOMAINS).toContain(domains.output)
    }
  })

  it('classifies image-consuming tools regardless of sidebar category', () => {
    // icon-pack and qr-decoder live in `developer`, image-ocr in `documents`,
    // yet all three strictly consume image files (TASKS.md audit finding).
    for (const id of ['icon-pack', 'qr-decoder', 'image-ocr', 'image-preview', 'image-convert']) {
      expect(fileInputDomain(id)).toBe('image')
      expect(IMAGE_CONSUMING_TOOL_IDS).toContain(id)
    }
    // None of them are misfiled into other consuming sets.
    expect(AUDIO_CONSUMING_TOOL_IDS).not.toContain('icon-pack')
    expect(DOC_CONSUMING_TOOL_IDS).not.toContain('qr-decoder')
  })

  it('classifies audio consumers plus the video→audio bridge', () => {
    for (const id of ['audio-convert', 'audio-trimmer', 'audio-normalize']) {
      expect(AUDIO_CONSUMING_TOOL_IDS).toContain(id)
      expect(AUDIO_PRODUCING_TOOL_IDS).toContain(id)
    }
    // Audio Extractor consumes VIDEO and produces AUDIO.
    expect(VIDEO_CONSUMING_TOOL_IDS).toContain('extract-audio')
    expect(AUDIO_PRODUCING_TOOL_IDS).toContain('extract-audio')
    expect(fileInputDomain('extract-audio')).toBe('video')
    expect(fileOutputDomain('extract-audio')).toBe('audio')
  })

  it('classifies cross-domain converter bridges with differing in/out domains', () => {
    expect(fileInputDomain('pdf-to-images')).toBe('document')
    expect(fileOutputDomain('pdf-to-images')).toBe('archive')
    expect(fileInputDomain('video-to-gif')).toBe('video')
    expect(fileOutputDomain('video-to-gif')).toBe('image')
    expect(fileInputDomain('images-to-pdf')).toBe('image')
    expect(fileOutputDomain('images-to-pdf')).toBe('document')
  })

  it('classifies QR generator and icon pack output as images despite developer category', () => {
    expect(fileOutputDomain('qr-generator')).toBe('image')
    expect(IMAGE_PRODUCING_TOOL_IDS).toContain('qr-generator')
    expect(fileOutputDomain('icon-pack')).toBe('image')
    expect(IMAGE_PRODUCING_TOOL_IDS).toContain('icon-pack')
    // Their output must not leak into unrelated producing sets.
    expect(AUDIO_PRODUCING_TOOL_IDS).not.toContain('qr-generator')
    expect(VIDEO_PRODUCING_TOOL_IDS).not.toContain('icon-pack')
  })

  it('classifies every PDF manipulator as a document-domain tool', () => {
    for (const id of [
      'pdf-merge',
      'pdf-split',
      'pdf-rotate',
      'pdf-compress',
      'pdf-reorder',
      'pdf-numberer',
      'pdf-watermark',
      'pdf-preview',
      'pdf-to-text',
      'pdf-to-images'
    ]) {
      expect(DOC_CONSUMING_TOOL_IDS).toContain(id)
    }
    expect(DOC_PRODUCING_TOOL_IDS).toContain('markdown-to-pdf')
    // Markdown → PDF consumes TEXT, not files.
    expect(fileInputDomain('markdown-to-pdf')).toBeNull()
  })

  it('classifies arbitrary-file tools as universal consumers/producers', () => {
    for (const id of ['zip-create', 'checksum-verifier', 'hash-generator']) {
      expect(UNIVERSAL_CONSUMING_TOOL_IDS).toContain(id)
    }
    for (const id of ['zip-extract', 'archive-inspect']) {
      expect(UNIVERSAL_PRODUCING_TOOL_IDS).toContain(id)
    }
    // Analysis tools produce text, not files.
    expect(fileOutputDomain('duplicate-finder')).toBeNull()
    expect(fileOutputDomain('folder-analyzer')).toBeNull()
  })

  it('does not classify text/future-only tools into file domains', () => {
    expect(fileInputDomain('json-format')).toBeNull()
    expect(fileOutputDomain('json-format')).toBeNull()
    expect(fileInputDomain('local-llm-playground')).toBeNull()
    expect(fileOutputDomain('local-llm-playground')).toBeNull()
  })

  it('returns null for unknown tool ids instead of throwing', () => {
    expect(fileInputDomain('not-a-real-tool')).toBeNull()
    expect(fileOutputDomain('not-a-real-tool')).toBeNull()
  })
})
