/**
 * Audio waveform analysis, audio slicing, and PCM WAV encoding logic
 */

/**
 * Format seconds into MM:SS.mmm
 */
export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

/**
 * Extract normalized waveform peak values (0.0 to 1.0) from an AudioBuffer
 */
export function extractWaveformPeaks(channelData: Float32Array, targetPeakCount = 200): number[] {
  if (channelData.length === 0) return []

  const step = Math.floor(channelData.length / targetPeakCount) || 1
  const peaks: number[] = []

  for (let i = 0; i < targetPeakCount; i++) {
    const start = i * step
    const end = Math.min(start + step, channelData.length)
    let max = 0

    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j])
      if (val > max) max = val
    }
    peaks.push(Number(max.toFixed(3)))
  }

  return peaks
}

/**
 * Slice an AudioBuffer and apply optional fade-in / fade-out
 */
export function sliceAudioBuffer(
  audioCtx: AudioContext,
  sourceBuffer: AudioBuffer,
  startSec: number,
  endSec: number,
  fadeInSec = 0,
  fadeOutSec = 0
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate
  const numChannels = sourceBuffer.numberOfChannels

  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(sourceBuffer.length, Math.floor(endSec * sampleRate))
  const sliceLength = Math.max(1, endSample - startSample)

  const newBuffer = audioCtx.createBuffer(numChannels, sliceLength, sampleRate)

  for (let c = 0; c < numChannels; c++) {
    const sourceData = sourceBuffer.getChannelData(c)
    const targetData = newBuffer.getChannelData(c)

    for (let i = 0; i < sliceLength; i++) {
      let sample = sourceData[startSample + i]

      // Apply Fade In
      if (fadeInSec > 0) {
        const fadeSamples = Math.floor(fadeInSec * sampleRate)
        if (i < fadeSamples) {
          sample *= i / fadeSamples
        }
      }

      // Apply Fade Out
      if (fadeOutSec > 0) {
        const fadeSamples = Math.floor(fadeOutSec * sampleRate)
        const fadeStart = sliceLength - fadeSamples
        if (i >= fadeStart) {
          sample *= (sliceLength - i) / fadeSamples
        }
      }

      targetData[i] = sample
    }
  }

  return newBuffer
}

/**
 * Encode an AudioBuffer to standard 16-bit PCM WAV bytes
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample

  const dataLength = buffer.length * blockAlign
  const headerLength = 44
  const wavBytes = new Uint8Array(headerLength + dataLength)
  const view = new DataView(wavBytes.buffer)

  // Write RIFF identifier
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')

  // Write fmt sub-chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true) // AudioFormat
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // ByteRate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // Write data sub-chunk
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  // Interleave channel samples
  const channelData: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c))
  }

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      // Clamp between -1 and 1
      const sample = Math.max(-1, Math.min(1, channelData[c][i]))
      // Convert to 16-bit integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return wavBytes
}
