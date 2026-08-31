/**
 * SVG & Vector Studio pure logic and utilities.
 * Handles shape data models, SVG code serialization, React component generation,
 * grid snapping, and rasterization.
 */

export type ShapeType =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'star'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'text'
  | 'preset-icon'

export interface Shape {
  id: string
  type: ShapeType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number // degrees (0-360)
  fill: string // hex, rgba, 'none', 'currentColor'
  stroke: string
  strokeWidth: number
  strokeDasharray?: string // e.g. '4 4'
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  opacity: number // 0 to 1
  // Rect-specific
  cornerRadius?: number
  // Star/Polygon specific
  pointsCount?: number
  innerRadiusRatio?: number // for stars (default 0.4)
  // Text specific
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  textAlign?: 'left' | 'center' | 'right'
  // Preset Icon specific (SVG path string)
  iconPath?: string
  viewBoxSize?: number
}

export interface CanvasConfig {
  width: number
  height: number
  background: string // 'transparent', '#ffffff', '#0f172a', etc.
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
}

export const CANVAS_PRESETS: Array<{ id: string; label: string; width: number; height: number }> = [
  { id: 'icon-square', label: 'App Icon / Favicon (512×512)', width: 512, height: 512 },
  { id: 'icon-sm', label: 'Small Icon (256×256)', width: 256, height: 256 },
  { id: 'icon-xs', label: 'Mini Glyph (64×64)', width: 64, height: 64 },
  { id: 'graphic-rect', label: 'Standard Graphic (800×600)', width: 800, height: 600 },
  { id: 'social-banner', label: 'Social Card (1200×630)', width: 1200, height: 630 },
  { id: 'hd-screen', label: 'HD 1080p (1920×1080)', width: 1920, height: 1080 }
]

export const PRESET_ICONS: Array<{ id: string; name: string; path: string }> = [
  {
    id: 'star-filled',
    name: 'Star',
    path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
  },
  {
    id: 'heart-filled',
    name: 'Heart',
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
  },
  {
    id: 'bolt',
    name: 'Lightning',
    path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
  },
  {
    id: 'shield',
    name: 'Shield',
    path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
  },
  {
    id: 'cloud',
    name: 'Cloud',
    path: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z'
  },
  {
    id: 'bell',
    name: 'Bell',
    path: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'
  },
  {
    id: 'check-circle',
    name: 'Check Circle',
    path: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3'
  },
  {
    id: 'sparkles',
    name: 'Sparkles',
    path: 'M12 3v3m0 12v3M3 12h3m12 0h3m-2.636-6.364l-2.121 2.121m-8.486 8.486l-2.121 2.121m12.728 0l-2.121-2.121m-8.486-8.486L4.757 5.636'
  },
  {
    id: 'fire',
    name: 'Flame',
    path: 'M12 2c1.5 3 4 4.5 4 8 0 3.31-2.69 6-6 6s-6-2.69-6-6c0-3.5 2.5-5 4-8 0 2 1 3 2 4 1-1 2-2 2-4z'
  },
  {
    id: 'bookmark',
    name: 'Bookmark',
    path: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z'
  }
]

export const SWATCH_COLORS = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#ffffff', // White
  '#94a3b8', // Slate
  '#1e293b', // Dark Slate
  '#000000', // Black
  'none' // Transparent
]

/**
 * Snaps a coordinate value to the nearest grid step if snapToGrid is enabled.
 */
