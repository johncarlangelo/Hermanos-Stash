import { useState } from 'react'
import { FieldRow, Select } from '../../components/ui/Inputs'
import { SingleFileMediaTool } from '../shared/media-tool'

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm']

export default function VideoGifTool() {
  const [fps, setFps] = useState(15)
  const [maxWidth, setMaxWidth] = useState(480)

  return (
    <SingleFileMediaTool
      toolId="video-to-gif"
      operation="gif"
      verb="Built GIF for"
      icon="film"
      accept={ACCEPTED_EXTENSIONS}
      dropLabel="Drop a video here"
      dropHint="Short clips work best — the whole clip becomes an animation"
      dialogTitle="Choose a video to turn into a GIF"
      emptyHint="Place ffmpeg.exe and ffprobe.exe into the resources/ffmpeg folder of this application, then reopen this tool."
      actionLabel="Create GIF"
      progressLabel="GIF creation"
      note="GIFs store every frame uncompressed — expect noticeably larger files than video."
      renderOptions={() => (
        <>
          <FieldRow label="Frame rate" htmlFor="gif-fps">
            <Select
              id="gif-fps"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-28"
              aria-label="Frames per second"
            >
              {[10, 15, 24].map((value) => (
                <option key={value} value={value}>
                  {value} fps
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="Width" htmlFor="gif-width">
            <Select
              id="gif-width"
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="w-28"
              aria-label="Maximum width"
            >
              {[320, 480, 640].map((value) => (
                <option key={value} value={value}>
                  {value} px
                </option>
              ))}
            </Select>
          </FieldRow>
        </>
      )}
      runRequest={(path, outputDir) =>
        window.stash.media.videoToGif({ path, outputDir, fps, maxWidth })
      }
    />
  )
}
