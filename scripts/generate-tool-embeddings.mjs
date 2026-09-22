import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from '@xenova/transformers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const routingPath = path.join(rootDir, 'TOOL_ROUTING.md')
const outputDir = path.join(rootDir, 'src', 'shared', 'assets')
const outputPath = path.join(outputDir, 'tool-embeddings.json')

async function main() {
  console.log('Reading TOOL_ROUTING.md...')
  const content = fs.readFileSync(routingPath, 'utf-8')

  // Parse tools: #### `<id>` — <Name>
  // - **Core Intent:** ...
  // - **User Triggers:** "...", "..."
  const toolRegex = /#### `([a-z0-9-]+)` — ([^\r\n]+)\r?\n- \*\*Core Intent:\*\* ([^\r\n]+)\r?\n- \*\*User Triggers:\*\* ([^\r\n]+)/g
  const tools = []
  let match

  while ((match = toolRegex.exec(content)) !== null) {
    const id = match[1]
    const name = match[2].trim()
    const intent = match[3].trim()
    const triggersRaw = match[4].trim()

    // Clean triggers
    const triggers = triggersRaw
      .replace(/"/g, '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const textToEmbed = `${name}. ${intent}. Triggers and symptoms: ${triggers.join(', ')}.`
    tools.push({ id, name, intent, triggers, textToEmbed })
  }

  console.log(`Parsed ${tools.length} tools from TOOL_ROUTING.md.`)
  if (tools.length === 0) {
    throw new Error('Failed to parse tools from TOOL_ROUTING.md!')
  }

  console.log('Loading feature-extraction pipeline (Xenova/all-MiniLM-L6-v2)...')
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true
  })

  console.log('Computing embeddings for 78 tools...')
  const entries = {}

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    process.stdout.write(`Embedding [${i + 1}/${tools.length}] ${tool.id}... \r`)
    const output = await extractor(tool.textToEmbed, { pooling: 'mean', normalize: true })
    // Float32Array to standard array rounded to 6 decimal places to keep JSON compact
    const vector = Array.from(output.data).map((v) => Number(v.toFixed(6)))
    entries[tool.id] = {
      id: tool.id,
      name: tool.name,
      intent: tool.intent,
      triggers: tool.triggers,
      vector
    }
  }


  console.log('\nAll tools embedded successfully!')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(entries), 'utf-8')
  const stats = fs.statSync(outputPath)
  console.log(`Saved precomputed embeddings to ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`)
}

main().catch((err) => {
  console.error('Embedding generation failed:', err)
  process.exit(1)
})
