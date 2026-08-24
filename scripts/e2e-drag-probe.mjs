/**
 * E2E drag-and-drop probe: synthesizes a real OS-backed file drop onto the
 * File Metadata Viewer's DropZone via CDP and verifies the tool receives the
 * absolute path (regression test for Electron >= 32 removing File.path).
 *
 * Usage: node scripts/e2e-drag-probe.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'

const PORT = 9500 + (Date.now() % 400)
const appPath = 'out/main/index.js'
if (!existsSync(appPath)) {
  console.error('Build first: npx electron-vite build')
  process.exit(2)
}

const fixtureDir = mkdtempSync(path.join(tmpdir(), 'stash-drag-'))
const fixturePath = path.join(fixtureDir, 'drag-sample.txt')
writeFileSync(fixturePath, 'drag and drop regression fixture\n')

const electronExe =
  process.platform === 'win32'
    ? 'node_modules/electron/dist/electron.exe'
    : 'node_modules/electron/dist/electron'
const electron = spawn(electronExe, [appPath, `--remote-debugging-port=${PORT}`], {
  stdio: 'ignore'
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // not ready
    }
    await sleep(250)
  }
  throw new Error('CDP endpoint never became available')
}

const ws = new WebSocket(await getPageTarget())
let msgId = 0
const pending = new Map()
const exceptions = []

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
  else resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    exceptions.push(d.exception?.description ?? d.text ?? 'exception')
  }
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

await new Promise((resolve, reject) => {
  ws.once('open', resolve)
  ws.once('error', reject)
})
await send('Runtime.enable')

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result
    ?.value

await sleep(1200)

const result = { fixturePath }

// Open File Metadata Viewer from the home cards.
result.navStep = await evaluate(
  `(async () => {
    const btns = [...document.querySelectorAll('button[aria-label^="Open "]')]
    const meta = btns.find(b => b.getAttribute('aria-label').includes('File Metadata'))
    if (!meta) return { found: false, available: btns.slice(0, 5).map(b => b.getAttribute('aria-label')) }
    meta.click()
    await new Promise(r => setTimeout(r, 900))
    return { found: true, heading: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()) }
  })()`
)
await sleep(600)

result.zoomAndRect = await evaluate(
  `(() => {
    const zone = document.querySelector('[role="button"][aria-label*="Drop files here"]')
    if (!zone) return null
    const r = zone.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, zoom: window.devicePixelRatio }
  })()`
)

if (result.zoomAndRect) {
  // CDP input coordinates are DIPs: multiply CSS px by page zoom.
  const cx = Math.round(result.zoomAndRect.x * result.zoomAndRect.zoom)
  const cy = Math.round(result.zoomAndRect.y * result.zoomAndRect.zoom)
  const data = { items: [], files: [fixturePath], dragOperationsMask: 1 }

  await send('Input.dispatchDragEvent', { type: 'dragEnter', x: cx, y: cy, data })
  await send('Input.dispatchDragEvent', { type: 'dragOver', x: cx, y: cy, data })
  await send('Input.dispatchDragEvent', { type: 'drop', x: cx, y: cy, data })
  await sleep(1200)

  result.afterDrop = await evaluate(
    `(() => {
      const bodyText = document.body.innerText
      return {
        listsFixture: bodyText.includes('drag-sample.txt'),
        invalidMessage: bodyText.includes("isn't supported"),
        emptyStill: bodyText.includes('Drop files here')
      }
    })()`
  )
} else {
  result.afterDrop = { error: 'DropZone not found' }
}

result.exceptions = exceptions
console.log(JSON.stringify(result, null, 2))

try {
  ws.terminate()
} catch {
  // socket gone
}
spawn('taskkill', ['/PID', String(electron.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
setTimeout(
  () => process.exit(result.afterDrop?.listsFixture && exceptions.length === 0 ? 0 : 1),
  150
)
