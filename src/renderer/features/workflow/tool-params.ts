/**
 * Hermanos Stash — Queue Workflow Tool Parameter Schemas
 *
 * Defines canonical parameter schemas for tools configurable within the workflow canvas.
 * Every field matches the exact parameter keys, types, options, and defaults
 * established in the corresponding workspace tool implementation.
 */

export type ParamInputType = 'text' | 'number' | 'range' | 'select' | 'boolean' | 'color'

export interface ParamOption {
  value: string | number
  label: string
}

export interface ToolParamField {
  /** Canonical parameter key used by the processor */
  key: string
  /** Human-readable label displayed in node detail drawer */
  label: string
  /** Form control type */
  type: ParamInputType
  /** Default fallback value if unspecified */
  defaultValue?: unknown
  /** Input placeholder string */
  placeholder?: string
  /** Explanatory hint or unit */
  hint?: string
  /** Unit indicator (e.g. 'px', '%', 'pt', '°', 'LUFS') */
  unit?: string
  /** Options list for 'select' inputs */
  options?: ParamOption[]
  /** Min bound for number/range */
  min?: number
  /** Max bound for number/range */
  max?: number
  /** Step increment for number/range */
  step?: number
  /** Alternate parameter keys for backward compatibility with templates and legacy graphs */
  aliases?: string[]
}

