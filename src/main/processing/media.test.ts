import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  AUDIO_EXTENSION_BY_CODEC,
  buildScaleFilter,
  clampBitrateKbps,
  clampCrf,
  convertVideo,
  extractAudio,
  outTimeStringToSeconds,
  parseFfmpegProgressLine,
  parseFfprobeJson,
  progressRatioFromLine,
  runFfmpeg,
  verifyMediaInfo,
  type MediaToolsContext
} from './media'

// Realistic ffprobe output for a short H.264 + AAC MP4.
const FFPROBE_FIXTURE = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: 'h264',
      codec_type: 'video',
      width: 1280,
      height: 720,
      pix_fmt: 'yuv420p',
      r_frame_rate: '30000/1001',
      avg_frame_rate: '30000/1001',
      duration: '0.500500',
      nb_frames: '15'
    },
    {
      index: 1,
      codec_name: 'aac',
      codec_type: 'audio',
      sample_fmt: 'fltp',
      sample_rate: '48000',
      channels: 2,
      channel_layout: 'stereo',
      duration: '0.544000'
    },
    { index: 2, codec_name: 'mov_text', codec_type: 'subtitle' }
  ],
  format: {
    filename: 'sample.mp4',
    nb_streams: 3,
    format_name: 'mov,mp4,m4a,3gp,m4a,3g2,mj2',
    duration: '0.512000',
    size: '48256',
    bit_rate: '754000'
  }
})

describe('parseFfprobeJson', () => {
  it('parses a realistic fixture into sanitized MediaInfo', () => {
    const info = parseFfprobeJson(FFPROBE_FIXTURE)
    expect(info.durationSec).toBeCloseTo(0.512, 3)
    expect(info.formatName).toBe('mov,mp4,m4a,3gp,m4a,3g2,mj2')
    expect(info.bitrate).toBe(754000)
    expect(info.sizeBytes).toBe(48256)
    expect(info.streams).toHaveLength(3)
    expect(info.streams[0]).toMatchObject({
      type: 'video',
      codec: 'h264',
      width: 1280,
      height: 720
    })
    expect(info.streams[1]).toMatchObject({
      type: 'audio',
      codec: 'aac',
      sampleRate: 48000,
      channels: 2
    })
    // Subtitle stream is neither video nor audio.
    expect(info.streams[2]!.type).toBe('other')
  })

  it('tolerates missing sections', () => {
    expect(parseFfprobeJson('{}')).toEqual({ streams: [] })
  })

  it('throws on malformed JSON', () => {
    expect(() => parseFfprobeJson('not json')).toThrow(/valid JSON/)
  })
})

describe('parseFfmpegProgressLine', () => {
  it('parses key=value pairs', () => {
    expect(parseFfmpegProgressLine('frame=42')).toEqual({ key: 'frame', value: '42' })
    expect(parseFfmpegProgressLine('out_time_us=250000')).toEqual({
      key: 'out_time_us',
      value: '250000'
    })
  })

  it('rejects non-progress lines', () => {
    expect(parseFfmpegProgressLine('')).toBeNull()
    expect(parseFfmpegProgressLine('no equals sign here')).toBeNull()
    expect(parseFfmpegProgressLine('=novalue')).toBeNull()
  })
})

describe('progressRatioFromLine', () => {
  it('computes ratios from microseconds timestamps', () => {
    expect(progressRatioFromLine('out_time_us', '250000', 1)).toBeCloseTo(0.25)
    expect(progressRatioFromLine('out_time_ms', '500000', 1)).toBeCloseTo(0.5)
  })

  it('computes ratios from wall-clock timestamps', () => {
    expect(progressRatioFromLine('out_time', '00:00:01.000000', 2)).toBeCloseTo(0.5)
  })

  it('clamps into 0..1 and returns null when duration unknown', () => {
    expect(progressRatioFromLine('out_time_us', '999999999', 1)).toBe(1)
    expect(progressRatioFromLine('out_time_us', '-100', 1)).toBe(0)
    expect(progressRatioFromLine('out_time_us', '500000', null)).toBeNull()
    expect(progressRatioFromLine('frame', '10', 1)).toBeNull()
  })
})

describe('outTimeStringToSeconds', () => {
  it('parses HH:MM:SS.micros', () => {
    expect(outTimeStringToSeconds('00:01:02.500000')).toBeCloseTo(62.5)
    expect(outTimeStringToSeconds('01:00:00.000000')).toBe(3600)
  })

  it('returns null for garbage', () => {
    expect(outTimeStringToSeconds('N/A')).toBeNull()
    expect(outTimeStringToSeconds('12:34')).toBeNull()
  })
})

describe('option clamps', () => {
  it('clamps CRF into the ffmpeg-valid range with fallbacks', () => {
    expect(clampCrf(undefined, 23)).toBe(23)
    expect(clampCrf(-5, 23)).toBe(0)
    expect(clampCrf(99, 28)).toBe(51)
    expect(clampCrf(27.6, 23)).toBe(28)
  })

  it('clamps audio bitrate into 32..320 kbps', () => {
    expect(clampBitrateKbps(undefined)).toBeUndefined()
    expect(clampBitrateKbps(8)).toBe(32)
    expect(clampBitrateKbps(600)).toBe(320)
    expect(clampBitrateKbps(191.9)).toBe(192)
  })
})

