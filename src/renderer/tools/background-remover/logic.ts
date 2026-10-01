/**
 * Hermanos Stash — Background Remover Tool Logic
 *
 * High-performance, local-first image background removal using
 * border-seeded contiguous flood-fill keying, global chroma isolation,
 * smoothstep alpha feathering, and edge defringing.
 */

export interface RgbColor {
  r: number
  g: number
  b: number
}

export type RemovalMode = 'contiguous' | 'global'

export type BackgroundPreset =
  'transparent' | 'white' | 'black' | 'grey' | 'studio-dark' | 'studio-warm' | 'studio-cool'

export interface BackgroundRemovalOptions {
  keyColor?: RgbColor
  mode?: RemovalMode
  tolerance?: number // 0 to 100
  feather?: number // 0 to 20 px / delta
  defringe?: boolean
}

export const DEFAULT_REMOVAL_OPTIONS: Required<BackgroundRemovalOptions> = {
  keyColor: { r: 255, g: 255, b: 255 },
  mode: 'contiguous',
  tolerance: 20,
  feather: 4,
  defringe: true
}

/**
 * Computes Euclidean color distance normalized to 0..100.
 */
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  // Max possible distance in RGB space is sqrt(255^2 * 3) ≈ 441.67
  const dist = Math.sqrt(dr * dr + dg * dg + db * db)
  return (dist / 441.67295593) * 100
}

/**
 * Analyzes perimeter and corner samples of an image to automatically detect
 * the predominant background color.
 */
export function detectBackgroundColor(imageData: ImageData): RgbColor {
  const { data, width, height } = imageData
  if (width === 0 || height === 0) {
    return { r: 255, g: 255, b: 255 }
  }

  const samples: RgbColor[] = []
  const stepX = Math.max(1, Math.floor(width / 32))
  const stepY = Math.max(1, Math.floor(height / 32))

  // Sample top and bottom rows
  for (let x = 0; x < width; x += stepX) {
    const topIdx = (0 * width + x) * 4
    const botIdx = ((height - 1) * width + x) * 4
    samples.push({ r: data[topIdx], g: data[topIdx + 1], b: data[topIdx + 2] })
    samples.push({ r: data[botIdx], g: data[botIdx + 1], b: data[botIdx + 2] })
  }

  // Sample left and right columns
  for (let y = 0; y < height; y += stepY) {
    const leftIdx = (y * width + 0) * 4
    const rightIdx = (y * width + (width - 1)) * 4
    samples.push({ r: data[leftIdx], g: data[leftIdx + 1], b: data[leftIdx + 2] })
    samples.push({ r: data[rightIdx], g: data[rightIdx + 1], b: data[rightIdx + 2] })
  }

  // Corner weight (corners are almost always background)
  const corners = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4 // bottom-right
  ]
  corners.forEach((idx) => {
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
  })

  // Compute average of the samples
  let totalR = 0
  let totalG = 0
  let totalB = 0
  samples.forEach((s) => {
    totalR += s.r
    totalG += s.g
    totalB += s.b
  })

  const avgR = Math.round(totalR / samples.length)
  const avgG = Math.round(totalG / samples.length)
  const avgB = Math.round(totalB / samples.length)

  return { r: avgR, g: avgG, b: avgB }
}

/**
 * Removes the background of an image using either contiguous edge flood-fill
 * or global chroma keying, returning a newly allocated ImageData with alpha channels.
 */
