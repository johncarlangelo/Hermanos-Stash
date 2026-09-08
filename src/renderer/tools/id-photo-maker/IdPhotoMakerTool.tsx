import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Crop,
  Download,
  FileText,
  IdCard,
  Image as ImageIcon,
  Move,
  Printer,
  RotateCcw,
  Sparkles,
  User,
  ZoomIn
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  calculateSheetLayout,
  DEFAULT_ADJUSTMENT_CONFIG,
  generateIdPhotoDocx,
  generateIdPhotoPdf,
  PAPER_DIMENSIONS,
  PRESET_PACKAGES,
  renderProcessedPhotoCanvas,
  renderSheet300DpiCanvas,
  type IdPhotoSizeId,
  type PaperSizeId,
  type PhotoAdjustmentConfig,
  type PresetPackageId
} from './logic'

export default function IdPhotoMakerTool() {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null)
  const [adjustment, setAdjustment] = useState<PhotoAdjustmentConfig>(DEFAULT_ADJUSTMENT_CONFIG)
  const [paperSize, setPaperSize] = useState<PaperSizeId>('letter')
  const [selectedPreset, setSelectedPreset] = useState<PresetPackageId>('combo_a')
  const [customCounts, setCustomCounts] = useState<{ [K in IdPhotoSizeId]: number }>({
    '1x1': 8,
    '2x2': 2,
    passport: 0,
    '1.5x1.5': 0
  })
  const [showBiometricGuide, setShowBiometricGuide] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const singlePreviewRef = useRef<HTMLCanvasElement>(null)

  // Handle uploaded file
  const handleFiles = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      setPhotoSrc(src)
      const img = new Image()
      img.onload = () => {
        setPhotoImg(img)
        toastSuccess(`Loaded photo: ${file.name}`)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }, [])

  // Load clean demo portrait
  const loadDemo = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 750
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Gentle studio gradient backdrop
      const grad = ctx.createLinearGradient(0, 0, 0, 750)
      grad.addColorStop(0, '#e2e8f0')
      grad.addColorStop(1, '#cbd5e1')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 600, 750)

      // Silhouette shoulders & torso (dark suit)
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.ellipse(300, 700, 240, 180, 0, 0, Math.PI * 2)
      ctx.fill()

      // White collar
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(250, 520)
      ctx.lineTo(300, 610)
      ctx.lineTo(350, 520)
      ctx.closePath()
      ctx.fill()

      // Dark tie
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.moveTo(290, 560)
      ctx.lineTo(310, 560)
      ctx.lineTo(318, 720)
      ctx.lineTo(300, 750)
      ctx.lineTo(282, 720)
      ctx.closePath()
      ctx.fill()

      // Neck
      ctx.fillStyle = '#fed7aa'
      ctx.fillRect(265, 460, 70, 70)

      // Head
      ctx.fillStyle = '#ffedd5'
      ctx.beginPath()
      ctx.ellipse(300, 360, 110, 140, 0, 0, Math.PI * 2)
      ctx.fill()

      // Hair
      ctx.fillStyle = '#334155'
      ctx.beginPath()
      ctx.ellipse(300, 280, 120, 80, 0, 0, Math.PI * 2)
      ctx.fill()

      // Eyes
      ctx.fillStyle = '#475569'
      ctx.beginPath()
      ctx.ellipse(260, 350, 12, 6, 0, 0, Math.PI * 2)
      ctx.ellipse(340, 350, 12, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      // Friendly smile
      ctx.strokeStyle = '#9a3412'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(300, 420, 30, 0.2, Math.PI - 0.2)
      ctx.stroke()
    }

    const dataUrl = canvas.toDataURL('image/png')
    setPhotoSrc(dataUrl)
    const img = new Image()
    img.onload = () => {
      setPhotoImg(img)
      setAdjustment((prev) => ({
        ...prev,
        showNametag: true,
        nametagText: 'DELA CRUZ, JUAN M.'
      }))
      toastSuccess('Loaded sample studio portrait with nametag')
    }
    img.src = dataUrl
  }, [])

  // Derive item list based on preset or custom
  const sheetItems = useMemo(() => {
    if (selectedPreset === 'custom') {
      return (Object.keys(customCounts) as IdPhotoSizeId[])
        .filter((k) => customCounts[k] > 0)
        .map((k) => ({ sizeId: k, count: customCounts[k] }))
    }
    const preset = PRESET_PACKAGES.find((p) => p.id === selectedPreset)
    return preset ? preset.items : [{ sizeId: '2x2' as IdPhotoSizeId, count: 4 }]
  }, [selectedPreset, customCounts])

  // Calculate layout
  const layout = useMemo(() => {
    return calculateSheetLayout(sheetItems, paperSize)
  }, [sheetItems, paperSize])

  // Render single 2x2 preview canvas with adjustment
  useEffect(() => {
    if (!photoImg || !singlePreviewRef.current) return
    const canvas = singlePreviewRef.current
    canvas.width = 240
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const processed = renderProcessedPhotoCanvas(photoImg, 240, 240, adjustment)
    ctx.clearRect(0, 0, 240, 240)
    ctx.drawImage(processed, 0, 0)
  }, [photoImg, adjustment])

  // Render Sheet Canvas Preview
  useEffect(() => {
    if (!photoImg || !previewCanvasRef.current) return
    const previewCanvas = previewCanvasRef.current
    const processed = renderProcessedPhotoCanvas(photoImg, 600, 600, adjustment)

    // Calculate preview dimensions (scale to fit container nicely)
    const containerW = 480
    const scale = containerW / layout.paper.widthPx300Dpi
    previewCanvas.width = containerW
    previewCanvas.height = Math.round(layout.paper.heightPx300Dpi * scale)

    const ctx = previewCanvas.getContext('2d')
    if (!ctx) return

    // Draw white paper base with subtle inner shadow
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height)

    // Margin guide line
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    const mPx = Math.round(0.5 * 300 * scale)
    ctx.strokeRect(mPx, mPx, previewCanvas.width - mPx * 2, previewCanvas.height - mPx * 2)
    ctx.setLineDash([])

    // Draw each photo in layout
    for (const box of layout.boxes) {
      const bx = Math.round(box.xInches * 300 * scale)
      const by = Math.round(box.yInches * 300 * scale)
      const bw = Math.round(box.widthInches * 300 * scale)
      const bh = Math.round(box.heightInches * 300 * scale)

      ctx.drawImage(processed, bx, by, bw, bh)

      if (adjustment.showCuttingGuide) {
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 1
        ctx.strokeRect(bx, by, bw, bh)
      }
    }
  }, [photoImg, adjustment, layout])

  // Export handlers
  const getProcessedPngBytes = useCallback((): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      if (!photoImg) return reject(new Error('No photo loaded'))
      const processed = renderProcessedPhotoCanvas(photoImg, 600, 600, adjustment)
      processed.toBlob((blob) => {
        if (!blob) return reject(new Error('Failed to generate PNG blob'))
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)))
      }, 'image/png')
    })
  }, [photoImg, adjustment])

  const handleDownloadPdf = async () => {
    if (!photoImg) return
    setIsExporting(true)
    try {
      const pngBytes = await getProcessedPngBytes()
      const pdfBytes = await generateIdPhotoPdf(pngBytes, layout, {
        showHairlineBorder: adjustment.showCuttingGuide
      })
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `id_photos_${paperSize}_${selectedPreset}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Exported print-ready 100% scale PDF')
      recordHistoryQuietly('id-photo-maker', 'ID Photo Studio', 'images')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`PDF export failed: ${message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadDocx = async () => {
    if (!photoImg) return
    setIsExporting(true)
    try {
      const pngBytes = await getProcessedPngBytes()
      const docxBytes = await generateIdPhotoDocx(pngBytes, layout)
      const blob = new Blob([docxBytes as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `id_photos_${paperSize}_${selectedPreset}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Exported Microsoft Word (.docx) document')
      recordHistoryQuietly('id-photo-maker', 'ID Photo Studio', 'images')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`DOCX export failed: ${message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadPng = () => {
    if (!photoImg) return
    try {
      const processed = renderProcessedPhotoCanvas(photoImg, 600, 600, adjustment)
      const sheetCanvas = renderSheet300DpiCanvas(processed, layout, adjustment.showCuttingGuide)
      sheetCanvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `id_photos_sheet_${paperSize}_300dpi.png`
        a.click()
        URL.revokeObjectURL(url)
        toastSuccess('Exported 300 DPI high-res sheet PNG')
        recordHistoryQuietly('id-photo-maker', 'ID Photo Studio', 'images')
      }, 'image/png')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`PNG export failed: ${message}`)
    }
  }

  const handlePrint = () => {
    if (!photoImg) return
    window.print()
  }

  return (
    <div className="flex h-full flex-col gap-4 text-[13px] text-ink overflow-hidden p-4 sm:p-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-accent/40 bg-raised text-accent shadow-xs">
            <IdCard size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
              ID & Passport Photo Studio
              <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent font-medium uppercase">
                1x1 · 2x2 · Passport
              </span>
            </h2>
            <p className="text-[12px] text-dim">
              Scale, frame, and tile photos onto ready-to-print sheets with exact physical
              dimensions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDemo}
            className="flex items-center gap-1.5"
          >
            <Sparkles size={13} className="text-accent" />
            <span>Load Sample Studio Photo</span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
        {/* LEFT COLUMN: Upload & Adjustment Controls (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {!photoSrc ? (
            <Panel className="p-4 flex flex-col items-center justify-center text-center gap-3">
              <DropZone
                accept={['.jpg', '.jpeg', '.png', '.webp']}
                onRawFiles={handleFiles}
                label="Drop portrait photo here"
                hint="Supports JPEG, PNG, and WebP — click to browse"
                className="w-full py-8"
              />
              <p className="text-[12px] text-faint">
                Take a clean portrait or selfie with even lighting. You can crop, zoom, and add a
                nametag next.
              </p>
            </Panel>
          ) : (
            <>
              {/* Photo Framing Card */}
              <Panel className="p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-semibold text-[13px] text-ink flex items-center gap-1.5">
                    <Crop size={14} className="text-accent" />
                    Portrait Framing & Biometrics
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoSrc(null)
                      setPhotoImg(null)
                    }}
                    className="text-[11px] text-faint hover:text-danger cursor-pointer"
                  >
                    Change Photo
                  </button>
                </div>

                <div className="flex items-start gap-4">
                  {/* Interactive Crop Preview Box */}
                  <div className="relative shrink-0 w-32 h-32 rounded border border-line bg-base overflow-hidden shadow-inner flex items-center justify-center">
                    <canvas ref={singlePreviewRef} className="w-full h-full object-cover" />

                    {/* Biometric Guide Overlay (Head & Eye line) */}
                    {showBiometricGuide && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        {/* Oval head guide */}
                        <div className="w-20 h-24 rounded-full border border-accent/60 bg-accent/5" />
                        {/* Eye level line */}
                        <div className="absolute top-[42%] w-full border-t border-dashed border-accent/40" />
                        {/* Center crosshair */}
                        <div className="absolute h-full border-l border-dashed border-accent/30" />
                      </div>
                    )}
                  </div>

                  {/* Sliders & Toggles */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11.5px] text-dim">
                        <span className="flex items-center gap-1">
                          <ZoomIn size={12} /> Zoom
                        </span>
                        <span className="font-mono">{Math.round(adjustment.zoom * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="2.5"
                        step="0.05"
                        value={adjustment.zoom}
                        onChange={(e) =>
                          setAdjustment((prev) => ({
                            ...prev,
                            zoom: parseFloat(e.target.value)
                          }))
                        }
                        className="w-full accent-accent cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11.5px] text-dim">
                        <span className="flex items-center gap-1">
                          <Move size={12} /> Pan Vertical
                        </span>
                        <span className="font-mono">{adjustment.panY}px</span>
                      </div>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="2"
                        value={adjustment.panY}
                        onChange={(e) =>
                          setAdjustment((prev) => ({
                            ...prev,
                            panY: parseInt(e.target.value, 10)
                          }))
                        }
                        className="w-full accent-accent cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setShowBiometricGuide(!showBiometricGuide)}
                        className={`text-[11px] cursor-pointer px-2 py-0.5 rounded border transition-colors ${
                          showBiometricGuide
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-line text-faint hover:text-dim'
                        }`}
                      >
                        Face Guide {showBiometricGuide ? 'ON' : 'OFF'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setAdjustment((prev) => ({
                            ...prev,
                            zoom: 1.0,
                            panX: 0,
                            panY: 0
                          }))
                        }
                        title="Reset Pan & Zoom"
                        className="text-[11px] text-faint hover:text-ink flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Solid Background Color Tint */}
                <div className="space-y-1.5 border-t border-line/60 pt-3">
                  <label className="text-[11.5px] text-dim font-medium">
                    Background Color Fill
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'original', label: 'Original' },
                      { id: 'white', label: 'White' },
                      { id: 'offwhite', label: 'Off-White' },
                      { id: 'skyblue', label: 'Sky Blue (PRC/Gov)' },
                      { id: 'red', label: 'Red' }
                    ].map((bg) => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() =>
                          setAdjustment((prev) => ({
                            ...prev,
                            backgroundColor: bg.id as PhotoAdjustmentConfig['backgroundColor']
                          }))
                        }
                        className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-all ${
                          adjustment.backgroundColor === bg.id
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-surface/60 text-dim hover:text-ink'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formal Nametag Strip */}
                <div className="space-y-2 border-t border-line/60 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                      <User size={13} className="text-accent" />
                      Bottom Nametag Banner
                    </label>
                    <input
                      type="checkbox"
                      id="nametag-check"
                      checked={adjustment.showNametag}
                      onChange={(e) =>
                        setAdjustment((prev) => ({
                          ...prev,
                          showNametag: e.target.checked
                        }))
                      }
                      className="accent-accent cursor-pointer"
                    />
                  </div>
                  {adjustment.showNametag && (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="SURNAME, FIRST NAME, M.I."
                        value={adjustment.nametagText}
                        onChange={(e) =>
                          setAdjustment((prev) => ({
                            ...prev,
                            nametagText: e.target.value
                          }))
                        }
                        className="w-full rounded border border-line bg-base px-2.5 py-1.5 text-[12px] font-mono uppercase text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                      />
                      <p className="text-[10.5px] text-faint">
                        Mandatory for Philippine Civil Service, PRC, and university submissions.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Package Presets & Layout Card */}
              <Panel className="p-4 space-y-3.5">
                <span className="font-semibold text-[13px] text-ink flex items-center gap-1.5">
                  <FileText size={14} className="text-accent" />
                  Print Sheet Package & Paper Size
                </span>

                {/* Paper Selector */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(['letter', 'a4', '4x6'] as PaperSizeId[]).map((pid) => {
                    const p = PAPER_DIMENSIONS[pid]
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setPaperSize(pid)}
                        className={`p-2 rounded text-center border cursor-pointer transition-all ${
                          paperSize === pid
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-surface/50 text-dim hover:text-ink'
                        }`}
                      >
                        <div className="font-medium text-[12px]">{p.name}</div>
                        <div className="text-[10px] text-faint font-mono">
                          {p.widthInches}x{p.heightInches}"
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Presets List */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] text-dim font-medium">Layout Package</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PRESET_PACKAGES.map((preset) => {
                      const isSelected = selectedPreset === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPreset(preset.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'border-accent/60 bg-accent-soft/30 text-ink shadow-xs'
                              : 'border-line bg-surface/50 text-dim hover:border-line-strong hover:text-ink'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              isSelected
                                ? 'border-accent bg-accent text-base'
                                : 'border-line bg-base'
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-[12px] text-ink">{preset.name}</div>
                            <div className="text-[11px] text-faint leading-snug">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      )
                    })}

                    {/* Custom counts option */}
                    <button
                      type="button"
                      onClick={() => setSelectedPreset('custom')}
                      className={`flex items-start gap-2.5 p-2.5 rounded border text-left cursor-pointer transition-all ${
                        selectedPreset === 'custom'
                          ? 'border-accent/60 bg-accent-soft/30 text-ink shadow-xs'
                          : 'border-line bg-surface/50 text-dim hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selectedPreset === 'custom'
                            ? 'border-accent bg-accent text-base'
                            : 'border-line bg-base'
                        }`}
                      >
                        {selectedPreset === 'custom' && <Check size={10} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[12px] text-ink">Custom Quantities</div>
                        {selectedPreset === 'custom' && (
                          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-line/60">
                            <div>
                              <span className="text-[10px] text-faint block">1x1 Inch</span>
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={customCounts['1x1']}
                                onChange={(e) =>
                                  setCustomCounts((prev) => ({
                                    ...prev,
                                    '1x1': Math.max(0, parseInt(e.target.value, 10) || 0)
                                  }))
                                }
                                className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] font-mono text-ink"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-faint block">2x2 Inch</span>
                              <input
                                type="number"
                                min="0"
                                max="12"
                                value={customCounts['2x2']}
                                onChange={(e) =>
                                  setCustomCounts((prev) => ({
                                    ...prev,
                                    '2x2': Math.max(0, parseInt(e.target.value, 10) || 0)
                                  }))
                                }
                                className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] font-mono text-ink"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-faint block">Passport (35x45)</span>
                              <input
                                type="number"
                                min="0"
                                max="12"
                                value={customCounts.passport}
                                onChange={(e) =>
                                  setCustomCounts((prev) => ({
                                    ...prev,
                                    passport: Math.max(0, parseInt(e.target.value, 10) || 0)
                                  }))
                                }
                                className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] font-mono text-ink"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Hairline Cutting Guide Toggle */}
                <div className="flex items-center justify-between border-t border-line/60 pt-2">
                  <label htmlFor="cutting-check" className="text-[12px] text-dim cursor-pointer">
                    Hairline Scissor Cutting Borders
                  </label>
                  <input
                    type="checkbox"
                    id="cutting-check"
                    checked={adjustment.showCuttingGuide}
                    onChange={(e) =>
                      setAdjustment((prev) => ({
                        ...prev,
                        showCuttingGuide: e.target.checked
                      }))
                    }
                    className="accent-accent cursor-pointer"
                  />
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Document Preview & Exports (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
          <Panel className="flex-1 flex flex-col overflow-hidden p-4">
            {/* Document Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[13px] text-ink">Document Sheet Preview</span>
                <span className="rounded bg-raised px-2 py-0.5 font-mono text-[10.5px] text-faint border border-line">
                  {PAPER_DIMENSIONS[paperSize].name} · {layout.totalPhotos} Photos
                </span>
              </div>

              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                100% Real Physical Scale
              </span>
            </div>

            {/* Document Canvas Preview Surface */}
            <div className="flex-1 overflow-auto bg-base/80 rounded-md border border-line p-4 flex items-center justify-center my-3 min-h-[360px]">
              {photoSrc ? (
                <div className="relative rounded bg-white shadow-2xl transition-transform">
                  <canvas ref={previewCanvasRef} className="rounded block" />
                </div>
              ) : (
                <div className="text-center p-8 text-faint space-y-2">
                  <ImageIcon size={32} className="mx-auto text-faint/50" />
                  <p className="text-[13px] text-dim">No photo loaded yet</p>
                  <p className="text-[11.5px]">
                    Upload a picture or click "Load Sample Studio Photo" above to see the sheet
                    layout.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="text-[11.5px] text-faint font-mono">
                {layout.overflowCount > 0 ? (
                  <span className="text-amber-400 font-medium">
                    ⚠️ {layout.overflowCount} photos exceeded page bounds
                  </span>
                ) : (
                  <span>Ready to print without Word formatting hassles</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrint}
                  disabled={!photoImg || isExporting}
                  className="flex items-center gap-1.5"
                  title="Print directly to printer"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadPng}
                  disabled={!photoImg || isExporting}
                  className="flex items-center gap-1.5"
                  title="Export high-resolution 300 DPI image"
                >
                  <ImageIcon size={13} />
                  <span>Download Image</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadDocx}
                  disabled={!photoImg || isExporting}
                  className="flex items-center gap-1.5"
                  title="Export Microsoft Word (.docx) document"
                >
                  <FileText size={13} className="text-blue-400" />
                  <span>Word (.docx)</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={!photoImg || isExporting}
                  className="flex items-center gap-1.5"
                  title="Export 100% scale vector PDF"
                >
                  <Download size={13} />
                  <span>Download PDF</span>
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
