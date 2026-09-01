import { describe, expect, it } from 'vitest'
import { calculateGridLayout, DEFAULT_GRID_CONFIG, type GridItem } from './logic'

describe('image-grid logic', () => {
  it('handles empty items list', () => {
    const layout = calculateGridLayout([], DEFAULT_GRID_CONFIG)
    expect(layout.totalWidth).toBe(0)
    expect(layout.cells.length).toBe(0)
  })

  it('calculates 3-column layout positions', () => {
    const items: GridItem[] = [
      { id: '1', name: 'img1.png', width: 800, height: 600, src: 'data:1' },
      { id: '2', name: 'img2.png', width: 800, height: 800, src: 'data:2' },
      { id: '3', name: 'img3.png', width: 600, height: 800, src: 'data:3' }
    ]

    const layout = calculateGridLayout(items, {
      ...DEFAULT_GRID_CONFIG,
      columns: 3,
      cellWidth: 300,
      cellHeight: 300,
      gutter: 10,
      margin: 20
    })

    expect(layout.cells.length).toBe(3)
    expect(layout.cells[0].x).toBe(20)
    expect(layout.cells[1].x).toBe(20 + 300 + 10)
    expect(layout.cells[2].x).toBe(20 + 2 * (300 + 10))
  })
})
