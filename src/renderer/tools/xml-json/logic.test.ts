import { describe, expect, it } from 'vitest'
import { DEFAULT_XML_JSON_OPTIONS, formatXml, jsonToXml, xmlToJson } from './logic'

describe('xml-json logic', () => {
  it('formats raw xml strings with indentation', () => {
    const raw = '<root><user id="1"><name>Alice</name></user></root>'
    const formatted = formatXml(raw, 2)
    expect(formatted).toContain('<user id="1">')
    expect(formatted).toContain('  <name>')
  })

  it('converts basic XML to JSON', () => {
    const xml = '<person name="John"><age>30</age><city>New York</city></person>'
    const jsonStr = xmlToJson(xml, DEFAULT_XML_JSON_OPTIONS)
    const parsed = JSON.parse(jsonStr)
    expect(parsed.person['@name']).toBe('John')
    expect(parsed.person.age).toBe('30')
    expect(parsed.person.city).toBe('New York')
  })

  it('converts XML with repeated child nodes into array in JSON', () => {
    const xml = '<books><item>Book 1</item><item>Book 2</item></books>'
    const jsonStr = xmlToJson(xml, DEFAULT_XML_JSON_OPTIONS)
    const parsed = JSON.parse(jsonStr)
    expect(Array.isArray(parsed.books.item)).toBe(true)
    expect(parsed.books.item.length).toBe(2)
  })

  it('converts JSON to formatted XML', () => {
    const json = JSON.stringify({
      config: {
        '@version': '1.0',
        title: 'App Config',
        port: 8080
      }
    })
    const xml = jsonToXml(json, DEFAULT_XML_JSON_OPTIONS)
    expect(xml).toContain('<config version="1.0">')
    expect(xml).toContain('App Config')
    expect(xml).toContain('8080')
    expect(xml).toContain('</config>')
  })
})
