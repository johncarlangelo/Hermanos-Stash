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
  | 'heart'
  | 'speech-bubble'
  | 'shield'
  | 'ring'
  | 'plus'
  | 'line'
  | 'arrow'
  | 'double-arrow'
  | 'freehand'
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
  // Rect / Speech bubble specific
  cornerRadius?: number
  // Star/Polygon specific
  pointsCount?: number
  innerRadiusRatio?: number // for stars (default 0.4) and rings
  thicknessRatio?: number // for plus/cross (default 0.35)
  // Freehand / Custom path specific
  pathData?: string
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

export interface PresetIconItem {
  id: string
  name: string
  category: 'ui' | 'media' | 'dev' | 'shapes' | 'nature'
  path: string
}

export const PRESET_ICONS: PresetIconItem[] = [
  // UI & General
  {
    id: 'star-filled',
    name: 'Star',
    category: 'shapes',
    path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
  },
  {
    id: 'heart-filled',
    name: 'Heart',
    category: 'shapes',
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
  },
  {
    id: 'bolt',
    name: 'Lightning',
    category: 'nature',
    path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
  },
  {
    id: 'shield',
    name: 'Shield',
    category: 'ui',
    path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
  },
  {
    id: 'cloud',
    name: 'Cloud',
    category: 'nature',
    path: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z'
  },
  {
    id: 'bell',
    name: 'Bell',
    category: 'ui',
    path: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'
  },
  {
    id: 'check-circle',
    name: 'Check Circle',
    category: 'ui',
    path: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3'
  },
  {
    id: 'sparkles',
    name: 'Sparkles',
    category: 'shapes',
    path: 'M12 3v3m0 12v3M3 12h3m12 0h3m-2.636-6.364l-2.121 2.121m-8.486 8.486l-2.121 2.121m12.728 0l-2.121-2.121m-8.486-8.486L4.757 5.636'
  },
  {
    id: 'fire',
    name: 'Flame',
    category: 'nature',
    path: 'M12 2c1.5 3 4 4.5 4 8 0 3.31-2.69 6-6 6s-6-2.69-6-6c0-3.5 2.5-5 4-8 0 2 1 3 2 4 1-1 2-2 2-4z'
  },
  {
    id: 'bookmark',
    name: 'Bookmark',
    category: 'ui',
    path: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z'
  },
  {
    id: 'lock',
    name: 'Lock',
    category: 'ui',
    path: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'
  },
  {
    id: 'settings',
    name: 'Settings Gear',
    category: 'ui',
    path: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'
  },
  {
    id: 'search',
    name: 'Search',
    category: 'ui',
    path: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'
  },
  {
    id: 'home',
    name: 'Home',
    category: 'ui',
    path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'
  },
  {
    id: 'user',
    name: 'User',
    category: 'ui',
    path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
  },
  {
    id: 'folder',
    name: 'Folder',
    category: 'ui',
    path: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'
  },
  {
    id: 'camera',
    name: 'Camera',
    category: 'media',
    path: 'M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0-8c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm8-3h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z'
  },
  {
    id: 'music',
    name: 'Music Note',
    category: 'media',
    path: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'
  },
  {
    id: 'video',
    name: 'Video Clip',
    category: 'media',
    path: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z'
  },
  {
    id: 'code',
    name: 'Code Tags',
    category: 'dev',
    path: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'
  },
  {
    id: 'terminal',
    name: 'Terminal CLI',
    category: 'dev',
    path: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-12-3l3.5-3.5L8 8l1.4-1.4L14.3 11.5 9.4 16.4 8 15zm7 0h4v2h-4v-2z'
  },
  {
    id: 'database',
    name: 'Database',
    category: 'dev',
    path: 'M12 2C6.48 2 2 4.02 2 6.5s4.48 4.5 10 4.5 10-2.02 10-4.5S17.52 2 12 2zm0 6.5c-4.42 0-8-1.57-8-2.5s3.58-2.5 8-2.5 8 1.57 8 2.5-3.58 2.5-8 2.5zM4 9v4c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5V9c-1.63 1.54-4.8 2.5-8 2.5s-6.37-.96-8-2.5zm0 6v4c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5v-4c-1.63 1.54-4.8 2.5-8 2.5s-6.37-.96-8-2.5z'
  },
  {
    id: 'cpu',
    name: 'Microchip CPU',
    category: 'dev',
    path: 'M6 2v2H4c-1.1 0-2 .9-2 2v2h2v2H2v2h2v2H2v2h2v2c0 1.1.9 2 2 2h2v-2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h-2v-2h2v-2h-2v-2h2V8h-2V6c0-1.1-.9-2-2-2h-2V2h-2v2h-2V2h-2v2H8V2H6zm2 4h8v8H8V6z'
  },
  {
    id: 'globe',
    name: 'Globe Earth',
    category: 'nature',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'
  },
  {
    id: 'sun',
    name: 'Sun / Brightness',
    category: 'nature',
    path: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z'
  },
  {
    id: 'moon',
    name: 'Moon / Dark Mode',
    category: 'nature',
    path: 'M12.3 2a10 10 0 00-1.9 19.8 10 10 0 0011.6-11.6A10 10 0 0112.3 2z'
  },
  {
    id: 'rocket',
    name: 'Rocket Launch',
    category: 'shapes',
    path: 'M13.13 2.05c-3.1.28-5.83 2.02-7.31 4.67l-2.09-.42c-.52-.1-.99.27-.99.8v3.29c0 .4.24.77.61.92l2.36.95c.24 1.13.75 2.18 1.47 3.06l-3.32 3.32c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l3.32-3.32c.88.72 1.93 1.23 3.06 1.47l.95 2.36c.16.37.52.61.92.61h3.29c.53 0 .9-.47.8-.99l-.42-2.09c2.65-1.48 4.39-4.21 4.67-7.31.3-3.23-1.04-6.3-3.53-8.22-1.25-.97-2.71-1.52-4.2-1.52zM12 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z'
  },
  {
    id: 'coffee',
    name: 'Coffee Mug',
    category: 'ui',
    path: 'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM2 21h18v-2H2v2z'
  },
  {
    id: 'tag',
    name: 'Badge Tag',
    category: 'ui',
    path: 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z'
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
 * Calculates SVG path for a cubic Bézier heart.
 */
export function getHeartPath(w: number, h: number): string {
  return `M ${roundTo(w / 2, 2)} ${roundTo(h * 0.85, 2)} C ${roundTo(w * 0.05, 2)} ${roundTo(
    h * 0.55,
    2
  )}, 0 ${roundTo(h * 0.25, 2)}, ${roundTo(w * 0.25, 2)} ${roundTo(h * 0.08, 2)} C ${roundTo(
    w * 0.42,
    2
  )} ${roundTo(h * 0.08, 2)}, ${roundTo(w / 2, 2)} ${roundTo(h * 0.28, 2)}, ${roundTo(
    w / 2,
    2
  )} ${roundTo(h * 0.28, 2)} C ${roundTo(w / 2, 2)} ${roundTo(h * 0.28, 2)}, ${roundTo(
    w * 0.58,
    2
  )} ${roundTo(h * 0.08, 2)}, ${roundTo(w * 0.75, 2)} ${roundTo(h * 0.08, 2)} C ${roundTo(
    w,
    2
  )} ${roundTo(h * 0.25, 2)}, ${roundTo(w * 0.95, 2)} ${roundTo(h * 0.55, 2)}, ${roundTo(
    w / 2,
    2
  )} ${roundTo(h * 0.85, 2)} Z`
}

/**
 * Calculates SVG path for a speech bubble / callout with a tail.
 */
export function getSpeechBubblePath(w: number, h: number, r = 8): string {
  const bodyH = Math.max(10, h * 0.76)
  const tailW = Math.min(w * 0.25, 24)
  const tailX = Math.min(w * 0.25, 20)
  const safeR = Math.min(r, bodyH / 2, w / 4)
  return `M ${safeR} 0 L ${w - safeR} 0 Q ${w} 0 ${w} ${safeR} L ${w} ${bodyH - safeR} Q ${w} ${bodyH} ${
    w - safeR
  } ${bodyH} L ${tailX + tailW} ${bodyH} L ${tailX} ${h} L ${tailX + tailW * 0.4} ${bodyH} L ${safeR} ${bodyH} Q 0 ${bodyH} 0 ${
    bodyH - safeR
  } L 0 ${safeR} Q 0 0 ${safeR} 0 Z`
}

/**
 * Calculates SVG path for a heraldic security shield.
 */
export function getShieldPath(w: number, h: number): string {
  return `M 0 ${roundTo(h * 0.08, 2)} Q ${roundTo(w / 2, 2)} 0 ${w} ${roundTo(
    h * 0.08,
    2
  )} L ${w} ${roundTo(h * 0.52, 2)} C ${w} ${roundTo(h * 0.85, 2)}, ${roundTo(
    w / 2,
    2
  )} ${h}, ${roundTo(w / 2, 2)} ${h} C ${roundTo(w / 2, 2)} ${h}, 0 ${roundTo(
    h * 0.85,
    2
  )}, 0 ${roundTo(h * 0.52, 2)} Z`
}

/**
 * Calculates SVG polygon points for a plus / cross.
 */
export function getPlusPoints(w: number, h: number, thicknessRatio = 0.35): string {
  const tX = (w * (1 - thicknessRatio)) / 2
  const tY = (h * (1 - thicknessRatio)) / 2
  const rX = w - tX
  const bY = h - tY
  return `${roundTo(tX, 2)},0 ${roundTo(rX, 2)},0 ${roundTo(rX, 2)},${roundTo(tY, 2)} ${roundTo(
    w,
    2
  )},${roundTo(tY, 2)} ${roundTo(w, 2)},${roundTo(bY, 2)} ${roundTo(rX, 2)},${roundTo(
    bY,
    2
  )} ${roundTo(rX, 2)},${roundTo(h, 2)} ${roundTo(tX, 2)},${roundTo(h, 2)} ${roundTo(
    tX,
    2
  )},${roundTo(bY, 2)} 0,${roundTo(bY, 2)} 0,${roundTo(tY, 2)} ${roundTo(tX, 2)},${roundTo(tY, 2)}`
}

/**
 * Calculates SVG path for a hollow ring / donut.
 */
export function getRingPath(w: number, h: number, innerRatio = 0.6): string {
  const rx = w / 2
  const ry = h / 2
  const irx = rx * innerRatio
  const iry = ry * innerRatio
  return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${rx} ${roundTo(
    ry - iry,
    2
  )} A ${roundTo(irx, 2)} ${roundTo(iry, 2)} 0 1 1 ${rx} ${roundTo(ry + iry, 2)} A ${roundTo(
    irx,
    2
  )} ${roundTo(iry, 2)} 0 1 1 ${rx} ${roundTo(ry - iry, 2)} Z`
}

/**
 * Calculates SVG path for a double-headed arrow.
 */
export function getDoubleArrowPath(w: number, h: number, strokeWidth = 2): string {
  const shaftW = Math.max(2, strokeWidth)
  const head = Math.min(24, Math.max(12, Math.min(w * 0.3, h)))
  return `M ${head} 0 L 0 ${h / 2} L ${head} ${h} L ${head} ${h / 2 + shaftW / 2} L ${
    w - head
  } ${h / 2 + shaftW / 2} L ${w - head} ${h} L ${w} ${h / 2} L ${w - head} 0 L ${
    w - head
  } ${h / 2 - shaftW / 2} L ${head} ${h / 2 - shaftW / 2} Z`
}

/**
 * Helper to round numbers to clean decimal places.
 */
export function roundTo(num: number, decimals = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(num * factor) / factor
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
    case 'heart':
    case 'shield':
      shapeDefaults = { width: 100, height: 100 }
      break
    case 'speech-bubble':
      shapeDefaults = { width: 120, height: 90, cornerRadius: 8 }
      break
    case 'ring':
      shapeDefaults = { width: 100, height: 100, innerRadiusRatio: 0.6 }
      break
    case 'plus':
      shapeDefaults = { width: 100, height: 100, thicknessRatio: 0.35 }
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
    case 'double-arrow':
      shapeDefaults = {
        fill: '#f59e0b',
        stroke: '#f59e0b',
        strokeWidth: 2,
        width: 140,
        height: 24
      }
      break
    case 'freehand':
      shapeDefaults = {
        fill: 'none',
        stroke: '#f59e0b',
        strokeWidth: 4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        pathData: 'M 10 10 Q 30 50 60 20 T 100 80'
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
    case 'heart':
      return 'Heart'
    case 'speech-bubble':
      return 'Callout'
    case 'shield':
      return 'Shield'
    case 'ring':
      return 'Ring Donut'
    case 'plus':
      return 'Cross Plus'
    case 'line':
      return 'Line'
    case 'arrow':
      return 'Arrow'
    case 'double-arrow':
      return 'Double Arrow'
    case 'freehand':
      return 'Brush Path'
    case 'text':
      return 'Text'
    case 'preset-icon':
      return 'Icon'
    default:
      return 'Shape'
  }
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
    thicknessRatio,
    pathData,
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
    case 'heart': {
      const path = getHeartPath(width, height)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <path d="${path}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'speech-bubble': {
      const path = getSpeechBubblePath(width, height, cornerRadius ?? 8)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <path d="${path}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'shield': {
      const path = getShieldPath(width, height)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <path d="${path}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'ring': {
      const path = getRingPath(width, height, innerRadiusRatio ?? 0.6)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <path d="${path}" fill-rule="evenodd" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'plus': {
      const points = getPlusPoints(width, height, thicknessRatio ?? 0.35)
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
    case 'double-arrow': {
      const arrowPath = getDoubleArrowPath(width, height, strokeWidth || 2)
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <path d="${arrowPath}" ${fillAttr}${strokeAttr} />\n  </g>`
    }
    case 'freehand': {
      return `  <g transform="translate(${x}, ${y})"${transform}${opacityAttr}>\n    <path d="${
        pathData || ''
      }" ${fillAttr}${strokeAttr} />\n  </g>`
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