export const WORKFLOW_TOOL_PARAMS: Record<string, ToolParamField[]> = {
  // --- Documents (PDF) ---
  'pdf-watermark': [
    {
      key: 'text',
      label: 'Watermark Text',
      type: 'text',
      defaultValue: 'CONFIDENTIAL',
      placeholder: 'e.g. CONFIDENTIAL, DRAFT, STRICTLY PRIVATE',
      aliases: ['watermark', 'watermarkText']
    },
    {
      key: 'fontSize',
      label: 'Font Size',
      type: 'range',
      defaultValue: 48,
      min: 12,
      max: 120,
      step: 2,
      unit: 'pt'
    },
    {
      key: 'rotationDegrees',
      label: 'Rotation Angle',
      type: 'range',
      defaultValue: -45,
      min: -90,
      max: 90,
      step: 5,
      unit: '°',
      aliases: ['rotation']
    },
    {
      key: 'opacity',
      label: 'Stamp Opacity',
      type: 'range',
      defaultValue: 0.15,
      min: 0.05,
      max: 1.0,
      step: 0.05,
      unit: ''
    },
    {
      key: 'colorHex',
      label: 'Watermark Color',
      type: 'color',
      defaultValue: '#ef4444'
    },
    {
      key: 'tiled',
      label: '3×3 Repeated Tile Pattern',
      type: 'boolean',
      defaultValue: false,
      hint: 'Repeats watermark in a diagonal 3x3 matrix across the page'
    },
    {
      key: 'pageRangeText',
      label: 'Page Range',
      type: 'text',
      defaultValue: 'all',
      placeholder: 'all or 1-5, 8',
      aliases: ['pageRanges', 'range']
    }
  ],

  'pdf-numberer': [
    {
      key: 'format',
      label: 'Numbering Format',
      type: 'select',
      defaultValue: 'page-of-total',
      options: [
        { value: 'page-of-total', label: 'Page N of Total (Page 1 of 10)' },
        { value: 'bates', label: 'Legal Bates Stamp (DOC-000001)' },
        { value: 'slash-total', label: 'Slash Total (1 / 10)' },
        { value: 'page-n', label: 'Page N (Page 1)' },
        { value: 'dash-n', label: 'Dash (- 1 -)' }
      ]
    },
    {
      key: 'batesPrefix',
      label: 'Bates Prefix',
      type: 'text',
      defaultValue: 'DOC-',
      placeholder: 'e.g. DOC-, CONFIDENTIAL-',
      aliases: ['prefix']
    },
    {
      key: 'batesDigits',
      label: 'Bates Digit Padding',
      type: 'number',
      defaultValue: 6,
      min: 3,
      max: 10,
      unit: 'digits'
    },
    {
      key: 'position',
      label: 'Position on Page',
      type: 'select',
      defaultValue: 'bottom-center',
      options: [
        { value: 'bottom-center', label: 'Bottom Center' },
        { value: 'bottom-right', label: 'Bottom Right' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'top-center', label: 'Top Center' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'top-left', label: 'Top Left' }
      ]
    },
    {
      key: 'startNumber',
      label: 'Starting Number',
      type: 'number',
      defaultValue: 1,
      min: 1,
      aliases: ['startingNumber']
    },
    {
      key: 'fontSize',
      label: 'Font Size',
      type: 'range',
      defaultValue: 10,
      min: 6,
      max: 24,
      step: 1,
      unit: 'pt'
    },
    {
      key: 'colorHex',
      label: 'Text Color',
      type: 'color',
      defaultValue: '#333333'
    },
    {
      key: 'pageRangeText',
      label: 'Page Range',
      type: 'text',
      defaultValue: 'all',
      placeholder: 'all or 2- (skip cover)',
      aliases: ['pageRanges', 'range']
    }
  ],

  'pdf-split': [
    {
      key: 'pageSpec',
      label: 'Page Specification / Ranges',
      type: 'text',
      defaultValue: '1',
      placeholder: 'e.g. 1-5, 8, 10-12 or all',
      hint: 'Supports comma-separated page ranges or single page numbers',
      aliases: ['range', 'pageRanges']
    }
  ],

  'pdf-rotate': [
    {
      key: 'angle',
      label: 'Rotation Angle',
      type: 'select',
      defaultValue: 90,
      options: [
        { value: 90, label: '90° Clockwise' },
        { value: 180, label: '180° Flip' },
        { value: 270, label: '270° Counter-Clockwise' }
      ]
    },
    {
      key: 'pageSpec',
      label: 'Target Pages',
      type: 'text',
      defaultValue: 'all',
      placeholder: 'all or 1-3',
      aliases: ['pageRanges', 'range']
    }
  ],

  'pdf-reorder': [
    {
      key: 'pageSpec',
      label: 'New Page Order',
      type: 'text',
      defaultValue: '1',
      placeholder: 'e.g. 3,1,2 or reverse'
    }
  ],

  'images-to-pdf': [
    {
      key: 'pageSize',
      label: 'PDF Page Size',
      type: 'select',
      defaultValue: 'a4',
      options: [
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'US Letter' },
        { value: 'fit', label: 'Fit Original Image Dimensions' }
      ]
    },
    {
      key: 'orientation',
      label: 'Page Orientation',
      type: 'select',
      defaultValue: 'portrait',
      options: [
        { value: 'portrait', label: 'Portrait' },
        { value: 'landscape', label: 'Landscape' }
      ]
    }
  ],

  'markdown-to-pdf': [
    {
      key: 'pageSize',
      label: 'Page Size',
      type: 'select',
      defaultValue: 'a4',
      options: [
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'US Letter' }
      ]
    }
  ],

  // --- Images ---
  'image-convert': [
    {
      key: 'format',
      label: 'Output Format',
      type: 'select',
      defaultValue: 'png',
      options: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
        { value: 'avif', label: 'AVIF' },
        { value: 'tiff', label: 'TIFF' }
      ]
    },
    {
      key: 'quality',
      label: 'Output Quality',
      type: 'range',
      defaultValue: 85,
      min: 10,
      max: 100,
      step: 5,
      unit: '%'
    }
  ],

  'image-compress': [
    {
      key: 'quality',
      label: 'Compression Quality',
      type: 'range',
      defaultValue: 75,
      min: 10,
      max: 100,
      step: 5,
      unit: '%'
    },
    {
      key: 'maxDimension',
      label: 'Maximum Dimension',
      type: 'select',
      defaultValue: 0,
      options: [
        { value: 0, label: 'Original Dimensions' },
        { value: 1920, label: '1920 px (Full HD)' },
        { value: 1280, label: '1280 px (HD)' },
        { value: 800, label: '800 px (Compact)' }
      ],
      hint: 'Optionally scales down larger images while preserving aspect ratio'
    }
  ],

  'image-watermark': [
    {
      key: 'text',
      label: 'Watermark Text',
      type: 'text',
      defaultValue: 'Hermanos Stash',
      placeholder: 'e.g. Hermanos Stash, COPYRIGHT',
      aliases: ['watermarkText', 'watermark']
    },
    {
      key: 'position',
      label: 'Position',
      type: 'select',
      defaultValue: 'bottom-right',
      options: [
        { value: 'bottom-right', label: 'Bottom Right' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'top-left', label: 'Top Left' },
        { value: 'center', label: 'Center' }
      ]
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'range',
      defaultValue: 0.6,
      min: 0.1,
      max: 1.0,
      step: 0.05
    },
    {
      key: 'fontSize',
      label: 'Font Size',
      type: 'range',
      defaultValue: 28,
      min: 12,
      max: 96,
      step: 2,
      unit: 'px'
    },
    {
      key: 'color',
      label: 'Watermark Color',
      type: 'color',
      defaultValue: '#ffffff',
      aliases: ['colorHex']
    }
  ],

  'social-resizer': [
    {
      key: 'presetId',
      label: 'Social Media Size Preset',
      type: 'select',
      defaultValue: 'instagram-square',
      options: [
        { value: 'instagram-square', label: 'Instagram Square (1080 × 1080)' },
        { value: 'instagram-portrait', label: 'Instagram Portrait (1080 × 1350)' },
        { value: 'instagram-story', label: 'Instagram Story (1080 × 1920)' },
        { value: 'youtube-thumb', label: 'YouTube Thumbnail (1280 × 720)' },
        { value: 'og-image', label: 'Open Graph / Meta Image (1200 × 630)' },
        { value: 'x-card', label: 'X / Twitter Card (1200 × 675)' },
        { value: 'linkedin', label: 'LinkedIn Post (1200 × 627)' },
        { value: 'facebook-link', label: 'Facebook Link (1200 × 630)' }
      ]
    }
  ],

  'id-photo-maker': [
    {
      key: 'sizePreset',
      label: 'Photo Dimension Preset',
      type: 'select',
      defaultValue: '2x2',
      options: [
        { value: '2x2', label: '2" × 2" (US Passport / Official)' },
        { value: '1x1', label: '1" × 1" (Standard ID)' },
        { value: 'passport', label: '35 × 45 mm (EU / UK / Schengen Passport)' }
      ]
    },
    {
      key: 'sheetSize',
      label: 'Print Sheet Size',
      type: 'select',
      defaultValue: 'A4',
      options: [
        { value: 'A4', label: 'A4 Paper' },
        { value: 'Letter', label: 'US Letter' },
        { value: '4x6', label: '4" × 6" Photo Paper' }
      ]
    }
  ],

  'image-slicer': [
    {
      key: 'rows',
      label: 'Grid Rows',
      type: 'number',
      defaultValue: 2,
      min: 1,
      max: 10
    },
    {
      key: 'cols',
      label: 'Grid Columns',
      type: 'number',
      defaultValue: 2,
      min: 1,
      max: 10
    }
  ],

  'image-grid': [
    {
      key: 'columns',
      label: 'Collage Columns',
      type: 'number',
      defaultValue: 3,
      min: 1,
      max: 8
    },
    {
      key: 'spacing',
      label: 'Tile Spacing',
      type: 'range',
      defaultValue: 8,
      min: 0,
      max: 48,
      unit: 'px'
    }
  ],

  // --- Video ---
  'video-convert': [
    {
      key: 'format',
      label: 'Video Container',
      type: 'select',
      defaultValue: 'mp4',
      options: [
        { value: 'mp4', label: 'MP4 (H.264 / AAC - Universal)' },
        { value: 'webm', label: 'WebM (VP9 - Web Native)' },
        { value: 'mkv', label: 'MKV (Matroska - Lossless container)' }
      ]
    },
    {
      key: 'crfQuality',
      label: 'Constant Rate Factor (CRF)',
      type: 'range',
      defaultValue: 23,
      min: 14,
      max: 35,
      step: 1,
      hint: 'Lower = higher quality & larger file (Default: 23)',
      aliases: ['crf', 'quality']
    }
  ],

  'video-compress': [
    {
      key: 'crfQuality',
      label: 'Target Quality / Compression Rate',
      type: 'range',
      defaultValue: 28,
      min: 18,
      max: 40,
      step: 1,
      hint: 'Standard web compression: 28',
      aliases: ['crf', 'quality']
    },
    {
      key: 'maxDimension',
      label: 'Maximum Resolution / Dimension',
      type: 'select',
      defaultValue: 0,
      options: [
        { value: 0, label: 'Original Resolution' },
        { value: 1920, label: '1080p (1920 px)' },
        { value: 1280, label: '720p (1280 px)' },
        { value: 854, label: '480p (854 px)' }
      ]
    }
  ],

  'video-to-gif': [
    {
      key: 'fps',
      label: 'Animation Frame Rate',
      type: 'range',
      defaultValue: 15,
      min: 5,
      max: 30,
      step: 1,
      unit: 'fps'
    },
    {
      key: 'maxWidth',
      label: 'Maximum Width',
      type: 'range',
      defaultValue: 640,
      min: 240,
      max: 1280,
      step: 40,
      unit: 'px'
    }
  ],

  'extract-audio': [
    {
      key: 'format',
      label: 'Extracted Audio Format',
      type: 'select',
      defaultValue: 'mp3',
      options: [
        { value: 'mp3', label: 'MP3 (MPEG Audio)' },
        { value: 'wav', label: 'WAV (Uncompressed PCM)' },
        { value: 'aac', label: 'AAC (Advanced Audio Coding)' },
        { value: 'flac', label: 'FLAC (Lossless)' },
        { value: 'opus', label: 'Opus (Modern High-Efficiency)' }
      ],
      aliases: ['codec']
    },
    {
      key: 'bitrateKbps',
      label: 'Audio Bitrate',
      type: 'select',
      defaultValue: 192,
      options: [
        { value: 320, label: '320 kbps (High Fidelity)' },
        { value: 256, label: '256 kbps' },
        { value: 192, label: '192 kbps (Standard)' },
        { value: 128, label: '128 kbps (Compact)' }
      ],
      aliases: ['bitrate']
    }
  ],

  // --- Audio ---
  'audio-convert': [
    {
      key: 'codec',
      label: 'Target Audio Codec',
      type: 'select',
      defaultValue: 'mp3',
      options: [
        { value: 'mp3', label: 'MP3 (Universal compatibility)' },
        { value: 'wav', label: 'WAV (Uncompressed 16-bit PCM)' },
        { value: 'aac', label: 'AAC (High quality streaming)' },
        { value: 'flac', label: 'FLAC (Lossless studio audio)' },
        { value: 'opus', label: 'Opus (VoIP / Low latency)' }
      ],
      aliases: ['format']
    },
    {
      key: 'bitrateKbps',
      label: 'Audio Bitrate',
      type: 'select',
      defaultValue: 192,
      options: [
        { value: 320, label: '320 kbps (High Fidelity)' },
        { value: 256, label: '256 kbps' },
        { value: 192, label: '192 kbps (Standard)' },
        { value: 128, label: '128 kbps (Compact)' }
      ],
      aliases: ['bitrate']
    }
  ],

  'audio-normalize': [
    {
      key: 'targetLufs',
      label: 'Integrated Target Loudness',
      type: 'range',
      defaultValue: -14,
      min: -24,
      max: -9,
      step: 1,
      unit: 'LUFS',
      hint: 'Streaming standard (Spotify/YouTube): -14 LUFS; Broadcast: -23 LUFS'
    }
  ],

  'audio-trimmer': [
    {
      key: 'startTime',
      label: 'Start Offset',
      type: 'number',
      defaultValue: 0,
      min: 0,
      unit: 'sec'
    },
    {
      key: 'duration',
      label: 'Clip Duration',
      type: 'number',
      defaultValue: 30,
      min: 1,
      unit: 'sec'
    }
  ],

  // --- Text & Developer ---
  'json-format': [
    {
      key: 'mode',
      label: 'Format Mode',
      type: 'select',
      defaultValue: 'pretty',
      options: [
        { value: 'pretty', label: 'Pretty Print (Indented)' },
        { value: 'minify', label: 'Minify (Single line)' }
      ]
    },
    {
      key: 'indent',
      label: 'Indentation',
      type: 'select',
      defaultValue: 2,
      options: [
        { value: 2, label: '2 Spaces' },
        { value: 4, label: '4 Spaces' },
        { value: 1, label: '1 Tab' }
      ],
      aliases: ['indentChoice']
    }
  ],

  'text-cases': [
    {
      key: 'caseMode',
      label: 'Casing Style',
      type: 'select',
      defaultValue: 'upper',
      options: [
        { value: 'upper', label: 'UPPERCASE' },
        { value: 'lower', label: 'lowercase' },
        { value: 'title', label: 'Title Case' },
        { value: 'camel', label: 'camelCase' },
        { value: 'pascal', label: 'PascalCase' },
        { value: 'snake', label: 'snake_case' },
        { value: 'kebab', label: 'kebab-case' },
        { value: 'constant', label: 'CONSTANT_CASE' },
        { value: 'sentence', label: 'Sentence case' }
      ],
      aliases: ['mode', 'casing']
    }
  ],

  'case-converter': [
    {
      key: 'caseMode',
      label: 'Casing Style',
      type: 'select',
      defaultValue: 'upper',
      options: [
        { value: 'upper', label: 'UPPERCASE' },
        { value: 'lower', label: 'lowercase' },
        { value: 'title', label: 'Title Case' },
        { value: 'camel', label: 'camelCase' },
        { value: 'pascal', label: 'PascalCase' },
        { value: 'snake', label: 'snake_case' },
        { value: 'kebab', label: 'kebab-case' },
        { value: 'constant', label: 'CONSTANT_CASE' },
        { value: 'sentence', label: 'Sentence case' }
      ],
      aliases: ['mode', 'casing']
    }
  ],

  'hash-generator': [
    {
      key: 'algorithm',
      label: 'Hash Algorithm',
      type: 'select',
      defaultValue: 'sha256',
      options: [
        { value: 'sha256', label: 'SHA-256' },
        { value: 'sha512', label: 'SHA-512' },
        { value: 'md5', label: 'MD5 (Legacy checksum)' },
        { value: 'sha1', label: 'SHA-1' }
      ],
      aliases: ['algo']
    }
  ],

  'base64-codec': [
    {
      key: 'direction',
      label: 'Operation Direction',
      type: 'select',
      defaultValue: 'encode',
      options: [
        { value: 'encode', label: 'Encode to Base64' },
        { value: 'decode', label: 'Decode from Base64' }
      ],
      aliases: ['mode']
    }
  ],

  'qr-generator': [
    {
      key: 'errorCorrection',
      label: 'Error Correction Level',
      type: 'select',
      defaultValue: 'M',
      options: [
        { value: 'L', label: 'L - Low (7% recovery)' },
        { value: 'M', label: 'M - Medium (15% recovery)' },
        { value: 'Q', label: 'Q - Quartile (25% recovery)' },
        { value: 'H', label: 'H - High (30% recovery)' }
      ]
    },
    {
      key: 'size',
      label: 'Canvas Size',
      type: 'range',
      defaultValue: 300,
      min: 150,
      max: 800,
      step: 50,
      unit: 'px'
    }
  ],

  'ascii-banner': [
    {
      key: 'font',
      label: 'Banner Font Style',
      type: 'select',
      defaultValue: 'Standard',
      options: [
        { value: 'Standard', label: 'Standard' },
        { value: 'Slant', label: 'Slant' },
        { value: 'Big', label: 'Big' },
        { value: 'Small', label: 'Small' },
        { value: 'Banner', label: 'Banner' }
      ]
    }
  ],

  'yaml-json': [
    {
      key: 'direction',
      label: 'Conversion Direction',
      type: 'select',
      defaultValue: 'yaml-to-json',
      options: [
        { value: 'yaml-to-json', label: 'YAML → JSON' },
        { value: 'json-to-yaml', label: 'JSON → YAML' }
      ]
    }
  ],

  'csv-json': [
    {
      key: 'direction',
      label: 'Conversion Direction',
      type: 'select',
      defaultValue: 'csv-to-json',
      options: [
        { value: 'csv-to-json', label: 'CSV → JSON' },
        { value: 'json-to-csv', label: 'JSON → CSV' }
      ]
    },
    {
      key: 'delimiter',
      label: 'CSV Delimiter',
      type: 'select',
      defaultValue: ',',
      options: [
        { value: ',', label: 'Comma (,)' },
        { value: '\t', label: 'Tab (\\t)' },
        { value: ';', label: 'Semicolon (;)' }
      ]
    }
  ]
}

