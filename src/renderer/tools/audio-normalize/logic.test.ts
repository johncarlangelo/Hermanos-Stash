import { describe, expect, it } from 'vitest'
import { analyzeAudioBuffer, LOUDNESS_PROFILES } from './logic'

describe('audio-normalize logic', () => {
  it('analyzes peak dBFS and RMS of mock AudioBuffer', () => {
    // 0.5 amplitude = -6.02 dBFS
    const samples = new Float32Array([0.5, -0.5, 0.5, -0.5])
    const mockBuffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 4,
      getChannelData: () => samples
    } as unknown as AudioBuffer

    const stats = analyzeAudioBuffer(mockBuffer)
    expect(stats.maxPeak).toBe(0.5)
    expect(stats.peakDbfs).toBeCloseTo(-6.02, 1)
  })

  it('contains standard platform loudness targets', () => {
    const spotify = LOUDNESS_PROFILES.find((p) => p.id === 'spotify-14')
    expect(spotify?.targetDbfs).toBe(-14.0)

    const broadcast = LOUDNESS_PROFILES.find((p) => p.id === 'broadcast-23')
    expect(broadcast?.targetDbfs).toBe(-23.0)
  })
})