export function snapCoordinate(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

/**
 * Creates a new shape with sensible defaults placed in the center of the canvas.
 */
export function createDefaultShape(
  type: ShapeType,
  canvasConfig: CanvasConfig,
  customData?: Partial<Shape>
): Shape {
  const id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const cx = canvasConfig.width / 2
  const cy = canvasConfig.height / 2

  const base: Shape = {
    id,
    type,
    name: getShapeDefaultName(type),
    x: snapCoordinate(cx - 50, canvasConfig.gridSize, canvasConfig.snapToGrid),
    y: snapCoordinate(cy - 50, canvasConfig.gridSize, canvasConfig.snapToGrid),
    width: 100,
    height: 100,
    rotation: 0,
    fill: '#f59e0b',
    stroke: '#000000',
    strokeWidth: 0,
    opacity: 1
  }

  let shapeDefaults: Partial<Shape> = {}

  switch (type) {
    case 'rect':
      shapeDefaults = { cornerRadius: 0 }
      break
    case 'circle':
    case 'ellipse':
    case 'triangle':
      shapeDefaults = { width: 100, height: 100 }
      break
    case 'star':
      shapeDefaults = { width: 100, height: 100, pointsCount: 5, innerRadiusRatio: 0.4 }
      break
    case 'polygon':
      shapeDefaults = { width: 100, height: 100, pointsCount: 6 }
      break
    case 'line':
      shapeDefaults = {
        fill: 'none',
        stroke: '#f59e0b',
        strokeWidth: 3,
        height: 0,
        width: 120,
        strokeLinecap: 'round'
      }
      break
    case 'arrow':
      shapeDefaults = {
        fill: '#f59e0b',
        stroke: '#f59e0b',
        strokeWidth: 2,
        width: 120,
        height: 24
      }
      break
    case 'text':
      shapeDefaults = {
        text: 'Text Label',
        fontSize: 28,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 160,
        height: 40,
        fill: '#ffffff'
      }
      break
    case 'preset-icon':
      shapeDefaults = {
        width: 80,
        height: 80,
        fill: '#f59e0b',
        viewBoxSize: 24,
        iconPath: PRESET_ICONS[0].path
      }
      break
  }

  return {
    ...base,
    ...shapeDefaults,
    ...customData
  }
}

export function getShapeDefaultName(type: ShapeType): string {
  switch (type) {
    case 'rect':
      return 'Rectangle'
    case 'circle':
      return 'Circle'
    case 'ellipse':
      return 'Ellipse'
    case 'triangle':
      return 'Triangle'
    case 'star':
      return 'Star'
    case 'polygon':
      return 'Polygon'
    case 'line':
      return 'Line'
    case 'arrow':
      return 'Arrow'
    case 'text':
      return 'Text'
    case 'preset-icon':
      return 'Icon'
    default:
      return 'Shape'
  }
}

/**
 * Calculates SVG polygon points for regular polygons.
 */
export function getPolygonPoints(w: number, h: number, pointsCount = 6): string {
  const points: string[] = []
  const rx = w / 2
  const ry = h / 2
  const cx = rx
  const cy = ry

  for (let i = 0; i < pointsCount; i++) {
    const angle = (i * 2 * Math.PI) / pointsCount - Math.PI / 2
    const x = cx + rx * Math.cos(angle)
    const y = cy + ry * Math.sin(angle)
    points.push(`${roundTo(x, 2)},${roundTo(y, 2)}`)
  }

  return points.join(' ')
}

/**
 * Calculates SVG polygon points for stars.
 */
export function getStarPoints(w: number, h: number, pointsCount = 5, innerRatio = 0.4): string {
  const points: string[] = []
  const rx = w / 2
  const ry = h / 2
  const innerRx = rx * innerRatio
  const innerRy = ry * innerRatio
  const cx = rx
  const cy = ry
  const totalPoints = pointsCount * 2

  for (let i = 0; i < totalPoints; i++) {
    const angle = (i * Math.PI) / pointsCount - Math.PI / 2
    const isOuter = i % 2 === 0
    const curRx = isOuter ? rx : innerRx
    const curRy = isOuter ? ry : innerRy
    const x = cx + curRx * Math.cos(angle)
    const y = cy + curRy * Math.sin(angle)
    points.push(`${roundTo(x, 2)},${roundTo(y, 2)}`)
  }

  return points.join(' ')
}

/**
 * Helper to round numbers to clean decimal places.
 */
export function roundTo(num: number, decimals = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(num * factor) / factor
}

/**
 * Generates an SVG element string for a specific shape.
 */
export function renderShapeToSvgElement(shape: Shape): string {
  const {
    type,
    x,
    y,
    width,
    height,
    rotation,
    fill,
    stroke,
    strokeWidth,
    strokeDasharray,
    strokeLinecap,
    strokeLinejoin,
    opacity,
    cornerRadius,
    pointsCount,
    innerRadiusRatio,
    text,
    fontSize,
    fontFamily,
    fontWeight,
    textAlign,
    iconPath,
    viewBoxSize = 24
  } = shape

  const transform =
    rotation !== 0 ? ` transform="rotate(${rotation} ${x + width / 2} ${y + height / 2})"` : ''
  const opacityAttr = opacity < 1 ? ` opacity="${opacity}"` : ''
  const strokeAttr =
    strokeWidth > 0 && stroke !== 'none'
      ? ` stroke="${stroke}" stroke-width="${strokeWidth}"${
          strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : ''
        }${strokeLinecap ? ` stroke-linecap="${strokeLinecap}"` : ''}${
          strokeLinejoin ? ` stroke-linejoin="${strokeLinejoin}"` : ''
        }`
      : ''
  const fillAttr = `fill="${fill}"`

  switch (type) {
    case 'rect': {
      const rxAttr = cornerRadius && cornerRadius > 0 ? ` rx="${cornerRadius}"` : ''
      return `  <rect x="${x}" y="${y}" width="${width}" height="${height}" ${fillAttr}${strokeAttr}${rxAttr}${transform}${opacityAttr} />`
    }
    case 'circle': {
      const r = Math.min(width, height) / 2
      const cx = x + width / 2
      const cy = y + height / 2
      return `  <circle cx="${cx}" cy="${cy}" r="${r}" ${fillAttr}${strokeAttr}${transform}${opacityAttr} />`
    }
    case 'ellipse': {
      const rx = width / 2
      const ry = height / 2
      const cx = x + rx
      const cy = y + ry
      return `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fillAttr}${strokeAttr}${transform}${opacityAttr} />`
    }
    case 'triangle': {
      const points = `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`
      return `  <polygon points="${points}" ${fillAttr}${strokeAttr}${transform}${opacityAttr} />`
    }
    case 'star': {
      const points = getStarPoints(width, height, pointsCount ?? 5, innerRadiusRatio ?? 0.4)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <polygon points="${points}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'polygon': {
      const points = getPolygonPoints(width, height, pointsCount ?? 6)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <polygon points="${points}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'line': {
      return `  <line x1="${x}" y1="${y}" x2="${x + width}" y2="${y + height}" stroke="${
        stroke !== 'none' ? stroke : fill
      }" stroke-width="${Math.max(1, strokeWidth)}"${
        strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : ''
      }${strokeLinecap ? ` stroke-linecap="${strokeLinecap}"` : ''}${transform}${opacityAttr} />`
    }
    case 'arrow': {
      const shaftWidth = Math.max(2, strokeWidth || 2)
      const headSize = Math.min(24, Math.max(12, height))
      const arrowPath = `M ${x} ${y + height / 2 - shaftWidth / 2} L ${x + width - headSize} ${
        y + height / 2 - shaftWidth / 2
      } L ${x + width - headSize} ${y} L ${x + width} ${y + height / 2} L ${x + width - headSize} ${
        y + height
      } L ${x + width - headSize} ${y + height / 2 + shaftWidth / 2} L ${x} ${
        y + height / 2 + shaftWidth / 2
      } Z`
      return `  <path d="${arrowPath}" ${fillAttr}${strokeAttr}${transform}${opacityAttr} />`
    }
    case 'text': {
      const anchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'
      const textX = textAlign === 'center' ? x + width / 2 : textAlign === 'right' ? x + width : x
      const textY = y + height / 2 + (fontSize || 24) * 0.35
      return `  <text x="${textX}" y="${textY}" font-family="${
        fontFamily || 'sans-serif'
      }" font-size="${fontSize || 24}" font-weight="${
        fontWeight || 'normal'
      }" text-anchor="${anchor}" ${fillAttr}${strokeAttr}${transform}${opacityAttr}>${escapeXml(
        text || ''
      )}</text>`
    }
    case 'preset-icon': {
      const scaleX = width / viewBoxSize
      const scaleY = height / viewBoxSize
      return `  <g transform="translate(${x}, ${y}) scale(${roundTo(scaleX, 4)}, ${roundTo(
        scaleY,
        4
      )})"${transform}${opacityAttr}>\n    <path d="${iconPath || ''}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    default:
      return ''
  }
}

/**
 * Escapes XML special characters for safe SVG text nodes.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generates full, standalone, compliant SVG markup string.
 */
export function generateSvgString(config: CanvasConfig, shapes: Shape[]): string {
  const { width, height, background } = config
  const bgRect =
    background && background !== 'transparent'
      ? `  <rect width="100%" height="100%" fill="${background}" />\n`
      : ''

  const shapeElements = shapes.map(renderShapeToSvgElement).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${bgRect}${shapeElements}
</svg>`
}

/**
 * Converts generated SVG markup into a clean, typed React functional component.
 */
export function generateReactComponent(
  config: CanvasConfig,
  shapes: Shape[],
  componentName = 'VectorIcon'
): string {
  const { width, height } = config
  const svgInner = shapes.map(renderShapeToSvgElement).join('\n')

  return `import React from 'react'

export interface ${componentName}Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

export function ${componentName}({ size = ${width}, ...props }: ${componentName}Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${width} ${height}"
      width={size}
      height={size}
      fill="currentColor"
      {...props}
    >
${svgInner}
    </svg>
  )
}

export default ${componentName}
`
}

/**
 * In-browser rasterization of SVG to PNG / WebP / JPEG Blob at specified scale.
 */
export async function rasterizeSvgToBlob(
  svgString: string,
  width: number,
  height: number,
  scale = 1,
  mimeType = 'image/png',
  quality = 0.95
): Promise<Blob> {
  const scaledWidth = Math.round(width * scale)
  const scaledHeight = Math.round(height * scale)

  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = scaledWidth
      canvas.height = scaledHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get 2D canvas context'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas to Blob conversion failed'))
          }
        },
        mimeType,
        quality
      )
    }

    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load SVG image into canvas for rasterization: ${String(e)}`))
    }

    img.src = url
  })
}
