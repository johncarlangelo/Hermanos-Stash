import { describe, expect, it } from 'vitest'
import { generateJsonSchema, inferStringFormat, validateJsonAgainstSchema } from './logic'

describe('json-schema logic', () => {
  it('infers email, uuid, date-time, and uri formats', () => {
    expect(inferStringFormat('test@example.com')).toBe('email')
    expect(inferStringFormat('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid')
    expect(inferStringFormat('2026-09-01T12:00:00Z')).toBe('date-time')
    expect(inferStringFormat('https://stash.local/api')).toBe('uri')
  })

  it('generates Draft-07 JSON schema from sample object', () => {
    const sample = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Alice',
      age: 28,
      isAdmin: true,
      tags: ['dev', 'admin']
    }
    const schema = generateJsonSchema(sample)
    const props = schema.properties as Record<string, Record<string, unknown>>
    expect(schema.type).toBe('object')
    expect(props.name.type).toBe('string')
    expect(props.age.type).toBe('integer')
    expect(props.isAdmin.type).toBe('boolean')
    expect(props.tags.type).toBe('array')
    expect(schema.required).toContain('id')
    expect(props.id.format).toBe('uuid')
  })

  it('validates matching JSON payload with 0 errors', () => {
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string', minLength: 2 },
        age: { type: 'integer', minimum: 0 }
      }
    }
    const payload = { name: 'Bob', age: 25 }
    const errors = validateJsonAgainstSchema(payload, schema)
    expect(errors.length).toBe(0)
  })

  it('detects missing required fields and type mismatches', () => {
    const schema = {
      type: 'object',
      required: ['id', 'email'],
      properties: {
        id: { type: 'integer' },
        email: { type: 'string' }
      }
    }
    const payload = { id: 'not-an-integer' }
    const errors = validateJsonAgainstSchema(payload, schema)
    expect(errors.some((e) => e.keyword === 'required')).toBe(true)
    expect(errors.some((e) => e.keyword === 'type')).toBe(true)
  })
})
