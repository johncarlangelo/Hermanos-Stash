import { create } from 'zustand'
import type { OrbState } from 'thinking-orbs'
import { toolRegistry } from '../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../shared/types/tool'
import {
  detectConversationalIntent,
  isGibberish,
  CONVERSATIONAL_RESPONSES
} from '../../shared/utils/conversational-guards'

export interface RecommendedToolItem {
  id: string
  name: string
  description?: string
  confidence?: number // 0.0 to 1.0 (e.g. 0.96 for 96%)
  category?: string
  icon?: string
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: number
  recommendedTools?: RecommendedToolItem[]
  isThinking?: boolean
  canCreatePipeline?: boolean
}

export interface ChatbotState {
  isOpen: boolean
  orbState: OrbState
  messages: ChatMessage[]
  setIsOpen: (isOpen: boolean) => void
  toggleOpen: () => void
  setOrbState: (state: OrbState) => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, update: Partial<ChatMessage>) => void
  clearMessages: () => void
  sendUserQuery: (query: string) => Promise<void>
}

/**
 * Heuristic router: analyzes user natural language queries and matches
 * the most relevant tools with calibrated confidence scores.
 */
function routeQueryToTools(query: string): {
  recommendedTools: RecommendedToolItem[]
  explanation: string
  canCreatePipeline: boolean
} {
  const clean = query.trim()
  if (!clean) {
    return {
      recommendedTools: [],
      explanation: 'Please enter a task or question to find the right tool.',
      canCreatePipeline: false
    }
  }

  // Pre-filter conversational queries (greetings, system health/test, keyboard mash)
  const conversational = detectConversationalIntent(clean)
  if (conversational === 'greeting') {
    return {
      recommendedTools: [],
      explanation: CONVERSATIONAL_RESPONSES.greeting,
      canCreatePipeline: false
    }
  }
  if (conversational === 'system_check') {
    return {
      recommendedTools: [],
      explanation: CONVERSATIONAL_RESPONSES.systemCheck,
      canCreatePipeline: false
    }
  }
  if (conversational === 'gibberish') {
    return {
      recommendedTools: [],
      explanation: CONVERSATIONAL_RESPONSES.gibberish,
      canCreatePipeline: false
    }
  }

  const q = clean.toLowerCase()

  // Intent checks for multi-step workflows
  const matchedTools: Array<{ tool: ToolDefinition; confidence: number }> = []

  // Direct keyword/intent matchers for common composite queries
  const isBatesOrPageNumber = /bates|numbering|page\s*number|paginate|number/i.test(q)
  const isWatermark = /watermark|stamp|confidential|watermarking/i.test(q)
  const isPdf = /pdf|document|pages/i.test(q)

  if (isPdf && isBatesOrPageNumber && isWatermark) {
    const numberer = toolRegistry.get('pdf-numberer')
    const watermarker = toolRegistry.get('pdf-watermark')
    if (numberer) matchedTools.push({ tool: numberer, confidence: 0.96 })
    if (watermarker) matchedTools.push({ tool: watermarker, confidence: 0.93 })

    return {
      recommendedTools: matchedTools.map(({ tool, confidence }) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        confidence,
        category: tool.category,
        icon: tool.icon
      })),
      explanation:
        'To add Bates numbering and watermark across your PDF, I recommend using **PDF Page Numberer** to generate sequential numbering followed by **PDF Watermark** to stamp your confidential or custom overlay.',
      canCreatePipeline: true
    }
  }

  // General token search through tool registry
  const searchResults = toolRegistry.search(query)
  if (searchResults.length > 0) {
    const topResults = searchResults.slice(0, 3)
    const highestScore = topResults[0]?.score ?? 100

    const items = topResults.map(({ tool, score }) => {
      // Calibrate score into a confidence probability between 0.70 and 0.98
      const confidence = Math.min(
        0.98,
        Math.max(0.65, Number(((score / highestScore) * 0.95).toFixed(2)))
      )
      return {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        confidence,
        category: tool.category,
        icon: tool.icon
      }
    })

    const primaryTool = items[0]
    return {
      recommendedTools: items,
      explanation: `Based on your request, I recommend using **${primaryTool.name}**. It is specifically designed to ${primaryTool.description.toLowerCase()}`,
      canCreatePipeline: items.length > 1
    }
  }

  // Fallback if no direct search match found
  return {
    recommendedTools: [],
    explanation: isGibberish(clean)
      ? CONVERSATIONAL_RESPONSES.gibberish
      : CONVERSATIONAL_RESPONSES.outOfScope,
    canCreatePipeline: false
  }
}

export const useChatbot = create<ChatbotState>((set, get) => ({
  isOpen: false,
  orbState: 'solving',
  messages: [],

  setIsOpen: (isOpen) => {
    set({ isOpen })
    if (!isOpen && typeof window !== 'undefined') {
      window.stash?.chatbot?.unloadModel?.().catch(() => {})
    }
  },
  toggleOpen: () => {
    const next = !get().isOpen
    set({ isOpen: next })
    if (!next && typeof window !== 'undefined') {
      window.stash?.chatbot?.unloadModel?.().catch(() => {})
    }
  },
  setOrbState: (orbState) => set({ orbState }),

  addMessage: (msg) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const newMsg: ChatMessage = {
      id,
      timestamp: Date.now(),
      ...msg
    }
    set((state) => ({ messages: [...state.messages, newMsg] }))
    return id
  },

  updateMessage: (id, update) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...update } : m))
    }))
  },

  clearMessages: () => set({ messages: [], orbState: 'solving' }),

  sendUserQuery: async (query: string) => {
    const clean = query.trim()
    if (!clean) return

    const { addMessage, updateMessage, setOrbState } = get()

    // 1. Add user message
    addMessage({
      sender: 'user',
      text: clean
    })

    // 2. Set orb to searching / solving state
    setOrbState('searching')

    // 3. Add temporary thinking message
    const thinkingId = addMessage({
      sender: 'assistant',
      text: 'Analyzing task and routing through tool decision matrix...',
      isThinking: true
    })

    let recommendedTools: RecommendedToolItem[] = []
    let explanation = ''
    let canCreatePipeline = false

    try {
      if (typeof window !== 'undefined' && window.stash?.chatbot?.semanticRoute) {
        const res = await window.stash.chatbot.semanticRoute(clean)
        if (res && res.recommendedTools) {
          recommendedTools = res.recommendedTools
          explanation = res.explanation
          canCreatePipeline = res.canCreatePipeline
        }
      }
    } catch (err) {
      console.warn('Semantic route IPC failed, falling back to local heuristic:', err)
    }


    // 4. Fall back to client heuristic if IPC returned empty or wasn't available
    if (recommendedTools.length === 0 && !explanation) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      const fallback = routeQueryToTools(clean)
      recommendedTools = fallback.recommendedTools
      explanation = fallback.explanation
      canCreatePipeline = fallback.canCreatePipeline
    }

    // 5. Update with actual recommendation
    updateMessage(thinkingId, {
      text: explanation,
      isThinking: false,
      recommendedTools,
      canCreatePipeline
    })

    // 6. Return orb to listening state
    setOrbState('listening')
  }
}))

