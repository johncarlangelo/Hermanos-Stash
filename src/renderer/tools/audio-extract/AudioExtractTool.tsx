import { useState } from 'react'
import { FieldRow, Select } from '../../components/ui/Inputs'
import type { AudioCodec } from '../../../shared/ipc'
import { SingleFileMediaTool } from '../shared/media-tool'

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm']

const CODEC_OPTIONS: Array<{ value: AudioCodec; label: string }> = [
  { value: 'aac', label: 'AAC (.m4a)' },
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV (lossless)' },
  { value: 'flac', label: 'FLAC (lossless)' },
  { value: 'opus', label: 'Opus' }
]

const LOSSY_CODECS: readonly AudioCodec[] = ['aac', 'mp3', 'opus']
const BITRATE_OPTIONS = [128, 192, 256, 320] as const

export default function AudioExtractTool() {
  const [codec, setCodec] = useState<AudioCodec>('aac')
  const [bitrate, setBitrate] = useState(192)
  const lossy = LOSSY_CODECS.includes(codec)

  return (
    <SingleFileMediaTool
      toolId="extract-audio"
      operation="extract-audio"
      verb="Extracted audio from"
      icon="music"
      accept={ACCEPTED_EXTENSIONS}
      dropLabel="Drop a video here"
      dropHint="MP4 · MOV · MKV · AVI · WebM — saves the soundtrack on its own"
      dialogTitle="Choose a video to extract audio from"
      emptyHint="Place ffmpeg.exe and ffprobe.exe into the resources/ffmpeg folder of this application, then reopen this tool."
      actionLabel="Extract audio"
      progressLabel="audio extraction"
      renderOptions={() => (
        <>
          <FieldRow
            label="Format"
            htmlFor="aext-codec"
            hint="WAV and FLAC are lossless; MP3, AAC and Opus trade a little fidelity for much smaller files."
          >
            <Select
              id="aext-codec"
              value={codec}
              onChange={(e) => setCodec(e.target.value as AudioCodec)}
              className="w-44"
            >
              {CODEC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldRow>
          {lossy && (
            <FieldRow
              label="Bitrate"
              htmlFor="aext-bitrate"
              hint="Higher bitrates sound better but take more space. 192 kbps is plenty for most listening. Lossless formats ignore this."
            >
              <Select
                id="aext-bitrate"
                value={bitrate}
                onChange={(e) => setBitrate(Number(e.target.value))}
                className="w-28"
              >
                {BITRATE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} kbps
                  </option>
                ))}
              </Select>
            </FieldRow>
          )}
        </>
      )}
      runRequest={(path, outputDir, fileName) =>
        window.stash.media.extractAudio({
          path,
          outputDir,
          codec,
          ...(lossy ? { bitrateKbps: bitrate } : {}),
          ...(fileName ? { fileName } : {})
        })
      }
    />
  )
}
