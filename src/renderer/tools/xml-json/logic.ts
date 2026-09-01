/**
 * XML ⇄ JSON conversion and XML formatter pure logic
 */

export interface XmlJsonOptions {
  attrPrefix: string // e.g. "@" or "_"
  textNodeName: string // e.g. "#text" or "value"
  indent: number // 2 or 4
  compact: boolean // whether to simplify single text nodes
}

export const DEFAULT_XML_JSON_OPTIONS: XmlJsonOptions = {
  attrPrefix: '@',
  textNodeName: '#text',
  indent: 2,
  compact: true
}

/**
 * Format raw XML with proper indentation
 */
export function formatXml(xmlString: string, indentSpaces = 2): string {
  const trimmed = xmlString.trim()
  if (!trimmed) return ''

  let formatted = ''
  let indent = 0
  const pad = ' '.repeat(indentSpaces)

  // Split XML tags and text content
  const tokens = trimmed.replace(/>\s*</g, '><').match(/(<[^>]+>|[^<]+)/g) || []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim()
    if (!token) continue

    if (token.startsWith('</')) {
      // Closing tag
      indent = Math.max(0, indent - 1)
      formatted += pad.repeat(indent) + token + '\n'
    } else if (token.startsWith('<') && token.endsWith('/>')) {
      // Self closing tag
      formatted += pad.repeat(indent) + token + '\n'
    } else if (token.startsWith('<?') || token.startsWith('<!')) {
      // Processing instruction or doctype
      formatted += pad.repeat(indent) + token + '\n'
    } else if (token.startsWith('<')) {
      // Opening tag
      formatted += pad.repeat(indent) + token + '\n'
      indent++
    } else {
      // Text node
      formatted += pad.repeat(indent) + token + '\n'
    }
  }

  return formatted.trim()
}

interface ParsedXmlNode {
  tag: string
  attributes: Record<string, string>
  children: Array<ParsedXmlNode | string>
}

/**
 * Pure lightweight XML tokenizer & parser (zero DOMParser dependency)
 */
