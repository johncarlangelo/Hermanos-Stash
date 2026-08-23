import { useEffect, useId, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { FieldRow, Select, TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { normalizeError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { formatDigest, HASH_ALGORITHMS, type HashAlgorithm } from './logic'

type Mode = 'text' | 'file'

/** Live text hashing debounce. */
const DEBOUNCE_MS = 200

export default function HashGeneratorTool() {
  const [mode, setMode] = useState<Mode>('text')
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha256')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Input mode" className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={mode === 'text' ? 'primary' : 'secondary'}
            aria-pressed={mode === 'text'}
            onClick={() => setMode('text')}
          >
            Text
          </Button>
          <Button
            size="sm"
            variant={mode === 'file' ? 'primary' : 'secondary'}
            aria-pressed={mode === 'file'}
            onClick={() => setMode('file')}
          >
            File
          </Button>
        </div>

        <FieldRow label="Algorithm" htmlFor="hash-algorithm">
          <Select
            id="hash-algorithm"
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
            className="w-32"
          >
            {HASH_ALGORITHMS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </FieldRow>
      </div>

      {mode === 'text' ? <TextHash algorithm={algorithm} /> : <FileHash algorithm={algorithm} />}
    </div>
  )
}

function TextHash({ algorithm }: { algorithm: HashAlgorithm }) {
  const [text, setText] = useState('')
  const [hex, setHex] = useState<string | null>(null)
  const [error, setError] = useState<StashError | null>(null)

  // Debounced invoke; a request counter discards stale responses.
  const requestSeq = useRef(0)
  useEffect(() => {
    if (text.length === 0) {
      setHex(null)
      setError(null)
      return
    }
    const seq = ++requestSeq.current
    const timer = setTimeout(() => {
      window.stash.crypto
        .hashText({ algorithm, text })
        .then((result) => {
          if (requestSeq.current !== seq) return
          setHex(result.hex)
          setError(null)
        })
        .catch((err: unknown) => {
          if (requestSeq.current !== seq) return
          setHex(null)
          setError(normalizeError(err))
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, algorithm])

  const copy = async () => {
    if (!hex) return
    try {
      await navigator.clipboard.writeText(hex)
      toastSuccess('Digest copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const error_ = error
  return (
    <Panel className="p-3.5">
      <SectionHeading>Text</SectionHeading>
      <label htmlFor="hash-text-input" className="sr-only">
        Text to hash
      </label>
      <TextArea
        id="hash-text-input"
        mono
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste any UTF-8 text…"
        className="mt-2 mb-2.5 h-40"
      />

      {!error_ && hex && (
        <DigestRow
          digest={formatDigest(hex)}
          algorithmLabel={algorithm}
          onCopy={() => void copy()}
        />
      )}
      {error_ && <ErrorNote error={error_} />}
      {!error_ && !hex && text.length > 0 && (
        <p role="status" className="text-[12px] text-faint">
          Computing…
        </p>
      )}
      {!error_ && !hex && text.length === 0 && (
        <p className="py-3 text-center text-[12px] text-faint">
          Enter some text above to see its digest.
        </p>
      )}
    </Panel>
  )
}

function FileHash({ algorithm }: { algorithm: HashAlgorithm }) {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [result, setResult] = useState<{ hex: string; sizeBytes: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  const compute = async (path: string) => {
    setBusy(true)
    setResult(null)
    setError(null)
    const startedAt = performance.now()
    try {
      const r = await window.stash.crypto.hashFile({ path, algorithm })
      setResult(r)
      recordHistory(path, algorithm, 'success', performance.now() - startedAt)
    } catch (err) {
      setError(normalizeError(err))
      recordHistory(
        path,
        algorithm,
        'failure',
        performance.now() - startedAt,
        normalizeError(err).userMessage
      )
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(formatDigest(result.hex))
      toastSuccess('Digest copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const name = filePath?.split(/[\\/]/).pop() ?? null

  return (
    <Panel className="p-3.5">
      <SectionHeading>File</SectionHeading>
      <div className="mt-2">
        <DropZone
          accept={[]}
          multiple={false}
          disabled={busy}
          dialogTitle="Choose a file to hash"
          hint="Any file type — streamed, never loaded whole into memory."
          onFiles={(paths) => {
            const path = paths[0]
            if (!path) return
            setFilePath(path)
            void compute(path)
          }}
        />
      </div>

      {busy && (
        <p role="status" aria-live="polite" className="mt-2.5 text-[12px] text-faint">
          Hashing…
        </p>
      )}

      {error && (
        <div className="mt-2.5">
          <ErrorNote error={error} />
        </div>
      )}

      {result && filePath && name && (
        <div className="mt-2.5 flex flex-col gap-1 rounded-md border border-line bg-base px-3 py-2.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <span className="min-w-0 truncate text-[12.5px] font-medium text-ink" title={name}>
              {name}
            </span>
            <span className="tnum text-[11.5px] text-faint">{formatBytes(result.sizeBytes)}</span>
          </div>
          <DigestRow
            digest={formatDigest(result.hex)}
            algorithmLabel={algorithm}
            onCopy={() => void copy()}
          />
        </div>
      )}

      {!busy && !error && !result && (
        <p className="py-3 text-center text-[12px] text-faint">
          Drop a file above to compute a checksum.
        </p>
      )}
    </Panel>
  )
}

function DigestRow({
  digest,
  algorithmLabel,
  onCopy
}: {
  digest: string
  algorithmLabel: string
  onCopy: () => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="shrink-0 font-mono text-[10.5px] tracking-wide text-faint uppercase"
      >
        {algorithmLabel}
      </label>
      <input
        id={id}
        readOnly
        value={digest}
        onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 cursor-text truncate rounded-sm bg-base px-2 py-1 font-mono text-[12px] text-ink tnum select-all focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        aria-label={`${algorithmLabel} digest`}
      />
      <IconButton
        variant="surface"
        size="sm"
        aria-label={`Copy ${algorithmLabel} digest`}
        onClick={onCopy}
      >
        <Copy size={13} />
      </IconButton>
    </div>
  )
}

/** History is best-effort and must never break the hashing flow. */
function recordHistory(
  path: string,
  algorithm: HashAlgorithm,
  status: 'success' | 'failure',
  durationMs: number,
  message?: string
): void {
  try {
    void window.stash.history.record({
      toolId: 'hash-generator',
      operation: `hash-${algorithm}`,
      inputs: [path.split(/[\\/]/).pop() ?? path],
      outputs: [],
      status,
      durationMs: Math.round(durationMs),
      ...(message ? { message } : {})
    })
  } catch {
    // Ignore — activity history failures are non-actionable here.
  }
}
