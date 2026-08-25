/**
 * History-view probe: launches the app, clicks the sidebar History row,
 * captures renderer exceptions/console errors and asserts the history
 * content actually rendered (not just the wordmark backdrop).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import WebSocket from 'ws'

const PORT = 9433
let electron = null

const appPath = existsSync('out/main/index.js') ? 'out/main/index.js' : null
if (!appPath) {
  console.error('Build first')
  process.exit(2)
}
const electronExe =
  process.platform === 'win32' ? 'node_modules/electron/dist/electron.exe' : 'node_modules/electron/dist/electron'
electron = spawn(electronExe, [appPath, `--remote-debugging-port=${PORT}`], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(500)
  }
  throw new Error('no page target')
}

const ws = new WebSocket(await getPageTarget())
await new Promise((r) => ws.on('open', r))

let id = 0
const pending = new Map()
const consoleErrors = []
const exceptions = []
ws.on('message', (raw) => {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id)
    pending.delete(msg.id)
    resolve(msg.result)
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  } else if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params.exceptionDetails?.exception?.description ?? 'unknown')
  }
})
function send(method, params = {}) {
  return new Promise((resolve) => {
    const mid = ++id
    pending.set(mid, { resolve })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r?.exceptionDetails) {
    return { __error: r.exceptionDetails?.exception?.description ?? 'eval failed' }
  }
  return r?.result?.value
}
await send('Runtime.enable')

// Wait for the app shell to mount.
let mounted = false
for (let i = 0; i < 30; i++) {
  const ok = await evalJs(`!!document.querySelector('[data-view]') && !!window.stash`)
  if (ok === true) { mounted = true; break }
  await sleep(500)
}
if (!mounted) {
  console.error('FAIL: app never mounted')
  electron.kill(); process.exit(1)
}

// Click the sidebar History row.
const clicked = await evalJs(`
(() => {
  const rows = [...document.querySelectorAll('button')]
  const row = rows.find(b => b.textContent.trim() === 'History')
  if (!row) return false
  row.click()
  return true
})()
`)
await sleep(1200)

const state = await evalJs(`JSON.stringify({
  view: document.querySelector('[data-view]')?.dataset.view,
  hasH1: !!document.querySelector('h1'),
  h1Text: document.querySelector('h1')?.textContent ?? null,
  bodyChildren: document.querySelector('[data-view]')?.children.length ?? 0,
  viewHTMLLength: document.querySelector('[data-view]')?.innerHTML.length ?? 0,
  hasWordmarkOnly: document.querySelector('[data-view]')?.innerHTML.length < 50
})`)

console.log('clicked:', clicked)
console.log('state:', state)
console.log('consoleErrors:', JSON.stringify(consoleErrors))
console.log('exceptions:', JSON.stringify(exceptions.slice(0, 3)))

const parsed = JSON.parse(state)
const pass =
  clicked === true &&
  parsed.view === 'history' &&
  parsed.hasH1 &&
  parsed.h1Text &&
  parsed.viewHTMLLength > 200

console.log(pass ? 'PASS: history view rendered content' : 'FAIL: history view did not render content')

ws.close()
if (electron) {
  try { process.kill(-electron.pid) } catch { electron.kill() }
}
process.exit(pass ? 0 : 1)
