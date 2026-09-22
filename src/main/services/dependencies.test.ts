import { describe, expect, it } from 'vitest'
import { checkAllDependencies } from './dependencies'

describe('System Dependencies Verifier', () => {
  it('returns a comprehensive structured dependency report', async () => {
    const report = await checkAllDependencies()

    expect(report).toBeDefined()
    expect(report.checkedAt).toBeTruthy()
    expect(report.platform).toBeDefined()
    expect(report.platform.os).toBeTruthy()
    expect(report.platform.node).toBeTruthy()
    expect(report.platform.arch).toBeTruthy()
    expect(typeof report.resourcesPath).toBe('string')

    expect(report.summary).toBeDefined()
    expect(report.summary.total).toBe(report.items.length)
    expect(report.summary.ready + report.summary.missing + report.summary.optionalOffline).toBe(
      report.summary.total
    )

    // Core engines must always be probed
    const ids = report.items.map((i) => i.id)
    expect(ids).toContain('ffmpeg')
    expect(ids).toContain('sharp')
    expect(ids).toContain('sqlite')
    expect(ids).toContain('pdf-engine')
    expect(ids).toContain('tesseract')
    expect(ids).toContain('archives')
    expect(ids).toContain('ollama')
    expect(ids).toContain('minilm-model')


    // Sharp, SQLite, PDF vector engine, and Archives should be operational
    const sharpItem = report.items.find((i) => i.id === 'sharp')
    expect(sharpItem?.status).toBe('ready')
    expect(sharpItem?.source).toBe('embedded')

    const sqliteItem = report.items.find((i) => i.id === 'sqlite')
    expect(sqliteItem?.status).toBe('ready')
    expect(sqliteItem?.source).toBe('embedded')

    const pdfItem = report.items.find((i) => i.id === 'pdf-engine')
    expect(pdfItem?.status).toBe('ready')

    const archiveItem = report.items.find((i) => i.id === 'archives')
    expect(archiveItem?.status).toBe('ready')

    // Local LLM is optional
    const ollamaItem = report.items.find((i) => i.id === 'ollama')
    expect(['ready', 'optional_offline']).toContain(ollamaItem?.status)
  })

  it('supports cache invalidation on rescan', async () => {
    const report = await checkAllDependencies({ invalidateCache: true })
    expect(report.items.length).toBeGreaterThanOrEqual(7)
    expect(report.summary.total).toBe(report.items.length)
  })

  it('rejects automated installation for unknown dependency IDs gracefully', async () => {
    const { installDependency } = await import('./dependencies')
    const result = await installDependency('unknown-binary')
    expect(result.success).toBe(false)
    expect(result.error).toContain('does not have an automated 1-click installer')
  })

  it('annotates installable dependencies with installable flag and download size', async () => {
    const report = await checkAllDependencies()
    const ffmpegItem = report.items.find((i) => i.id === 'ffmpeg')
    if (ffmpegItem && (ffmpegItem.status === 'missing' || ffmpegItem.status === 'degraded')) {
      expect(ffmpegItem.installable).toBe(true)
      expect(ffmpegItem.downloadSize).toBe('~25 MB')
    }

    const tessItem = report.items.find((i) => i.id === 'tesseract')
    if (tessItem && (tessItem.status === 'missing' || tessItem.status === 'degraded')) {
      expect(tessItem.installable).toBe(true)
      expect(tessItem.downloadSize).toBe('~4 MB')
    }

    const minilmItem = report.items.find((i) => i.id === 'minilm-model')
    expect(minilmItem).toBeDefined()
    expect(minilmItem?.category).toBe('ai')
    if (minilmItem && (minilmItem.status === 'missing' || minilmItem.status === 'degraded')) {
      expect(minilmItem.installable).toBe(true)
      expect(minilmItem.downloadSize).toBe('~23 MB')
    }
  })
})


