import { useState } from 'react'
import { FieldRow, Select } from '../../components/ui/Inputs'
import { SingleFileMediaTool } from '../shared/media-tool'

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm']

const PRESET_OPTIONS = [
  { value: 28, label: 'Balanced (CRF 28)' },
  { value: 34, label: 'Aggressive (CRF 34)' },
  { value: 40, label: 'Max compression (CRF 40)' }
] as const

const DIMENSION_OPTIONS = [
  { value: 0, label: 'Original' },
  { value: 1920, label: '1080p' },
  { value: 1280, label: '720p' },
  { value: 480, label: '480p' }
] as const

export default function VideoCompressTool() {
  const [crf, setCrf] = useState(28)
  const [maxDimension, setMaxDimension] = useState(0)

  return (
    <SingleFileMediaTool
      toolId="video-compress"
      operation="compress"
      verb="Compressed"
      icon="film"
      accept={ACCEPTED_EXTENSIONS}
      dropLabel="Drop a video here"
      dropHint="MP4 · MOV · MKV · AVI · WebM — originals are never modified"
      dialogTitle="Choose a video to compress"
      emptyHint="Place ffmpeg.exe and ffprobe.exe into the resources/ffmpeg folder of this application, then reopen this tool."
      actionLabel="Compress video"
      progressLabel="video compression"
      renderOptions={() => (
        <>
          <FieldRow label="Preset" htmlFor="vcomp-preset">
            <Select
              id="vcomp-preset"
              value={crf}
              onChange={(e) => setCrf(Number(e.target.value))}
              className="w-56"
              aria-label="Compression preset"
            >
              {PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="Max size" htmlFor="vcomp-maxdim">
            <Select
              id="vcomp-maxdim"
              value={maxDimension}
              onChange={(e) => setMaxDimension(Number(e.target.value))}
              className="w-28"
              aria-label="Maximum resolution"
            >
              {DIMENSION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldRow>
        </>
      )}
      runRequest={(path, outputDir, fileName) =>
        window.stash.media.compressVideo({
          path,
          outputDir,
          crfQuality: crf,
          ...(maxDimension > 0 ? { maxDimension } : {}),
          ...(fileName ? { fileName } : {})
        })
      }
    />
  )
}
