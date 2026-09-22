import { useEffect, useRef, useState } from 'react'
import { ArrowUp, RotateCcw, Sparkles, Workflow, X, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import { ThinkingOrb } from 'thinking-orbs'
import { useChatbot, type RecommendedToolItem } from '../../stores/chatbot'
import { useNav } from '../../stores/nav'
import { getIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'

const PROMPT_SUGGESTIONS = [
  'I have a 100-page PDF, how do I add bates numbers and watermark each page?',
  'Convert my PNG images to WebP and compress them',
  'Format and validate messy JSON with line errors',
  'Extract audio stream from an MP4 video clip'
]

export function ChatbotWidget() {
  const isOpen = useChatbot((s) => s.isOpen)
  const setIsOpen = useChatbot((s) => s.setIsOpen)
  const toggleOpen = useChatbot((s) => s.toggleOpen)
  const orbState = useChatbot((s) => s.orbState)
  const messages = useChatbot((s) => s.messages)
  const clearMessages = useChatbot((s) => s.clearMessages)
  const sendUserQuery = useChatbot((s) => s.sendUserQuery)

  const openTool = useNav((s) => s.openTool)
  const openQueue = useNav((s) => s.openQueue)

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [isOpen])

  // Keyboard shortcuts: Ctrl+/ to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggleOpen()
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, toggleOpen, setIsOpen])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const clean = input.trim()
    if (!clean) return
    setInput('')
    void sendUserQuery(clean)
  }

  return (
    <>
      {/* Floating Trigger Orb Button (Bottom-Right) */}
      <div className="fixed bottom-9 right-6 z-40">
        <button
          type="button"
          onClick={toggleOpen}
          className={clsx(
            'group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-shell/90 backdrop-blur-md shadow-xl shadow-black/50 transition-all duration-200 hover:scale-105 active:scale-95',
            isOpen
              ? 'border-accent shadow-[0_0_20px_-3px_var(--color-accent-glow)]'
              : 'hover:border-accent hover:shadow-[0_0_20px_-3px_var(--color-accent-glow)]'
          )}
          title={isOpen ? 'Close Hermano' : 'Open Hermano (Ctrl+/)'}
          aria-label="Toggle Hermano"
        >
          <ThinkingOrb state={isOpen ? 'listening' : orbState} size={32} theme="dark" />
        </button>
      </div>

      {/* Floating Chatbot Window (Non-draggable modal docked bottom-right) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Hermano Decision Router"
          className="fixed bottom-23 right-6 z-40 flex h-[530px] max-h-[calc(100vh-7.5rem)] w-[390px] sm:w-[420px] flex-col overflow-hidden rounded-2xl border border-line-strong bg-shell/95 backdrop-blur-2xl shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-line/70 px-4 py-3 bg-surface/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink tracking-wide">Hermano</span>
              <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400 tracking-wider uppercase">
                ROUTER · BETA
              </span>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearMessages}
                  className="rounded p-1 text-faint hover:bg-surface hover:text-ink cursor-pointer transition-colors"
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  <RotateCcw size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-faint hover:bg-surface hover:text-ink cursor-pointer transition-colors"
                title="Close (Esc)"
                aria-label="Close Hermano"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Message History Area */}
          <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-3.5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center space-y-4 pt-4 pb-2 text-center">
                {/* ThinkingOrb in the middle */}
                <div className="flex items-center justify-center">
                  <ThinkingOrb state={orbState} size={64} theme="dark" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-ink">How can Hermano help you?</h3>
                  <p className="max-w-[300px] text-xs text-dim leading-relaxed">
                    Ask how to solve a task or describe your workflow, and I&apos;ll route you
                    directly to the right tool or pipeline.
                  </p>
                </div>

                <div className="w-full space-y-2 pt-2 text-left">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-faint">
                    Try asking:
                  </span>
                  <div className="space-y-1.5">
                    {PROMPT_SUGGESTIONS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendUserQuery(prompt)}
                        className="w-full text-left rounded-lg border border-line/60 bg-surface/30 hover:bg-surface/80 hover:border-accent/40 p-2.5 text-xs text-dim hover:text-ink transition-colors cursor-pointer leading-normal flex items-start justify-between gap-2 group"
                      >
                        <span>{prompt}</span>
                        <ArrowUp
                          size={11}
                          className="rotate-45 shrink-0 opacity-0 group-hover:opacity-100 text-accent transition-opacity mt-0.5"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={clsx(
                    'flex flex-col',
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  {msg.sender === 'user' ? (
                    <div className="rounded-xl rounded-tr-xs bg-accent/15 border border-accent/30 text-ink px-3.5 py-2.5 text-xs max-w-[85%] leading-relaxed shadow-sm">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="rounded-xl rounded-tl-xs bg-surface/70 border border-line/70 text-ink p-3.5 text-xs max-w-[95%] space-y-3 leading-relaxed shadow-sm">
                      {msg.isThinking ? (
                        <div className="flex flex-col items-center justify-center py-3 w-full gap-2.5 text-dim">
                          <ThinkingOrb state="searching" size={64} theme="dark" />
                          <span className="text-xs text-faint">{msg.text}</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-ink/90 leading-relaxed whitespace-pre-wrap">
                            {msg.text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                  <strong key={i} className="text-accent font-semibold">
                                    {part.slice(2, -2)}
                                  </strong>
                                )
                              }
                              return part
                            })}
                          </div>

                          {/* Recommended Tools Cards */}
                          {msg.recommendedTools && msg.recommendedTools.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-faint">
                                Recommended Tools ({msg.recommendedTools.length})
                              </span>
                              <div className="space-y-2">
                                {msg.recommendedTools.map((tool: RecommendedToolItem) => {
                                  const Icon = tool.icon ? getIcon(tool.icon) : Sparkles
                                  return (
                                    <div
                                      key={tool.id}
                                      className="rounded-lg border border-line/80 bg-raised/60 p-2.5 space-y-2 transition-colors hover:border-line-strong"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface border border-line/60 text-accent">
                                            <Icon size={13} />
                                          </div>
                                          <div className="min-w-0">
                                            <div className="font-semibold text-xs text-ink truncate">
                                              {tool.name}
                                            </div>
                                            {tool.category && (
                                              <span className="text-[10px] font-mono text-faint uppercase">
                                                {tool.category}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {tool.description && (
                                        <p className="text-[11px] text-dim leading-snug line-clamp-2">
                                          {tool.description}
                                        </p>
                                      )}

                                      <div className="pt-1 flex items-center justify-end">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => {
                                            openTool(tool.id)
                                            setIsOpen(false)
                                          }}
                                          className="h-6 px-2.5 text-[11px] cursor-pointer gap-1"
                                        >
                                          Open Tool
                                          <ExternalLink size={10} aria-hidden />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Pipeline Chain Shortcut */}
                          {msg.canCreatePipeline && (
                            <div className="rounded-lg border border-accent/25 bg-accent/5 p-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Workflow size={13} className="text-accent shrink-0" />
                                <span className="text-[11px] text-dim truncate">
                                  Chain sequentially in workflow canvas
                                </span>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  openQueue()
                                  setIsOpen(false)
                                }}
                                className="h-6 px-2 text-[10px] cursor-pointer shrink-0"
                              >
                                Open Queue
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area */}
          <div className="shrink-0 border-t border-line/70 p-3 bg-surface/40">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Hermano how to solve a task or find a tool..."
                className="flex-1 rounded-xl border border-line bg-shell/80 px-3 py-2 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-raised disabled:opacity-30 disabled:pointer-events-none hover:bg-accent-hover transition-all"
                title="Send query"
                aria-label="Send query"
              >
                <ArrowUp size={14} />
              </button>
            </form>
            <div className="flex items-center justify-between pt-2 px-1 text-[9.5px] font-mono text-faint">
              <span>Press Enter to send · Esc to close</span>
              <span>100% Local Router</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
