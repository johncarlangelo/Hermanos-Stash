import fs from 'node:fs'
import path from 'node:path'
import * as electron from 'electron'
import { env, pipeline } from '@xenova/transformers'
import type { SemanticRouteMatch, SemanticRouteResult } from '../../shared/ipc'
import { toolRegistry } from '../../shared/tool-registry/registry'
import precomputedEmbeddingsRaw from '../../shared/assets/tool-embeddings.json'
import {
  detectConversationalIntent,
  isGibberish,
  CONVERSATIONAL_RESPONSES
} from '../../shared/utils/conversational-guards'

interface PrecomputedEntry {
  id: string
  name: string
  intent?: string
  triggers?: string[]
  vector: number[]
}


const precomputedEmbeddings = precomputedEmbeddingsRaw as Record<string, PrecomputedEntry>

// Ambiguity clusters from TOOL_ROUTING.md with domain disambiguation guards
interface AmbiguityCluster {
  name: string
  keywords: string[]
  domainKeywords: string[]
  tools: string[]
  question: string
}

const AMBIGUITY_CLUSTERS: AmbiguityCluster[] = [
  {
    name: 'Compress / Make Smaller',
    keywords: ['compress', 'smaller', 'shrink', 'reduce size', 'optimize size'],
    domainKeywords: [
      'pdf', 'document', 'page',
      'png', 'jpg', 'jpeg', 'webp', 'avif', 'image', 'photo', 'picture',
      'mp4', 'mkv', 'webm', 'mov', 'video', 'clip',
      'zip', 'archive', 'folder', 'bundle'
    ],
    tools: ['pdf-compress', 'image-compress', 'video-compress', 'zip-create'],
    question:
      'Are you trying to compress a PDF document, an image, a video clip, or bundle files into a ZIP archive?'
  },
  {
    name: 'Convert',
    keywords: ['convert', 'transcode', 'change format', 'turn into'],
    domainKeywords: [
      'png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'gif', 'svg', 'image', 'photo',
      'mp4', 'mkv', 'webm', 'mov', 'avi', 'video', 'clip',
      'mp3', 'wav', 'ogg', 'm4a', 'flac', 'audio', 'sound', 'track',
      'pdf', 'document', 'pages', 'markdown', 'md',
      'json', 'csv', 'yaml', 'yml', 'xml', 'sql', 'spreadsheet',
      'curl', 'timestamp', 'epoch', 'date', 'color', 'hex', 'rgb', 'hsl', 'case', 'camelcase', 'kebab', 'snake', 'text'
    ],
    tools: ['image-convert', 'video-convert', 'audio-convert', 'csv-json', 'yaml-json', 'xml-json'],
    question:
      'What kind of file are you converting (media like video/audio, an image, or structured data like JSON/CSV)?'
  },
  {
    name: 'Cut / Split / Trim',
    keywords: ['cut', 'split', 'trim', 'slice', 'divide'],
    domainKeywords: [
      'pdf', 'document', 'page', 'pages',
      'image', 'photo', 'picture', 'grid', 'carousel', 'instagram',
      'mp3', 'wav', 'audio', 'song', 'sound', 'waveform', 'voice'
    ],
    tools: ['pdf-split', 'image-slicer', 'audio-trimmer'],
    question:
      'Are you splitting pages of a PDF, slicing an image into a grid, or trimming an audio clip?'
  },
  {
    name: 'Extract',
    keywords: ['extract', 'pull out', 'unzip', 'rip'],
    domainKeywords: [
      'audio', 'soundtrack', 'mp3', 'sound', 'from video', 'mp4',
      'zip', 'rar', '7z', 'tar', 'archive',
      'ocr', 'text from image', 'text from photo', 'receipt',
      'text from pdf', 'pages from pdf', 'images from pdf',
      'palette', 'color', 'colors'
    ],
    tools: ['extract-audio', 'zip-extract', 'image-ocr', 'pdf-to-text'],
    question:
      'Are you extracting audio from a video, unzipping an archive, OCRing text from a photo, or pulling text from a PDF?'
  },
  {
    name: 'Watermark / Stamp',
    keywords: ['watermark', 'stamp', 'bates', 'overlay'],
    domainKeywords: [
      'pdf', 'bates', 'numbering', 'legal', 'document',
      'image', 'photo', 'picture', 'jpeg', 'png'
    ],
    tools: ['pdf-watermark', 'image-watermark', 'pdf-numberer'],
    question:
      'Are you applying a watermark to images, stamping a confidential notice on a PDF, or adding Bates numbering?'
  },
  {
    name: 'Inspect / Metadata',
    keywords: ['inspect', 'metadata', 'exif', 'properties', 'details'],
    domainKeywords: [
      'exif', 'camera', 'gps', 'photo', 'picture', 'iso', 'aperture',
      'zip', 'rar', '7z', 'archive', 'tar',
      'file system', 'creation date', 'mime'
    ],
    tools: ['file-metadata', 'image-exif', 'archive-inspect'],
    question:
      'Are you inspecting general filesystem metadata, photo camera/GPS EXIF tags, or previewing contents inside an archive?'
  },
  {
    name: 'Format Code / Data',
    keywords: ['format', 'beautify', 'pretty print', 'indent'],
    domainKeywords: [
      'json', 'sql', 'query', 'xml', 'database', 'table',
      'png', 'jpg', 'jpeg', 'webp', 'avif', 'image', 'photo', 'video', 'mp4', 'audio'
    ],
    tools: ['json-format', 'sql-formatter', 'xml-json'],
    question:
      'Which language are you formatting — JSON data, an SQL database query, or XML?'
  },
  {
    name: 'Diff / Compare',
    keywords: ['diff', 'compare', 'difference', 'find duplicate'],
    domainKeywords: [
      'duplicate files', 'duplicates', 'disk', 'storage', 'space',
      'text', 'side by side', 'code diff'
    ],
    tools: ['text-diff', 'duplicate-finder'],
    question:
      'Are you comparing two text files side-by-side, or scanning your disk for duplicate files?'
  }
]

