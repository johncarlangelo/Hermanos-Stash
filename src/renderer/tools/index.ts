import { lazy } from 'react'
import { toolRegistry } from '../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../shared/types/tool'

/**
 * Single registration point for every tool in the catalog.
 *
 * A tool ships as:
 *   1. a `ToolDefinition` (this file) — searchable metadata,
 *   2. a view component mapped in `componentMap` below,
 *   3. pure logic + tests colocated with the implementation.
 *
 * The shell discovers everything through the shared registry; adding a tool
 * never requires touching unrelated application code (ARCHITECTURE.md).
 */

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'json-format',
    name: 'JSON Formatter',
    category: 'text',
    description: 'Pretty-print, minify and validate JSON with precise error locations.',
    tags: ['json', 'format', 'validate', 'minify', 'pretty'],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'base64-codec',
    name: 'Base64 Encoder / Decoder',
    category: 'text',
    description: 'Convert text to Base64 and back, with correct Unicode handling.',
    tags: ['base64', 'encode', 'decode', 'text', 'binary'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'markdown-preview',
    name: 'Markdown Preview',
    category: 'text',
    description: 'Render Markdown to sanitized HTML with a live side-by-side preview.',
    tags: ['markdown', 'md', 'html', 'preview'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'yaml-json',
    name: 'YAML ⇄ JSON Converter',
    category: 'text',
    description: 'Convert YAML to JSON and back with precise error locations.',
    tags: ['yaml', 'json', 'convert'],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'csv-json',
    name: 'CSV ⇄ JSON Converter',
    category: 'text',
    description:
      'Convert CSV/TSV to JSON and back with strict RFC 4180 quoting and delimiter control.',
    tags: ['csv', 'tsv', 'json', 'spreadsheet', 'convert'],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'text-diff',
    name: 'Text Diff',
    category: 'text',
    description: 'Compare two texts line by line and see exactly what was added or removed.',
    tags: ['diff', 'compare', 'changes', 'lines'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'file-metadata',
    name: 'File Metadata Viewer',
    category: 'files',
    description: 'Inspect size, dates, MIME type and full path for any local file.',
    tags: ['metadata', 'properties', 'size', 'dates', 'inspect'],
    icon: 'folder',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      supportsBatch: true
    }
  },
  {
    id: 'image-preview',
    name: 'Image Preview',
    category: 'images',
    description: 'Open and inspect images locally with dimensions, size and zoom controls.',
    tags: ['image', 'preview', 'viewer', 'png', 'jpg', 'webp', 'gif'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true
    }
  },
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    category: 'developer',
    description: 'Generate scannable QR codes from text or URLs, entirely offline.',
    tags: ['qr', 'qrcode', 'generator', 'barcode'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesFiles: true
    }
  },
  {
    id: 'image-convert',
    name: 'Image Converter',
    category: 'images',
    description:
      'Batch-convert images between PNG, JPEG, WebP, AVIF and TIFF with quality control.',
    tags: ['convert', 'format', 'webp', 'jpeg', 'png', 'avif'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      supportsBatch: true,
      producesFiles: true
    }
  },
  {
    id: 'image-compress',
    name: 'Image Compressor',
    category: 'images',
    description: 'Shrink images in place of quality you choose, with optional downscaling.',
    tags: ['compress', 'optimize', 'size', 'resize', 'quality'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      supportsBatch: true,
      producesFiles: true
    }
  },
  {
    id: 'zip-create',
    name: 'ZIP Creator',
    category: 'files',
    description: 'Pack any mix of files into a single .zip archive, entirely locally.',
    tags: ['zip', 'archive', 'pack', 'compress'],
    icon: 'folder',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      supportsProgress: true,
      supportsBatch: true,
      producesFiles: true
    }
  },
  {
    id: 'zip-extract',
    name: 'ZIP Extractor',
    category: 'files',
    description: 'Extract .zip archives into a folder you choose, with zip-slip protection.',
    tags: ['unzip', 'extract', 'archive'],
    icon: 'folder',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesFiles: true
    }
  },
  {
    id: 'pdf-merge',
    name: 'PDF Merger',
    category: 'documents',
    description: 'Combine several PDFs into one document, in exactly the order you choose.',
    tags: ['pdf', 'merge', 'combine', 'join'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      supportsProgress: true,
      supportsBatch: true,
      producesFiles: true
    }
  },
  {
    id: 'pdf-split',
    name: 'PDF Splitter',
    category: 'documents',
    description:
      'Extract page ranges like "1-3, 7" from a PDF into separate documents of their own.',
    tags: ['pdf', 'split', 'extract', 'pages'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'pdf-preview',
    name: 'PDF Preview',
    category: 'documents',
    description: 'Read PDFs locally with fast page navigation, zoom and document details.',
    tags: ['pdf', 'preview', 'viewer', 'read'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true
    }
  },
  {
    id: 'video-convert',
    name: 'Video Converter',
    category: 'video',
    description: 'Convert videos between MP4, WebM and MKV with quality control, locally.',
    tags: ['video', 'convert', 'mp4', 'webm', 'mkv'],
    icon: 'film',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'video-compress',
    name: 'Video Compressor',
    category: 'video',
    description: 'Shrink video files with preset quality levels and optional downscaling.',
    tags: ['video', 'compress', 'shrink', 'size'],
    icon: 'film',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'video-to-gif',
    name: 'Video → GIF',
    category: 'video',
    description: 'Turn short video clips into smooth GIFs using two-pass palette optimization.',
    tags: ['gif', 'animation', 'convert'],
    icon: 'film',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'extract-audio',
    name: 'Audio Extractor',
    category: 'audio',
    description: 'Pull the soundtrack out of any video as AAC, MP3, WAV, FLAC or Opus.',
    tags: ['audio', 'extract', 'soundtrack', 'mp3', 'wav'],
    icon: 'music',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'audio-convert',
    name: 'Audio Converter',
    category: 'audio',
    description: 'Convert audio files between MP3, AAC, WAV, FLAC and Opus locally.',
    tags: ['audio', 'convert', 'mp3', 'flac', 'wav'],
    icon: 'music',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  }
]