describe('buildScaleFilter', () => {
  it('caps the larger edge while preserving aspect ratio', () => {
    expect(buildScaleFilter(720)).toBe(
      "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))'"
    )
  })

  it('rejects nonsensical dimensions', () => {
    expect(buildScaleFilter(8)).toBeNull()
    expect(buildScaleFilter(720.5)).toBeNull()
  })
})

describe('verifyMediaInfo', () => {
  const videoInfo = parseFfprobeJson(FFPROBE_FIXTURE)

  /** stashError throws plain objects, so assert via a catching wrapper. */
  function catchStash(fn: () => unknown): { code: string; userMessage: string } | null {
    try {
      fn()
      return null
    } catch (err) {
      return err as { code: string; userMessage: string }
    }
  }

  it('accepts matching kind and duration', () => {
    const summary = verifyMediaInfo(videoInfo, { kind: 'video', expectedDurationSec: 0.5 })
    expect(summary.verified).toBe(true)
    expect(summary.actualDurationSec).toBeCloseTo(0.512)
  })

  it('accepts within ±10% tolerance but rejects beyond it', () => {
    expect(
      catchStash(() => verifyMediaInfo(videoInfo, { kind: 'video', expectedDurationSec: 0.55 }))
    ).toBeNull()
    const thrown = catchStash(() =>
      verifyMediaInfo(videoInfo, { kind: 'video', expectedDurationSec: 2 })
    )
    expect(thrown?.code).toBe('UNSUPPORTED')
    expect(thrown?.userMessage).toMatch(/unexpected length/)
  })

  it('rejects mismatched kinds and bad GIF containers', () => {
    const silentVideo = {
      ...videoInfo,
      streams: videoInfo.streams.filter((s) => s.type === 'video')
    }
    expect(catchStash(() => verifyMediaInfo(silentVideo, { kind: 'audio' }))?.userMessage).toMatch(
      /valid audio file/
    )
    const gifLike = { formatName: 'gif', streams: [{ type: 'video' as const }] }
    expect(catchStash(() => verifyMediaInfo(gifLike, { kind: 'gif' }))).toBeNull()
    expect(
      catchStash(() =>
        verifyMediaInfo(
          { formatName: 'png_pipe', streams: [{ type: 'video' as const }] },
          { kind: 'gif' }
        )
      )?.userMessage
    ).toMatch(/valid GIF animation/)
  })
})

describe('AUDIO_EXTENSION_BY_CODEC', () => {
  it('maps AAC to .m4a containers', () => {
    expect(AUDIO_EXTENSION_BY_CODEC['aac']).toBe('.m4a')
    expect(AUDIO_EXTENSION_BY_CODEC['opus']).toBe('.opus')
  })
})

// --- Integration (only when real binaries resolve at resources/ffmpeg) ------

describe('media integration', () => {
  const repoBinDir = path.resolve(process.cwd(), 'resources/ffmpeg')

  async function resolveTestContext(): Promise<MediaToolsContext | null> {
    const names = ['ffmpeg.exe', 'ffmpeg'].filter(
      (name) => !name.endsWith('.exe') || process.platform === 'win32'
    )
    const probeNames = ['ffprobe.exe', 'ffprobe'].filter(
      (name) => !name.endsWith('.exe') || process.platform === 'win32'
    )
    for (const ffmpegName of names) {
      for (const ffprobeName of probeNames) {
        try {
          await fs.access(path.join(repoBinDir, ffmpegName))
          await fs.access(path.join(repoBinDir, ffprobeName))
          return {
            ffmpegPath: path.join(repoBinDir, ffmpegName),
            ffprobePath: path.join(repoBinDir, ffprobeName)
          }
        } catch {
          // Try next name pair.
        }
      }
    }
    return null
  }

  it.runIf(process.platform === 'win32')(
    'round-trips a tiny clip end to end',
    async () => {
      // Existence guard so CI without binaries stays green.
      const localCtx = await resolveTestContext()
      if (localCtx === null) return

      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stash-media-test-'))
      try {
        const source = path.join(workDir, 'src.mp4')
        // 0.5s color test source with silent audio track.
        await runFfmpeg({
          ffmpegPath: localCtx.ffmpegPath,
          args: [
            '-f',
            'lavfi',
            '-i',
            'testsrc=duration=0.5:size=160x120:rate=30',
            '-f',
            'lavfi',
            '-i',
            'anullsrc=r=48000:cl=stereo',
            '-shortest',
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-c:a',
            'aac',
            '-t',
            '0.5',
            source
          ],
          totalDurationSec: null,
          sourceName: 'src.mp4'
        })

        // Convert to WebM and verify by re-probing.
        const webm = path.join(workDir, 'out.webm')
        const converted = await convertVideo(localCtx, source, webm, {
          format: 'webm',
          crfQuality: 35
        })
        expect(converted.verified).toBe(true)
        expect(converted.bytesWritten).toBeGreaterThan(0)

        // Extract WAV audio; duration must be ≈0.5s ±0.2s.
        const wav = path.join(workDir, 'out.wav')
        const extracted = await extractAudio(localCtx, source, wav, { codec: 'wav' })
        expect(extracted.verified).toBe(true)
        expect(extracted.info.durationSec).toBeGreaterThan(0.3)
        expect(extracted.info.durationSec!).toBeLessThan(0.7)
      } finally {
        await fs.rm(workDir, { recursive: true, force: true })
      }
    },
    15000
  )
})
