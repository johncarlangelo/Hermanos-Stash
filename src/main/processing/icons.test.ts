import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import {
  FAVICON_NAME,
  ICON_PACK_SIZES,
  buildIcoContainer,
  iconFileName,
  loadSquareLogo,
  writeFaviconIco,
  writeIconPng
} from './icons'

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'stash-icons-'))
}

async function writeLogoPng(dir: string, name = 'logo.png'): Promise<string> {
  const buffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 40, g: 90, b: 160 }
    }
  })
    .png()
    .toBuffer()
  const file = path.join(dir, name)
  await fs.writeFile(file, buffer)
  return file
}

describe('buildIcoContainer', () => {
  it('writes correct header fields for a known payload', () => {
    const png = Buffer.alloc(1234, 7)
    png[0] = 0x89 // look like the start of a PNG signature
    png[1] = 0x50
    const ico = buildIcoContainer(png)

    expect(ico.length).toBe(22 + 1234)
    expect(ico.readUInt16LE(0)).toBe(0) // reserved
    expect(ico.readUInt16LE(2)).toBe(1) // type: icon
    expect(ico.readUInt16LE(4)).toBe(1) // one image
    expect(ico.readUInt8(6)).toBe(0) // width byte 0 == 256
    expect(ico.readUInt8(7)).toBe(0) // height byte 0 == 256
    expect(ico.readUInt8(8)).toBe(0) // palette colors
    expect(ico.readUInt8(9)).toBe(0) // reserved
    expect(ico.readUInt16LE(10)).toBe(1) // planes
    expect(ico.readUInt16LE(12)).toBe(32) // bit count
    expect(ico.readUInt32LE(14)).toBe(1234) // payload size
    expect(ico.readUInt32LE(18)).toBe(22) // payload offset
    // Payload copied verbatim after the header.
    expect(Buffer.compare(ico.subarray(22), png)).toBe(0)
  })

  it('encodes sub-256 side lengths as literal bytes', () => {
    const ico = buildIcoContainer(Buffer.alloc(4), 48)
    expect(ico.readUInt8(6)).toBe(48)
    expect(ico.readUInt8(7)).toBe(48)
  })
})

describe('icon pack generation', () => {
  it('produces nine PNGs plus a valid favicon.ico', async () => {
    const dir = await makeTempDir()
    try {
      const logo = await writeLogoPng(dir, 'brand.png')
      const squareMaster = await loadSquareLogo(logo)
      expect(squareMaster.length).toBeGreaterThan(0)

      for (const size of ICON_PACK_SIZES) {
        const target = path.join(dir, iconFileName(size))
        await writeIconPng(squareMaster, size, target)
        const meta = await sharp(await fs.readFile(target)).metadata()
        expect(meta).toMatchObject({ width: size, height: size })
      }

      const favicon = path.join(dir, FAVICON_NAME)
      await writeFaviconIco(squareMaster, favicon)
      const bytes = await fs.readFile(favicon)
      // ICO signature: reserved=0, type=1.
      expect(bytes[0]).toBe(0)
      expect(bytes[1]).toBe(0)
      expect(bytes[2]).toBe(1)
      expect(bytes[3]).toBe(0)
      // One entry whose payload is the raw PNG (starts with PNG signature).
      expect(bytes.readUInt32LE(14)).toBe(bytes.length - 22)
      expect(Array.from(bytes.subarray(22, 26))).toEqual([0x89, 0x50, 0x4e, 0x47])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects missing logos with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const missing = path.join(dir, 'nope.png')
      await expect(loadSquareLogo(missing)).rejects.toSatisfy(
        (err: unknown) =>
          typeof err === 'object' && err !== null && (err as { code?: string }).code === 'FS_READ'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
