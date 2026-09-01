/**
 * Image slicing and grid tile calculations logic
 */

export interface ImageSlice {
  index: number
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
  filename: string
}

export interface SliceGridConfig {
  mode: 'grid' | 'fixed-size'
  cols: number
  rows: number
  tileWidth: number
  tileHeight: number
  format: 'png' | 'jpeg' | 'webp'
  quality: number // 0.1 to 1.0
  namingPattern: 'row-col' | 'sequential'
}

export const DEFAULT_SLICE_CONFIG: SliceGridConfig = {
  mode: 'grid',
  cols: 3,
  rows: 3,
  tileWidth: 512,
  tileHeight: 512,
  format: 'png',
  quality: 0.92,
  namingPattern: 'row-col'
}

/**
 * Calculate slice coordinate boundaries for an image
 */
export function calculateSlices(
  imgWidth: number,
  imgHeight: number,
  config: SliceGridConfig,
  baseFilename = 'image'
): ImageSlice[] {
  if (imgWidth <= 0 || imgHeight <= 0) return []

  const cleanName = baseFilename.replace(/\.[^/.]+$/, '')
  const slices: ImageSlice[] = []

  let actualCols = config.cols
  let actualRows = config.rows
  let stepW = imgWidth / actualCols
  let stepH = imgHeight / actualRows

  if (config.mode === 'fixed-size') {
    stepW = Math.max(10, config.tileWidth)
    stepH = Math.max(10, config.tileHeight)
    actualCols = Math.ceil(imgWidth / stepW)
    actualRows = Math.ceil(imgHeight / stepH)
  }

  let index = 1
  for (let r = 0; r < actualRows; r++) {
    for (let c = 0; c < actualCols; c++) {
      const x = Math.round(c * stepW)
      const y = Math.round(r * stepH)
      const w = Math.min(Math.round(stepW), imgWidth - x)
      const h = Math.min(Math.round(stepH), imgHeight - y)

      if (w <= 0 || h <= 0) continue

      const ext = config.format === 'jpeg' ? 'jpg' : config.format
      const filename =
        config.namingPattern === 'row-col'
          ? `${cleanName}_r${r + 1}_c${c + 1}.${ext}`
          : `${cleanName}_${String(index).padStart(2, '0')}.${ext}`

      slices.push({
        index,
        row: r + 1,
        col: c + 1,
        x,
        y,
        width: w,
        height: h,
        filename
      })
      index++
    }
  }

  return slices
}
