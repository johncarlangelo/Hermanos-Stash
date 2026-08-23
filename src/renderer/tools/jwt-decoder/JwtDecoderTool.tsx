import { useId, useMemo, useState } from 'react'
import { Copy, TriangleAlert } from 'lucide-react'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { toastError, toastSuccess } from '../../stores/toasts'
import { decodeJwt, isExpired, type JwtPayload } from './logic'

const TIME_CLAIMS: Record<string, string> = {
  exp: 'Expires at',
  iat: 'Issued at',
  nbf: 'Not before'
}

export default function JwtDecoderTool() {
  const [token, setToken] = useState('')

  const tokenId = useId()
  const hasToken = token.trim().length > 0

  const decoded = useMemo(() => (hasToken ? decodeJwt(token) : null), [token, hasToken])
  const error = decoded && 'error' in decoded ? decoded.error : null

  const nowMs = Date.now()
  const expired = decoded && !('error' in decoded) ? isExpired(decoded.payload, nowMs) : false

  const copyJson = async (label: string, value: object) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
      toastSuccess(`${label} JSON copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <SectionHeading>Token</SectionHeading>
        <label htmlFor={tokenId} className="sr-only">
          JWT token
        </label>
        <TextArea
          id={tokenId}
          mono
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOi…"
          aria-invalid={Boolean(error)}
          className="mt-2 h-24"
        />
      </Panel>

      <div
        role="status"
        className="flex items-start gap-2.5 rounded-md border border-line bg-raised px-3 py-2.5"
      >
        <TriangleAlert size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden />
        <p className="text-[12px] leading-snug text-dim">
          Signature is not verified — decoding only. Never treat a decoded token as trusted.
        </p>
      </div>

      {!hasToken ? (
        <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
          <p className="text-[12.5px] text-dim">Paste a JWT above to inspect its claims.</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            Header and payload are decoded locally — the token never leaves this machine.
          </p>
        </div>
      ) : error ? (
        <Panel className="p-3.5">
          <p role="alert" className="text-[12.5px] leading-snug text-danger">
            {error.message}
          </p>
        </Panel>
      ) : decoded && !('error' in decoded) ? (
        <>
          <ClaimStrip payload={decoded.payload} nowMs={nowMs} expired={expired} />
          <div className="grid gap-4 lg:grid-cols-2">
            <DecodedPanel
              title="Header"
              value={decoded.header}
              onCopy={() => void copyJson('Header', decoded.header)}
            />
            <DecodedPanel
              title="Payload"
              value={decoded.payload}
              onCopy={() => void copyJson('Payload', decoded.payload)}
            />
          </div>
          <Panel className="flex min-w-0 flex-col gap-1.5 p-3.5">
            <SectionHeading>Signature</SectionHeading>
            <code
              className="truncate font-mono text-[11.5px] break-all text-faint"
              title={decoded.signature}
            >
              {decoded.signature || '(empty — unsigned token)'}
            </code>
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function DecodedPanel({
  title,
  value,
  onCopy
}: {
  title: string
  value: object
  onCopy: () => void
}) {
  return (
    <Panel className="min-w-0 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <SectionHeading>{title}</SectionHeading>
        <IconButton
          variant="surface"
          size="sm"
          aria-label={`Copy ${title.toLowerCase()} JSON`}
          onClick={onCopy}
        >
          <Copy size={13} />
        </IconButton>
      </div>
      <pre
        aria-label={`${title} contents`}
        className="max-h-64 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink"
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </Panel>
  )
}

function ClaimStrip({
  payload,
  nowMs,
  expired
}: {
  payload: JwtPayload
  nowMs: number
  expired: boolean
}) {
  const present = Object.keys(TIME_CLAIMS).filter((claim) => typeof payload[claim] === 'number')
  if (present.length === 0) return null

  return (
    <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3.5 py-3">
      {present.map((claim) => {
        const seconds = payload[claim] as number
        return (
          <span key={claim} className="flex items-baseline gap-2 text-[12px]">
            <span className="font-mono text-[10.5px] tracking-wide text-faint uppercase">
              {TIME_CLAIMS[claim]}
            </span>
            <span className="tnum text-ink">{formatEpoch(seconds)}</span>
            <span className="font-mono text-[10px] text-faint tnum">({claim})</span>
          </span>
        )
      })}
      {typeof payload.exp === 'number' && (
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-xs border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wide ${
            expired ? 'border-danger/40 bg-danger/10 text-danger' : 'border-ok/30 bg-ok/10 text-ok'
          }`}
        >
          {expired ? `Expired ${describeAgo(payload.exp * 1000, nowMs)}` : 'Valid'}
        </span>
      )}
    </Panel>
  )
}

function formatEpoch(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function describeAgo(ms: number, nowMs: number): string {
  const minutes = Math.round((nowMs - ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}
