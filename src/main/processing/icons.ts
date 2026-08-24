import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { stashError } from '../../shared/errors'
import { writePipeline } from './images'

/**
 * Icon-pack generation: one logo in, a complete size set out.
 * PNG-in-ICO is valid since Windows Vista, so favicon.ico is a minimal
 * hand-built container around the 256px PNG — no extra dependency needed.
 */

export const ICON_PACK_SIZES: readonly number[] = [16, 32, 48, 64, 128, 180, 192, 256, 512]

/** Working resolution every output is derived from (center-cropped square). */
const MASTER_SIZE = 512

/**
 * Build a single-image ICO container. Header layout:
 *   ICONDIR (6 bytes): reserved=0, type=1, image count
 *   ICONDIRENTRY (16 bytes): width, height, palette, reserved,
 *     planes, bit count, payload byte length, payload offset
 * A width/height byte of 0 means 256 px per the format spec.
 */
export function buildIcoContainer(pngBytes: Buffer, sideLength = 256): Buffer {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one embedded image
  header.writeUInt8(sideLength >= 256 ? 0 : sideLength, 6)
  header.writeUInt8(sideLength >= 256 ? 0 : sideLength, 7)
  header.writeUInt8(0, 8) // palette colors
  header.writeUInt8(0, 9) // reserved
  header.writeUInt16LE(1, 10) // color planes
  header.writeUInt16LE(32, 12) // bits per pixel
  header.writeUInt32LE(pngBytes.byteLength, 14)
  header.writeUInt32LE(22, 18) // payload offset
  return Buffer.concat([header, pngBytes])
}

/** Center-crop the source to a square master PNG buffer for all outputs. */
export async function loadSquareLogo(inputPath: string): Promise<Buffer> {
  try {
    return await sharp(inputPath)
      .resize({ width: MASTER_SIZE, height: MASTER_SIZE, fit: 'cover' })
      .png()
      .toBuffer()
  } catch (err) {
    const message = String((err as Error)?.message ?? err)
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || /missing|no such file/i.test(message)) {
      throw stashError('FS_READ', `"${path.basename(inputPath)}" could not be found or opened.`, {
        technicalMessage: message
      })
    }
    throw stashError(
      'UNSUPPORTED',
      `"${path.basename(inputPath)}" isn't a supported logo image (.png or .svg).`,
      { technicalMessage: message }
    )
  }
}

export function iconFileName(size: number): string {
  return `icon-${size}.png`
}

export const FAVICON_NAME = 'favicon.ico'

export async function writeIconPng(
  squareMaster: Buffer,
  size: number,
  targetPath: string
): Promise<number> {
  return writePipeline(
    sharp(squareMaster).resize({ width: size, height: size }),
    targetPath,
    iconFileName(size)
  )
}

export async function writeFaviconIco(squareMaster: Buffer, targetPath: string): Promise<number> {
  try {
    const png256 = await sharp(squareMaster).resize({ width: 256, height: 256 }).png().toBuffer()
    await fs.writeFile(targetPath, buildIcoContainer(png256))
  } catch (err) {
    throw stashError('FS_WRITE', `Could not write "${FAVICON_NAME}".`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }
  return (await fs.stat(targetPath)).size
}
