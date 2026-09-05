import { useEffect, useRef, useState } from 'react'
import { Download, Music, Pause, Play, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  encodeAudioBufferToWav,
  extractWaveformPeaks,
  formatAudioTime,
  sliceAudioBuffer
} from './logic'

export default function AudioTrimmerTool() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [duration, setDuration] = useState<number>(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [endTime, setEndTime] = useState<number>(0)
  const [fadeIn, setFadeIn] = useState<number>(0)
  const [fadeOut, setFadeOut] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [peaks, setPeaks] = useState<number[]>([])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AudioCtxClass()
    }
    return audioCtxRef.current
  }

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setFileName(file.name)

    try {
      const arrayBuf = await file.arrayBuffer()
      const ctx = getAudioContext()
      const decoded = await ctx.decodeAudioData(arrayBuf)
      setAudioBuffer(decoded)
      setDuration(decoded.duration)
      setStartTime(0)
      setEndTime(decoded.duration)

      const channelData = decoded.getChannelData(0)
      const extracted = extractWaveformPeaks(channelData, 240)
      setPeaks(extracted)
      toastSuccess(`Loaded audio (${decoded.duration.toFixed(1)}s)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to decode audio: ${message}`)
    }
  }

  const loadDemo = () => {
    const ctx = getAudioContext()
    const sampleRate = ctx.sampleRate
    const demoDur = 6.0
    const buffer = ctx.createBuffer(2, sampleRate * demoDur, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate
        // Melodic arpeggiator chord synth demo
        const noteFreq = [261.63, 329.63, 392.0, 523.25][Math.floor(t * 4) % 4]
        data[i] =
          Math.sin(2 * Math.PI * noteFreq * t) * 0.3 * Math.exp(-((t * 4) % 1) * 3) +
          Math.sin(2 * Math.PI * (noteFreq / 2) * t) * 0.15
      }
    }

    setAudioBuffer(buffer)
    setFileName('synth-arpeggio-demo.wav')
    setDuration(demoDur)
    setStartTime(1.0)
    setEndTime(5.0)

    const channelData = buffer.getChannelData(0)
    setPeaks(extractWaveformPeaks(channelData, 240))
  }

  // Draw Waveform Canvas with Range Overlay
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0 || duration === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#09090b'
    ctx.fillRect(0, 0, w, h)

    // Calculate selection bounds
    const startX = (startTime / duration) * w
    const endX = (endTime / duration) * w

    // Highlight selected area
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(startX, 0, endX - startX, h)

    // Center line
    ctx.strokeStyle = '#27272a'
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    // Draw peaks bars
    const barWidth = w / peaks.length
    peaks.forEach((peak, i) => {
      const x = i * barWidth
      const barH = Math.max(2, peak * (h * 0.8))
      const isSelected = x >= startX && x <= endX

      ctx.fillStyle = isSelected ? '#3b82f6' : '#52525b'
      ctx.fillRect(x, (h - barH) / 2, Math.max(1, barWidth - 1), barH)
    })

    // Draw start & end markers
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, 0)
    ctx.lineTo(startX, h)
    ctx.moveTo(endX, 0)
    ctx.lineTo(endX, h)
    ctx.stroke()
  }, [peaks, duration, startTime, endTime])

  const stopPlayback = () => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop()
      } catch {
        // audio source may already be stopped
      }
      currentSourceRef.current = null
    }
    setIsPlaying(false)
  }

  const playRange = () => {
    if (!audioBuffer) return
    stopPlayback()
    const ctx = getAudioContext()
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    const offset = startTime
    const playDuration = Math.max(0.1, endTime - startTime)

    source.onended = () => setIsPlaying(false)
    source.start(0, offset, playDuration)
    currentSourceRef.current = source
    setIsPlaying(true)
  }

  const handleDownloadTrimmed = () => {
    if (!audioBuffer) return
    const ctx = getAudioContext()
    const sliced = sliceAudioBuffer(ctx, audioBuffer, startTime, endTime, fadeIn, fadeOut)
    const wavBytes = encodeAudioBufferToWav(sliced)

    const blob = new Blob([wavBytes as unknown as BlobPart], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trimmed-${fileName.replace(/\.[^/.]+$/, '') || 'audio'}.wav`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Trimmed WAV audio downloaded')
    recordHistoryQuietly('audio-trimmer', 'Audio Waveform Trimmer', 'audio')
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {!audioBuffer ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            accept={['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']}
            label="Drop an audio file here to visualize waveform and trim"
            hint="Supports MP3, WAV, OGG, FLAC, and AAC files · click to browse"
            dialogTitle="Choose an audio file to trim"
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDemo}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Sparkles size={13} className="text-accent" />
              Load Sample Audio Synth
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-h-0">
          {/* Waveform Canvas Panel */}
          <Panel className="p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Music size={14} className="text-accent shrink-0" />
                <span className="font-semibold text-ink text-[12px] truncate">{fileName}</span>
                <span className="text-[10.5px] text-faint font-mono">
                  ({formatAudioTime(duration)})
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopPlayback()
                  setAudioBuffer(null)
                }}
                className="text-[11px] text-accent hover:underline cursor-pointer"
              >
                Change Audio
              </button>
            </div>

            {/* Canvas Visualizer */}
            <div className="w-full h-32 rounded-md border border-line bg-black overflow-hidden relative shadow-inner">
              <canvas
                ref={canvasRef}
                width={800}
                height={128}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Playback Controls & Timestamps */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={isPlaying ? stopPlayback : playRange}
                  className="gap-1.5 cursor-pointer text-[12px]"
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  {isPlaying ? 'Pause' : 'Play Selection'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={stopPlayback}
                  className="cursor-pointer text-[12px]"
                >
                  Stop
                </Button>
              </div>

              <div className="flex items-center gap-4 text-[12px] font-mono">
                <div>
                  <span className="text-faint text-[10px] block uppercase">Selection Start</span>
                  <span className="font-bold text-accent">{formatAudioTime(startTime)}</span>
                </div>
                <div>
                  <span className="text-faint text-[10px] block uppercase">Selection End</span>
                  <span className="font-bold text-accent">{formatAudioTime(endTime)}</span>
                </div>
                <div>
                  <span className="text-faint text-[10px] block uppercase">Trimmed Length</span>
                  <span className="font-bold text-emerald-400">
                    {formatAudioTime(Math.max(0, endTime - startTime))}
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Adjustment Sliders & Export */}
          <Panel className="flex-1 p-3.5 flex flex-col justify-between gap-3 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11.5px]">
              {/* Start Time Slider */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">Start Time Position</span>
                  <span className="font-mono text-ink font-bold">{startTime.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, endTime - 0.1)}
                  step={0.05}
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* End Time Slider */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">End Time Position</span>
                  <span className="font-mono text-ink font-bold">{endTime.toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={Math.min(duration, startTime + 0.1)}
                  max={duration}
                  step={0.05}
                  value={endTime}
                  onChange={(e) => setEndTime(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* Fade In */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">Fade In Envelope</span>
                  <span className="font-mono text-ink">{fadeIn.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={fadeIn}
                  onChange={(e) => setFadeIn(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* Fade Out */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">Fade Out Envelope</span>
                  <span className="font-mono text-ink">{fadeOut.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={fadeOut}
                  onChange={(e) => setFadeOut(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="border-t border-line/60 pt-3 flex items-center justify-between">
              <span className="text-[11px] text-faint">
                Encodes lossless 16-bit PCM WAV in your browser session
              </span>

              <Button
                variant="primary"
                size="md"
                onClick={handleDownloadTrimmed}
                className="gap-2 cursor-pointer text-[12px]"
              >
                <Download size={13} />
                Download Trimmed Audio (WAV)
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
