import { beforeEach, describe, expect, it } from 'vitest'
import '../tools'
import { useChatbot } from './chatbot'

describe('useChatbot Store', () => {
  beforeEach(() => {
    useChatbot.setState({
      isOpen: false,
      orbState: 'solving',
      messages: []
    })
  })

  it('initializes with default values', () => {
    const state = useChatbot.getState()
    expect(state.isOpen).toBe(false)
    expect(state.orbState).toBe('solving')
    expect(state.messages).toEqual([])
  })

  it('toggles open state correctly', () => {
    useChatbot.getState().toggleOpen()
    expect(useChatbot.getState().isOpen).toBe(true)

    useChatbot.getState().toggleOpen()
    expect(useChatbot.getState().isOpen).toBe(false)
  })

  it('clears messages and resets orb state', () => {
    useChatbot.getState().addMessage({
      sender: 'user',
      text: 'hello'
    })
    useChatbot.getState().setOrbState('searching')

    expect(useChatbot.getState().messages.length).toBe(1)

    useChatbot.getState().clearMessages()
    expect(useChatbot.getState().messages).toEqual([])
    expect(useChatbot.getState().orbState).toBe('solving')
  })

  it('routes composite PDF query to PDF numberer and watermark tools', async () => {
    await useChatbot
      .getState()
      .sendUserQuery('I have a 100-page PDF, how do I add bates numbers and watermark each page?')

    const messages = useChatbot.getState().messages
    expect(messages.length).toBe(2)

    const userMsg = messages[0]
    expect(userMsg.sender).toBe('user')

    const botMsg = messages[1]
    expect(botMsg.sender).toBe('assistant')
    expect(botMsg.isThinking).toBe(false)
    expect(botMsg.canCreatePipeline).toBe(true)

    const toolIds = botMsg.recommendedTools?.map((t) => t.id)
    expect(toolIds).toContain('pdf-numberer')
    expect(toolIds).toContain('pdf-watermark')

    expect(botMsg.recommendedTools?.[0].confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('routes single-tool queries correctly', async () => {
    await useChatbot.getState().sendUserQuery('format json')

    const messages = useChatbot.getState().messages
    expect(messages.length).toBe(2)

    const botMsg = messages[1]
    expect(botMsg.sender).toBe('assistant')
    const toolIds = botMsg.recommendedTools?.map((t) => t.id)
    expect(toolIds).toContain('json-format')
  })

  it('responds warmly to greetings like "hello"', async () => {
    await useChatbot.getState().sendUserQuery('hello')

    const messages = useChatbot.getState().messages
    expect(messages.length).toBe(2)

    const botMsg = messages[1]
    expect(botMsg.sender).toBe('assistant')
    expect(botMsg.text).toContain("Hey there! 👋 I'm Hermano")
    expect(botMsg.recommendedTools).toHaveLength(0)
  })

  it('responds with system ready status on "test"', async () => {
    await useChatbot.getState().sendUserQuery('test')

    const messages = useChatbot.getState().messages
    expect(messages.length).toBe(2)

    const botMsg = messages[1]
    expect(botMsg.sender).toBe('assistant')
    expect(botMsg.text).toContain('All systems go! ⚡')
    expect(botMsg.recommendedTools).toHaveLength(0)
  })

  it('catches keyboard mash / gibberish with friendly re-prompt', async () => {
    await useChatbot.getState().sendUserQuery('dfsdagfdg')

    const messages = useChatbot.getState().messages
    expect(messages.length).toBe(2)

    const botMsg = messages[1]
    expect(botMsg.sender).toBe('assistant')
    expect(botMsg.text).toContain("I didn't quite catch that!")
    expect(botMsg.recommendedTools).toHaveLength(0)
  })
})
