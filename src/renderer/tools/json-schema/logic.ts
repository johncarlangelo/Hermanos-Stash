/**
 * JSON Schema generator and lightweight offline validator
 */

export interface SchemaValidationError {
  path: string
  message: string
  keyword?: string
}

/**
 * Infer format for string values (email, date-time, uri, uuid, ipv4)
 */
export function inferStringFormat(str: string): string | undefined {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return 'uuid'
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return 'email'
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) && !isNaN(Date.parse(str))) {
    return 'date-time'
  }
  if (/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(str)) {
    return 'uri'
  }
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str)) {
    return 'ipv4'
  }
  return undefined
}

/**
 * Generate JSON Schema (Draft-07) from sample JavaScript value
 */
export function generateJsonSchema(value: unknown, title = 'Root'): Record<string, unknown> {
  if (value === null) {
    return { type: 'null' }
  }

  const type = typeof value

  if (type === 'boolean') {
    return { type: 'boolean' }
  }

  if (type === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' }
  }

  if (type === 'string') {
    const schema: Record<string, unknown> = { type: 'string' }
    const fmt = inferStringFormat(value as string)
    if (fmt) schema.format = fmt
    return schema
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array', items: {} }
    }
    // Infer items from first element
    return {
      type: 'array',
      items: generateJsonSchema(value[0], 'Item')
    }
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const key of Object.keys(obj)) {
      properties[key] = generateJsonSchema(obj[key], key)
      required.push(key)
    }

    const schema: Record<string, unknown> = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title,
      type: 'object',
      properties
    }

    if (required.length > 0) {
      schema.required = required
    }

    return schema
  }

  return {}
}

/**
 * Validate JSON payload against a JSON schema
 */
export function validateJsonAgainstSchema(
  payload: unknown,
  schema: Record<string, unknown>,
  currentPath = '#'
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = []
  if (!schema || typeof schema !== 'object') return errors

  const expectedType = schema.type as string | string[] | undefined

  if (expectedType) {
    const types = Array.isArray(expectedType) ? expectedType : [expectedType]
    let matches = false

    for (const t of types) {
      if (t === 'null' && payload === null) matches = true
      else if (t === 'boolean' && typeof payload === 'boolean') matches = true
      else if (t === 'integer' && typeof payload === 'number' && Number.isInteger(payload))
        matches = true
      else if (t === 'number' && typeof payload === 'number') matches = true
      else if (t === 'string' && typeof payload === 'string') matches = true
      else if (t === 'array' && Array.isArray(payload)) matches = true
      else if (
        t === 'object' &&
        typeof payload === 'object' &&
        payload !== null &&
        !Array.isArray(payload)
      )
        matches = true
    }

    if (!matches) {
      const actual = payload === null ? 'null' : Array.isArray(payload) ? 'array' : typeof payload
      errors.push({
        path: currentPath,
        message: `Expected type "${types.join(' | ')}", but got "${actual}"`,
        keyword: 'type'
      })
      return errors
    }
  }

  // String Constraints
  if (typeof payload === 'string') {
    const minLength = schema.minLength as number | undefined
    const maxLength = schema.maxLength as number | undefined
    const pattern = schema.pattern as string | undefined

    if (minLength !== undefined && payload.length < minLength) {
      errors.push({
        path: currentPath,
        message: `String is shorter than minLength (${payload.length} < ${minLength})`,
        keyword: 'minLength'
      })
    }
    if (maxLength !== undefined && payload.length > maxLength) {
      errors.push({
        path: currentPath,
        message: `String is longer than maxLength (${payload.length} > ${maxLength})`,
        keyword: 'maxLength'
      })
    }
    if (pattern) {
      try {
        const regex = new RegExp(pattern)
        if (!regex.test(payload)) {
          errors.push({
            path: currentPath,
            message: `String does not match pattern: ${pattern}`,
            keyword: 'pattern'
          })
        }
      } catch {
        // Ignore invalid regex in user schema
      }
    }
  }

  // Number Constraints
  if (typeof payload === 'number') {
    const minimum = schema.minimum as number | undefined
    const maximum = schema.maximum as number | undefined

    if (minimum !== undefined && payload < minimum) {
      errors.push({
        path: currentPath,
        message: `Number is less than minimum (${payload} < ${minimum})`,
        keyword: 'minimum'
      })
    }
    if (maximum !== undefined && payload > maximum) {
      errors.push({
        path: currentPath,
        message: `Number is greater than maximum (${payload} > ${maximum})`,
        keyword: 'maximum'
      })
    }
  }

  // Array Validation
  if (Array.isArray(payload)) {
    const minItems = schema.minItems as number | undefined
    const maxItems = schema.maxItems as number | undefined
    const itemsSchema = schema.items as Record<string, unknown> | undefined

    if (minItems !== undefined && payload.length < minItems) {
      errors.push({
        path: currentPath,
        message: `Array has fewer items than minItems (${payload.length} < ${minItems})`,
        keyword: 'minItems'
      })
    }
    if (maxItems !== undefined && payload.length > maxItems) {
      errors.push({
        path: currentPath,
        message: `Array has more items than maxItems (${payload.length} > ${maxItems})`,
        keyword: 'maxItems'
      })
    }
    if (itemsSchema && typeof itemsSchema === 'object') {
      for (let i = 0; i < payload.length; i++) {
        const subErrors = validateJsonAgainstSchema(payload[i], itemsSchema, `${currentPath}/${i}`)
        errors.push(...subErrors)
      }
    }
  }

  // Object Validation
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const payloadObj = payload as Record<string, unknown>
    const required = schema.required as string[] | undefined
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined

    // Required properties
    if (Array.isArray(required)) {
      for (const req of required) {
        if (payloadObj[req] === undefined) {
          errors.push({
            path: currentPath,
            message: `Missing required property: "${req}"`,
            keyword: 'required'
          })
        }
      }
    }

    // Properties validation
    if (properties && typeof properties === 'object') {
      for (const key of Object.keys(properties)) {
        if (payloadObj[key] !== undefined) {
          const subErrors = validateJsonAgainstSchema(
            payloadObj[key],
            properties[key],
            `${currentPath}/${key}`
          )
          errors.push(...subErrors)
        }
      }
    }
  }

  return errors
}
