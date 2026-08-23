import { dump as yamlDump, load as yamlLoad } from 'js-yaml'

export interface ConvertIssue {
  message: string
  line?: number
  column?: number
}

export type ConvertResult = { ok: true; output: string } | { ok: false; error: ConvertIssue }

interface YamlMark {
  line?: number
  column?: number
}

function issueFromYamlError(err: unknown): ConvertIssue {
  if (!(err instanceof Error) || err.name !== 'YAMLException') {
    return { message: err instanceof Error ? err.message : String(err) }
  }

  // js-yaml appends "at line N, column M" to the reason; we surface location
  // as structured fields instead of duplicated text.
  const issue: ConvertIssue = { message: err.message.replace(/\s+at line \d+, column \d+$/, '') }
  const mark = (err as { mark?: YamlMark }).mark
  if (mark && typeof mark.line === 'number') {
    issue.line = mark.line + 1
    if (typeof mark.column === 'number') issue.column = mark.column + 1
  }
  return issue
}

function issueFromJsonError(err: unknown): ConvertIssue {
  const raw = err instanceof Error ? err.message : String(err)
  return { message: raw.replace(/^JSON\.parse:\s*/i, '') }
}

/** YAML → pretty-printed JSON. `json: true` keeps duplicate keys as errors and YAML 1.1 booleans as strings. */
export function yamlToJson(input: string): ConvertResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Nothing to convert — the input is empty.' } }
  }
  try {
    const data = yamlLoad(trimmed, { json: true })
    return { ok: true, output: JSON.stringify(data, null, 2) ?? '' }
  } catch (err) {
    return { ok: false, error: issueFromYamlError(err) }
  }
}

/** JSON → YAML with two-space indentation. */
export function jsonToYaml(input: string): ConvertResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Nothing to convert — the input is empty.' } }
  }
  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch (err) {
    return { ok: false, error: issueFromJsonError(err) }
  }
  try {
    return { ok: true, output: yamlDump(data, { indent: 2 }) }
  } catch (err) {
    return { ok: false, error: issueFromYamlError(err) }
  }
}