/**
 * Retrieve parameter configuration fields for a tool by its ID.
 * Returns empty array if the tool operates with standard automatic processing.
 */
export function getToolParamFields(toolId: string): ToolParamField[] {
  return WORKFLOW_TOOL_PARAMS[toolId] || []
}

/**
 * Resolve parameter value from node.params, inspecting canonical key first,
 * then configured aliases, and falling back to default.
 */
export function resolveParamValue(
  params: Record<string, unknown> | undefined,
  field: ToolParamField
): unknown {
  if (!params) return field.defaultValue

  // If an alias holds an explicit non-empty user value while the canonical key holds the default/preset placeholder,
  // honor the user's customized alias input.
  if (field.aliases) {
    for (const alias of field.aliases) {
      const aliasVal = params[alias]
      const canonVal = params[field.key]
      if (
        aliasVal !== undefined &&
        aliasVal !== '' &&
        canonVal !== undefined &&
        aliasVal !== canonVal &&
        (canonVal === field.defaultValue || canonVal === 'STRICTLY PRIVATE')
      ) {
        return aliasVal
      }
    }
  }

  if (params[field.key] !== undefined) {
    return params[field.key]
  }

  if (field.aliases) {
    for (const alias of field.aliases) {
      if (params[alias] !== undefined) {
        return params[alias]
      }
    }
  }

  return field.defaultValue
}
