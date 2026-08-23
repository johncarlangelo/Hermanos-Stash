import { useState } from 'react'
import { FieldRow, Select } from '../../components/ui/Inputs'
import type { AudioCodec } from '../../../shared/ipc'
import { SingleFileMediaTool } from '../shared/media-tool'

const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus']

const CODEC_OPTIONS: Array<{ value: AudioCodec; label: string }> = [
  { value: 'aac', label: 'AAC (.m4a)' },
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV (lossless)' },
  { value: 'flac', label: 'FLAC (lossless)' },
  { value: 'opus', label: 'Opus' }
]

const LOSSY_CODECS: readonly AudioCodec[] = ['aac', 'mp3', 'opus']
const BITRATE_OPTIONS = [128, 192, 256, 320] as const

export default function AudioConvertTool() {
  const [codec, setCodec] = useState<AudioCodec>('mp3')
  const [bitrate, setBitrate] = useState(192)
  const lossy = LOSSY_CODECS.includes(codec)

  return (
    <SingleFileMediaTool
      toolId="audio-convert"
      operation="convert"
      verb="Converted"
      icon="music"
      accept={ACCEPTED_EXTENSIONS}
      dropLabel="Drop an audio file here"
      dropHint="MP3 · WAV · FLAC · M4A · AAC · OGG · Opus"
      dialogTitle="Choose an audio file to convert"
      emptyHint="Place ffmpeg.exe and ffprobe.exe into the resources/ffmpeg folder of this application, then reopen this tool."
      actionLabel={`Convert to ${codec.toUpperCase()}`}
      progressLabel="audio conversion"
      renderOptions={() => (
        <>
          <FieldRow label="Format" htmlFor="aconv-codec">
            <Select
              id="aconv-codec"
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
            <FieldRow label="Bitrate" htmlFor="aconv-bitrate">
              <Select
                id="aconv-bitrate"
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
      runRequest={(path, outputDir) =>
        window.stash.media.convertAudio({
          path,
          outputDir,
          codec,
          ...(lossy ? { bitrateKbps: bitrate } : {})
        })
      }
    />
  )
}
