/**
 * cURL command parser and multi-language code generator
 */

export interface ParsedCurl {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  auth: { user?: string; pass?: string } | null
}

export type TargetLanguage =
  | 'javascript-fetch'
  | 'javascript-axios'
  | 'python-requests'
  | 'python-httpx'
  | 'go'
  | 'rust'
  | 'php'
  | 'curl-clean'

/**
 * Tokenize a shell command respecting quotes
 */
export function tokenizeShellCommand(cmd: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  const trimmed = cmd.replace(/\\\r?\n/g, ' ').trim()

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Parse cURL command line string into structured object
 */
export function parseCurlCommand(curlStr: string): ParsedCurl {
  const tokens = tokenizeShellCommand(curlStr)
  let url = ''
  let method = ''
  const headers: Record<string, string> = {}
  let body: string | null = null
  let auth: { user?: string; pass?: string } | null = null

  let i = 0
  if (tokens[0]?.toLowerCase() === 'curl') {
    i = 1
  }

  while (i < tokens.length) {
    const t = tokens[i]

    if (t === '-X' || t === '--request') {
      method = tokens[i + 1]?.toUpperCase() || 'GET'
      i += 2
    } else if (t === '-H' || t === '--header') {
      const headerLine = tokens[i + 1] || ''
      const colonIdx = headerLine.indexOf(':')
      if (colonIdx > 0) {
        const key = headerLine.slice(0, colonIdx).trim()
        const val = headerLine.slice(colonIdx + 1).trim()
        headers[key] = val
      }
      i += 2
    } else if (
      t === '-d' ||
      t === '--data' ||
      t === '--data-raw' ||
      t === '--data-binary' ||
      t === '--data-json'
    ) {
      body = tokens[i + 1] || ''
      if (!method) method = 'POST'
      i += 2
    } else if (t === '-u' || t === '--user') {
      const userPass = tokens[i + 1] || ''
      const parts = userPass.split(':')
      auth = { user: parts[0], pass: parts[1] || '' }
      i += 2
    } else if (t === '--url') {
      url = tokens[i + 1] || ''
      i += 2
    } else if (!t.startsWith('-')) {
      if (!url) {
        url = t.replace(/^['"]|['"]$/g, '')
      }
      i++
    } else {
      // Skip flags like -s, -k, --insecure, etc.
      i++
    }
  }

  if (!method) {
    method = body ? 'POST' : 'GET'
  }

  return { url, method, headers, body, auth }
}

/**
 * Generate code snippet in target language
 */
export function generateCodeFromCurl(parsed: ParsedCurl, lang: TargetLanguage): string {
  const { url, method, headers, body, auth } = parsed
  if (!url) return '// Enter a valid cURL command with a target URL'

  const effectiveHeaders = { ...headers }
  if (auth && auth.user) {
    const encoded = btoa(`${auth.user}:${auth.pass || ''}`)
    effectiveHeaders['Authorization'] = `Basic ${encoded}`
  }

  const isJsonBody =
    body &&
    (effectiveHeaders['Content-Type']?.includes('application/json') ||
      (body.trim().startsWith('{') && body.trim().endsWith('}')))

  switch (lang) {
    case 'javascript-fetch': {
      const options: Record<string, unknown> = { method }
      if (Object.keys(effectiveHeaders).length > 0) {
        options.headers = effectiveHeaders
      }
      if (body && method !== 'GET' && method !== 'HEAD') {
        options.body = isJsonBody ? JSON.stringify(JSON.parse(body), null, 2) : body
      }

      const bodyCode = options.body
        ? isJsonBody
          ? `,\n  body: JSON.stringify(${JSON.stringify(JSON.parse(body), null, 4)})`
          : `,\n  body: ${JSON.stringify(options.body)}`
        : ''

      const headersCode =
        Object.keys(effectiveHeaders).length > 0
          ? `,\n  headers: ${JSON.stringify(effectiveHeaders, null, 4)}`
          : ''

      return `const response = await fetch('${url}', {\n  method: '${method}'${headersCode}${bodyCode}\n});\n\nconst data = await response.json();\nconsole.log(data);`
    }

    case 'javascript-axios': {
      const config: string[] = []
      if (Object.keys(effectiveHeaders).length > 0) {
        config.push(`headers: ${JSON.stringify(effectiveHeaders, null, 4)}`)
      }

      if (body && method !== 'GET') {
        const bodyStr = isJsonBody
          ? JSON.stringify(JSON.parse(body), null, 4)
          : JSON.stringify(body)
        if (config.length > 0) {
          return `import axios from 'axios';\n\nconst { data } = await axios.${method.toLowerCase()}('${url}', ${bodyStr}, {\n  ${config.join(',\n  ')}\n});\n\nconsole.log(data);`
        }
        return `import axios from 'axios';\n\nconst { data } = await axios.${method.toLowerCase()}('${url}', ${bodyStr});\nconsole.log(data);`
      }

      const cfgStr = config.length > 0 ? `, {\n  ${config.join(',\n  ')}\n}` : ''
      return `import axios from 'axios';\n\nconst { data } = await axios.${method.toLowerCase()}('${url}'${cfgStr});\nconsole.log(data);`
    }

    case 'python-requests': {
      let py = `import requests\n\nurl = "${url}"\n`
      if (Object.keys(effectiveHeaders).length > 0) {
        py += `headers = ${JSON.stringify(effectiveHeaders, null, 4)}\n`
      }
      if (body) {
        if (isJsonBody) {
          py += `payload = ${JSON.stringify(JSON.parse(body), null, 4)}\n`
          py += `response = requests.${method.toLowerCase()}(url, json=payload${Object.keys(effectiveHeaders).length > 0 ? ', headers=headers' : ''})\n`
        } else {
          py += `data = ${JSON.stringify(body)}\n`
          py += `response = requests.${method.toLowerCase()}(url, data=data${Object.keys(effectiveHeaders).length > 0 ? ', headers=headers' : ''})\n`
        }
      } else {
        py += `response = requests.${method.toLowerCase()}(url${Object.keys(effectiveHeaders).length > 0 ? ', headers=headers' : ''})\n`
      }
      py += `\nprint(response.status_code)\nprint(response.json())`
      return py
    }

    case 'python-httpx': {
      let py = `import httpx\n\n`
      if (Object.keys(effectiveHeaders).length > 0) {
        py += `headers = ${JSON.stringify(effectiveHeaders, null, 4)}\n`
      }
      if (body && isJsonBody) {
        py += `payload = ${JSON.stringify(JSON.parse(body), null, 4)}\n`
        py += `response = httpx.${method.toLowerCase()}("${url}", json=payload${Object.keys(effectiveHeaders).length > 0 ? ', headers=headers' : ''})\n`
      } else if (body) {
        py += `data = ${JSON.stringify(body)}\n`
        py += `response = httpx.${method.toLowerCase()}("${url}", content=data${Object.keys(effectiveHeaders).length > 0 ? ', headers=headers' : ''})\n`
      } else {
        py += `response = httpx.${method.toLowerCase()}("${url}"${Object.keys(effectiveHeaders).length > 0 ? ', headers=headers' : ''})\n`
      }
      py += `\nprint(response.json())`
      return py
    }

    case 'go': {
      let bodyReader = 'nil'
      let imports = `"fmt"\n\t"io"\n\t"net/http"`
      if (body) {
        imports += `\n\t"strings"`
        bodyReader = `strings.NewReader(${JSON.stringify(body)})`
      }

      let reqHeaders = ''
      for (const [k, v] of Object.entries(effectiveHeaders)) {
        reqHeaders += `\treq.Header.Set("${k}", "${v}")\n`
      }

      return `package main

import (
\t${imports}
)

func main() {
\tclient := &http.Client{}
\treq, err := http.NewRequest("${method}", "${url}", ${bodyReader})
\tif err != nil {
\t\tpanic(err)
\t}
${reqHeaders}
\tresp, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()

\tbodyText, _ := io.ReadAll(resp.Body)
\tfmt.Printf("%s\\n", bodyText)
}`
    }

    case 'rust': {
      let rust = `use reqwest::header::HeaderMap;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n    let client = reqwest::Client::new();\n`
      if (Object.keys(effectiveHeaders).length > 0) {
        rust += `    let mut headers = HeaderMap::new();\n`
        for (const [k, v] of Object.entries(effectiveHeaders)) {
          rust += `    headers.insert("${k}", "${v}".parse()?);\n`
        }
      }

      rust += `\n    let response = client.${method.toLowerCase()}("${url}")\n`
      if (Object.keys(effectiveHeaders).length > 0) {
        rust += `        .headers(headers)\n`
      }
      if (body) {
        rust += `        .body(${JSON.stringify(body)})\n`
      }
      rust += `        .send()\n        .await?;\n\n    println!("{:#?}", response.text().await?);\n    Ok(())\n}`
      return rust
    }

    case 'php': {
      let php = `<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, array(\n`
      php += `  CURLOPT_URL => '${url}',\n`
      php += `  CURLOPT_RETURNTRANSFER => true,\n`
      php += `  CURLOPT_CUSTOMREQUEST => '${method}',\n`

      if (body) {
        php += `  CURLOPT_POSTFIELDS => ${JSON.stringify(body)},\n`
      }

      if (Object.keys(effectiveHeaders).length > 0) {
        const headerArr = Object.entries(effectiveHeaders).map(([k, v]) => `    "${k}: ${v}"`)
        php += `  CURLOPT_HTTPHEADER => array(\n${headerArr.join(',\n')}\n  ),\n`
      }

      php += `));\n\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;\n`
      return php
    }

    case 'curl-clean': {
      let c = `curl -X ${method} "${url}"`
      for (const [k, v] of Object.entries(effectiveHeaders)) {
        c += ` \\\n  -H "${k}: ${v}"`
      }
      if (body) {
        c += ` \\\n  -d '${body}'`
      }
      return c
    }
  }
}
