import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Crop,
  Download,
  FileText,
  IdCard,
  Image as ImageIcon,
  Move,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  User,
  X,
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
  ID_PHOTO_DIMENSIONS,
  PAPER_DIMENSIONS,
  PRESET_PACKAGES,
  renderProcessedPhotoCanvas,
  renderSheet300DpiCanvas,
  type IdPhotoSizeId,
  type PaperSizeId,
  type PhotoAdjustmentConfig,
  type PresetPackageId,
  type SizeAdjustment
} from './logic'

export interface LoadedPhoto {
  id: string
  name: string
  src: string
  img: HTMLImageElement
  adjustment: PhotoAdjustmentConfig
}

export const FRAMING_PREVIEW_SIZES: Record<
  IdPhotoSizeId,
  { name: string; width: number; height: number; boxClass: string; desc: string }
> = {
  '2x2': {
    name: '2" × 2"',
    width: 240,
    height: 240,
    boxClass: 'w-36 h-36',
    desc: 'Square 1:1 (US Visa / Passport / PRC)'
  },
  passport: {
    name: 'Passport (35×45)',
    width: 210,
    height: 270,
    boxClass: 'w-[126px] h-[162px]',
    desc: '35×45mm (Schengen / DFA / International)'
  },
  wallet: {
    name: 'Wallet (2.5×3.5")',
    width: 196,
    height: 274,
    boxClass: 'w-[125px] h-[175px]',
    desc: '2.5" × 3.5" (Keepsake / Portfolio)'
  },
  '1x1': {
    name: '1" × 1"',
    width: 240,
    height: 240,
    boxClass: 'w-36 h-36',
    desc: 'Square 1:1 (Gov ID / clearance)'
  },
  '1.5x1.5': {
    name: '1.5" × 1.5"',
    width: 240,
    height: 240,
    boxClass: 'w-36 h-36',
    desc: 'Square 1:1 (School / College)'
  }
}

