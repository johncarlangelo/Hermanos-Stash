/** Isolated, bounded real-renderer workflow wire regression. Build latest first.
 * node scripts/e2e-workflow-compatibility.mjs
 * Only DOM events are used: no React state access or direct validator calls.
 */
/* global AbortSignal */
import { Buffer } from 'node:buffer'
import { clearTimeout } from 'node:timers'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import WebSocket from 'ws'

const root = resolve(import.meta.dirname, '..')
const evidence = join(root, '.hermes', `workflow-compatibility-${Date.now()}`)
mkdirSync(evidence, { recursive: true })
const userData = join(evidence, 'user-data')
mkdirSync(userData)
const appPath = join(root, 'out/main/index.js')
const sourcePaths = [
  'src/shared/utils/tool-domains.ts',
  'src/renderer/features/workflow/execution.ts',
  'src/renderer/features/workflow/version.ts'
]
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const results = {
  started: new Date().toISOString(),
  evidence,
  userData,
  cases: [],
  exceptions: [],
  consoleErrors: [],
  sourceHashes: Object.fromEntries(sourcePaths.map((p) => [p, hash(join(root, p))]))
}
let child, ws, watchdog
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pending = new Map()
let msgId = 0
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout: ${method}`))
    }, 7000)
    pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer)
        resolve(r)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      }
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value
}
async function waitFor(expression, label) {
  for (let i = 0; i < 50; i++) {
    if (await evaluate(expression)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}
function assert(value, message) {
  if (!value) throw new Error(message)
}
async function snapshot(name) {
  const body = await evaluate('document.body.innerText')
  writeFileSync(join(evidence, `${name}.txt`), body)
  const png = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(evidence, `${name}.png`), Buffer.from(png.data, 'base64'))
}
const card = (name) =>
  `[...document.querySelectorAll('[data-dropzone="workflow-node"]')].find(n => n.querySelector('h4')?.textContent === ${JSON.stringify(name)})`
async function pointer(name, port, type) {
  return evaluate(
    `(() => { const n = ${card(name)}; if (!n) throw new Error('Missing node'); const el = ${port ? `n.querySelector('[data-port="${port}"]')` : 'n'}; if (!el) throw new Error('Missing port'); const r = el.getBoundingClientRect(); const x = r.x+r.width/2, y = r.y+r.height/2; el.dispatchEvent(new PointerEvent('${type}', { bubbles:true, cancelable:true, pointerId:1, pointerType:'mouse', button:0, buttons:${type === 'pointerup' ? 0 : 1}, clientX:x, clientY:y })); return {x,y}; })()`
  )
}
async function state() {
  return evaluate(
    `({ toolbar: document.querySelector('[data-toolbar="workflow-toolbar"]').innerText, edges: [...document.querySelectorAll('svg path > title')].filter(t=>t.textContent.startsWith('Connection cable')).length, icon: (${card('Icon Pack Generator')}).innerText, toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(n=>n.innerText) })`
  )
}
function cleanup() {
  ws?.terminate()
  if (child?.pid && child.exitCode === null) {
    if (process.platform === 'win32') {
      const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true
      })
      results.cleanup = {
        pid: child.pid,
        exitCode: killed.status,
        output: killed.stdout?.trim(),
        error: killed.stderr?.trim()
      }
    } else {
      child.kill('SIGKILL')
      results.cleanup = { pid: child.pid, signal: 'SIGKILL' }
    }
  }
}
try {
  const html = readFileSync(join(root, 'out/renderer/index.html'), 'utf8')
  const entry = html.match(/src="([^"]+\.js)"/)?.[1]
  assert(entry, 'Built renderer entry missing')
  const renderer = join(root, 'out/renderer', entry.replace(/^\//, ''))
  results.build = {
    appPath,
    renderer,
    rendererHash: hash(renderer),
    modified: statSync(renderer).mtime.toISOString()
  }
  assert(
    sourcePaths.every((p) => statSync(renderer).mtimeMs >= statSync(join(root, p)).mtimeMs),
    'Build older than validator sources; build latest first'
  )
  const server = createServer()
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  await new Promise((r) => server.close(r))
  results.port = port
  // Set userData before importing the main entry, including before singleton lock.
  const bootstrap = join(evidence, 'isolated-main.cjs')
  writeFileSync(
    bootstrap,
    `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(userData)}); require(${JSON.stringify(appPath)});\n`
  )
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  child = spawn(
    join(
      root,
      'node_modules/electron/dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron'
    ),
    [bootstrap, `--user-data-dir=${userData}`, `--remote-debugging-port=${port}`],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  )
  results.pid = child.pid
  let appLog = ''
  child.stdout.on('data', (d) => {
    appLog += d
  })
  child.stderr.on('data', (d) => {
    appLog += d
  })
  child.on('error', (e) => {
    appLog += String(e)
  })
  watchdog = setTimeout(() => {
    results.error = 'Probe exceeded 90 seconds'
    cleanup()
    writeFileSync(join(evidence, 'results.json'), JSON.stringify(results, null, 2))
    process.exit(2)
  }, 90000)
  let target
  for (let i = 0; i < 60; i++) {
    try {
      target = (
        await (
          await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
        ).json()
      ).find((t) => t.type === 'page' && t.url.startsWith('file:'))
      if (target) break
    } catch {
      /* Endpoint not ready yet. */
    }
    if (child.exitCode !== null) throw new Error(`Electron exited: ${child.exitCode}; ${appLog}`)
    await sleep(200)
  }
  assert(target, `No isolated renderer target: ${appLog}`)
  results.target = target.url
  ws = new WebSocket(target.webSocketDebuggerUrl)
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    if (pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) p.reject(new Error(m.error.message))
      else p.resolve(m.result)
    }
    if (m.method === 'Runtime.exceptionThrown') results.exceptions.push(m.params.exceptionDetails)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      results.consoleErrors.push(m.params.args.map((a) => a.value || a.description).join(' '))
  })
  await new Promise((r, j) => {
    ws.once('open', r)
    ws.once('error', j)
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await waitFor(
    '!!window.stash && document.querySelectorAll("aside button").length > 0',
    'app mount'
  )
  results.appInfo = await evaluate('window.stash.app.getInfo()')
  assert(
    resolve(results.appInfo.dataFolder).toLowerCase() === resolve(userData).toLowerCase(),
    'User-data isolation failed'
  )
  await evaluate(
    `(() => { const b=[...document.querySelectorAll('aside button')].find(n => n.textContent.trim().startsWith('Queue') || n.getAttribute('title') === 'Queue'); if (!b) throw new Error('Queue button not found'); b.click(); })()`
  )
  await waitFor('!!document.querySelector(\'[data-dropzone="workflow-canvas"]\')', 'canvas')
  await snapshot('00-empty')
  for (const [toolId, x, y] of [
    ['extract-audio', 180, 220],
    ['image-compress', 180, 450],
    ['icon-pack', 650, 320]
  ]) {
    await evaluate(
      `(() => { const c=document.querySelector('[data-dropzone="workflow-canvas"]'); const r=c.getBoundingClientRect(); const dataTransfer=new DataTransfer(); dataTransfer.setData('text/stash-tool-id', '${toolId}'); c.dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer,clientX:r.x+${x},clientY:r.y+${y}})); })()`
    )
    await sleep(180)
  }
  await waitFor(
    'document.querySelectorAll(\'[data-dropzone="workflow-node"]\').length === 3',
    'three dropped nodes'
  )
  await snapshot('01-nodes')
  for (const targetKind of ['port']) {
    for (const [source, accepted] of [
      ['Audio Extractor', false],
      ['Image Compressor', true]
    ]) {
      const label = `${targetKind}-${accepted ? 'accepted' : 'rejected'}`
      const before = await state()
      assert(before.edges === 0, 'Each case must start with zero edges')
      const start = await pointer(source, 'out-files', 'pointerdown')
      await sleep(150)
      const preview = await evaluate(
        `({text:(${card('Icon Pack Generator')}).innerText, reasons:[...(${card('Icon Pack Generator')}).querySelectorAll('[title]')].map(n=>n.title)})`
      )
      assert(
        accepted
          ? /\bCOMPATIBLE\b/.test(preview.text) && !preview.text.includes('INCOMPATIBLE')
          : preview.text.includes('INCOMPATIBLE'),
        `Incorrect wire preview: ${label}`
      )
      await snapshot(`${label}-preview`)
      const end = await pointer(
        'Icon Pack Generator',
        targetKind === 'port' ? 'in-files' : null,
        'pointerup'
      )
      await sleep(180)
      const after = await state()
      const record = {
        label,
        source,
        target: 'Icon Pack Generator',
        interaction: 'DOM PointerEvent on live canvas nodes',
        start,
        end,
        before,
        preview,
        after
      }
      results.cases.push(record)
      assert(after.edges === (accepted ? 1 : 0), `Wrong edge count: ${label}`)
      assert(
        after.icon.includes('Input: Linked from upstream') === accepted,
        `Wrong target input state: ${label}`
      )
      if (!accepted)
        assert(
          after.toasts.some((t) => /audio/i.test(t) && /image/i.test(t)),
          'No semantic rejection toast'
        )
      record.passed = true
      await snapshot(`${label}-result`)
      if (accepted) {
        await evaluate(
          `(() => { const t=[...document.querySelectorAll('svg path > title')].find(t=>t.textContent.startsWith('Connection cable')); t.parentElement.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); })()`
        )
        await sleep(150)
        assert((await state()).edges === 0, 'Disconnect failed')
      }
    }
  }
  results.sourcesUnchanged = sourcePaths.every(
    (p) => hash(join(root, p)) === results.sourceHashes[p]
  )
  assert(results.sourcesUnchanged, 'Validator source changed during probe')
  assert(results.exceptions.length === 0, 'Renderer exceptions detected')
  results.passed = true
  writeFileSync(join(evidence, 'electron.log'), appLog)
} catch (e) {
  results.passed = false
  results.error = e.stack || String(e)
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      await snapshot('failure')
    } catch {
      /* Preserve original failure. */
    }
  }
} finally {
  clearTimeout(watchdog)
  cleanup()
  rmSync(join(evidence, 'isolated-main.cjs'), { force: true })
  results.finished = new Date().toISOString()
  writeFileSync(join(evidence, 'results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}
process.exit(results.passed ? 0 : 1)
