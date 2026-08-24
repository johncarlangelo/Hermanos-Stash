/**
 * Pure JSON → TypeScript type generator. No React, no DOM — fully testable.
 *
 * Strategy: walk the parsed value depth-first, claiming one unique PascalCase
 * identifier per object shape (and per merged array-member shape), emitting
 * declarations parent-first. Scalars stay inline; arrays of objects merge
 * their members into an all-keys superset shape.
 */

import { positionToLineColumn } from '../json-format/logic'

export interface JsonIssue {
  message: string
  line?: number
  column?: number
}

export type GenerateResult =
  { ok: true; output: string; interfaceCount: number } | { ok: false; error: JsonIssue }

export type ExportStyle = 'interface' | 'type'

export interface GenerateTypesOptions {
  /** Name for the root declaration. Defaults to 'Root'. */
  rootName?: string
  /** `interface Foo {}` vs `type Foo = {}`. Defaults to 'interface'. */
  exportStyle?: ExportStyle
  /** Keys missing in SOME array siblings become optional (`?`). */
  optionalFields?: boolean
}

const RESERVED_WORDS = new Set([
  'any',
  'as',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'return',
  'satisfies',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield'
])

/** Strip anything that cannot appear in a TypeScript identifier. */
export function sanitizeTypeName(raw: string): string {
  let name = raw.replace(/[^A-Za-z0-9_$]/g, '')
  if (!name) return '_'
  if (/^[0-9]/.test(name)) name = `_${name}`
  if (RESERVED_WORDS.has(name)) name = `${name}_`
  return name
}

function pascalCase(raw: string): string {
  const parts = raw.split(/[^A-Za-z0-9_$]+/).filter(Boolean)
  if (parts.length === 0) return '_'
  return sanitizeTypeName(parts.map((part) => part[0].toUpperCase() + part.slice(1)).join(''))
}

interface EmitContext {
  style: ExportStyle
  optionalFields: boolean
  usedNames: Set<string>
  declarations: string[]
}

/** Claim a unique PascalCase identifier, suffixing numerically on collision. */
function claimName(base: string, ctx: EmitContext): string {
  const stem = pascalCase(base)
  let candidate = stem
  let suffix = 2
  while (ctx.usedNames.has(candidate)) candidate = `${stem}${suffix++}`
  ctx.usedNames.add(candidate)
  return candidate
}

function propKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

function renderDeclaration(name: string, props: string[], ctx: EmitContext): string {
  const body = props.map((prop) => `  ${prop}`).join('\n')
  return ctx.style === 'interface'
    ? `export interface ${name} {\n${body}\n}`
    : `export type ${name} = {\n${body}\n}`
}

function inferScalar(value: unknown): string | null {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return null
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inferValue(value: unknown, nameHint: string, ctx: EmitContext): string {
  const scalar = inferScalar(value)
  if (scalar !== null) return scalar
  if (Array.isArray(value)) return inferArray(value, nameHint, ctx)
  return inferObject(isPlainObject(value) ? value : {}, nameHint, ctx)
}

function inferObject(source: Record<string, unknown>, nameHint: string, ctx: EmitContext): string {
  const keys = Object.keys(source)
  if (keys.length === 0) return 'Record<string, never>'
  const name = claimName(nameHint, ctx)
  const insertAt = ctx.declarations.length
  const props: string[] = []
  for (const key of keys) {
    const expr = inferValue(source[key], `${name}${pascalCase(key)}`, ctx)
    props.push(`${propKey(key)}: ${expr}`)
  }
  // Children were appended during recursion; slot the parent in front of them.
  ctx.declarations.splice(insertAt, 0, renderDeclaration(name, props, ctx))
  return name
}

/**
 * Merge sibling object members into one all-keys superset shape. A key is
 * optional only when `optionalFields` is on AND some siblings lack it.
 */
function mergedShape(members: Record<string, unknown>[], name: string, ctx: EmitContext): string {
  const keys: string[] = []
  for (const member of members) {
    for (const key of Object.keys(member)) {
      if (!keys.includes(key)) keys.push(key)
    }
  }
  const insertAt = ctx.declarations.length
  const props: string[] = []
  for (const key of keys) {
    const holders = members.filter((member) => key in member)
    const optional = ctx.optionalFields && holders.length < members.length
    const expr = mergeExpressions(
      holders.map((member) => member[key]),
      `${name}${pascalCase(key)}`,
      ctx
    )
    props.push(`${propKey(key)}${optional ? '?' : ''}: ${expr}`)
  }
  ctx.declarations.splice(insertAt, 0, renderDeclaration(name, props, ctx))
  return name
}

function mergeExpressions(values: unknown[], nameHint: string, ctx: EmitContext): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const value of values) {
    const expr = inferValue(value, nameHint, ctx)
    if (!seen.has(expr)) {
      seen.add(expr)
      parts.push(expr)
    }
  }
  return parts.join(' | ')
}

