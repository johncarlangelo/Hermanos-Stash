import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { isStashError } from '../../shared/errors'
import { createZipArchive, extractZipArchive, isUnsafeEntryName, zipEntryName } from './archives'

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'stash-zip-'))
}

describe('zipEntryName', () => {
  it('dedupes colliding basenames with numeric suffixes', () => {
    const used = new Set<string>()
    expect(zipEntryName('a.txt', used)).toBe('a.txt')
    expect(zipEntryName('a.txt', used)).toBe('a-1.txt')
    expect(zipEntryName('A.TXT', used)).toBe('A-2.TXT')
    expect(zipEntryName('readme', used)).toBe('readme')
    expect(zipEntryName('readme', used)).toBe('readme-1')
  })
})

describe('isUnsafeEntryName', () => {
  it('rejects traversal and absolute entry paths', () => {
    expect(isUnsafeEntryName('../evil.txt')).toBe(true)
    expect(isUnsafeEntryName('nested/../../evil.txt')).toBe(true)
    expect(isUnsafeEntryName('/abs/path.txt')).toBe(true)
    expect(isUnsafeEntryName('C:\\Windows\\evil.txt')).toBe(true)
    expect(isUnsafeEntryName('c:/evil.txt')).toBe(true)
    expect(isUnsafeEntryName('docs/readme.md')).toBe(false)
    expect(isUnsafeEntryName('plain.txt')).toBe(false)
  })
})

describe('createZipArchive', () => {
  it('packs files and reports written size', async () => {
    const dir = await makeTempDir()
    try {
      const a = path.join(dir, 'alpha.txt')
      const b = path.join(dir, 'beta.txt')
      await fs.writeFile(a, 'hello alpha')
      await fs.writeFile(b, Buffer.alloc(2048, 7))
      const target = path.join(dir, 'out.zip')

      const result = await createZipArchive([a, b], target)
      expect(result.fileCount).toBe(2)
      expect((await fs.stat(target)).size).toBe(result.bytesWritten)

      const zip = await JSZip.loadAsync(await fs.readFile(target))
      expect(await zip.file('alpha.txt')!.async('text')).toBe('hello alpha')
      expect(Object.keys(zip.files).sort()).toEqual(['alpha.txt', 'beta.txt'])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects non-file inputs with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const missing = path.join(dir, 'gone.txt')
      await expect(createZipArchive([missing], path.join(dir, 'o.zip'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'FS_WRITE'
      )
      const folder = path.join(dir, 'sub')
      await fs.mkdir(folder)
      await expect(createZipArchive([folder], path.join(dir, 'o.zip'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'VALIDATION'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('extractZipArchive', () => {
  it('extracts entries into the output directory and reports structure', async () => {
    const dir = await makeTempDir()
    try {
      const zipPath = path.join(dir, 'in.zip')
      const zip = new JSZip()
      zip.file('top.txt', 'top level')
      zip.file('nested/deep/leaf.txt', 'buried')
      await fs.writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }))

      const outDir = path.join(dir, 'extracted')
      const result = await extractZipArchive(zipPath, outDir)
      expect(result.extractedCount).toBe(2)
      expect(result.skipped).toEqual([])
      expect(result.topLevelCount).toBe(2) // top.txt + nested/
      expect(await fs.readFile(path.join(outDir, 'top.txt'), 'utf-8')).toBe('top level')
      expect(await fs.readFile(path.join(outDir, 'nested/deep/leaf.txt'), 'utf-8')).toBe('buried')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('skips zip-slip entries instead of writing outside outputDir', async () => {
    const dir = await makeTempDir()
    try {
      const zipPath = path.join(dir, 'evil.zip')
      const zip = new JSZip()
      zip.file('good.txt', 'fine')
      zip.file('../../escaped.txt', 'should not exist')
      zip.file('/absolute.txt', 'nor this')
      await fs.writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }))

      const outDir = path.join(dir, 'out')
      const result = await extractZipArchive(zipPath, outDir)
      // JSZip normalizes '..' segments, so only the absolute entry skips;
      // 'escaped.txt' lands safely *inside* outputDir.
      expect(result.extractedCount).toBe(2)
      expect(result.skipped).toEqual(['/absolute.txt'])
      expect(await fs.readFile(path.join(outDir, 'good.txt'), 'utf-8')).toBe('fine')
      expect(await fs.readFile(path.join(outDir, 'escaped.txt'), 'utf-8')).toBe('should not exist')
      // Nothing escaped the temp sandbox.
      const siblings = (await fs.readdir(dir)).filter(
        (name) => name !== 'evil.zip' && name !== 'out'
      )
      expect(siblings).toEqual([])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects corrupt archives with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const zipPath = path.join(dir, 'bad.zip')
      await fs.writeFile(zipPath, 'this is not a zip file')
      await expect(extractZipArchive(zipPath, path.join(dir, 'out'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'UNSUPPORTED'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
