import { describe, expect, it } from 'vitest'
import {
  type CanvasConfig,
  type Shape,
  createDefaultShape,
  escapeXml,
  generateReactComponent,
  generateSvgString,
  getDoubleArrowPath,
  getHeartPath,
  getPlusPoints,
  getPolygonPoints,
  getRingPath,
  getShieldPath,
  getSpeechBubblePath,
  getStarPoints,
  renderShapeToSvgElement,
  snapCoordinate
} from './logic'

const testConfig: CanvasConfig = {
  width: 512,
  height: 512,
  background: 'transparent',
  showGrid: true,
  snapToGrid: true,
  gridSize: 20
}

describe('SVG Creator Logic', () => {
  it('snaps coordinates correctly when enabled', () => {
    expect(snapCoordinate(44, 20, true)).toBe(40)
    expect(snapCoordinate(53, 20, true)).toBe(60)
    expect(snapCoordinate(53, 20, false)).toBe(53)
  })

  it('creates default shapes with centered coordinates', () => {
    const rect = createDefaultShape('rect', testConfig)
    expect(rect.type).toBe('rect')
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(100)
    expect(rect.x).toBe(200) // 512/2 = 256 - 50 = 206 -> snapped to 200
    expect(rect.y).toBe(200)
  })

  it('calculates star and polygon points accurately', () => {
    const star = getStarPoints(100, 100, 5, 0.4)
    expect(star).toBeTruthy()
    expect(star.split(' ').length).toBe(10)

    const polygon = getPolygonPoints(100, 100, 6)
    expect(polygon).toBeTruthy()
    expect(polygon.split(' ').length).toBe(6)
  })

  it('calculates geometric math paths accurately', () => {
    const heart = getHeartPath(100, 100)
    expect(heart).toContain('M')
    expect(heart).toContain('C')

    const bubble = getSpeechBubblePath(120, 90, 8)
    expect(bubble).toContain('M')
    expect(bubble).toContain('Q')

    const shield = getShieldPath(100, 100)
    expect(shield).toContain('M')
    expect(shield).toContain('Q')

    const plus = getPlusPoints(100, 100, 0.35)
    expect(plus.split(' ').length).toBe(12)

    const ring = getRingPath(100, 100, 0.6)
    expect(ring).toContain('A')

    const doubleArrow = getDoubleArrowPath(140, 24, 2)
    expect(doubleArrow).toContain('M')
    expect(doubleArrow).toContain('L')
  })

  it('escapes XML special characters in text', () => {
    expect(escapeXml('<script>alert("1 & 2")</script>')).toBe(
      '&lt;script&gt;alert(&quot;1 &amp; 2&quot;)&lt;/script&gt;'
    )
  })

  it('renders various shape elements to SVG string', () => {
    const rect = createDefaultShape('rect', testConfig, { cornerRadius: 8, fill: '#ff0000' })
    const renderedRect = renderShapeToSvgElement(rect)
    expect(renderedRect).toContain('<rect')
    expect(renderedRect).toContain('rx="8"')
    expect(renderedRect).toContain('fill="#ff0000"')

    const circle = createDefaultShape('circle', testConfig, { fill: '#00ff00' })
    const renderedCircle = renderShapeToSvgElement(circle)
    expect(renderedCircle).toContain('<circle')
    expect(renderedCircle).toContain('fill="#00ff00"')

    const heart = createDefaultShape('heart', testConfig, { fill: '#ec4899' })
    const renderedHeart = renderShapeToSvgElement(heart)
    expect(renderedHeart).toContain('<path')
    expect(renderedHeart).toContain('fill="#ec4899"')

    const ring = createDefaultShape('ring', testConfig, { fill: '#8b5cf6' })
    const renderedRing = renderShapeToSvgElement(ring)
    expect(renderedRing).toContain('fill-rule="evenodd"')

    const text = createDefaultShape('text', testConfig, { text: 'Hello SVG' })
    const renderedText = renderShapeToSvgElement(text)
    expect(renderedText).toContain('<text')
    expect(renderedText).toContain('Hello SVG')
  })

  it('generates a complete valid SVG document', () => {
    const shapes: Shape[] = [
      createDefaultShape('rect', testConfig, { fill: '#10b981' }),
      createDefaultShape('circle', testConfig, { fill: '#f59e0b' }),
      createDefaultShape('heart', testConfig, { fill: '#ef4444' })
    ]

    const svg = generateSvgString(testConfig, shapes)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 512 512"')
    expect(svg).toContain('<rect')
    expect(svg).toContain('<circle')
    expect(svg).toContain('</svg>')
  })

  it('includes background rect when background is solid', () => {
    const configWithBg: CanvasConfig = { ...testConfig, background: '#0f172a' }
    const svg = generateSvgString(configWithBg, [])
    expect(svg).toContain('<rect width="100%" height="100%" fill="#0f172a"')
  })

  it('generates clean React TSX component', () => {
    const shapes: Shape[] = [createDefaultShape('star', testConfig)]
    const component = generateReactComponent(testConfig, shapes, 'StarIcon')

    expect(component).toContain('export function StarIcon')
    expect(component).toContain('export interface StarIconProps')
    expect(component).toContain('<svg')
    expect(component).toContain('polygon')
  })
})