function inferArray(items: unknown[], nameHint: string, ctx: EmitContext): string {
  if (items.length === 0) return 'unknown[]'
  if (items.every(isPlainObject)) {
    const itemName = claimName(`${nameHint}Item`, ctx)
    return `${mergedShape(items, itemName, ctx)}[]`
  }
  // Uniform short string arrays collapse into a literal union.
  if (items.every((item) => typeof item === 'string')) {
    const distinct = [...new Set(items as string[])]
    if (distinct.length <= 5) return distinct.map((value) => JSON.stringify(value)).join(' | ')
    return 'string[]'
  }
  const seen = new Set<string>()
  const parts: string[] = []
  for (const item of items) {
    const expr = inferValue(item, nameHint, ctx)
    if (!seen.has(expr)) {
      seen.add(expr)
      parts.push(expr)
    }
  }
  return parts.length === 1 ? `${parts[0]}[]` : `(${parts.join(' | ')})[]`
}

function issueFromParseError(err: unknown, input: string): JsonIssue {
  const raw = err instanceof Error ? err.message : String(err)
  const issue: JsonIssue = { message: raw.replace(/^JSON\.parse:\s*/i, '') }
  const positionMatch = /position (\d+)/i.exec(raw)
  if (positionMatch) {
    const { line, column } = positionToLineColumn(input, Number(positionMatch[1]))
    issue.line = line
    issue.column = column
    return issue
  }
  const hintMatch = /\(line (\d+) column (\d+)\)/i.exec(raw)
  if (hintMatch) {
    issue.line = Number(hintMatch[1])
    issue.column = Number(hintMatch[2])
  }
  return issue
}

/** Infer TypeScript declarations from a JSON document. */
export function generateTypes(input: string, options: GenerateTypesOptions = {}): GenerateResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Nothing to convert — the input is empty.' } }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    return { ok: false, error: issueFromParseError(err, trimmed) }
  }

  const ctx: EmitContext = {
    style: options.exportStyle ?? 'interface',
    optionalFields: options.optionalFields ?? false,
    usedNames: new Set(),
    declarations: []
  }
  // pascalCase here keeps the alias name identical to what claimName will
  // produce for the root shape, so no stray duplicate alias is emitted.
  const rootBase = pascalCase(options.rootName?.trim() || 'Root')

  // A root array of objects becomes one merged item shape plus an alias.
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPlainObject)) {
    const itemName = claimName(`${rootBase}Item`, ctx)
    const shapeRef = mergedShape(parsed, itemName, ctx)
    ctx.declarations.push(`export type ${rootBase} = ${shapeRef}[]`)
    return {
      ok: true,
      output: ctx.declarations.join('\n\n'),
      interfaceCount: ctx.declarations.length - 1
    }
  }

  const scalar = inferScalar(parsed)
  if (scalar !== null) {
    return {
      ok: true,
      output: `export type ${rootBase} = ${scalar}`,
      interfaceCount: 0
    }
  }

  const expr = inferValue(parsed, rootBase, ctx)
  // Scalar containers (empty object/array) yield an inline alias instead of
  // a declared interface.
  if (expr !== rootBase) {
    ctx.declarations.push(`export type ${rootBase} = ${expr}`)
    return { ok: true, output: ctx.declarations.join('\n\n'), interfaceCount: 0 }
  }
  return {
    ok: true,
    output: ctx.declarations.join('\n\n'),
    interfaceCount: ctx.declarations.length
  }
}
