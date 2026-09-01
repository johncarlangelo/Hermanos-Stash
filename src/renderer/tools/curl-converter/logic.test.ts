import { describe, expect, it } from 'vitest'
import { generateCodeFromCurl, parseCurlCommand, tokenizeShellCommand } from './logic'

describe('curl-converter logic', () => {
  it('tokenizes shell commands respecting quotes and flags', () => {
    const cmd = 'curl -X POST "https://api.example.com/v1" -H \'Content-Type: application/json\''
    const tokens = tokenizeShellCommand(cmd)
    expect(tokens).toEqual([
      'curl',
      '-X',
      'POST',
      'https://api.example.com/v1',
      '-H',
      'Content-Type: application/json'
    ])
  })

  it('parses basic GET cURL', () => {
    const cmd = 'curl https://api.github.com/users/octocat -H "User-Agent: App"'
    const parsed = parseCurlCommand(cmd)
    expect(parsed.url).toBe('https://api.github.com/users/octocat')
    expect(parsed.method).toBe('GET')
    expect(parsed.headers['User-Agent']).toBe('App')
  })

  it('parses POST request with JSON payload', () => {
    const cmd = `curl -X POST https://httpbin.org/post -H "Content-Type: application/json" -d '{"hello": "world"}'`
    const parsed = parseCurlCommand(cmd)
    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('https://httpbin.org/post')
    expect(parsed.body).toBe('{"hello": "world"}')
  })

  it('generates JavaScript Fetch code', () => {
    const parsed = parseCurlCommand('curl -X GET https://example.com/api')
    const code = generateCodeFromCurl(parsed, 'javascript-fetch')
    expect(code).toContain("fetch('https://example.com/api'")
    expect(code).toContain("method: 'GET'")
  })

  it('generates Python Requests code', () => {
    const parsed = parseCurlCommand('curl -X POST https://example.com/login -d "user=admin"')
    const code = generateCodeFromCurl(parsed, 'python-requests')
    expect(code).toContain('import requests')
    expect(code).toContain('requests.post')
  })

  it('generates Go net/http code', () => {
    const parsed = parseCurlCommand('curl https://example.com')
    const code = generateCodeFromCurl(parsed, 'go')
    expect(code).toContain('package main')
    expect(code).toContain('http.NewRequest')
  })
})
