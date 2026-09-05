import { useMemo, useRef, useState } from 'react'
import { Download, Music, Pause, Play, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  LOUDNESS_PROFILES,
  analyzeAudioBuffer,
  encodeAudioBufferToWav,
  normalizeAudioBuffer,
  type NormalizationTarget
} from './logic'

export default function AudioNormalizeTool() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [targetId, setTargetId] = useState<NormalizationTarget>('spotify-14')
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)

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
      toastSuccess(`Loaded audio (${decoded.duration.toFixed(1)}s)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to decode audio: ${message}`)
    }
  }

  const loadDemo = () => {
    const ctx = getAudioContext()
    const sampleRate = ctx.sampleRate
    const demoDur = 4.0
    const buffer = ctx.createBuffer(2, sampleRate * demoDur, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate
        // Quiet sine chord demo (-18 dBFS)
        data[i] =
          (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 554.37 * t)) *
          0.12 *
          Math.sin((Math.PI * t) / demoDur)
      }
    }

    setAudioBuffer(buffer)
    setFileName('quiet-chord-demo.wav')
  }

  const stats = useMemo(() => {
    if (!audioBuffer) return { maxPeak: 0, peakDbfs: -100, rmsDbfs: -100 }
    return analyzeAudioBuffer(audioBuffer)
  }, [audioBuffer])

  const targetProfile = LOUDNESS_PROFILES.find((p) => p.id === targetId)
  const effectiveTargetDb = targetProfile?.targetDbfs ?? -14.0

  const gainAdjustmentDb = useMemo(() => {
    if (!audioBuffer) return 0
    const mode = targetId.includes('peak') ? 'peak' : 'rms'
    const current = mode === 'peak' ? stats.peakDbfs : stats.rmsDbfs
    return Number((effectiveTargetDb - current).toFixed(2))
  }, [audioBuffer, targetId, effectiveTargetDb, stats])

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

  const playNormalizedPreview = () => {
    if (!audioBuffer) return
    stopPlayback()
    const ctx = getAudioContext()
    const mode = targetId.includes('peak') ? 'peak' : 'rms'
    const { normalizedBuffer } = normalizeAudioBuffer(ctx, audioBuffer, effectiveTargetDb, mode)

    const source = ctx.createBufferSource()
    source.buffer = normalizedBuffer
    source.connect(ctx.destination)
    source.onended = () => setIsPlaying(false)
    source.start(0)
    currentSourceRef.current = source
    setIsPlaying(true)
  }

  const handleDownload = () => {
    if (!audioBuffer) return
    const ctx = getAudioContext()
    const mode = targetId.includes('peak') ? 'peak' : 'rms'
    const { normalizedBuffer } = normalizeAudioBuffer(ctx, audioBuffer, effectiveTargetDb, mode)
    const wavBytes = encodeAudioBufferToWav(normalizedBuffer)

    const blob = new Blob([wavBytes as unknown as BlobPart], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `normalized-${fileName.replace(/\.[^/.]+$/, '') || 'audio'}.wav`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Normalized audio downloaded')
    recordHistoryQuietly('audio-normalize', 'Audio Loudness Normalizer', 'audio')
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {!audioBuffer ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            accept={['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']}
            label="Drop an audio file here to normalize loudness"
            hint="Supports MP3, WAV, OGG, FLAC, and AAC files · click to browse"
            dialogTitle="Choose an audio file to normalize"
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDemo}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Sparkles size={13} className="text-accent" />
              Load Quiet Sample Synth (-18 dB)
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Settings & Loudness Profiles */}
          <Panel className="lg:col-span-7 p-3.5 flex flex-col gap-3 overflow-y-auto">
            {/* Audio Info */}
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-2 truncate">
                <Music size={14} className="text-accent shrink-0" />
                <span className="font-semibold text-ink text-[12px] truncate">{fileName}</span>
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

            {/* Target Loudness Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">
                Target Loudness Standard
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
                {LOUDNESS_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTargetId(p.id)}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-colors ${
                      targetId === p.id
                        ? 'border-accent bg-accent/10 shadow-xs'
                        : 'border-line bg-base/60 text-dim hover:text-ink'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-ink">{p.name}</span>
                      <span className="font-mono text-accent font-bold">{p.targetDbfs} dB</span>
                    </div>
                    <div className="text-[10px] text-faint mt-0.5">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Preview Controls */}
            <div className="space-y-2 border-t border-line/60 pt-3">
              <span className="text-[11px] uppercase font-semibold text-faint block">
                Audition & Preview
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={isPlaying ? stopPlayback : playNormalizedPreview}
                  className="gap-1.5 cursor-pointer text-[12px]"
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  {isPlaying ? 'Pause' : 'Play Normalized'}
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
            </div>
          </Panel>

          {/* Right Metrics & Export */}
          <Panel className="lg:col-span-5 p-3.5 flex flex-col justify-between gap-3 overflow-hidden">
            <div className="space-y-3">
              <span className="text-[11px] uppercase font-semibold text-faint block border-b border-line/60 pb-1">
                Loudness Analysis & Metering
              </span>

              {/* Meters Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded border border-line bg-base/50 space-y-1">
                  <span className="text-faint block text-[10px] uppercase">Original Peak</span>
                  <span className="font-mono font-bold text-ink text-[14px]">
                    {stats.peakDbfs} dBFS
                  </span>
                </div>

                <div className="p-2.5 rounded border border-line bg-base/50 space-y-1">
                  <span className="text-faint block text-[10px] uppercase">Original RMS</span>
                  <span className="font-mono font-bold text-ink text-[14px]">
                    {stats.rmsDbfs} dBFS
                  </span>
                </div>
              </div>

              {/* Calculated Gain Change Badge */}
              <div className="p-3 rounded border border-accent/40 bg-accent/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-faint uppercase font-semibold block">
                    Calculated Gain Adjustment
                  </span>
                  <span className="text-[10px] text-faint">
                    Applied dynamically via soft-limiter
                  </span>
                </div>

                <span className="text-[18px] font-mono font-bold text-accent">
                  {gainAdjustmentDb > 0 ? `+${gainAdjustmentDb}` : gainAdjustmentDb} dB
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="border-t border-line/60 pt-3 flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleDownload}
                className="w-full gap-2 cursor-pointer text-[12px]"
              >
                <Download size={13} />
                Download Normalized Audio (WAV)
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
