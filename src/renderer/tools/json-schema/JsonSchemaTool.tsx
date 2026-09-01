import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Code2, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { generateJsonSchema, validateJsonAgainstSchema } from './logic'

const SAMPLES = {
  user: {
    schema: JSON.stringify(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'User Profile',
        type: 'object',
        required: ['id', 'username', 'email'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', minLength: 3, maxLength: 20 },
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 13 },
          isActive: { type: 'boolean' }
        }
      },
      null,
      2
    ),
    payload: JSON.stringify(
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'john_doe',
        email: 'john.doe@example.com',
        age: 29,
        isActive: true
      },
      null,
      2
    )
  },

  order: {
    schema: JSON.stringify(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Order',
        type: 'object',
        required: ['orderId', 'totalAmount', 'items'],
        properties: {
          orderId: { type: 'string' },
          totalAmount: { type: 'number', minimum: 0 },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['sku', 'qty', 'unitPrice'],
              properties: {
                sku: { type: 'string' },
                qty: { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number', minimum: 0 }
              }
            }
          }
        }
      },
      null,
      2
    ),
    payload: JSON.stringify(
      {
        orderId: 'ORD-9842',
        totalAmount: 129.5,
        items: [
          { sku: 'STASH-PRO', qty: 1, unitPrice: 99.5 },
          { sku: 'DEV-KIT', qty: 1, unitPrice: 30.0 }
        ]
      },
      null,
      2
    )
  }
}

export default function JsonSchemaTool() {
  const [schemaText, setSchemaText] = useState<string>(SAMPLES.user.schema)
  const [payloadText, setPayloadText] = useState<string>(SAMPLES.user.payload)
  const [copied, setCopied] = useState<string | null>(null)

  // Validate live
  const { errors, parseError } = useMemo(() => {
    if (!schemaText.trim() || !payloadText.trim()) {
      return { errors: [], parseError: null }
    }

    let parsedSchema: Record<string, unknown>
    let parsedPayload: unknown

    try {
      parsedSchema = JSON.parse(schemaText) as Record<string, unknown>
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { errors: [], parseError: `Schema JSON Error: ${message}` }
    }

    try {
      parsedPayload = JSON.parse(payloadText)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { errors: [], parseError: `Payload JSON Error: ${message}` }
    }

    const valErrors = validateJsonAgainstSchema(parsedPayload, parsedSchema)
    return { errors: valErrors, parseError: null }
  }, [schemaText, payloadText])

  const isValid = !parseError && errors.length === 0 && schemaText.trim().length > 0

  const handleInferSchema = () => {
    try {
      const parsed = JSON.parse(payloadText)
      const inferred = generateJsonSchema(parsed)
      setSchemaText(JSON.stringify(inferred, null, 2))
      toastSuccess('Generated JSON Schema from payload')
      recordHistoryQuietly('json-schema', 'JSON Schema Validator & Generator', 'developer')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Cannot parse payload: ${message}`)
    }
  }

  const handleFormat = (target: 'schema' | 'payload') => {
    try {
      if (target === 'schema') {
        setSchemaText(JSON.stringify(JSON.parse(schemaText), null, 2))
      } else {
        setPayloadText(JSON.stringify(JSON.parse(payloadText), null, 2))
      }
      toastSuccess('Formatted JSON')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Formatting error: ${message}`)
    }
  }

  const handleCopy = async (target: 'schema' | 'payload') => {
    const content = target === 'schema' ? schemaText : payloadText
    await navigator.clipboard.writeText(content)
    setCopied(target)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess(`Copied ${target} to clipboard`)
    recordHistoryQuietly('json-schema', 'JSON Schema Validator & Generator', 'developer')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Code2 size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">JSON Schema Validator & Generator</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Draft-07 · 2020-12
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          <button
            type="button"
            onClick={() => {
              setSchemaText(SAMPLES.user.schema)
              setPayloadText(SAMPLES.user.payload)
            }}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            User Profile
          </button>
          <button
            type="button"
            onClick={() => {
              setSchemaText(SAMPLES.order.schema)
              setPayloadText(SAMPLES.order.payload)
            }}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Order Item
          </button>
        </div>
      </div>

      {/* Validation Status Bar */}
      <div
        className={`p-2.5 rounded border flex items-center justify-between transition-colors ${
          parseError
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            : isValid
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        }`}
      >
        <div className="flex items-center gap-2 text-[12px] font-medium truncate">
          {parseError ? (
            <>
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
              <span className="truncate">{parseError}</span>
            </>
          ) : isValid ? (
            <>
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>Valid Payload — All Schema Constraints Met (0 errors)</span>
            </>
          ) : (
            <>
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span>
                Schema Mismatch: {errors.length} validation issue{errors.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleInferSchema}
          className="gap-1 cursor-pointer text-[11px] bg-base/70"
        >
          <Wand2 size={12} className="text-accent" />
          Auto-Infer Schema from Payload
        </Button>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 overflow-hidden">
        {/* Left: Schema Editor */}
        <Panel className="p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">
              JSON Schema Definition
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleFormat('schema')}
                className="text-[10.5px] py-0.5"
              >
                Format
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy('schema')}
                className="text-[10.5px] py-0.5"
              >
                {copied === 'schema' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            placeholder="Enter JSON Schema..."
            className="flex-1 w-full rounded border border-line bg-base p-2.5 font-mono text-[11.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed select-all"
          />
        </Panel>

        {/* Right: Payload Editor & Errors */}
        <Panel className="p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">
              JSON Payload (Data to Test)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleFormat('payload')}
                className="text-[10.5px] py-0.5"
              >
                Format
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy('payload')}
                className="text-[10.5px] py-0.5"
              >
                {copied === 'payload' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            placeholder="Enter JSON payload to validate..."
            className="flex-1 w-full rounded border border-line bg-base p-2.5 font-mono text-[11.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed select-all"
          />

          {/* Validation Errors Drawer */}
          {errors.length > 0 && (
            <div className="h-28 rounded border border-amber-500/40 bg-amber-500/10 p-2.5 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-200">
              <div className="font-semibold text-amber-300 text-[11.5px] border-b border-amber-500/30 pb-1">
                Schema Violations ({errors.length}):
              </div>
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-accent font-bold">[{err.path}]</span>
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
