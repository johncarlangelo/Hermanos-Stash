/**
 * Contact sheet and multi-image collage layout calculations logic
 */

export interface GridItem {
  id: string
  name: string
  width: number
  height: number
  src: string
}

export interface GridLayoutConfig {
  columns: number
  gutter: number // spacing between images in px
  margin: number // outer border margin in px
  cellWidth: number // target pixel width per cell
  cellHeight: number // target pixel height per cell (0 = preserve square/aspect)
  backgroundColor: string
  showCaptions: boolean
  showIndex: boolean
  captionHeight: number
  title?: string
}

export const DEFAULT_GRID_CONFIG: GridLayoutConfig = {
  columns: 3,
  gutter: 16,
  margin: 24,
  cellWidth: 320,
  cellHeight: 320,
  backgroundColor: '#18181b',
  showCaptions: true,
  showIndex: true,
  captionHeight: 28,
  title: 'Hermanos Stash — Contact Sheet'
}

export interface CalculatedGridCell {
  item: GridItem
  index: number
  x: number
  y: number
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  cellW: number
  cellH: number
  captionY: number
}

export interface CalculatedGridLayout {
  totalWidth: number
  totalHeight: number
  cells: CalculatedGridCell[]
}

/**
 * Calculate total canvas bounds and exact placement for each image cell
 */
export function calculateGridLayout(
  items: GridItem[],
  config: GridLayoutConfig
): CalculatedGridLayout {
  if (items.length === 0) {
    return { totalWidth: 0, totalHeight: 0, cells: [] }
  }

  const cols = Math.max(1, config.columns)
  const rows = Math.ceil(items.length / cols)

  const headerHeight = config.title ? 48 : 0
  const cellW = config.cellWidth
  const cellH = config.cellHeight + (config.showCaptions ? config.captionHeight : 0)

  const totalWidth = config.margin * 2 + cols * cellW + (cols - 1) * config.gutter
  const totalHeight = config.margin * 2 + headerHeight + rows * cellH + (rows - 1) * config.gutter

  const cells: CalculatedGridCell[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const colIdx = i % cols
    const rowIdx = Math.floor(i / cols)

    const cellX = config.margin + colIdx * (cellW + config.gutter)
    const cellY = config.margin + headerHeight + rowIdx * (cellH + config.gutter)

    // Calculate aspect ratio fit within cell
    const targetImgH = config.cellHeight
    const imgAspect = item.width > 0 && item.height > 0 ? item.width / item.height : 1
    const cellAspect = cellW / targetImgH

    let imgW: number
    let imgH: number

    if (imgAspect > cellAspect) {
      imgW = cellW
      imgH = Math.round(cellW / imgAspect)
    } else {
      imgH = targetImgH
      imgW = Math.round(targetImgH * imgAspect)
    }

    const imgX = cellX + Math.round((cellW - imgW) / 2)
    const imgY = cellY + Math.round((targetImgH - imgH) / 2)
    const captionY = cellY + targetImgH + 18

    cells.push({
      item,
      index: i + 1,
      x: cellX,
      y: cellY,
      imgX,
      imgY,
      imgW,
      imgH,
      cellW,
      cellH,
      captionY
    })
  }

  return { totalWidth, totalHeight, cells }
}
