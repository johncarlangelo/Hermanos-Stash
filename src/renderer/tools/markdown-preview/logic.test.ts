import { describe, expect, it, vi } from 'vitest'

// DOMPurify needs a real window to parse HTML; in the Node test environment we
// stub it with a minimal allowlist-style sanitizer so the render pipeline can
// still be verified end-to-end.
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) =>
      html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
  }
}))

import { countWordsAndChars, markdownToHtml, renderMarkdown } from './logic'

describe('markdownToHtml', () => {
  it('converts ATX headings at several levels', () => {
    const html = markdownToHtml('# Title\n\n## Sub')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<h2>Sub</h2>')
  })

  it('converts bold and italic emphasis', () => {
    const html = markdownToHtml('This is **bold** and *italic*.')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('converts unordered and ordered lists', () => {
    const html = markdownToHtml('- one\n- two\n\n1. first\n2. second')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>second</li>')
  })

  it('converts fenced code blocks', () => {
    const html = markdownToHtml('```js\nconst x = 1\n```')
    expect(html).toMatch(/<pre><code[^>]*>const x = 1/)
  })

  it('renders inline code spans', () => {
    expect(markdownToHtml('use `npm run` here')).toContain('<code>npm run</code>')
  })

  it('returns an empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('')
  })
})

describe('renderMarkdown — sanitization pipeline', () => {
  it('strips script tags from rendered output', () => {
    const html = renderMarkdown('# Hi\n\n<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).toContain('Hi')
  })

  it('keeps legitimate formatting after sanitization', () => {
    const html = renderMarkdown('**bold** text')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })
})

describe('countWordsAndChars', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWordsAndChars('one two\tthree\nfour')).toEqual({ words: 4, chars: 18 })
  })

  it('reports zero words for whitespace-only input without crashing', () => {
    expect(countWordsAndChars('   \n ')).toEqual({ words: 0, chars: 5 })
  })

  it('counts zero for the boundary empty string', () => {
    expect(countWordsAndChars('')).toEqual({ words: 0, chars: 0 })
  })
})