export function parseXmlPure(xml: string): ParsedXmlNode {
  const clean = xml
    .replace(/<\?xml[\s\S]*?\?>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
  if (!clean) throw new Error('Empty XML document')

  let pos = 0

  function skipWhitespace() {
    while (pos < clean.length && /\s/.test(clean[pos])) pos++
  }

  function parseAttributes(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {}
    const re = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    let match
    while ((match = re.exec(attrStr)) !== null) {
      attrs[match[1]] = match[2] !== undefined ? match[2] : match[3]
    }
    return attrs
  }

  function parseElement(): ParsedXmlNode {
    skipWhitespace()
    if (clean[pos] !== '<') {
      throw new Error(`Expected '<' at index ${pos}`)
    }

    const closeTagIndex = clean.indexOf('>', pos)
    if (closeTagIndex === -1) throw new Error('Unclosed XML tag')

    const tagContent = clean.slice(pos + 1, closeTagIndex).trim()
    const isSelfClosing = tagContent.endsWith('/')
    const body = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent

    const firstSpace = body.search(/\s/)
    const tagName = firstSpace === -1 ? body : body.slice(0, firstSpace)
    const attrStr = firstSpace === -1 ? '' : body.slice(firstSpace)
    const attributes = parseAttributes(attrStr)

    pos = closeTagIndex + 1
    if (isSelfClosing) {
      return { tag: tagName, attributes, children: [] }
    }

    const children: Array<ParsedXmlNode | string> = []

    while (pos < clean.length) {
      const nextTag = clean.indexOf('<', pos)
      if (nextTag === -1) break

      const text = clean.slice(pos, nextTag).trim()
      if (text) children.push(text)

      pos = nextTag
      if (clean.slice(pos, pos + 2 + tagName.length) === `</${tagName}`) {
        // Closing tag found
        const closingEnd = clean.indexOf('>', pos)
        pos = closingEnd + 1
        return { tag: tagName, attributes, children }
      }

      if (clean.startsWith('</', pos)) {
        // Mismatched tag
        const closingEnd = clean.indexOf('>', pos)
        pos = closingEnd + 1
        continue
      }

      // Child element
      const childElem = parseElement()
      children.push(childElem)
    }

    return { tag: tagName, attributes, children }
  }

  return parseElement()
}

function xmlNodeToJsonObject(node: ParsedXmlNode, options: XmlJsonOptions): unknown {
  const obj: Record<string, unknown> = {}

  // Attributes
  for (const [k, v] of Object.entries(node.attributes)) {
    obj[`${options.attrPrefix}${k}`] = v
  }

  if (node.children.length === 0) {
    return Object.keys(obj).length > 0 ? obj : ''
  }

  if (node.children.length === 1 && typeof node.children[0] === 'string') {
    const textVal = node.children[0]
    if (Object.keys(obj).length === 0 && options.compact) {
      return textVal
    }
    obj[options.textNodeName] = textVal
    return obj
  }

  for (const child of node.children) {
    if (typeof child === 'string') {
      if (child.trim()) {
        obj[options.textNodeName] = child.trim()
      }
    } else {
      const childVal = xmlNodeToJsonObject(child, options)
      if (obj[child.tag] === undefined) {
        obj[child.tag] = childVal
      } else if (Array.isArray(obj[child.tag])) {
        ;(obj[child.tag] as unknown[]).push(childVal)
      } else {
        obj[child.tag] = [obj[child.tag], childVal]
      }
    }
  }

  return obj
}

/**
 * Convert XML String to JSON
 */
export function xmlToJson(
  xmlString: string,
  options: XmlJsonOptions = DEFAULT_XML_JSON_OPTIONS
): string {
  const trimmed = xmlString.trim()
  if (!trimmed) return ''

  const parsed = parseXmlPure(trimmed)
  const result: Record<string, unknown> = {}
  result[parsed.tag] = xmlNodeToJsonObject(parsed, options)

  return JSON.stringify(result, null, options.indent)
}

/**
 * Convert JSON Object to XML element strings
 */
export function objectToXml(
  obj: unknown,
  rootName = 'root',
  options: XmlJsonOptions = DEFAULT_XML_JSON_OPTIONS
): string {
  if (obj === null || obj === undefined) return `<${rootName}/>`

  if (typeof obj !== 'object') {
    return `<${rootName}>${String(obj)}</${rootName}>`
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => objectToXml(item, rootName, options)).join('\n')
  }

  const objRecord = obj as Record<string, unknown>
  const attrs: string[] = []
  const children: string[] = []
  let textValue: string | null = null

  for (const key of Object.keys(objRecord)) {
    const val = objRecord[key]
    if (key.startsWith(options.attrPrefix)) {
      const attrName = key.slice(options.attrPrefix.length)
      attrs.push(`${attrName}="${String(val).replace(/"/g, '&quot;')}"`)
    } else if (key === options.textNodeName) {
      textValue = String(val)
    } else {
      children.push(objectToXml(val, key, options))
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : ''

  if (children.length === 0 && textValue === null) {
    return `<${rootName}${attrStr}/>`
  }

  if (children.length === 0 && textValue !== null) {
    return `<${rootName}${attrStr}>${textValue}</${rootName}>`
  }

  const innerContent = children.join('\n') + (textValue !== null ? `\n${textValue}` : '')
  return `<${rootName}${attrStr}>\n${innerContent}\n</${rootName}>`
}

/**
 * Convert JSON String to XML
 */
export function jsonToXml(
  jsonString: string,
  options: XmlJsonOptions = DEFAULT_XML_JSON_OPTIONS
): string {
  const trimmed = jsonString.trim()
  if (!trimmed) return ''

  const parsed: unknown = JSON.parse(trimmed)
  let xml: string

  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const objRecord = parsed as Record<string, unknown>
    const keys = Object.keys(objRecord)
    if (keys.length === 1) {
      // Use existing single top-level key as root
      xml = objectToXml(objRecord[keys[0]], keys[0], options)
    } else {
      xml = objectToXml(parsed, 'root', options)
    }
  } else {
    xml = objectToXml(parsed, 'root', options)
  }

  return formatXml(xml, options.indent)
}
