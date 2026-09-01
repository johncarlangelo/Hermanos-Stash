import { describe, expect, it } from 'vitest'
import { DEFAULT_TABLE_OPTIONS, generateAsciiTable, parseTableData } from './logic'

describe('ascii-table logic', () => {
  it('parses CSV input into string grid', () => {
    const input = 'Name, Role, Level\nAlice, Lead, 5\nBob, Dev, 3'
    const grid = parseTableData(input)
    expect(grid.length).toBe(3)
    expect(grid[0]).toEqual(['Name', 'Role', 'Level'])
    expect(grid[1]).toEqual(['Alice', 'Lead', '5'])
  })

  it('parses JSON array into string grid', () => {
    const input = JSON.stringify([
      { id: 1, name: 'Prod-A', price: 99 },
      { id: 2, name: 'Prod-B', price: 149 }
    ])
    const grid = parseTableData(input)
    expect(grid.length).toBe(3)
    expect(grid[0]).toEqual(['id', 'name', 'price'])
    expect(grid[1]).toEqual(['1', 'Prod-A', '99'])
  })

  it('generates unicode single box table', () => {
    const grid = [
      ['ID', 'City', 'Temp'],
      ['1', 'Tokyo', '24C'],
      ['2', 'Paris', '19C']
    ]
    const table = generateAsciiTable(grid, DEFAULT_TABLE_OPTIONS)
    expect(table).toContain('┌')
    expect(table).toContain('┬')
    expect(table).toContain('┐')
    expect(table).toContain('Tokyo')
    expect(table).toContain('┘')
  })

  it('generates markdown table', () => {
    const grid = [
      ['Item', 'Qty', 'Price'],
      ['Apples', '10', '1.50']
    ]
    const table = generateAsciiTable(grid, {
      ...DEFAULT_TABLE_OPTIONS,
      style: 'markdown'
    })
    expect(table).toContain('| Item')
    expect(table).toContain('| ------ |')
    expect(table).toContain('| Apples |')
  })

  it('generates sql/ascii-simple table', () => {
    const grid = [
      ['Code', 'Status'],
      ['200', 'OK'],
      ['404', 'Not Found']
    ]
    const table = generateAsciiTable(grid, {
      ...DEFAULT_TABLE_OPTIONS,
      style: 'sql'
    })
    expect(table).toContain('+')
    expect(table).toContain('|')
    expect(table).toContain('200')
  })

  it('prepends row index numbering when enabled', () => {
    const grid = [
      ['Tool', 'Category'],
      ['Compressor', 'Image']
    ]
    const table = generateAsciiTable(grid, {
      ...DEFAULT_TABLE_OPTIONS,
      includeRowIndex: true
    })
    expect(table).toContain('#')
    expect(table).toContain('1')
  })
})