export function removeBackground(
  srcData: ImageData,
  options?: BackgroundRemovalOptions
): ImageData {
  const width = srcData.width
  const height = srcData.height
  const totalPixels = width * height

  // Allocate clean output array
  const outputData = new Uint8ClampedArray(srcData.data)
  if (width === 0 || height === 0) {
    return { data: outputData, width, height } as unknown as ImageData
  }

  const keyColor = options?.keyColor ?? detectBackgroundColor(srcData)
  const mode = options?.mode ?? 'contiguous'
  const tolerance = Math.max(0, Math.min(100, options?.tolerance ?? 20))
  const feather = Math.max(0, Math.min(50, options?.feather ?? 4))
  const defringe = options?.defringe ?? true

  const maxThreshold = tolerance + feather

  if (mode === 'global') {
    // Global removal: tests every pixel across the image against the key color
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4
      const r = outputData[idx]
      const g = outputData[idx + 1]
      const b = outputData[idx + 2]
      const a = outputData[idx + 3]

      if (a === 0) continue

      const dist = colorDistance(r, g, b, keyColor.r, keyColor.g, keyColor.b)

      if (dist <= tolerance) {
        outputData[idx + 3] = 0 // completely transparent
      } else if (dist < maxThreshold && feather > 0) {
        const factor = (dist - tolerance) / feather
        // Smoothstep interpolation for soft matte edge
        const smoothFactor = factor * factor * (3 - 2 * factor)
        outputData[idx + 3] = Math.round(a * smoothFactor)

        if (defringe) {
          outputData[idx] = Math.round(r * smoothFactor + (1 - smoothFactor) * 128)
          outputData[idx + 1] = Math.round(g * smoothFactor + (1 - smoothFactor) * 128)
          outputData[idx + 2] = Math.round(b * smoothFactor + (1 - smoothFactor) * 128)
        }
      }
    }
  } else {
    // Contiguous mode: BFS from all boundary pixels inwards
    // 0 = unvisited, 1 = transparent background, 2 = semi-transparent feather boundary
    const visited = new Uint8Array(totalPixels)
    const queue = new Int32Array(totalPixels)
    let qHead = 0
    let qTail = 0

    // Seed perimeter pixels
    for (let x = 0; x < width; x++) {
      // Top row
      const topIdx = 0 * width + x
      const topDataIdx = topIdx * 4
      const distTop = colorDistance(
        outputData[topDataIdx],
        outputData[topDataIdx + 1],
        outputData[topDataIdx + 2],
        keyColor.r,
        keyColor.g,
        keyColor.b
      )
      if (distTop <= maxThreshold) {
        visited[topIdx] = 1
        queue[qTail++] = topIdx
      }

      // Bottom row
      const botIdx = (height - 1) * width + x
      const botDataIdx = botIdx * 4
      const distBot = colorDistance(
        outputData[botDataIdx],
        outputData[botDataIdx + 1],
        outputData[botDataIdx + 2],
        keyColor.r,
        keyColor.g,
        keyColor.b
      )
      if (distBot <= maxThreshold && !visited[botIdx]) {
        visited[botIdx] = 1
        queue[qTail++] = botIdx
      }
    }

    for (let y = 1; y < height - 1; y++) {
      // Left column
      const leftIdx = y * width + 0
      const leftDataIdx = leftIdx * 4
      const distLeft = colorDistance(
        outputData[leftDataIdx],
        outputData[leftDataIdx + 1],
        outputData[leftDataIdx + 2],
        keyColor.r,
        keyColor.g,
        keyColor.b
      )
      if (distLeft <= maxThreshold && !visited[leftIdx]) {
        visited[leftIdx] = 1
        queue[qTail++] = leftIdx
      }

      // Right column
      const rightIdx = y * width + (width - 1)
      const rightDataIdx = rightIdx * 4
      const distRight = colorDistance(
        outputData[rightDataIdx],
        outputData[rightDataIdx + 1],
        outputData[rightDataIdx + 2],
        keyColor.r,
        keyColor.g,
        keyColor.b
      )
      if (distRight <= maxThreshold && !visited[rightIdx]) {
        visited[rightIdx] = 1
        queue[qTail++] = rightIdx
      }
    }

    // BFS Flood fill
    while (qHead < qTail) {
      const curr = queue[qHead++]
      const cx = curr % width
      const cy = Math.floor(curr / width)
      const cDataIdx = curr * 4

      const dist = colorDistance(
        outputData[cDataIdx],
        outputData[cDataIdx + 1],
        outputData[cDataIdx + 2],
        keyColor.r,
        keyColor.g,
        keyColor.b
      )

      if (dist <= tolerance) {
        outputData[cDataIdx + 3] = 0
      } else if (dist < maxThreshold && feather > 0) {
        const factor = (dist - tolerance) / feather
        const smoothFactor = factor * factor * (3 - 2 * factor)
        outputData[cDataIdx + 3] = Math.round(outputData[cDataIdx + 3] * smoothFactor)
        // Semi-transparent edge pixels do not expand BFS further into foreground
        continue
      }

      // 4-neighborhood expansion
      const neighbors = [
        cx > 0 ? curr - 1 : -1,
        cx < width - 1 ? curr + 1 : -1,
        cy > 0 ? curr - width : -1,
        cy < height - 1 ? curr + width : -1
      ]

      for (let n = 0; n < 4; n++) {
        const nIdx = neighbors[n]
        if (nIdx < 0 || visited[nIdx]) continue

        const nDataIdx = nIdx * 4
        const nDist = colorDistance(
          outputData[nDataIdx],
          outputData[nDataIdx + 1],
          outputData[nDataIdx + 2],
          keyColor.r,
          keyColor.g,
          keyColor.b
        )

        if (nDist <= maxThreshold) {
          visited[nIdx] = 1
          queue[qTail++] = nIdx
        }
      }
    }
  }

  // Return new ImageData
  if (typeof ImageData !== 'undefined') {
    return new ImageData(outputData, width, height)
  }
  return {
    data: outputData,
    width,
    height,
    colorSpace: 'srgb'
  } as unknown as ImageData
}

/**
 * Formats RGB object as Hex string #RRGGBB
 */
export function rgbToHex(rgb: RgbColor): string {
  const r = Math.max(0, Math.min(255, rgb.r)).toString(16).padStart(2, '0')
  const g = Math.max(0, Math.min(255, rgb.g)).toString(16).padStart(2, '0')
  const b = Math.max(0, Math.min(255, rgb.b)).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`.toUpperCase()
}

/**
 * Parses Hex string #RRGGBB into RGB object
 */
export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '').trim()
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0
    }
  }
  return { r: 255, g: 255, b: 255 }
}
