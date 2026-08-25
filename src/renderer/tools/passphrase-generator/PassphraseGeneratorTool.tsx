import { useCallback, useEffect, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { Slider } from '../../components/ui/Slider'
import { FieldRow, Input, Select, Toggle } from '../../components/ui/Inputs'
import { normalizeError, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import {
  entropyBits,
  generatePassphrase,
  generatePassword,
  strengthLabel,
  SYMBOL_SET,
  type StrengthLabel
} from './logic'

type Mode = 'passphrase' | 'password'

/** Entropy visualized as full scale — anything past this reads as maxed out. */
const STRENGTH_FULL_BITS = 128

const STRENGTH_TONE: Record<StrengthLabel, string> = {
  Weak: 'bg-danger text-danger',
  Fair: 'bg-warn text-warn',
  Strong: 'bg-accent text-accent',
  Excellent: 'bg-ok text-ok'
}

export default function PassphraseGeneratorTool() {
  const [mode, setMode] = useState<Mode>('passphrase')
  const [wordCount, setWordCount] = useState('4')
  const [separator, setSeparator] = useState('-')
  const [capitalize, setCapitalize] = useState(true)
  const [appendNumber, setAppendNumber] = useState(true)
  const [length, setPasswordLength] = useState(20)
  const [upper, setUpper] = useState(true)
  const [digitsOn, setDigitsOn] = useState(true)
  const [symbols, setSymbols] = useState(true)

  const [output, setOutput] = useState<string | null>(null)
  const [error, setError] = useState<StashError | null>(null)

  // Regenerating on every option change keeps the displayed secret and its
  // strength meter in lockstep — a stale output would be misleading.
  const regenerate = useCallback(() => {
    setError(null)
    try {
      if (mode === 'passphrase') {
        const count = Number.parseInt(wordCount, 10)
        setOutput(
          generatePassphrase({
            words: count,
            separator,
            capitalize,
            appendNumber
          })
        )
      } else {
        setOutput(generatePassword(length, { upper, digits: digitsOn, symbols }))
      }
    } catch (err) {
      setOutput(null)
      setError(normalizeError(err))
    }
  }, [mode, wordCount, separator, capitalize, appendNumber, length, upper, digitsOn, symbols])

  useEffect(() => {
    regenerate()
  }, [regenerate])

  const copy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      toastSuccess('Copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const bits =
    mode === 'passphrase'
      ? entropyBits({ mode: 'words', words: Math.max(1, Number.parseInt(wordCount, 10) || 1) })
      : entropyBits({
          mode: 'chars',
          length,
          alphabetSize:
            26 + (upper ? 26 : 0) + (digitsOn ? 10 : 0) + (symbols ? SYMBOL_SET.length : 0)
        })
  const label = strengthLabel(bits)

  return (
    <div className="flex flex-col gap-4">
      <Panel className="space-y-3 p-3.5">
        <div className="flex items-center justify-between">
          <SectionHeading>Options</SectionHeading>
          <div role="group" aria-label="Generator mode" className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={mode === 'passphrase' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'passphrase'}
              onClick={() => setMode('passphrase')}
            >
              Passphrase
            </Button>
            <Button
              size="sm"
              variant={mode === 'password' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'password'}
              onClick={() => setMode('password')}
            >
              Password
            </Button>
          </div>
        </div>

        {mode === 'passphrase' ? (
          <>
            <FieldRow
              label="Words"
              htmlFor="pp-word-count"
              hint="More words mean far more entropy — each added word adds 8 bits."
            >
              <Select
                id="pp-word-count"
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value)}
                className="w-24"
              >
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </FieldRow>
            <FieldRow label="Separator" htmlFor="pp-separator">
              <Input
                id="pp-separator"
                value={separator}
                maxLength={3}
                onChange={(e) => setSeparator(e.target.value)}
                className="w-20"
              />
            </FieldRow>
            <FieldRow label="Capitalize">
              <Toggle checked={capitalize} onChange={setCapitalize} label="Capitalize each word" />
            </FieldRow>
            <FieldRow
              label="Add digits"
              hint="Appends two random digits at the end for sites that require numbers."
            >
              <Toggle checked={appendNumber} onChange={setAppendNumber} label="Append two digits" />
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="Length">
              <Slider
                min={8}
                max={64}
                value={length}
                aria-label={`Password length, ${length} characters`}
                onValueChange={setPasswordLength}
                className="w-full"
              />
              <span
                aria-live="polite"
                className="tnum w-8 shrink-0 text-right text-[13px] text-ink"
              >
                {length}
              </span>
            </FieldRow>
            <FieldRow label="A–Z">
              <Toggle checked={upper} onChange={setUpper} label="Include uppercase letters" />
            </FieldRow>
            <FieldRow label="0–9">
              <Toggle checked={digitsOn} onChange={setDigitsOn} label="Include digits" />
            </FieldRow>
            <FieldRow label="Symbols" hint={`Uses exactly these characters: ${SYMBOL_SET}`}>
              <Toggle checked={symbols} onChange={setSymbols} label="Include symbols" />
            </FieldRow>
          </>
        )}
        {error && <ErrorNote error={error} />}
      </Panel>

      <Panel className="p-3.5">
        <SectionHeading>Result</SectionHeading>
        <div className="mt-2.5 min-h-14 rounded-md border border-line bg-base px-3 py-2.5">
          {output ? (
            <p
              aria-label="Generated secret"
              className="font-mono text-[17px] leading-relaxed break-all text-ink select-text"
            >
              {output}
            </p>
          ) : (
            <p className="text-[12px] text-faint">No output yet.</p>
          )}
        </div>

        <StrengthMeter bits={bits} label={label} />

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={regenerate}>
            <RefreshCw size={13} /> Regenerate
          </Button>
          <Button size="md" disabled={!output} onClick={() => void copy()}>
            <Copy size={13} /> Copy
          </Button>
          <span className="ml-auto text-[11px] leading-snug text-faint">
            Generated locally with your OS secure random source. Nothing is stored or sent.
          </span>
        </div>
      </Panel>
    </div>
  )
}

function StrengthMeter({ bits, label }: { bits: number; label: StrengthLabel }) {
  const ratio = Math.min(1, Math.max(0, bits / STRENGTH_FULL_BITS))
  return (
    <div className="mt-3 flex items-center gap-3">
      <span
        className={`w-20 shrink-0 text-right text-[12px] font-medium ${STRENGTH_TONE[label].split(' ')[1]}`}
      >
        {label}
      </span>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label={`${label} strength`}
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full transition-all duration-200 ease-out ${STRENGTH_TONE[label].split(' ')[0]}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className="tnum shrink-0 text-[11.5px] text-faint">
        ≈ {Math.round(bits)} bits of entropy
      </span>
    </div>
  )
}