for (const definition of TOOL_DEFINITIONS) {
  toolRegistry.register(definition)
}

/** Lazily-loaded view per tool id. */
const JsonFormatTool = lazy(() => import('./json-format/JsonFormatTool'))
const Base64Tool = lazy(() => import('./base64/Base64Tool'))
const MarkdownPreviewTool = lazy(() => import('./markdown-preview/MarkdownPreviewTool'))
const YamlJsonTool = lazy(() => import('./yaml-json/YamlJsonTool'))
const CsvJsonTool = lazy(() => import('./csv-json/CsvJsonTool'))
const TextDiffTool = lazy(() => import('./text-diff/TextDiffTool'))
const FileMetadataTool = lazy(() => import('./file-metadata/FileMetadataTool'))
const ImagePreviewTool = lazy(() => import('./image-preview/ImagePreviewTool'))
const QrGeneratorTool = lazy(() => import('./qr-generator/QrGeneratorTool'))
const ImageConvertTool = lazy(() => import('./image-convert/ImageConvertTool'))
const ImageCompressTool = lazy(() => import('./image-compress/ImageCompressTool'))
const ZipCreateTool = lazy(() => import('./zip-create/ZipCreateTool'))
const ZipExtractTool = lazy(() => import('./zip-extract/ZipExtractTool'))
const PdfMergeTool = lazy(() => import('./pdf-merge/PdfMergeTool'))
const PdfSplitTool = lazy(() => import('./pdf-split/PdfSplitTool'))
const PdfPreviewTool = lazy(() => import('./pdf-preview/PdfPreviewTool'))
const VideoConvertTool = lazy(() => import('./video-convert/VideoConvertTool'))
const VideoCompressTool = lazy(() => import('./video-compress/VideoCompressTool'))
const VideoGifTool = lazy(() => import('./video-gif/VideoGifTool'))
const AudioExtractTool = lazy(() => import('./audio-extract/AudioExtractTool'))
const AudioConvertTool = lazy(() => import('./audio-convert/AudioConvertTool'))

export const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'json-format': JsonFormatTool,
  'base64-codec': Base64Tool,
  'markdown-preview': MarkdownPreviewTool,
  'yaml-json': YamlJsonTool,
  'csv-json': CsvJsonTool,
  'text-diff': TextDiffTool,
  'file-metadata': FileMetadataTool,
  'image-preview': ImagePreviewTool,
  'qr-generator': QrGeneratorTool,
  'image-convert': ImageConvertTool,
  'image-compress': ImageCompressTool,
  'zip-create': ZipCreateTool,
  'zip-extract': ZipExtractTool,
  'pdf-merge': PdfMergeTool,
  'pdf-split': PdfSplitTool,
  'pdf-preview': PdfPreviewTool,
  'video-convert': VideoConvertTool,
  'video-compress': VideoCompressTool,
  'video-to-gif': VideoGifTool,
  'extract-audio': AudioExtractTool,
  'audio-convert': AudioConvertTool
}
