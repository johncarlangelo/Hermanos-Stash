import { describe, expect, it } from 'vitest'
import {
  detectConversationalIntent,
  isGibberish,
  CONVERSATIONAL_RESPONSES
} from './conversational-guards'

describe('Conversational Guards & Intent Pre-Filters', () => {
  describe('Greeting Detection', () => {
    const greetings = ['hello', 'hi', 'hey', 'hey there!', 'good morning', 'sup', 'yo']
    it.each(greetings)('detects "%s" as greeting intent', (query) => {
      expect(detectConversationalIntent(query)).toBe('greeting')
    })
  })

  describe('System Check & Help Detection', () => {
    const systemQueries = ['test', 'testing', 'help', 'ping', 'who are you', 'what can you do']
    it.each(systemQueries)('detects "%s" as system_check intent', (query) => {
      expect(detectConversationalIntent(query)).toBe('system_check')
    })
  })

  describe('Gibberish & Keyboard Mash Detection', () => {
    const gibberishQueries = [
      'dfsdagfdg',
      'asdfasdf',
      'qwertyuiop',
      '????',
      '.....',
      'aaaaaa',
      'bcdfgh'
    ]
    it.each(gibberishQueries)('detects "%s" as gibberish', (query) => {
      expect(isGibberish(query)).toBe(true)
      expect(detectConversationalIntent(query)).toBe('gibberish')
    })
  })

  describe('Normal Tool Queries are not intercepted', () => {
    const toolQueries = [
      'compress video',
      'split pdf',
      'extract audio from mp4',
      'format json',
      'make my file smaller',
      'stamp watermark on document'
    ]
    it.each(toolQueries)('returns null for legitimate tool query "%s"', (query) => {
      expect(detectConversationalIntent(query)).toBeNull()
      expect(isGibberish(query)).toBe(false)
    })
  })

  describe('Conversational Responses format', () => {
    it('has non-empty friendly messages with markdown formatting', () => {
      expect(CONVERSATIONAL_RESPONSES.greeting).toContain('Hey there!')
      expect(CONVERSATIONAL_RESPONSES.systemCheck).toContain('All systems go!')
      expect(CONVERSATIONAL_RESPONSES.gibberish).toContain("I didn't quite catch that!")
      expect(CONVERSATIONAL_RESPONSES.outOfScope).toContain("I couldn't find a matching tool in Stash")
    })
  })
})
