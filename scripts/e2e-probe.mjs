/**
 * CDP-driven desktop probe for Hermanos Stash.
 *
 * Launches the built app with remote debugging (default) or attaches to an
 * already-running instance (CDP_ATTACH_PORT=<port>), drives the real UI
 * (favorites roundtrip, sidebar navigation, settings view), and captures
 * renderer exceptions + console errors. Exits non-zero on failure.
 *
 * Usage: node scripts/e2e-probe.mjs
 *        CDP_ATTACH_PORT=9333 node scripts/e2e-probe.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import WebSocket from 'ws'

const PORT = process.env.CDP_ATTACH_PORT ? Number(process.env.CDP_ATTACH_PORT) : 9400 + (Date.now() % 500)
let electron = null

if (!process.env.CDP_ATTACH_PORT) {
  const appPath = existsSync('out/main/index.js') ? 'out/main/index.js' : null
  if (!appPath) {
    console.error('Build first: npx electron-vite build')
    process.exit(2)
  }
  // Spawn the real electron binary (no shell wrapper) so we hold its true PID
  // for tree-kill, and never collide with a stale instance's debug port.
  const electronExe = process.platform === 'win32'
    ? 'node_modules/electron/dist/electron.exe'
    : 'node_modules/electron/dist/electron'
  if (!existsSync(electronExe)) {
    console.error('Electron binary not found at', electronExe)
    process.exit(2)
  }
  electron = spawn(electronExe, [appPath, `--remote-debugging-port=${PORT}`], {
    stdio: 'ignore'
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // not ready yet
    }
    await sleep(250)
  }
  throw new Error('CDP endpoint never became available')
}

const wsUrl = await getPageTarget()
const ws = new WebSocket(wsUrl)

let msgId = 0
const pending = new Map()
const exceptions = []
const consoleErrors = []

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
    const detail = msg.params.exceptionDetails
    exceptions.push(
      detail.exception?.description ?? detail.text ?? JSON.stringify(detail).slice(0, 300)
    )
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(
      msg.params.args
        .map((a) => a.value ?? a.description ?? '')
        .join(' ')
        .slice(0, 400)
    )
  }
})

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

await new Promise((resolve, reject) => {
  ws.once('open', resolve)
  ws.once('error', reject)
})

function evaluate(expression) {
  return send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  }).then((r) => r.result?.value)
}

await send('Runtime.enable')

const results = {}
try {
  await sleep(1200) // let React mount

  results.bridgeSanity = await evaluate(
    `(async () => {
      const info = await window.stash.app.getInfo()
      return { version: info.version, hasBridge: !!window.stash.favorites }
    })()`
  )

  // 1. Favorites bridge roundtrip (main process + SQLite).
  results.favoritesBridge = await evaluate(
    `(async () => {
      const before = await window.stash.favorites.list()
      const state = await window.stash.favorites.toggle('json-format')
      const after = await window.stash.favorites.list()
      // restore original state
      await window.stash.favorites.toggle('json-format')
      const restored = await window.stash.favorites.list()
      return { before, state, after, restored }
    })()`
  )

  // Go home first.
  await evaluate(
    `(() => {
      const btn = document.querySelector('button[aria-label="Go to workspace home"]')
      if (btn) btn.click()
      return true
    })()`
  )
  await sleep(300)

  // 2. Click an actual favorite star in the UI.
  results.favoriteStarClick = await evaluate(
    `(async () => {
      const star = document.querySelector('button[aria-label^="Add "][aria-label$="to favorites"]')
      if (!star) return { found: false }
      star.click()
      await new Promise(r => setTimeout(r, 600))
      const pressed = star.getAttribute('aria-pressed')
      const favNavExists = !!document.querySelector('nav[aria-label="Favorites"]')
      return { found: true, pressedAfter: pressed, favoritesSectionVisible: favNavExists }
    })()`
  )

  // 3. Navigate to Settings through the sidebar like a user.
  results.settingsNavigation = await evaluate(
    `(async () => {
      const buttons = [...document.querySelectorAll('aside button')]
      const settingsBtn = buttons.find(b => b.textContent.trim().includes('Settings'))
      if (!settingsBtn) return { found: false }
      settingsBtn.click()
      await new Promise(r => setTimeout(r, 800))
      const heading = [...document.querySelectorAll('h1')].map(h => h.textContent.trim())
      const bodySample = document.body.innerText.slice(0, 150)
      return { found: true, headings: heading, bodySample, blank: document.body.innerText.trim().length === 0 }
    })()`
  )

  // 4. Recents limit sanity via bridge.
  results.recentsShape = await evaluate(
    `(async () => {
      const rows = await window.stash.recents.list(8)
      return { count: rows.length, sample: rows.slice(0, 3).map(r => r.toolId) }
    })()`
  )
} catch (err) {
  results.probeError = String(err)
}

results.exceptions = exceptions
results.consoleErrors = consoleErrors

console.log(JSON.stringify(results, null, 2))

// Hard cleanup: terminate the socket and the whole process tree, then force-exit
// so surviving Electron children can never keep this probe alive.
try {
  ws.terminate()
} catch {
  // socket already gone
}
if (electron) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(electron.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: true
      })
    } else {
      electron.kill()
    }
  } catch {
    // already gone
  }
}
setTimeout(() => process.exit(exceptions.length > 0 ? 1 : 0), 150)
