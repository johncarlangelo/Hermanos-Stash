import { useMemo, useState } from 'react'
import { BarChart2, BookOpen, Check, Clock, Copy, Hash, MessageSquare } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { analyzeText } from './logic'

const SAMPLES = {
  announcement: `Hermanos Stash is a local-first desktop utility suite crafted for developers, designers, and power users. Everything runs completely offline on your own machine without relying on external cloud subscriptions or remote APIs.

With over fifty integrated tools for images, documents, audio, data transformation, and developer utilities, Hermanos Stash delivers maximum privacy, blazing performance, and an intuitive dark workspace.`,

  manifesto: `Software should be fast, private, and durable. In an era dominated by subscription-locked web utilities that leak telemetry and upload personal files to third-party servers, local-first applications offer a refreshing return to user sovereignty.

When you process an image, format an SQL query, or calculate a cryptographic hash in Hermanos Stash, no byte leaves your machine. Your data remains strictly where it belongs—in your hands.`,

  story: `Once upon a time in a small mountain village, an old clockmaker spent his days crafting intricate mechanical gears. Every morning, he would wind up the village tower clock, and its soothing chimes echoed across the green valleys.`
}

export default function TextAnalyzerTool() {
  const [text, setText] = useState<string>(SAMPLES.announcement)
  const [copied, setCopied] = useState(false)

  const metrics = useMemo(() => {
    return analyzeText(text)
  }, [text])

  const handleCopyReport = async () => {
    const report = `--- Text Analysis Summary ---
Words: ${metrics.wordCount}
Characters: ${metrics.charCount} (without spaces: ${metrics.charNoSpaces})
Sentences: ${metrics.sentenceCount}
Paragraphs: ${metrics.paragraphCount}
Reading Time: ~${Math.max(1, Math.round(metrics.readingTimeSeconds / 60))} min (${metrics.readingTimeSeconds}s)
Speaking Time: ~${Math.max(1, Math.round(metrics.speakingTimeSeconds / 60))} min (${metrics.speakingTimeSeconds}s)
Flesch Reading Ease: ${metrics.fleschReadingEase}/100 (${metrics.readingLevelLabel})
Flesch-Kincaid Grade Level: Grade ${metrics.fleschGradeLevel}
Automated Readability Index (ARI): ${metrics.automatedReadabilityIndex}`

    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess('Analysis metrics copied to clipboard')
    recordHistoryQuietly('text-analyzer', 'Text Statistics & Readability', 'text')
  }

  const formatSeconds = (sec: number) => {
    if (sec < 60) return `${sec}s`
    const mins = Math.floor(sec / 60)
    const rem = sec % 60
    return `${mins}m ${rem}s`
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">Text Statistics & Readability Analyzer</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Flesch-Kincaid · ARI · WPM
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Samples:</span>
          <button
            type="button"
            onClick={() => setText(SAMPLES.announcement)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Announcement
          </button>
          <button
            type="button"
            onClick={() => setText(SAMPLES.manifesto)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Manifesto
          </button>
          <button
            type="button"
            onClick={() => setText(SAMPLES.story)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Story
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Input Area */}
        <Panel className="lg:col-span-6 p-3.5 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">Source Content</span>
            <button
              type="button"
              onClick={() => setText('')}
              className="text-[11px] text-faint hover:text-ink cursor-pointer"
            >
              Clear Text
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or write text to analyze metrics..."
            className="flex-1 w-full rounded border border-line bg-base p-3 font-sans text-[12.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed select-all"
          />
        </Panel>

        {/* Right Dashboard / Metrics Area */}
        <div className="lg:col-span-6 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Panel className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-faint uppercase font-medium">Words</span>
              <div className="text-[20px] font-bold text-ink font-mono mt-1">
                {metrics.wordCount.toLocaleString()}
              </div>
            </Panel>

            <Panel className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-faint uppercase font-medium">Characters</span>
              <div className="text-[20px] font-bold text-ink font-mono mt-1">
                {metrics.charCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-faint">
                {metrics.charNoSpaces.toLocaleString()} no spaces
              </span>
            </Panel>

            <Panel className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-faint uppercase font-medium">Sentences</span>
              <div className="text-[20px] font-bold text-ink font-mono mt-1">
                {metrics.sentenceCount.toLocaleString()}
              </div>
            </Panel>

            <Panel className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-faint uppercase font-medium">Paragraphs</span>
              <div className="text-[20px] font-bold text-ink font-mono mt-1">
                {metrics.paragraphCount.toLocaleString()}
              </div>
            </Panel>
          </div>

          {/* Readability Score Card */}
          <Panel className="p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen size={15} className="text-accent" />
                <h3 className="font-semibold text-[12.5px] text-ink">Readability Scores</h3>
              </div>
              <span className="text-[11.5px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/30">
                {metrics.readingLevelLabel}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11.5px]">
                <span className="text-faint">Flesch Reading Ease (0-100)</span>
                <span className="font-mono font-bold text-ink">{metrics.fleschReadingEase}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-base overflow-hidden border border-line">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${metrics.fleschReadingEase}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="rounded border border-line bg-base/50 p-2 text-center">
                <div className="text-faint">Grade Level</div>
                <div className="font-mono font-bold text-[14px] text-ink mt-0.5">
                  {metrics.fleschGradeLevel}
                </div>
              </div>
              <div className="rounded border border-line bg-base/50 p-2 text-center">
                <div className="text-faint">Auto ARI</div>
                <div className="font-mono font-bold text-[14px] text-ink mt-0.5">
                  {metrics.automatedReadabilityIndex}
                </div>
              </div>
              <div className="rounded border border-line bg-base/50 p-2 text-center">
                <div className="text-faint">Coleman-Liau</div>
                <div className="font-mono font-bold text-[14px] text-ink mt-0.5">
                  {metrics.colemanLiauIndex}
                </div>
              </div>
            </div>
          </Panel>

          {/* Time & Structure Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <Panel className="p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-faint text-[11px] font-semibold uppercase">
                <Clock size={12} className="text-accent" />
                <span>Reading Time</span>
              </div>
              <div className="text-[17px] font-mono font-bold text-ink">
                {formatSeconds(metrics.readingTimeSeconds)}
              </div>
              <div className="text-[10.5px] text-faint">Estimated at 200 WPM</div>
            </Panel>

            <Panel className="p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-faint text-[11px] font-semibold uppercase">
                <MessageSquare size={12} className="text-accent" />
                <span>Speaking Time</span>
              </div>
              <div className="text-[17px] font-mono font-bold text-ink">
                {formatSeconds(metrics.speakingTimeSeconds)}
              </div>
              <div className="text-[10.5px] text-faint">Estimated at 130 WPM</div>
            </Panel>
          </div>

          {/* Top Keywords */}
          {metrics.topKeywords.length > 0 && (
            <Panel className="p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
                <div className="flex items-center gap-1.5 text-faint text-[11px] font-semibold uppercase">
                  <Hash size={12} className="text-accent" />
                  <span>Frequent Keywords</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyReport}
                  className="gap-1 cursor-pointer text-[11px] py-0.5"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy Report'}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                {metrics.topKeywords.map((k) => (
                  <div
                    key={k.word}
                    className="flex flex-col p-1.5 rounded border border-line bg-base/60 text-[11px]"
                  >
                    <span className="font-semibold text-ink truncate">{k.word}</span>
                    <span className="text-[10px] text-faint font-mono">
                      {k.count}x ({k.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
