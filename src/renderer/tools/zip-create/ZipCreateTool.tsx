import { useState } from 'react'
import { Archive } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  ErrorNote,
  Panel,
  ProgressBar,
  SectionHeading,
  SuccessNote
} from '../../components/ui/Feedback'
import { DropZone } from '../../components/ui/DropZone'
import { OutputNameField } from '../shared/OutputNameField'
import { validateOutputName } from '../shared/output-name'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { ZipCreateResult } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { FileListPanel } from '../shared/file-list-panel'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { fileNameOf, useFileList } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

export default function ZipCreateTool() {
  const { items, addPaths, removePath, clearAll } = useFileList()
  const [zipping, setZipping] = useState(false)
  const [result, setResult] = useState<(ZipCreateResult & { target: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const [outputName, setOutputName] = useState('archive.zip')

  const outputCheck = validateOutputName(outputName, '.zip')
  const nameError = outputCheck.ok ? null : outputCheck.error

  const canRun = items.length > 0 && !zipping && outputCheck.ok

  const createArchive = async (): Promise<void> => {
    setZipping(true)
    setError(null)
    setResult(null)
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: outputName,
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
        title: 'Save archive as…'
      })
      if (dialog.cancelled || !dialog.path) return
      const res = await window.stash.archives.createZip({
        paths: items.map((item) => item.path),
        targetZip: dialog.path
      })
      setResult({ ...res, target: dialog.path })
      toastSuccess(
        `Packed ${res.fileCount} file${res.fileCount === 1 ? '' : 's'}`,
        `${fileNameOf(dialog.path)} · ${formatBytes(res.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'zip-create',
        operation: 'create-archive',
        inputs: items.map((item) => fileNameOf(item.path)),
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'zip-create',
        operation: 'create-archive',
        inputs: items.map((item) => fileNameOf(item.path)),
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
      toastError(err)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <DropZone
          multiple
          label="Drop files here to pack into a zip archive"
          hint="Any mix of files · compressed locally into a single .zip · click to browse"
          dialogTitle="Choose files to pack into an archive"
          onFiles={addPaths}
        />
      ) : (
        <>
          <DropZone
            multiple
            label="Drop more files to add to archive"
            hint="Click to browse or drop additional files"
            dialogTitle="Choose additional files to pack"
            onFiles={addPaths}
          />
          <FileListPanel
            items={items}
            onRemove={removePath}
            onClearAll={clearAll}
            heading="Files to pack"
          />
        </>
      )}

      <Panel className="p-3.5">
        <SectionHeading>Archive</SectionHeading>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
          You'll pick the save location when you press Create. Duplicate file names are kept apart
          with a numeric suffix inside the archive.
        </p>
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <OutputNameField value={outputName} onChange={setOutputName} error={nameError} />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              loading={zipping}
              disabled={!canRun}
              onClick={() => void createArchive()}
            >
              <Archive size={13} /> Create archive…
            </Button>
            {!canRun && !zipping && (
              <span className="text-[11px] text-faint">
                {nameError ?? 'Add at least one file first.'}
              </span>
            )}
          </div>
        </div>
      </Panel>

      {zipping && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={null} indeterminate label="Creating archive" />
          <p className="tnum text-[11.5px] text-faint">Compressing {items.length} files…</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SuccessNote
              message={`Created ${fileNameOf(result.target)} — ${result.fileCount} file${
                result.fileCount === 1 ? '' : 's'
              }, ${formatBytes(result.bytesWritten)}`}
            />
          </div>
          <RevealButton path={result.target} />
          <CopyPathButton path={result.target} />
        </div>
      )}
    </div>
  )
}
