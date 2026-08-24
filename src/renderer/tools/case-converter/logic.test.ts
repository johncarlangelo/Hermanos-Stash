import { describe, expect, it } from 'vitest'
import { convertCase, counts, toWords } from './logic'

describe('toWords — boundary detection', () => {
  it('splits camelCase', () => {
    expect(toWords('myVariableName')).toEqual(['my', 'Variable', 'Name'])
  })

  it('splits PascalCase', () => {
    expect(toWords('PascalTriangle')).toEqual(['Pascal', 'Triangle'])
  })

  it('keeps acronym boundaries intact', () => {
    expect(toWords('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request'])
    expect(toWords('parseJSONValue')).toEqual(['parse', 'JSON', 'Value'])
  })

  it('splits snake_case and SCREAMING_SNAKE', () => {
    expect(toWords('snake_case_value')).toEqual(['snake', 'case', 'value'])
    expect(toWords('SCREAMING_SNAKE')).toEqual(['SCREAMING', 'SNAKE'])
  })

  it('splits kebab-case', () => {
    expect(toWords('my-kebab-value')).toEqual(['my', 'kebab', 'value'])
  })

  it('attaches digits to their segment', () => {
    expect(toWords('v2Beta')).toEqual(['v2', 'Beta'])
    expect(toWords('html5Parser')).toEqual(['html5', 'Parser'])
  })

  it('strips punctuation as boundaries', () => {
    expect(toWords('hello, world! (again)')).toEqual(['hello', 'world', 'again'])
  })

  it('returns an empty array for empty or symbol-only input', () => {
    expect(toWords('')).toEqual([])
    expect(toWords('   \t\n ')).toEqual([])
    expect(toWords('!!! --- ???')).toEqual([])
  })
})

describe('convertCase', () => {
  const sample = 'XMLHttpRequest v2'

  it('produces camelCase', () => {
    expect(convertCase(sample, 'camel')).toBe('xmlHttpRequestV2')
  })

  it('produces PascalCase', () => {
    expect(convertCase(sample, 'pascal')).toBe('XmlHttpRequestV2')
  })

  it('produces snake_case', () => {
    expect(convertCase(sample, 'snake')).toBe('xml_http_request_v2')
  })

  it('produces kebab-case', () => {
    expect(convertCase(sample, 'kebab')).toBe('xml-http-request-v2')
  })

  it('produces CONSTANT_CASE', () => {
    expect(convertCase(sample, 'constant')).toBe('XML_HTTP_REQUEST_V2')
  })

  it('produces Title Case and Sentence case', () => {
    expect(convertCase('hello WORLD again', 'title')).toBe('Hello World Again')
    expect(convertCase('HELLO WORLD', 'sentence')).toBe('Hello world')
  })

  it('upper and lower pass through the raw text', () => {
    expect(convertCase('aB_cD', 'upper')).toBe('AB_CD')
    expect(convertCase('aB_cD', 'lower')).toBe('ab_cd')
  })

  it('maps empty input to empty output for every kind', () => {
    for (const kind of [
      'camel',
      'pascal',
      'snake',
      'kebab',
      'constant',
      'title',
      'sentence'
    ] as const) {
      expect(convertCase('', kind)).toBe('')
    }
  })
})

describe('counts', () => {
  it('counts words, chars, whitespace-free chars and lines', () => {
    const result = counts('one two\nthree')
    expect(result.words).toBe(3)
    expect(result.chars).toBe(13)
    expect(result.noWhitespaceChars).toBe(11)
    expect(result.lines).toBe(2)
  })

  it('counts sentences by terminators', () => {
    expect(counts('First one. Second one! Third?').sentences).toBe(3)
    expect(counts('no terminator here').sentences).toBe(1)
  })

  it('computes reading time at 200 wpm', () => {
    const fourHundredWords = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ')
    expect(counts(fourHundredWords).readingTimeMin).toBe(2)
  })

  it('handles empty input honestly', () => {
    expect(counts('')).toEqual({
      words: 0,
      chars: 0,
      noWhitespaceChars: 0,
      lines: 0,
      sentences: 0,
      readingTimeMin: 0
    })
  })
})
