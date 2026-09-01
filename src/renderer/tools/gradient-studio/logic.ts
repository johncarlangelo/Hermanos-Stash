/**
 * CSS and Vector SVG Gradient calculations and code generator
 */

export interface ColorStop {
  id: string
  color: string
  position: number // 0 to 100%
  opacity: number // 0 to 1
}

export type GradientType = 'linear' | 'radial' | 'conic' | 'mesh'

export interface GradientConfig {
  type: GradientType
  angle: number // 0 to 360 degrees for linear & conic
  radialShape: 'circle' | 'ellipse'
  radialPosition: 'center' | 'top' | 'bottom' | 'top left' | 'top right'
  stops: ColorStop[]
}

export const PRESET_GRADIENTS: { name: string; config: GradientConfig }[] = [
  {
    name: 'Sunset Horizon',
    config: {
      type: 'linear',
      angle: 135,
      radialShape: 'circle',
      radialPosition: 'center',
      stops: [
        { id: '1', color: '#f59e0b', position: 0, opacity: 1 },
        { id: '2', color: '#ec4899', position: 50, opacity: 1 },
        { id: '3', color: '#8b5cf6', position: 100, opacity: 1 }
      ]
    }
  },
  {
    name: 'Cyberpunk Neon',
    config: {
      type: 'linear',
      angle: 90,
      radialShape: 'circle',
      radialPosition: 'center',
      stops: [
        { id: '1', color: '#06b6d4', position: 0, opacity: 1 },
        { id: '2', color: '#3b82f6', position: 50, opacity: 1 },
        { id: '3', color: '#d946ef', position: 100, opacity: 1 }
      ]
    }
  },
  {
    name: 'Emerald Matrix',
    config: {
      type: 'linear',
      angle: 180,
      radialShape: 'circle',
      radialPosition: 'center',
      stops: [
        { id: '1', color: '#10b981', position: 0, opacity: 1 },
        { id: '2', color: '#064e3b', position: 100, opacity: 1 }
      ]
    }
  },
  {
    name: 'Cosmic Radial',
    config: {
      type: 'radial',
      angle: 0,
      radialShape: 'circle',
      radialPosition: 'center',
      stops: [
        { id: '1', color: '#a855f7', position: 0, opacity: 1 },
        { id: '2', color: '#3b82f6', position: 60, opacity: 1 },
        { id: '3', color: '#09090b', position: 100, opacity: 1 }
      ]
    }
  },
  {
    name: 'Conic Spectrum',
    config: {
      type: 'conic',
      angle: 0,
      radialShape: 'circle',
      radialPosition: 'center',
      stops: [
        { id: '1', color: '#ef4444', position: 0, opacity: 1 },
        { id: '2', color: '#f59e0b', position: 25, opacity: 1 },
        { id: '3', color: '#10b981', position: 50, opacity: 1 },
        { id: '4', color: '#3b82f6', position: 75, opacity: 1 },
        { id: '5', color: '#ef4444', position: 100, opacity: 1 }
      ]
    }
  }
]

export const DEFAULT_GRADIENT: GradientConfig = PRESET_GRADIENTS[0].config

/**
 * Format hex + opacity into CSS rgba string
 */
export function colorToCssRgba(hex: string, opacity: number): string {
  if (opacity === 1) return hex
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 0
  const b = parseInt(clean.substring(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Generate CSS background gradient string
 */
export function generateCssGradient(config: GradientConfig): string {
  const sortedStops = [...config.stops].sort((a, b) => a.position - b.position)
  const stopStr = sortedStops
    .map((s) => `${colorToCssRgba(s.color, s.opacity)} ${s.position}%`)
    .join(', ')

  if (config.type === 'linear') {
    return `linear-gradient(${config.angle}deg, ${stopStr})`
  }

  if (config.type === 'radial') {
    return `radial-gradient(${config.radialShape} at ${config.radialPosition}, ${stopStr})`
  }

  if (config.type === 'conic') {
    return `conic-gradient(from ${config.angle}deg, ${stopStr})`
  }

  // Mesh gradient simulated via multiple layered radial gradients
  return `radial-gradient(circle at 20% 20%, ${colorToCssRgba(sortedStops[0]?.color || '#f59e0b', 0.8)} 0%, transparent 50%),
radial-gradient(circle at 80% 30%, ${colorToCssRgba(sortedStops[1]?.color || '#ec4899', 0.8)} 0%, transparent 50%),
radial-gradient(circle at 50% 80%, ${colorToCssRgba(sortedStops[2]?.color || '#8b5cf6', 0.8)} 0%, transparent 50%),
#09090b`
}

/**
 * Generate SVG <defs> vector gradient markup
 */
export function generateSvgGradient(config: GradientConfig, id = 'customGradient'): string {
  const sortedStops = [...config.stops].sort((a, b) => a.position - b.position)
  const stopElements = sortedStops
    .map(
      (s) =>
        `    <stop offset="${s.position}%" stop-color="${s.color}" stop-opacity="${s.opacity}" />`
    )
    .join('\n')

  if (config.type === 'linear') {
    const angleRad = (config.angle * Math.PI) / 180
    const x1 = Math.round(50 - Math.cos(angleRad) * 50)
    const y1 = Math.round(50 - Math.sin(angleRad) * 50)
    const x2 = Math.round(50 + Math.cos(angleRad) * 50)
    const y2 = Math.round(50 + Math.sin(angleRad) * 50)

    return `<svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
${stopElements}
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#${id})" />
</svg>`
  }

  return `<svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
${stopElements}
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#${id})" />
</svg>`
}