// Exact format affinity mapping: boosts tools specializing in mentioned file extensions
const FORMAT_AFFINITY: Record<string, string[]> = {
  png: ['image-convert', 'image-compress', 'image-slicer', 'image-watermark'],
  jpg: ['image-convert', 'image-compress', 'image-slicer', 'image-watermark'],
  jpeg: ['image-convert', 'image-compress', 'image-slicer', 'image-watermark'],
  webp: ['image-convert', 'image-compress'],
  avif: ['image-convert', 'image-compress'],
  mp4: ['video-convert', 'video-compress', 'extract-audio'],
  mkv: ['video-convert', 'video-compress'],
  webm: ['video-convert', 'video-compress'],
  mp3: ['audio-convert', 'audio-trimmer', 'audio-normalize'],
  wav: ['audio-convert', 'audio-trimmer', 'audio-normalize'],
  flac: ['audio-convert', 'audio-trimmer', 'audio-normalize'],
  sql: ['sql-formatter'],
  json: ['json-format'],
  csv: ['csv-json'],
  yaml: ['yaml-json'],
  yml: ['yaml-json'],
  xml: ['xml-json'],
  svg: ['svg-creator']
}

// Pipeline state
type FeatureExtractor = (
  text: string,
  options?: { pooling?: 'mean' | 'none' | 'cls'; normalize?: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>

let extractorInstance: FeatureExtractor | null = null
let idleTimer: NodeJS.Timeout | null = null
const IDLE_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes

export function getResourcesPath(): string {
  const electronApp = (electron as { app?: { getAppPath(): string } }).app
  return (
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ||
    (electronApp ? path.join(electronApp.getAppPath(), 'resources') : path.resolve('resources'))
  )
}

export function getModelPath(): string {
  return path.join(getResourcesPath(), 'models', 'Xenova', 'all-MiniLM-L6-v2')
}

export function isModelInstalled(): boolean {
  const modelFile = path.join(getModelPath(), 'onnx', 'model_quantized.onnx')
  return fs.existsSync(modelFile)
}

function resetIdleWatchdog(): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  idleTimer = setTimeout(() => {
    unloadModel()
  }, IDLE_TIMEOUT_MS)
}

export function unloadModel(): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  extractorInstance = null
}

