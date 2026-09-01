import { describe, expect, it } from 'vitest'
import { encodeAudioBufferToWav, extractWaveformPeaks, formatAudioTime } from './logic'

describe('audio-trimmer logic', () => {
  it('formats audio timestamps into mm:ss.ms', () => {
    expect(formatAudioTime(0)).toBe('00:00.00')
    expect(formatAudioTime(75.5)).toBe('01:15.50')
    expect(formatAudioTime(130.25)).toBe('02:10.25')
  })

  it('extracts peak arrays for waveform rendering', () => {
    const rawSamples = new Float32Array([0.1, 0.5, 0.9, -0.8, 0.2, -0.4])
    const peaks = extractWaveformPeaks(rawSamples, 3)
    expect(peaks.length).toBe(3)
    expect(peaks[0]).toBeGreaterThan(0)
  })

  it('encodes mock AudioBuffer into valid RIFF WAVE bytes', () => {
    const mockAudioBuffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 1000,
      getChannelData: () => new Float32Array(1000)
    } as unknown as AudioBuffer

    const wav = encodeAudioBufferToWav(mockAudioBuffer)
    expect(wav.length).toBe(44 + 1000 * 2)

    // Check RIFF header magic bytes
    const str = String.fromCharCode(...wav.slice(0, 4))
    expect(str).toBe('RIFF')
    const waveStr = String.fromCharCode(...wav.slice(8, 12))
    expect(waveStr).toBe('WAVE')
  })
})
