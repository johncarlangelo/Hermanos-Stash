import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { openDatabase } from './db'
import { AssetStashStore, inferAssetType } from './stores'

describe('AssetStashStore (ADR-033)', () => {
  let db: ReturnType<typeof openDatabase>['db']
  let store: AssetStashStore
  let tempDir: string

  beforeEach(() => {
    const opened = openDatabase(':memory:')
    db = opened.db
    store = new AssetStashStore(db)
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stash-assets-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('infers asset categories correctly from filenames', () => {
    expect(inferAssetType('photo.PNG')).toBe('image')
    expect(inferAssetType('document.pdf')).toBe('document')
    expect(inferAssetType('song.mp3')).toBe('audio')
    expect(inferAssetType('movie.mp4')).toBe('video')
    expect(inferAssetType('bundle.tar.gz')).toBe('archive')
    expect(inferAssetType('bundle.zip')).toBe('archive')
    expect(inferAssetType('code.tsx')).toBe('code')
    expect(inferAssetType('unknown.xyz')).toBe('other')
  })

  it('adds and indexes a local file reference without duplicating bytes', () => {
    const filePath = path.join(tempDir, 'test-image.png')
    fs.writeFileSync(filePath, Buffer.from('fake-png-bytes'))

    const asset = store.add(filePath, 'image-preview', ['tag1', 'tag2'])
    expect(asset.id).toBeGreaterThan(0)
    expect(asset.filePath).toBe(path.resolve(filePath))
    expect(asset.fileName).toBe('test-image.png')
    expect(asset.fileSize).toBe(14)
    expect(asset.fileType).toBe('image')
    expect(asset.mimeType).toBe('image/png')
    expect(asset.sourceToolId).toBe('image-preview')
    expect(asset.favorite).toBe(false)
    expect(asset.tags).toEqual(['tag1', 'tag2'])
    expect(asset.exists).toBe(true)

    // Verify count
    expect(store.count()).toBe(1)
  })

  it('updates timestamp and size on re-adding same file path (UPSERT)', () => {
    const filePath = path.join(tempDir, 'doc.pdf')
    fs.writeFileSync(filePath, Buffer.from('initial'))

    const t1 = store.add(filePath, 'pdf-merge', [], 1000)
    expect(t1.fileSize).toBe(7)

    // Modify file
    fs.writeFileSync(filePath, Buffer.from('updated-longer-content'))
    const t2 = store.add(filePath, 'pdf-split', [], 2000)

    expect(t2.id).toBe(t1.id)
    expect(t2.fileSize).toBe(22)
    expect(t2.lastAccessedMs).toBe(2000)
    expect(store.count()).toBe(1)
  })

  it('filters by category, favorite, and search query', () => {
    const f1 = path.join(tempDir, 'alpha.png')
    const f2 = path.join(tempDir, 'beta.pdf')
    const f3 = path.join(tempDir, 'gamma.mp3')
    fs.writeFileSync(f1, 'a')
    fs.writeFileSync(f2, 'b')
    fs.writeFileSync(f3, 'c')

    const a1 = store.add(f1)
    store.add(f2)
    store.add(f3)

    // Favorite a1
    store.toggleFavorite(a1.id)

    // Filter by type
    const images = store.list({ type: 'image' })
    expect(images.length).toBe(1)
    expect(images[0].fileName).toBe('alpha.png')

    // Filter by favorite
    const favs = store.list({ favorite: true })
    expect(favs.length).toBe(1)
    expect(favs[0].fileName).toBe('alpha.png')

    // Search query
    const searchResults = store.list({ search: 'beta' })
    expect(searchResults.length).toBe(1)
    expect(searchResults[0].fileName).toBe('beta.pdf')
  })

  it('removes a reference without deleting the disk file', () => {
    const filePath = path.join(tempDir, 'keep-me.txt')
    fs.writeFileSync(filePath, 'original content')

    const asset = store.add(filePath)
    expect(store.count()).toBe(1)

    store.remove(asset.id)
    expect(store.count()).toBe(0)

    // File on disk MUST still exist!
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('cleans up missing references when files were removed from disk', () => {
    const f1 = path.join(tempDir, 'file1.txt')
    const f2 = path.join(tempDir, 'file2.txt')
    fs.writeFileSync(f1, 'one')
    fs.writeFileSync(f2, 'two')

    store.add(f1)
    store.add(f2)
    expect(store.count()).toBe(2)

    // Delete file1 externally
    fs.unlinkSync(f1)

    const removed = store.cleanupMissing()
    expect(removed).toBe(1)
    expect(store.count()).toBe(1)
    expect(store.list()[0].fileName).toBe('file2.txt')
  })

  it('handles batch addition gracefully', () => {
    const f1 = path.join(tempDir, 'batch1.jpg')
    const f2 = path.join(tempDir, 'batch2.png')
    fs.writeFileSync(f1, '1')
    fs.writeFileSync(f2, '2')

    const added = store.addBatch([f1, f2, '   ', '/invalid/non/existent/path/here.xyz'])
    expect(added.length).toBe(3) // 2 real + 1 non-existent path registered as reference
    expect(store.count()).toBe(3)
  })
})
