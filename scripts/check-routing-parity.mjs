/**
 * Hermano Tool Routing Parity & Regression Verifier
 *
 * Verifies 100% parity across:
 * 1. Tool Catalog Registry (src/renderer/tools/index.ts)
 * 2. Decision Routing Specification (TOOL_ROUTING.md)
 * 3. Offline Vector Embeddings (src/shared/assets/tool-embeddings.json)
 * 4. Ambiguity Clusters (src/main/services/semantic-router.ts)
 *
 * Fails loudly in CI or pre-commit if any tool is added, renamed, or modified
 * without updating routing triggers and precomputed neural embeddings.
 *
 * Usage:
 *   node scripts/check-routing-parity.mjs
 *   node scripts/check-routing-parity.mjs --json
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const REGISTRY_FILE = path.join(rootDir, 'src', 'renderer', 'tools', 'index.ts')
const ROUTING_FILE = path.join(rootDir, 'TOOL_ROUTING.md')
const EMBEDDINGS_FILE = path.join(rootDir, 'src', 'shared', 'assets', 'tool-embeddings.json')
const ROUTER_FILE = path.join(rootDir, 'src', 'main', 'services', 'semantic-router.ts')

const isJsonOutput = process.argv.includes('--json')

function loadRegisteredTools() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    throw new Error(`Registry file not found at: ${REGISTRY_FILE}`)
  }
  const content = fs.readFileSync(REGISTRY_FILE, 'utf8')
  // Match tool definitions: id: 'tool-name'
  const matches = [...content.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
  const unique = Array.from(new Set(matches))
  return unique
}

function loadRoutingDocTools() {
  if (!fs.existsSync(ROUTING_FILE)) {
    throw new Error(`Routing document not found at: ${ROUTING_FILE}`)
  }
  const content = fs.readFileSync(ROUTING_FILE, 'utf8')
  const toolRegex = new RegExp(
    '#### `([a-z0-9-]+)` — ([^\\r\\n]+)\\r?\\n- \\*\\*Core Intent:\\*\\* ([^\\r\\n]+)\\r?\\n- \\*\\*User Triggers:\\*\\* ([^\\r\\n]+)',
    'g'
  )
  const map = new Map()
  let match
  while ((match = toolRegex.exec(content)) !== null) {
    const id = match[1]
    const name = match[2].trim()
    const intent = match[3].trim()
    const triggersRaw = match[4].trim()
    const triggers = triggersRaw
      .replace(/"/g, '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    map.set(id, { name, intent, triggers })
  }
  return map
}

function loadEmbeddings() {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    throw new Error(`Tool embeddings file not found at: ${EMBEDDINGS_FILE}`)
  }
  const data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf8'))
  return data
}

function loadClusterToolIds() {
  if (!fs.existsSync(ROUTER_FILE)) {
    throw new Error(`Semantic router file not found at: ${ROUTER_FILE}`)
  }
  const content = fs.readFileSync(ROUTER_FILE, 'utf8')
  // Extract tools: ['pdf-compress', 'image-compress', ...]
  const clusterToolsMatches = [...content.matchAll(/tools:\s*\[([^\]]+)\]/g)]
  const clusterToolIds = new Set()
  for (const m of clusterToolsMatches) {
    const ids = m[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean)
    for (const id of ids) clusterToolIds.add(id)
  }
  return Array.from(clusterToolIds)
}

function runParityCheck() {
  const registeredIds = loadRegisteredTools()
  const registeredSet = new Set(registeredIds)

  const routingMap = loadRoutingDocTools()
  const routingSet = new Set(routingMap.keys())

  const embeddings = loadEmbeddings()
  const embeddingSet = new Set(Object.keys(embeddings))

  const clusterToolIds = loadClusterToolIds()

  const missingFromRouting = registeredIds.filter((id) => !routingSet.has(id))
  const missingFromEmbeddings = registeredIds.filter((id) => !embeddingSet.has(id))
  const orphanRouting = Array.from(routingSet).filter((id) => !registeredSet.has(id))
  const orphanEmbeddings = Array.from(embeddingSet).filter((id) => !registeredSet.has(id))
  const invalidClusterTools = clusterToolIds.filter((id) => !registeredSet.has(id))

  const malformedRouting = []
  for (const [id, entry] of routingMap.entries()) {
    if (!entry.intent || entry.intent.length < 5) {
      malformedRouting.push(`${id}: Core Intent is too brief or empty`)
    }
    if (!entry.triggers || entry.triggers.length < 2) {
      malformedRouting.push(`${id}: User Triggers must have at least 2 examples (has ${entry.triggers?.length || 0})`)
    }
  }

  const malformedEmbeddings = []
  for (const [id, entry] of Object.entries(embeddings)) {
    if (!Array.isArray(entry.vector) || entry.vector.length !== 384) {
      malformedEmbeddings.push(`${id}: Vector dimension is ${entry.vector?.length || 0}, expected 384`)
      continue
    }
    // Check vector normalization (sum of squares ~ 1.0)
    let sumSq = 0
    for (const val of entry.vector) {
      sumSq += val * val
    }
    if (Math.abs(sumSq - 1.0) > 0.05) {
      malformedEmbeddings.push(`${id}: Vector is not normalized (norm=${Math.sqrt(sumSq).toFixed(4)})`)
    }
  }

  const passed =
    missingFromRouting.length === 0 &&
    missingFromEmbeddings.length === 0 &&
    orphanRouting.length === 0 &&
    orphanEmbeddings.length === 0 &&
    invalidClusterTools.length === 0 &&
    malformedRouting.length === 0 &&
    malformedEmbeddings.length === 0

  const report = {
    passed,
    totalRegistered: registeredIds.length,
    totalDocumented: routingMap.size,
    totalEmbedded: Object.keys(embeddings).length,
    missingFromRouting,
    missingFromEmbeddings,
    orphanRouting,
    orphanEmbeddings,
    invalidClusterTools,
    malformedRouting,
    malformedEmbeddings
  }

  if (isJsonOutput) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(passed ? 0 : 1)
  }

  console.log('\n======================================================')
  console.log(' Hermano Tool Decision Router — Catalog Parity Verifier')
  console.log('======================================================\n')
  console.log(`• Catalog Tools Registered in index.ts:    ${registeredIds.length}`)
  console.log(`• Tools Documented in TOOL_ROUTING.md:     ${routingMap.size}`)
  console.log(`• Tools Embedded in tool-embeddings.json:   ${Object.keys(embeddings).length}\n`)

  if (passed) {
    console.log(`✅ 100% PARITY CONFIRMED across all ${registeredIds.length} tools!`)
    console.log('   - All registered tools exist in TOOL_ROUTING.md with intents & triggers.')
    console.log('   - All registered tools have normalized 384-d MiniLM vectors in tool-embeddings.json.')
    console.log('   - All ambiguity cluster tools resolve cleanly against the catalog.\n')
    process.exit(0)
  }

  console.error('❌ PARITY CHECK FAILED:\n')

  if (missingFromRouting.length > 0) {
    console.error(`✖ Missing from TOOL_ROUTING.md (${missingFromRouting.length} tools):`)
    for (const id of missingFromRouting) console.error(`    - ${id}`)
    console.error('  → Fix: Add a "#### `<id>` — <Name>" section in TOOL_ROUTING.md with Core Intent and User Triggers.\n')
  }

  if (missingFromEmbeddings.length > 0) {
    console.error(`✖ Missing from tool-embeddings.json (${missingFromEmbeddings.length} tools):`)
    for (const id of missingFromEmbeddings) console.error(`    - ${id}`)
    console.error('  → Fix: Run "npm run router:embeddings" to regenerate tool-embeddings.json.\n')
  }

  if (orphanRouting.length > 0) {
    console.error(`✖ Orphan tools in TOOL_ROUTING.md (${orphanRouting.length} tools not in registry):`)
    for (const id of orphanRouting) console.error(`    - ${id}`)
    console.error('  → Fix: Remove or rename stale tools from TOOL_ROUTING.md.\n')
  }

  if (orphanEmbeddings.length > 0) {
    console.error(`✖ Orphan tools in tool-embeddings.json (${orphanEmbeddings.length} tools not in registry):`)
    for (const id of orphanEmbeddings) console.error(`    - ${id}`)
    console.error('  → Fix: Run "npm run router:embeddings" to prune deleted tools.\n')
  }

  if (invalidClusterTools.length > 0) {
    console.error(`✖ Invalid tool IDs in AMBIGUITY_CLUSTERS (${invalidClusterTools.length} tools):`)
    for (const id of invalidClusterTools) console.error(`    - ${id}`)
    console.error('  → Fix: Correct tool IDs in AMBIGUITY_CLUSTERS in src/main/services/semantic-router.ts.\n')
  }

  if (malformedRouting.length > 0) {
    console.error(`✖ Malformed routing entries (${malformedRouting.length} errors):`)
    for (const err of malformedRouting) console.error(`    - ${err}`)
    console.error('  → Fix: Ensure all tools have descriptive intents and at least 2 user triggers.\n')
  }

  if (malformedEmbeddings.length > 0) {
    console.error(`✖ Malformed vector embeddings (${malformedEmbeddings.length} errors):`)
    for (const err of malformedEmbeddings) console.error(`    - ${err}`)
    console.error('  → Fix: Run "npm run router:embeddings" to regenerate valid normalized vectors.\n')
  }

  process.exit(1)
}

try {
  runParityCheck()
} catch (err) {
  console.error('Unexpected error running parity check:', err)
  process.exit(1)
}