async function getExtractor(): Promise<FeatureExtractor | null> {
  if (extractorInstance) {
    resetIdleWatchdog()
    return extractorInstance
  }

  const modelInstalled = isModelInstalled()
  const resourcesPath = getResourcesPath()

  if (modelInstalled) {
    // Configure transformers to load strictly from local disk without hitting remote HF
    env.localModelPath = path.join(resourcesPath, 'models')
    env.allowRemoteModels = false
    env.allowLocalModels = true
  } else {
    // If not installed on disk, return null to use graceful fallback
    return null
  }

  try {
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true
    })
    extractorInstance = pipe as unknown as FeatureExtractor
    resetIdleWatchdog()
    return extractorInstance
  } catch (err) {
    console.error('Failed to initialize local MiniLM pipeline:', err)
    return null
  }
}

/**
 * Calculates dot product between two normalized vectors (cosine similarity).
 */
function dotProduct(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i]
  }
  return sum
}

/**
 * Executes semantic intent routing for a user prompt.
 */
export async function semanticRoute(query: string): Promise<SemanticRouteResult> {
  const clean = query.trim()
  if (!clean) {
    return {
      recommendedTools: [],
      explanation: 'Please enter a task or question to find the right tool.',
      tier: 'out_of_scope',
      canCreatePipeline: false
    }
  }

  // Pre-filter conversational queries (greetings, system health/test, obvious keyboard mash)
  const conversational = detectConversationalIntent(clean)
  if (conversational === 'greeting') {
    return {
      recommendedTools: [],
      explanation: CONVERSATIONAL_RESPONSES.greeting,
      tier: 'out_of_scope',
      canCreatePipeline: false
    }
  }
  if (conversational === 'system_check') {
    return {
      recommendedTools: [],
      explanation: CONVERSATIONAL_RESPONSES.systemCheck,
      tier: 'out_of_scope',
      canCreatePipeline: false
    }
  }
  if (conversational === 'gibberish') {
    return {
      recommendedTools: [],
      explanation: CONVERSATIONAL_RESPONSES.gibberish,
      tier: 'out_of_scope',
      canCreatePipeline: false
    }
  }

  const qLower = clean.toLowerCase()
  const extractor = await getExtractor()

  // Helper for whole word/phrase matching to prevent false substring hits (e.g. 'rip' in 'typescript')
  const hasWord = (text: string, phrase: string): boolean => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|\\b)${escaped}(\\b|$)`, 'i').test(text)
  }

  // Check if this query triggers an ambiguity cluster (only if domain was NOT already specified)
  const matchedCluster = AMBIGUITY_CLUSTERS.find((cluster) => {
    const hasVerb = cluster.keywords.some((kw) => hasWord(qLower, kw))
    if (!hasVerb) return false
    const domainSpecified = cluster.domainKeywords.some((dk) => hasWord(qLower, dk))
    return !domainSpecified
  })

  // 1. Semantic Embedding Flow (if MiniLM model is available)
  if (extractor) {
    try {
      const output = await extractor(clean, { pooling: 'mean', normalize: true })
      const queryVector = Array.from(output.data)

      // Identify explicit format tokens in user query for affinity boosting
      const tokens = qLower.split(/[\s,._-]+/)
      const formatBoosts = new Set<string>()
      for (const tok of tokens) {
        if (FORMAT_AFFINITY[tok]) {
          for (const toolId of FORMAT_AFFINITY[tok]) {
            formatBoosts.add(toolId)
          }
        }
      }

      // Score all precomputed tools
      const scored: Array<{ id: string; name: string; score: number }> = []
      for (const [id, entry] of Object.entries(precomputedEmbeddings)) {
        let score = dotProduct(queryVector, entry.vector)
        if (formatBoosts.has(id)) {
          score += 0.10
        }
        scored.push({ id, name: entry.name, score })
      }

      scored.sort((a, b) => b.score - a.score)

      const top = scored[0]
      const second = scored[1]
      const third = scored[2]

      const topEntry = precomputedEmbeddings[top.id]
      const secondEntry = second ? precomputedEmbeddings[second.id] : undefined
      const thirdEntry = third ? precomputedEmbeddings[third.id] : undefined

      const topToolDef = toolRegistry.get(top.id)
      const secondToolDef = second ? toolRegistry.get(second.id) : undefined
      const thirdToolDef = third ? toolRegistry.get(third.id) : undefined

      const topDesc = topToolDef?.description || topEntry?.intent || top.name
      const secondDesc = secondToolDef?.description || secondEntry?.intent || second?.name
      const thirdDesc = thirdToolDef?.description || thirdEntry?.intent || third?.name

      // Multi-step pipeline detection (e.g. bates numbering + watermark, or split + compress)
      const hasPipelineConnectors = /and|then|after|both|into|followed by|chain/i.test(clean)
      const isMultiStepPdf =
        clean.includes('pdf') &&
        ((clean.includes('number') && clean.includes('watermark')) ||
          (clean.includes('split') && clean.includes('compress')))

      if (hasPipelineConnectors || isMultiStepPdf) {
        if (top.score >= 0.65 && second && second.score >= 0.5) {
          const recs: SemanticRouteMatch[] = [
            {
              id: top.id,
              name: top.name,
              description: topDesc,
              confidence: Number(top.score.toFixed(2)),
              category: topToolDef?.category,
              icon: topToolDef?.icon
            },
            {
              id: second.id,
              name: second.name,
              description: secondDesc,
              confidence: Number(second.score.toFixed(2)),
              category: secondToolDef?.category,
              icon: secondToolDef?.icon
            }
          ]

          return {
            recommendedTools: recs,
            explanation: `I detected a multi-step workflow! You can connect **${top.name}** and **${second.name}** directly in the Visual Queue.`,
            tier: 'high',
            canCreatePipeline: true,
            modelActive: true
          }
        }
      }

      // Ambiguity Cluster routing (broad verb without domain keywords)
      if (matchedCluster && top.score < 0.88) {
        const clusterToolDefs = matchedCluster.tools
          .map((id) => {
            const def = toolRegistry.get(id)
            const entry = precomputedEmbeddings[id]
            const scoreObj = scored.find((s) => s.id === id)
            return {
              id,
              name: def?.name || entry?.name || id,
              description: def?.description || entry?.intent || id,
              confidence: Number((scoreObj?.score ?? 0.65).toFixed(2)),
              category: def?.category,
              icon: def?.icon
            }
          })
          .slice(0, 3)

        return {
          recommendedTools: clusterToolDefs,
          explanation: `A couple options could work for this: ${matchedCluster.question}`,
          tier: 'ambiguous',
          canCreatePipeline: false,
          clarifyingQuestion: matchedCluster.question,
          cluster: matchedCluster.name,
          modelActive: true
        }
      }

      // Tier 1: High Confidence
      if (top.score >= 0.72 || (top.score >= 0.65 && (!second || top.score - second.score >= 0.07))) {
        const recs: SemanticRouteMatch[] = [
          {
            id: top.id,
            name: top.name,
            description: topDesc,
            confidence: Number(top.score.toFixed(2)),
            category: topToolDef?.category,
            icon: topToolDef?.icon,
            rationale: topDesc
          }
        ]
        if (second && second.score >= 0.68) {
          recs.push({
            id: second.id,
            name: second.name,
            description: secondDesc,
            confidence: Number(second.score.toFixed(2)),
            category: secondToolDef?.category,
            icon: secondToolDef?.icon
          })
        }

        return {
          recommendedTools: recs,
          explanation: `Sounds like you want **${top.name}** — ${topDesc.toLowerCase()}`,
          tier: 'high',
          canCreatePipeline: false,
          modelActive: true
        }
      }

      // Tier 2: Ambiguous / Close Contenders
      if (top.score >= 0.40 || matchedCluster) {
        const recs: SemanticRouteMatch[] = [
          {
            id: top.id,
            name: top.name,
            description: topDesc,
            confidence: Number(top.score.toFixed(2)),
            category: topToolDef?.category,
            icon: topToolDef?.icon
          }
        ]
        if (second) {
          recs.push({
            id: second.id,
            name: second.name,
            description: secondDesc,
            confidence: Number(second.score.toFixed(2)),
            category: secondToolDef?.category,
            icon: secondToolDef?.icon
          })
        }
        if (third && third.score >= 0.45) {
          recs.push({
            id: third.id,
            name: third.name,
            description: thirdDesc,
            confidence: Number(third.score.toFixed(2)),
            category: thirdToolDef?.category,
            icon: thirdToolDef?.icon
          })
        }

        const clarifying = matchedCluster
          ? matchedCluster.question
          : `Which tool best matches your desired output: **${top.name}** or **${second?.name ?? 'another option'}**?`

        return {
          recommendedTools: recs,
          explanation: `A couple options could work for this: ${clarifying}`,
          tier: 'ambiguous',
          canCreatePipeline: false,
          clarifyingQuestion: clarifying,
          cluster: matchedCluster?.name,
          modelActive: true
        }
      }

      // Tier 3: Low Score / Gibberish or Out of Scope
      if (top.score < 0.35 || isGibberish(clean)) {
        return {
          recommendedTools: [],
          explanation: CONVERSATIONAL_RESPONSES.gibberish,
          tier: 'out_of_scope',
          canCreatePipeline: false,
          modelActive: true
        }
      }

      return {
        recommendedTools: [],
        explanation: CONVERSATIONAL_RESPONSES.outOfScope,
        tier: 'out_of_scope',
        canCreatePipeline: false,
        modelActive: true
      }
    } catch (err) {
      console.error('Semantic routing failed, falling back to heuristics:', err)
    }
  }

  // 2. Fallback Heuristic Matcher (Runs when model is uninstalled or offline)
  let matchedEntries: Array<{ id: string; name: string; description: string; score: number }>


  const searchResults = toolRegistry.search(clean)
  if (searchResults.length > 0) {
    matchedEntries = searchResults.slice(0, 3).map(({ tool, score }) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      score: score / 100
    }))
  } else {
    // Search self-contained precomputedEmbeddings (always available in main process)
    const stopWords = new Set(['file', 'files', 'tool', 'tools', 'with', 'from', 'this', 'that', 'make', 'want', 'need', 'using'])
    const tokens = qLower.split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t))
    const candidates: Array<{
      id: string
      name: string
      description: string
      score: number
      normalizedScore: number
    }> = []

    for (const [id, entry] of Object.entries(precomputedEmbeddings)) {
      let score = 0
      const nameL = entry.name.toLowerCase()
      const intentL = (entry.intent || '').toLowerCase()
      const triggersL = (entry.triggers || []).map((t: string) => t.toLowerCase())

      // Exact tool ID match
      if (id === qLower || id.replace(/-/g, ' ') === qLower) {
        score += 2.0
      }

      // Check if entire query or key phrase is in triggers
      for (const tr of triggersL) {
        if (tr === qLower || tr.includes(qLower) || qLower.includes(tr)) {
          score += 1.5
          break
        }
      }

      // Check tokens
      let matchedTokenCount = 0
      for (const t of tokens) {
        let hit = false
        if (id.includes(t)) {
          score += 0.8
          hit = true
        }
        if (nameL.includes(t)) {
          score += 0.7
          hit = true
        }
        if (intentL.includes(t)) {
          score += 0.4
          hit = true
        }
        if (triggersL.some((tr: string) => tr.includes(t))) {
          score += 0.6
          hit = true
        }
        if (hit) matchedTokenCount++
      }

      // Heavy bonus if all significant tokens match this tool
      if (tokens.length > 0 && matchedTokenCount === tokens.length) {
        score += 1.2
      }

      if (score > 0) {
        candidates.push({
          id,
          name: entry.name,
          description: entry.intent || entry.name,
          score,
          normalizedScore: Math.min(0.98, Math.max(0.6, Number((score / 5).toFixed(2))))
        })
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    matchedEntries = candidates.slice(0, 3).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      score: c.normalizedScore
    }))
  }

  if (matchedEntries.length > 0) {
    const isComposite =
      matchedEntries.length > 1 &&
      (/and|then|after|both|into|followed by/i.test(clean) ||
        (clean.includes('pdf') && clean.includes('watermark') && clean.includes('number')))

    const recs: SemanticRouteMatch[] = matchedEntries.map((m) => {
      const def = toolRegistry.get(m.id)
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        confidence: Number(m.score.toFixed(2)),
        category: def?.category,
        icon: def?.icon
      }
    })

    const primary = recs[0]
    const descText = (primary.description || primary.name).toLowerCase()
    return {
      recommendedTools: recs,
      explanation: isComposite
        ? `I detected a multi-step workflow! You can combine **${recs[0].name}** and **${recs[1].name}** directly in the Visual Queue.`
        : `Based on your request, I recommend **${primary.name}** (${descText}).`,
      tier: primary.confidence >= 0.75 ? 'high' : 'ambiguous',
      canCreatePipeline: isComposite,
      modelActive: false
    }
  }


  return {
    recommendedTools: [],
    explanation: isGibberish(clean)
      ? CONVERSATIONAL_RESPONSES.gibberish
      : CONVERSATIONAL_RESPONSES.outOfScope,
    tier: 'out_of_scope',
    canCreatePipeline: false,
    modelActive: false
  }
}

