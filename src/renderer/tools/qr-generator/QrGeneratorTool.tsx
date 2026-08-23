import { useId, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { FieldRow, Select, TextArea } from '../../components/ui/Inputs'
import { normalizeError, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import { generateQrDataUrl, type ErrorCorrectionLevel } from './logic'

const SIZES = [256, 512, 1024] as const
const EC_LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']

export default function QrGeneratorTool() {
  const [text, setText] = useState('')
  const [width, setWidth] = useState<number>(512)
  const [ecLevel, setEcLevel] = useState<ErrorCorrectionLevel>('M')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  const contentId = useId()
  const sizeId = useId()
  const ecId = useId()
  const hasGenerated = dataUrl !== null

  const generate = async (): Promise<void> => {
    setGenerating(true)
    setError(null)
    try {
      setDataUrl(await generateQrDataUrl(text, { width, errorCorrectionLevel: ecLevel }))
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setGenerating(false)
    }
  }

  const copyImage = async (): Promise<void> => {
    if (!dataUrl) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toastSuccess('QR code copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const saveImage = async (): Promise<void> => {
    if (!dataUrl) return
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: 'qrcode.png',
        filters: [{ name: 'PNG image', extensions: ['png'] }]
      })
      if (dialog.cancelled || !dialog.path) return
      const bytes = await (await fetch(dataUrl)).arrayBuffer()
      await window.stash.fs.writeFileBytes(dialog.path, bytes)
      toastSuccess(`Saved ${fileNameOf(dialog.path)}`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionHeading>Content</SectionHeading>
          <span aria-live="polite" className="tnum text-[10.5px] text-faint">
            {text.length.toLocaleString()} chars
          </span>
        </div>
        <label htmlFor={contentId} className="sr-only">
          Content to encode in the QR code
        </label>
        <TextArea
          id={contentId}
          mono
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            'Paste a URL, plain text, or a WiFi string like:\nWIFI:T:WPA;S:NetworkName;P:password;;'
          }
          className="h-32"
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FieldRow label="Size" htmlFor={sizeId}>
            <Select
              id={sizeId}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-24"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} px
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="Error corr." htmlFor={ecId}>
            <Select
              id={ecId}
              value={ecLevel}
              onChange={(e) => setEcLevel(e.target.value as ErrorCorrectionLevel)}
              className="w-24"
            >
              {EC_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </FieldRow>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Button variant="primary" loading={generating} onClick={() => void generate()}>
            {hasGenerated ? 'Regenerate' : 'Generate'}
          </Button>
          <span className="text-[11px] text-faint">
            Encoded locally — nothing is uploaded or scanned by a server.
          </span>
        </div>
      </Panel>

      {error && !generating && <ErrorNote error={error} />}

      <div>
        <SectionHeading>Result</SectionHeading>
      </div>

      <Panel className="p-6">
        {hasGenerated ? (
          <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
            <img
              src={dataUrl}
              alt="Generated QR code"
              width={Math.min(width, 512)}
              height={Math.min(width, 512)}
              className="h-auto max-w-full rounded-sm"
              style={{ imageRendering: width > 512 ? 'auto' : 'pixelated' }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void copyImage()}>
                <Copy size={13} /> Copy image
              </Button>
              <Button size="sm" onClick={() => void saveImage()}>
                <Download size={13} /> Save…
              </Button>
            </div>
            <p className="tnum text-[10.5px] text-faint">
              {width} × {width} px · error correction {ecLevel}
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
            <p className="text-[12.5px] text-dim">Enter some content above and press Generate.</p>
            <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-relaxed text-faint">
              Higher error correction survives more damage and dirt but stores less data — level M
              suits most everyday codes.
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}
