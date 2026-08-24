import { useState } from 'react'
import { FieldRow, Select } from '../../components/ui/Inputs'
import type { VideoOutputFormat } from '../../../shared/ipc'
import { SingleFileMediaTool } from '../shared/media-tool'

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm']

const FORMAT_OPTIONS: Array<{ value: VideoOutputFormat; label: string }> = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'mkv', label: 'MKV' }
]

export default function VideoConvertTool() {
  const [format, setFormat] = useState<VideoOutputFormat>('mp4')
  const [crf, setCrf] = useState(23)

  return (
    <SingleFileMediaTool
      toolId="video-convert"
      operation="convert"
      verb="Converted"
      icon="film"
      accept={ACCEPTED_EXTENSIONS}
      dropLabel="Drop a video here"
      dropHint="MP4 · MOV · MKV · AVI · WebM — re-encoded locally with FFmpeg"
      dialogTitle="Choose a video to convert"
      emptyHint="Place ffmpeg.exe and ffprobe.exe into the resources/ffmpeg folder of this application, then reopen this tool."
      actionLabel={`Convert to ${FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? format}`}
      progressLabel="video conversion"
      renderOptions={() => (
        <>
          <FieldRow
            label="Format"
            htmlFor="vconv-format"
            hint="MP4 plays almost everywhere. WebM and MKV suit web use or archiving."
          >
            <Select
              id="vconv-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as VideoOutputFormat)}
              className="w-28"
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow
            label="Quality"
            htmlFor="vconv-crf"
            hint="Lower values keep more detail but produce larger files. 18-23 looks near-original; above 30 gets visibly soft."
          >
            <input
              id="vconv-crf"
              type="range"
              min={18}
              max={40}
              step={1}
              value={crf}
              aria-label={`Quality, CRF ${crf}. Lower CRF means better quality.`}
              onChange={(e) => setCrf(Number(e.target.value))}
              className="w-40 cursor-pointer accent-accent"
            />
            <span className="tnum w-12 text-[12px] text-dim" title="Constant Rate Factor">
              CRF {crf}
            </span>
          </FieldRow>
        </>
      )}
      runRequest={(path, outputDir, fileName) =>
        window.stash.media.convertVideo({
          path,
          outputDir,
          format,
          crfQuality: crf,
          ...(fileName ? { fileName } : {})
        })
      }
    />
  )
}
