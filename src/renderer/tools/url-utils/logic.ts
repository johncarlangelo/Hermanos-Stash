/**
 * Pure URL parsing/encoding helpers. Missing protocols get `https://` prepended
 * so users can type "example.com/path" directly; malformed input becomes a
 * typed error instead of an exception.
 */

export interface QueryParam {
  key: string
  value: string
}

export interface UrlParts {
  href: string
  protocol: string
  host: string
  hostname: string
  /** Present only when non-default (URL.port is '' for default ports). */
  port?: string
  pathname: string
  search: string
  hash: string
  origin: string
  searchParams: QueryParam[]
}

export type ParseUrlResult = { ok: true; parts: UrlParts } | { ok: false; error: string }

export type ComponentResult = { ok: true; output: string } | { ok: false; error: string }

export function parseUrlComponents(input: string): ParseUrlResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Enter a URL to inspect.' }

  let candidate = trimmed
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: `"${trimmed}" is not a valid URL.` }
  }

  return {
    ok: true,
    parts: {
      href: url.href,
      protocol: url.protocol,
      host: url.host,
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      origin: url.origin,
      searchParams: [...url.searchParams.entries()].map(([key, value]) => ({ key, value }))
    }
  }
}

export function encodeComponent(input: string): ComponentResult {
  try {
    return { ok: true, output: encodeURIComponent(input) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function decodeComponent(input: string): ComponentResult {
  try {
    return { ok: true, output: decodeURIComponent(input) }
  } catch {
    return {
      ok: false,
      error: 'That is not valid percent-encoding — check for stray "%" characters.'
    }
  }
}

/** Parse a query string with or without its leading "?". */
export function parseQuery(input: string): QueryParam[] {
  const raw = input.trim().replace(/^\?/, '')
  if (!raw) return []
  return [...new URLSearchParams(raw).entries()].map(([key, value]) => ({ key, value }))
}
