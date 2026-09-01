/**
 * Audio loudness normalization, RMS / Peak gain scaling, and WAV encoder
 */

import { encodeAudioBufferToWav } from '../audio-trimmer/logic'

export type NormalizationTarget =
  'peak-0db' | 'peak-1db' | 'spotify-14' | 'apple-16' | 'broadcast-23' | 'custom'

export interface LoudnessProfile {
  id: NormalizationTarget
  name: string
  targetDbfs: number
  description: string
}

export const LOUDNESS_PROFILES: LoudnessProfile[] = [
  {
    id: 'peak-0db',
    name: 'Peak (-0.1 dBFS)',
    targetDbfs: -0.1,
    description: 'Maximum volume without digital clipping'
  },
  {
    id: 'peak-1db',
    name: 'Peak (-1.0 dBFS)',
    targetDbfs: -1.0,
    description: 'Safe headroom for lossy MP3/AAC compression'
  },
  {
    id: 'spotify-14',
    name: 'Streaming (-14 LUFS / RMS)',
    targetDbfs: -14.0,
    description: 'Target loudness for Spotify, YouTube, and Web'
  },
  {
    id: 'apple-16',
    name: 'Apple Music (-16 LUFS)',
    targetDbfs: -16.0,
    description: 'Optimized dynamic range for Apple Music & Podcasts'
  },
  {
    id: 'broadcast-23',
    name: 'EBU R128 (-23 LUFS)',
    targetDbfs: -23.0,
    description: 'Broadcast television & cinema loudness standard'
  }
]

/**
 * Measure maximum peak amplitude and RMS level of an AudioBuffer
 */
export function analyzeAudioBuffer(buffer: AudioBuffer): {
  maxPeak: number
  peakDbfs: number
  rmsDbfs: number
} {
  let maxPeak = 0
  let sumSquares = 0
  let totalSamples = 0

  const numChannels = buffer.numberOfChannels
  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      if (abs > maxPeak) maxPeak = abs
      sumSquares += data[i] * data[i]
      totalSamples++
    }
  }

  const rms = totalSamples > 0 ? Math.sqrt(sumSquares / totalSamples) : 0
  const peakDbfs = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -100
  const rmsDbfs = rms > 0 ? 20 * Math.log10(rms) : -100

  return {
    maxPeak: Number(maxPeak.toFixed(4)),
    peakDbfs: Number(peakDbfs.toFixed(2)),
    rmsDbfs: Number(rmsDbfs.toFixed(2))
  }
}

/**
 * Normalize an AudioBuffer to target dBFS
 */
export function normalizeAudioBuffer(
  audioCtx: AudioContext,
  sourceBuffer: AudioBuffer,
  targetDbfs: number,
  mode: 'peak' | 'rms' = 'peak'
): { normalizedBuffer: AudioBuffer; appliedGainDb: number } {
  const { peakDbfs, rmsDbfs } = analyzeAudioBuffer(sourceBuffer)
  const currentDb = mode === 'rms' ? rmsDbfs : peakDbfs

  const appliedGainDb = targetDbfs - currentDb
  const gainLinear = Math.pow(10, appliedGainDb / 20)

  const numChannels = sourceBuffer.numberOfChannels
  const length = sourceBuffer.length
  const sampleRate = sourceBuffer.sampleRate

  const newBuffer = audioCtx.createBuffer(numChannels, length, sampleRate)

  for (let c = 0; c < numChannels; c++) {
    const sourceData = sourceBuffer.getChannelData(c)
    const targetData = newBuffer.getChannelData(c)

    for (let i = 0; i < length; i++) {
      // Apply linear gain with soft-clipping protection
      let sample = sourceData[i] * gainLinear
      if (sample > 0.99) {
        sample = 0.99 + 0.01 * Math.tanh((sample - 0.99) / 0.01)
      } else if (sample < -0.99) {
        sample = -0.99 + 0.01 * Math.tanh((sample + 0.99) / 0.01)
      }
      targetData[i] = sample
    }
  }

  return {
    normalizedBuffer: newBuffer,
    appliedGainDb: Number(appliedGainDb.toFixed(2))
  }
}

export { encodeAudioBufferToWav }
