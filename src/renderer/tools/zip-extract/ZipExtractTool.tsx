import { useState } from 'react'
import { FolderOutput } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  EmptyState,
  ErrorNote,
  Panel,
  SectionHeading,
  SuccessNote
} from '../../components/ui/Feedback'
import { FieldRow } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { ZipExtractResult } from '../../../shared/ipc'
import { toastError, toastSuccess } from '../../stores/toasts'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

export default function ZipExtractTool() {
  const [zipPath, setZipPath] = useState<string | null>(null)
  const [destination, setDestination] = useOutputDir('zip-extract')
  const [extracting, setExtracting] = useState(false)
  const [result, setResult] = useState<(ZipExtractResult & { outputDir: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)

  const canRun = zipPath !== null && destination !== '' && !extracting

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose extraction folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const extract = async (): Promise<void> => {
    if (!zipPath || !destination) return
    setExtracting(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.stash.archives.extractZip({ zipPath, outputDir: destination })
      setResult({ ...res, outputDir: destination })
      toastSuccess(
        `Extracted ${res.extractedCount} file${res.extractedCount === 1 ? '' : 's'}`,
        res.skipped.length > 0
          ? `${res.skipped.length} unsafe entr${res.skipped.length === 1 ? 'y' : 'ies'} skipped.`
          : undefined
      )
      recordHistoryQuietly({
        toolId: 'zip-extract',
        operation: 'extract-archive',
        inputs: [fileNameOf(zipPath)],
        outputs: [fileNameOf(destination)],
        status: 'success',
        ...(res.skipped.length > 0 ? { message: `${res.skipped.length} entries skipped` } : {})
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'zip-extract',
        operation: 'extract-archive',
        inputs: [fileNameOf(zipPath)],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
      toastError(err)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DropZone
        accept={['.zip']}
        label={zipPath ? `Replace ${fileNameOf(zipPath)}` : 'Drop a .zip archive here'}
        hint="One archive at a time · click to browse"
        dialogTitle="Choose a ZIP archive to extract"
        onFiles={(paths) => {
          setZipPath(paths[0] ?? null)
          setResult(null)
          setError(null)
        }}
      />

      {!zipPath && (
        <EmptyState
          icon="folder"
          title="No archive selected yet."
          hint="Drop or browse for a .zip file above and choose where its contents should go. Unsafe paths inside archives are detected and skipped automatically."
        />
      )}

      <Panel className="p-3.5">
        <SectionHeading>Extraction</SectionHeading>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
          Contents are unpacked into the folder you choose, recreating any subfolders from the
          archive.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <FieldRow label="Extract to">
            <Button size="sm" onClick={() => void chooseDestination()}>
              Choose folder…
            </Button>
          </FieldRow>
          {destination && (
            <span
              className="min-w-0 max-w-56 truncate font-mono text-[11px] text-faint"
              title={destination}
            >
              {destination}
            </span>
          )}
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <Button
            variant="primary"
            loading={extracting}
            disabled={!canRun}
            onClick={() => void extract()}
          >
            <FolderOutput size={13} /> Extract
          </Button>
        </div>
      </Panel>

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SuccessNote
                message={`Extracted ${result.extractedCount} file${
                  result.extractedCount === 1 ? '' : 's'
                } into ${result.topLevelCount} top-level item${result.topLevelCount === 1 ? '' : 's'}.`}
              />
            </div>
            <RevealButton path={result.outputDir} />
            <CopyPathButton path={result.outputDir} />
          </div>
          {result.skipped.length > 0 && (
            <>
              <SectionHeading>Skipped (unsafe paths)</SectionHeading>
              <ul className="flex flex-col gap-1">
                {result.skipped.map((name) => (
                  <li
                    key={name}
                    className="truncate font-mono text-[11.5px] text-warn"
                    title={name}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
