import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import JSZip from 'jszip'
import {
  detectMimeType,
  extractArchiveEntry,
  inspectArchive,
  readArchiveEntry
} from './archive-inspector'

describe('Archive Inspector Engine', () => {
  let tmpDir: string
  let sampleZipPath: string

  beforeAll(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'stash-archive-inspect-test-'))
    sampleZipPath = path.join(tmpDir, 'sample.zip')

    const zip = new JSZip()
    zip.file('hello.txt', 'Hello Hermanos Stash!')
    zip.file('data/nested.json', JSON.stringify({ version: '1.0.0', author: 'Hermanos' }))
    zip.folder('empty-folder')

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    await fsp.writeFile(sampleZipPath, buffer)
  })

  afterAll(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  })

  it('detects MIME types correctly', () => {
    expect(detectMimeType('photo.png')).toBe('image/png')
    expect(detectMimeType('video.mp4')).toBe('video/mp4')
    expect(detectMimeType('track.mp3')).toBe('audio/mpeg')
    expect(detectMimeType('doc.pdf')).toBe('application/pdf')
    expect(detectMimeType('notes.md')).toBe('text/markdown')
    expect(detectMimeType('unknown.xyz')).toBe('application/octet-stream')
  })

  it('inspects entries and returns accurate metadata', async () => {
    const result = await inspectArchive({ path: sampleZipPath })
    expect(result.path).toBe(sampleZipPath)
    expect(result.fileCount).toBe(2)
    expect(result.entries.length).toBeGreaterThanOrEqual(2)

    const helloEntry = result.entries.find((e) => e.path === 'hello.txt')
    expect(helloEntry).toBeDefined()
    expect(helloEntry?.isDirectory).toBe(false)
    expect(helloEntry?.uncompressedSize).toBe(21) // "Hello Hermanos Stash!".length = 21

    const jsonEntry = result.entries.find((e) => e.path === 'data/nested.json')
    expect(jsonEntry).toBeDefined()
  })

  it('reads single entry directly into memory', async () => {
    const readRes = await readArchiveEntry({
      archivePath: sampleZipPath,
      entryPath: 'hello.txt'
    })

    expect(readRes.mimeType).toBe('text/plain')
    const decoded = Buffer.from(readRes.bytes).toString('utf8')
    expect(decoded).toBe('Hello Hermanos Stash!')
  })

  it('extracts single entry to target file path', async () => {
    const outPath = path.join(tmpDir, 'extracted-hello.txt')
    const extractRes = await extractArchiveEntry({
      archivePath: sampleZipPath,
      entryPath: 'hello.txt',
      targetPath: outPath
    })

    expect(extractRes.bytesWritten).toBe(21)
    const content = await fsp.readFile(outPath, 'utf8')
    expect(content).toBe('Hello Hermanos Stash!')
  })

  it('throws error for non-existent archive', async () => {
    await expect(inspectArchive({ path: path.join(tmpDir, 'nonexistent.zip') })).rejects.toThrow()
  })
})