export default function IdPhotoMakerTool() {
  const [photos, setPhotos] = useState<LoadedPhoto[]>([])
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [distributionMode, setDistributionMode] = useState<'split' | 'repeat'>('split')
  const [paperSize, setPaperSize] = useState<PaperSizeId>('letter')
  const [selectedPreset, setSelectedPreset] = useState<PresetPackageId>('combo_a')
  const [customCounts, setCustomCounts] = useState<{ [K in IdPhotoSizeId]: number }>({
    '1x1': 8,
    '2x2': 2,
    passport: 0,
    '1.5x1.5': 0,
    wallet: 0
  })
  const [showBiometricGuide, setShowBiometricGuide] = useState(true)
  const [showCuttingGuide, setShowCuttingGuide] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [framingSize, setFramingSize] = useState<IdPhotoSizeId>('2x2')

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const singlePreviewRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const activePhoto = useMemo(() => {
    return photos.find((p) => p.id === activePhotoId) || photos[0] || null
  }, [photos, activePhotoId])

  const activeAdjustment = activePhoto ? activePhoto.adjustment : DEFAULT_ADJUSTMENT_CONFIG

  const currentSizeAdj = activePhoto?.adjustment.sizeAdjustments?.[framingSize]
  const currentZoom = currentSizeAdj?.zoom ?? activeAdjustment.zoom
  const currentPanX = currentSizeAdj?.panX ?? activeAdjustment.panX
  const currentPanY = currentSizeAdj?.panY ?? activeAdjustment.panY

  // Automatically match framing preview size if preset has exactly 1 size (e.g. 4_wallet -> wallet)
  useEffect(() => {
    const preset = PRESET_PACKAGES.find((p) => p.id === selectedPreset)
    if (preset && preset.items.length === 1) {
      setFramingSize(preset.items[0].sizeId)
    }
  }, [selectedPreset])

  const updateActiveAdjustment = useCallback(
    (updater: (prev: PhotoAdjustmentConfig) => PhotoAdjustmentConfig) => {
      if (!activePhoto) return
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === activePhoto.id ? { ...p, adjustment: updater(p.adjustment) } : p
        )
      )
    },
    [activePhoto]
  )

  const updateFraming = useCallback(
    (delta: { zoom?: number; panX?: number; panY?: number }) => {
      if (!activePhoto) return
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id !== activePhoto.id) return p
          const prevSizeAdj = p.adjustment.sizeAdjustments?.[framingSize] ?? {
            zoom: p.adjustment.zoom,
            panX: p.adjustment.panX,
            panY: p.adjustment.panY
          }
          const nextSizeAdj = {
            zoom: delta.zoom !== undefined ? delta.zoom : prevSizeAdj.zoom,
            panX: delta.panX !== undefined ? delta.panX : prevSizeAdj.panX,
            panY: delta.panY !== undefined ? delta.panY : prevSizeAdj.panY
          }
          return {
            ...p,
            adjustment: {
              ...p.adjustment,
              zoom: framingSize === '2x2' ? nextSizeAdj.zoom : p.adjustment.zoom,
              panX: framingSize === '2x2' ? nextSizeAdj.panX : p.adjustment.panX,
              panY: framingSize === '2x2' ? nextSizeAdj.panY : p.adjustment.panY,
              sizeAdjustments: {
                ...p.adjustment.sizeAdjustments,
                [framingSize]: nextSizeAdj
              }
            }
          }
        })
      )
    },
    [activePhoto, framingSize]
  )

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    initialPanRef.current = { x: currentPanX, y: currentPanY }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    updateFraming({
      panX: Math.round(initialPanRef.current.x + dx),
      panY: Math.round(initialPanRef.current.y + dy)
    })
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const zoomStep = 0.05
    const delta = e.deltaY < 0 ? zoomStep : -zoomStep
    const newZoom = Math.min(2.5, Math.max(0.8, parseFloat((currentZoom + delta).toFixed(2))))
    updateFraming({ zoom: newZoom })
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      initialPanRef.current = { x: currentPanX, y: currentPanY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - dragStartRef.current.x
    const dy = e.touches[0].clientY - dragStartRef.current.y
    updateFraming({
      panX: Math.round(initialPanRef.current.x + dx),
      panY: Math.round(initialPanRef.current.y + dy)
    })
  }

  const handleTouchEnd = () => {
    isDraggingRef.current = false
  }

  const handleApplyToAllSizes = () => {
    if (!activePhoto) return
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== activePhoto.id) return p
        const allSizes: IdPhotoSizeId[] = ['2x2', '1x1', 'passport', 'wallet', '1.5x1.5']
        const newSizeAdjustments: Partial<Record<IdPhotoSizeId, SizeAdjustment>> = {}
        allSizes.forEach((sz) => {
          newSizeAdjustments[sz] = {
            zoom: currentZoom,
            panX: currentPanX,
            panY: currentPanY
          }
        })
        return {
          ...p,
          adjustment: {
            ...p.adjustment,
            zoom: currentZoom,
            panX: currentPanX,
            panY: currentPanY,
            sizeAdjustments: newSizeAdjustments
          }
        }
      })
    )
    toastSuccess(`Applied ${FRAMING_PREVIEW_SIZES[framingSize].name} framing to all photo sizes`)
  }

  const handleDownloadSinglePhoto = () => {
    if (!activePhoto) return
    try {
      const dim = ID_PHOTO_DIMENSIONS[framingSize]
      const processed = renderProcessedPhotoCanvas(
        activePhoto.img,
        dim.widthPx300Dpi,
        dim.heightPx300Dpi,
        activePhoto.adjustment,
        framingSize
      )
      processed.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activePhoto.name}_${framingSize}_300dpi.png`
        a.click()
        URL.revokeObjectURL(url)
        toastSuccess(`Exported single ${dim.name} (${dim.widthMm}×${dim.heightMm}mm) PNG`)
        recordHistoryQuietly('id-photo-maker', 'ID Photo Studio', 'images')
      }, 'image/png')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toastError(`Single photo export failed: ${msg}`)
    }
  }

  // Handle uploaded files (single or multiple)
  const handleFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return
      const newPhotos: LoadedPhoto[] = []
      let loadedCount = 0

      Array.from(files).forEach((file, idx) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const src = e.target?.result as string
          const img = new Image()
          img.onload = () => {
            newPhotos.push({
              id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              src,
              img,
              adjustment: { ...DEFAULT_ADJUSTMENT_CONFIG }
            })
            loadedCount++
            if (loadedCount === files.length) {
              setPhotos((prev) => {
                const combined = [...prev, ...newPhotos]
                if (!activePhotoId && combined.length > 0) {
                  setActivePhotoId(combined[0].id)
                }
                return combined
              })
              toastSuccess(`Loaded ${files.length} photo${files.length > 1 ? 's' : ''}`)
            }
          }
          img.src = src
        }
        reader.readAsDataURL(file)
      })
    },
    [activePhotoId]
  )

  // Demo portraits generator (supports Person 1 Juan and Person 2 Maria)
  const createDemoPortrait = useCallback((index: number = 0): { dataUrl: string; name: string } => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 750
    const ctx = canvas.getContext('2d')
    if (!ctx) return { dataUrl: '', name: 'Portrait' }

    if (index === 0) {
      // Juan Dela Cruz (Suit & Tie)
      const grad = ctx.createLinearGradient(0, 0, 0, 750)
      grad.addColorStop(0, '#e2e8f0')
      grad.addColorStop(1, '#cbd5e1')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 600, 750)

      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.ellipse(300, 700, 240, 180, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(250, 520)
      ctx.lineTo(300, 610)
      ctx.lineTo(350, 520)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.moveTo(290, 560)
      ctx.lineTo(310, 560)
      ctx.lineTo(318, 720)
      ctx.lineTo(300, 750)
      ctx.lineTo(282, 720)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#fed7aa'
      ctx.fillRect(265, 460, 70, 70)

      ctx.fillStyle = '#ffedd5'
      ctx.beginPath()
      ctx.ellipse(300, 360, 110, 140, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#334155'
      ctx.beginPath()
      ctx.ellipse(300, 280, 120, 80, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#475569'
      ctx.beginPath()
      ctx.ellipse(260, 350, 12, 6, 0, 0, Math.PI * 2)
      ctx.ellipse(340, 350, 12, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#9a3412'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(300, 420, 30, 0.2, Math.PI - 0.2)
      ctx.stroke()
      return { dataUrl: canvas.toDataURL('image/png'), name: 'DELA CRUZ, JUAN M.' }
    } else {
      // Maria Santos (Teal background, collar)
      const grad = ctx.createLinearGradient(0, 0, 0, 750)
      grad.addColorStop(0, '#e0f2fe')
      grad.addColorStop(1, '#bae6fd')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 600, 750)

      ctx.fillStyle = '#0369a1'
      ctx.beginPath()
      ctx.ellipse(300, 700, 230, 170, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(260, 530)
      ctx.lineTo(300, 600)
      ctx.lineTo(340, 530)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#fed7aa'
      ctx.fillRect(270, 460, 60, 70)

      ctx.fillStyle = '#1c1917'
      ctx.beginPath()
      ctx.ellipse(300, 400, 150, 190, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffedd5'
      ctx.beginPath()
      ctx.ellipse(300, 360, 105, 135, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#1c1917'
      ctx.beginPath()
      ctx.ellipse(300, 275, 115, 75, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#334155'
      ctx.beginPath()
      ctx.ellipse(265, 350, 11, 6, 0, 0, Math.PI * 2)
      ctx.ellipse(335, 350, 11, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#be123c'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(300, 420, 26, 0.2, Math.PI - 0.2)
      ctx.stroke()
      return { dataUrl: canvas.toDataURL('image/png'), name: 'SANTOS, MARIA C.' }
    }
  }, [])

  // Load sample demo portrait
  const loadDemo = useCallback(() => {
    const demoIdx = photos.length % 2
    const { dataUrl, name } = createDemoPortrait(demoIdx)
    const img = new Image()
    img.onload = () => {
      const newPhoto: LoadedPhoto = {
        id: `demo-${Date.now()}-${demoIdx}`,
        name: demoIdx === 0 ? 'Juan Dela Cruz' : 'Maria Santos',
        src: dataUrl,
        img,
        adjustment: {
          ...DEFAULT_ADJUSTMENT_CONFIG,
          showNametag: true,
          nametagText: name
        }
      }
      setPhotos((prev) => [...prev, newPhoto])
      setActivePhotoId(newPhoto.id)
      toastSuccess(`Loaded sample portrait: ${newPhoto.name}`)
    }
    img.src = dataUrl
  }, [photos, createDemoPortrait])

  // Remove a photo
  const removePhoto = useCallback(
    (id: string) => {
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.id !== id)
        if (activePhotoId === id) {
          setActivePhotoId(filtered.length > 0 ? filtered[0].id : null)
        }
        return filtered
      })
    },
    [activePhotoId]
  )

  // Derive item list based on preset or custom counts and multi-photo distribution
  const sheetItems = useMemo(() => {
    let baseItems: Array<{ sizeId: IdPhotoSizeId; count: number }> = []
    if (selectedPreset === 'custom') {
      baseItems = (Object.keys(customCounts) as IdPhotoSizeId[])
        .filter((k) => customCounts[k] > 0)
        .map((k) => ({ sizeId: k, count: customCounts[k] }))
    } else {
      const preset = PRESET_PACKAGES.find((p) => p.id === selectedPreset)
      baseItems = preset ? preset.items : [{ sizeId: '2x2' as IdPhotoSizeId, count: 4 }]
    }

    if (photos.length <= 1) {
      return baseItems.map((item) => ({ ...item, photoIndex: 0 }))
    }

    // Multiple photos loaded:
    if (distributionMode === 'repeat') {
      // Repeat the full package for each photo
      const result: Array<{ sizeId: IdPhotoSizeId; count: number; photoIndex: number }> = []
      photos.forEach((_, pIdx) => {
        baseItems.forEach((item) => {
          result.push({ sizeId: item.sizeId, count: item.count, photoIndex: pIdx })
        })
      })
      return result
    }

    // Default 'split': Distribute the package's slots evenly among photos
    const result: Array<{ sizeId: IdPhotoSizeId; count: number; photoIndex: number }> = []
    baseItems.forEach((item) => {
      const countsPerPhoto = new Array(photos.length).fill(0)
      for (let i = 0; i < item.count; i++) {
        countsPerPhoto[i % photos.length]++
      }
      countsPerPhoto.forEach((count, pIdx) => {
        if (count > 0) {
          result.push({ sizeId: item.sizeId, count, photoIndex: pIdx })
        }
      })
    })
    return result
  }, [selectedPreset, customCounts, photos, distributionMode])

  // Calculate layout
  const layout = useMemo(() => {
    return calculateSheetLayout(sheetItems, paperSize)
  }, [sheetItems, paperSize])

  // Render single preview canvas for active photo
  useEffect(() => {
    if (!activePhoto || !singlePreviewRef.current) return
    const canvas = singlePreviewRef.current
    const targetDim = FRAMING_PREVIEW_SIZES[framingSize]
    canvas.width = targetDim.width
    canvas.height = targetDim.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const processed = renderProcessedPhotoCanvas(
      activePhoto.img,
      targetDim.width,
      targetDim.height,
      activeAdjustment,
      framingSize
    )
    ctx.clearRect(0, 0, targetDim.width, targetDim.height)
    ctx.drawImage(processed, 0, 0)
  }, [activePhoto, activeAdjustment, framingSize])

  // Render Sheet Canvas Preview
  useEffect(() => {
    if (photos.length === 0 || !previewCanvasRef.current) return
    const previewCanvas = previewCanvasRef.current

    // Pre-render canvases for each unique (photo, sizeId) combo
    const uniqueSizes = Array.from(new Set(layout.boxes.map((b) => b.sizeId)))
    const canvasMap = new Map<string, HTMLCanvasElement>()

    photos.forEach((p, pIdx) => {
      uniqueSizes.forEach((sizeId) => {
        const dim = ID_PHOTO_DIMENSIONS[sizeId]
        const c = renderProcessedPhotoCanvas(
          p.img,
          dim.widthPx300Dpi,
          dim.heightPx300Dpi,
          { ...p.adjustment, showCuttingGuide: false },
          sizeId
        )
        canvasMap.set(`${pIdx}_${sizeId}`, c)
      })
    })

    // Calculate preview dimensions (scale to fit container nicely)
    const containerW = 480
    const scale = containerW / layout.paper.widthPx300Dpi
    previewCanvas.width = containerW
    previewCanvas.height = Math.round(layout.paper.heightPx300Dpi * scale)

    const ctx = previewCanvas.getContext('2d')
    if (!ctx) return

    // Draw white paper base
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

      const pIdx = Math.min(box.photoIndex ?? 0, photos.length - 1)
      const processed = canvasMap.get(`${pIdx}_${box.sizeId}`)
      if (processed) {
        ctx.drawImage(processed, bx, by, bw, bh)
      }

      if (showCuttingGuide) {
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 1
        ctx.strokeRect(bx, by, bw, bh)
      }

      // If multiple photos are on sheet, draw subtle #1, #2 badge in preview
      if (photos.length > 1) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'
        const badgeW = 20
        const badgeH = 14
        ctx.fillRect(bx + 3, by + 3, badgeW, badgeH)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 8.5px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`#${pIdx + 1}`, bx + 3 + badgeW / 2, by + 3 + badgeH / 2)
      }
    }
  }, [photos, layout, showCuttingGuide])

  // Process all photos to PNG bytes per size for exports
  const getAllProcessedPngBytesMap = useCallback((): Promise<Record<string, Uint8Array>> => {
    const uniqueSizes = Array.from(new Set(layout.boxes.map((b) => b.sizeId)))
    const tasks: Array<Promise<{ key: string; bytes: Uint8Array }>> = []

    photos.forEach((p, pIdx) => {
      uniqueSizes.forEach((sizeId) => {
        const dim = ID_PHOTO_DIMENSIONS[sizeId]
        tasks.push(
          new Promise<{ key: string; bytes: Uint8Array }>((resolve, reject) => {
            const processed = renderProcessedPhotoCanvas(
              p.img,
              dim.widthPx300Dpi,
              dim.heightPx300Dpi,
              { ...p.adjustment, showCuttingGuide: false },
              sizeId
            )
            processed.toBlob((blob) => {
              if (!blob) return reject(new Error('Failed to generate PNG blob'))
              blob.arrayBuffer().then((buf) => {
                resolve({ key: `${pIdx}_${sizeId}`, bytes: new Uint8Array(buf) })
              })
            }, 'image/png')
          })
        )
      })
    })

    return Promise.all(tasks).then((entries) => {
      const map: Record<string, Uint8Array> = {}
      for (const entry of entries) {
        map[entry.key] = entry.bytes
      }
      return map
    })
  }, [photos, layout])

  const handleDownloadPdf = async () => {
    if (photos.length === 0) return
    setIsExporting(true)
    try {
      const pngBytesMap = await getAllProcessedPngBytesMap()
      const pdfBytes = await generateIdPhotoPdf(pngBytesMap, layout, {
        showHairlineBorder: showCuttingGuide
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
    if (photos.length === 0) return
    setIsExporting(true)
    try {
      const pngBytesMap = await getAllProcessedPngBytesMap()
      const docxBytes = await generateIdPhotoDocx(pngBytesMap, layout)
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
    if (photos.length === 0) return
    try {
      const uniqueSizes = Array.from(new Set(layout.boxes.map((b) => b.sizeId)))
      const canvasMap = new Map<string, HTMLCanvasElement>()

      photos.forEach((p, pIdx) => {
        uniqueSizes.forEach((sizeId) => {
          const dim = ID_PHOTO_DIMENSIONS[sizeId]
          const c = renderProcessedPhotoCanvas(
            p.img,
            dim.widthPx300Dpi,
            dim.heightPx300Dpi,
            { ...p.adjustment, showCuttingGuide: false },
            sizeId
          )
          canvasMap.set(`${pIdx}_${sizeId}`, c)
        })
      })

      const sheetCanvas = renderSheet300DpiCanvas(canvasMap, layout, showCuttingGuide)
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
    if (photos.length === 0) return
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
                1x1 · 2x2 · Passport · Wallet
              </span>
            </h2>
            <p className="text-[12px] text-dim">
              Scale, frame, and tile single or multiple photos onto ready-to-print sheets with exact
              physical dimensions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(Array.from(e.target.files))
                e.target.value = ''
              }
            }}
            className="hidden"
          />

          <Button
            variant="secondary"
            size="sm"
            onClick={loadDemo}
            className="flex items-center gap-1.5"
          >
            <Sparkles size={13} className="text-accent" />
            <span>
              {photos.length === 0
                ? 'Load Sample Studio Photo'
                : `Add Sample Photo (${photos.length % 2 === 0 ? 'Juan' : 'Maria'})`}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
        {/* LEFT COLUMN: Upload & Adjustment Controls (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {photos.length === 0 ? (
            <Panel className="p-4 flex flex-col items-center justify-center text-center gap-3">
              <DropZone
                accept={['.jpg', '.jpeg', '.png', '.webp']}
                multiple={true}
                onRawFiles={handleFiles}
                label="Drop one or more portrait photos here"
                hint="Supports JPEG, PNG, and WebP — select multiple files or click to browse"
                className="w-full py-8"
              />
              <p className="text-[12px] text-faint">
                Take a clean portrait or selfie with even lighting. You can crop, zoom, and add a
                nametag next.
              </p>
            </Panel>
          ) : (
            <>
              {/* Photo Tray Strip */}
              <Panel className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-dim uppercase tracking-wider">
                    Loaded Photos ({photos.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer font-medium"
                  >
                    <Plus size={12} /> Add More Photos
                  </button>
                </div>

                {/* Horizontal scrollable cards */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                  {photos.map((p, idx) => {
                    const isActive = p.id === activePhoto?.id
                    return (
                      <div
                        key={p.id}
                        onClick={() => setActivePhotoId(p.id)}
                        className={`relative flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all shrink-0 ${
                          isActive
                            ? 'border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30'
                            : 'border-line bg-surface/60 hover:border-line-strong hover:bg-surface'
                        }`}
                      >
                        <img
                          src={p.src}
                          alt={p.name}
                          className="w-9 h-9 object-cover rounded border border-line"
                        />
                        <div className="min-w-0 pr-4">
                          <div className="text-[11px] font-medium text-ink truncate max-w-[85px]">
                            #{idx + 1} {p.name}
                          </div>
                          <div className="text-[9.5px] text-faint truncate max-w-[85px]">
                            {p.adjustment.showNametag && p.adjustment.nametagText
                              ? p.adjustment.nametagText
                              : 'Standard'}
                          </div>
                        </div>
                        {photos.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removePhoto(p.id)
                            }}
                            className="absolute top-1 right-1 p-0.5 rounded text-faint hover:text-danger hover:bg-base"
                            title="Remove photo"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Multi-Photo Distribution Selector */}
                {photos.length > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-line/60 text-[11px]">
                    <span className="text-dim">Sheet Slot Allocation</span>
                    <div className="flex items-center gap-1 bg-surface rounded p-0.5 border border-line">
                      <button
                        type="button"
                        onClick={() => setDistributionMode('split')}
                        className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
                          distributionMode === 'split'
                            ? 'bg-accent text-base font-semibold shadow-xs'
                            : 'text-dim hover:text-ink'
                        }`}
                        title="Distribute package slots evenly among all photos"
                      >
                        Split Slots
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistributionMode('repeat')}
                        className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
                          distributionMode === 'repeat'
                            ? 'bg-accent text-base font-semibold shadow-xs'
                            : 'text-dim hover:text-ink'
                        }`}
                        title="Print a full package copy for each photo"
                      >
                        Repeat All
                      </button>
                    </div>
                  </div>
                )}
              </Panel>

              {/* Photo Framing Card for activePhoto */}
              <Panel className="p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-semibold text-[13px] text-ink flex items-center gap-1.5">
                    <Crop size={14} className="text-accent" />
                    Portrait Framing —{' '}
                    <span className="text-accent truncate max-w-[150px]">
                      {activePhoto?.name ?? 'Photo'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotos([])
                      setActivePhotoId(null)
                    }}
                    className="text-[11px] text-faint hover:text-danger cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                {/* Framing Size Selector Tabs */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-dim font-medium">Select Size to Frame:</span>
                    <span className="text-faint text-[10.5px]">
                      {FRAMING_PREVIEW_SIZES[framingSize].desc}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 bg-surface/60 p-1 rounded-lg border border-line">
                    {(['2x2', 'passport', 'wallet', '1x1', '1.5x1.5'] as IdPhotoSizeId[]).map(
                      (sz) => {
                        const isSelected = framingSize === sz
                        const isIncludedInLayout = layout.boxes.some((b) => b.sizeId === sz)
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setFramingSize(sz)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-accent text-base font-semibold shadow-xs'
                                : 'text-dim hover:text-ink hover:bg-surface'
                            }`}
                          >
                            <span>{FRAMING_PREVIEW_SIZES[sz].name}</span>
                            {isIncludedInLayout && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSelected ? 'bg-base' : 'bg-accent'
                                }`}
                                title="Included in current sheet layout"
                              />
                            )}
                          </button>
                        )
                      }
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3.5 pt-1">
                  {/* Interactive Drag-to-Pan Canvas Box */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className={`relative ${FRAMING_PREVIEW_SIZES[framingSize].boxClass} rounded border border-line bg-base overflow-hidden shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing select-none group`}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onWheel={handleWheel}
                      title="Click & drag picture to freely position • Scroll mouse wheel to zoom"
                    >
                      <canvas
                        ref={singlePreviewRef}
                        className="w-full h-full object-cover pointer-events-none"
                      />

                      {/* Biometric Face Guide Overlay */}
                      {showBiometricGuide && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          {/* Oval head guide scaled to aspect ratio */}
                          <div
                            className={`rounded-full border border-accent/60 bg-accent/5 ${
                              framingSize === 'passport'
                                ? 'w-[90px] h-[122px]'
                                : framingSize === 'wallet'
                                  ? 'w-[88px] h-[126px]'
                                  : 'w-20 h-24'
                            }`}
                          />
                          {/* Eye level line */}
                          <div className="absolute top-[42%] w-full border-t border-dashed border-accent/40" />
                          {/* Center vertical crosshair */}
                          <div className="absolute h-full border-l border-dashed border-accent/30" />
                        </div>
                      )}

                      {/* Subtle drag hint */}
                      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs text-[9px] text-white/90 px-1 py-0.5 rounded pointer-events-none flex items-center gap-0.5">
                        <Move size={9} /> Drag to pan
                      </div>
                    </div>
                    <span className="text-[10px] text-faint flex items-center gap-1">
                      <Move size={10} /> Drag to move picture
                    </span>
                  </div>

                  {/* Sliders: Zoom, Pan X, Pan Y */}
                  <div className="flex-1 space-y-2 min-w-0">
                    {/* Zoom */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-dim">
                        <span className="flex items-center gap-1">
                          <ZoomIn size={12} /> Zoom
                        </span>
                        <span className="font-mono">{Math.round(currentZoom * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="2.5"
                        step="0.05"
                        value={currentZoom}
                        onChange={(e) => updateFraming({ zoom: parseFloat(e.target.value) })}
                        className="w-full accent-accent cursor-pointer"
                      />
                    </div>

                    {/* Pan Horizontal (X) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-dim">
                        <span className="flex items-center gap-1">
                          <Move size={12} /> Pan Horizontal (X)
                        </span>
                        <span className="font-mono">
                          {currentPanX > 0 ? `+${currentPanX}` : currentPanX}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="1"
                        value={currentPanX}
                        onChange={(e) => updateFraming({ panX: parseInt(e.target.value, 10) })}
                        className="w-full accent-accent cursor-pointer"
                      />
                    </div>

                    {/* Pan Vertical (Y) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-dim">
                        <span className="flex items-center gap-1">
                          <Move size={12} /> Pan Vertical (Y)
                        </span>
                        <span className="font-mono">
                          {currentPanY > 0 ? `+${currentPanY}` : currentPanY}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="1"
                        value={currentPanY}
                        onChange={(e) => updateFraming({ panY: parseInt(e.target.value, 10) })}
                        className="w-full accent-accent cursor-pointer"
                      />
                    </div>

                    {/* Buttons: Face Guide, Center, Reset */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setShowBiometricGuide(!showBiometricGuide)}
                        className={`cursor-pointer px-2 py-0.5 rounded border transition-colors ${
                          showBiometricGuide
                            ? 'border-accent bg-accent/15 text-accent font-medium'
                            : 'border-line text-faint hover:text-dim'
                        }`}
                      >
                        Face Guide {showBiometricGuide ? 'ON' : 'OFF'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateFraming({ panX: 0, panY: 0 })}
                          title="Center Image (Pan = 0)"
                          className="text-faint hover:text-ink px-2 py-0.5 rounded border border-line bg-surface/50 cursor-pointer"
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() => updateFraming({ zoom: 1.0, panX: 0, panY: 0 })}
                          title="Reset Zoom & Pan"
                          className="text-faint hover:text-ink px-2 py-0.5 rounded border border-line bg-surface/50 flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw size={10} /> Reset
                        </button>
                      </div>
                    </div>

                    {/* Secondary Actions: Apply All & Single Photo Download */}
                    <div className="flex items-center justify-between pt-1 border-t border-line/50 text-[10.5px]">
                      <button
                        type="button"
                        onClick={handleApplyToAllSizes}
                        className="text-accent hover:underline cursor-pointer font-medium"
                      >
                        Apply framing to all sizes
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSinglePhoto}
                        className="text-dim hover:text-ink flex items-center gap-1 cursor-pointer"
                        title="Download this single cropped photo as PNG"
                      >
                        <Download size={11} /> Save {FRAMING_PREVIEW_SIZES[framingSize].name}
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
                          updateActiveAdjustment((prev) => ({
                            ...prev,
                            backgroundColor: bg.id as PhotoAdjustmentConfig['backgroundColor']
                          }))
                        }
                        className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-all ${
                          activeAdjustment.backgroundColor === bg.id
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
                      checked={activeAdjustment.showNametag}
                      onChange={(e) =>
                        updateActiveAdjustment((prev) => ({
                          ...prev,
                          showNametag: e.target.checked
                        }))
                      }
                      className="accent-accent cursor-pointer"
                    />
                  </div>
                  {activeAdjustment.showNametag && (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="SURNAME, FIRST NAME, M.I."
                        value={activeAdjustment.nametagText}
                        onChange={(e) =>
                          updateActiveAdjustment((prev) => ({
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
                          {p.widthInches}″ × {p.heightInches}″
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
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-line/60">
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
                            <div>
                              <span className="text-[10px] text-faint block">Wallet (2.5x3.5)</span>
                              <input
                                type="number"
                                min="0"
                                max="8"
                                value={customCounts.wallet}
                                onChange={(e) =>
                                  setCustomCounts((prev) => ({
                                    ...prev,
                                    wallet: Math.max(0, parseInt(e.target.value, 10) || 0)
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
                    checked={showCuttingGuide}
                    onChange={(e) => setShowCuttingGuide(e.target.checked)}
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
                  {photos.length > 1 ? ` (${photos.length} people)` : ''}
                </span>
              </div>

              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                100% Real Physical Scale
              </span>
            </div>

            {/* Document Canvas Preview Surface */}
            <div className="flex-1 overflow-auto bg-base/80 rounded-md border border-line p-4 flex items-center justify-center my-3 min-h-[360px]">
              {photos.length > 0 ? (
                <div className="relative rounded bg-white shadow-2xl transition-transform">
                  <canvas ref={previewCanvasRef} className="rounded block" />
                </div>
              ) : (
                <div className="text-center p-8 text-faint space-y-2">
                  <ImageIcon size={32} className="mx-auto text-faint/50" />
                  <p className="text-[13px] text-dim">No photo loaded yet</p>
                  <p className="text-[11.5px]">
                    Upload pictures or click &ldquo;Load Sample Studio Photo&rdquo; above to see the
                    sheet layout.
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
                  disabled={photos.length === 0 || isExporting}
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
                  disabled={photos.length === 0 || isExporting}
                  className="flex items-center gap-1.5"
                  title="Export high-resolution 300 DPI sheet image"
                >
                  <ImageIcon size={13} />
                  <span>Download Image</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadDocx}
                  disabled={photos.length === 0 || isExporting}
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
                  disabled={photos.length === 0 || isExporting}
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
