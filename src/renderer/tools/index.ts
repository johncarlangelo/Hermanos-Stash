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
    id: 'regex-tester',
    name: 'Regex Tester',
    category: 'developer',
    description: 'Test regular expressions live with match highlighting, groups and flags.',
    tags: ['regex', 'regexp', 'pattern'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    category: 'developer',
    description: 'Decode JWT headers and payloads locally, with expiry status at a glance.',
    tags: ['jwt', 'token', 'decode', 'auth'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'timestamp-converter',
    name: 'Unix Timestamp Converter',
    category: 'developer',
    description:
      'Convert Unix seconds or milliseconds to readable dates — and back — in UTC and local time.',
    tags: ['unix', 'epoch', 'time', 'date', 'iso'],
    icon: 'clock',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'hash-generator',
    name: 'Hash Generator',
    category: 'developer',
    description:
      'Compute MD5, SHA-1, SHA-256 or SHA-512 digests of text or any file, streamed locally.',
    tags: ['hash', 'sha256', 'md5', 'checksum', 'digest'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      acceptsFiles: true,
      producesText: true
    }
  },
  {
    id: 'url-utils',
    name: 'URL Utilities',
    category: 'developer',
    description: 'Parse URLs into components and percent-encode/decode text safely.',
    tags: ['url', 'encode', 'decode', 'parse', 'query'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'uuid-generator',
    name: 'UUID Generator',
    category: 'developer',
    description: 'Generate random version-4 UUIDs in bulk using the OS secure random source.',
    tags: ['uuid', 'guid', 'id', 'generator'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      producesText: true
    }
  },
  {
    id: 'qr-decoder',
    name: 'QR Decoder',
    category: 'developer',
    description: 'Extract the text payload out of any QR code image, entirely offline.',
    tags: ['qr', 'decode', 'scanner', 'qrcode'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesText: true
    }
  },
  {
    id: 'passphrase-generator',
    name: 'Passphrase Generator',
    category: 'developer',
    description:
      'Create strong diceware-style passphrases or random passwords with live entropy feedback.',
    tags: ['password', 'passphrase', 'security', 'generator', 'entropy'],
    icon: 'lock',
    version: '1.0.0',
    capabilities: {
      producesText: true
    }
  },
  {
    id: 'prompt-library',
    name: 'Prompt Library',
    category: 'future',
    description:
      'Build a local library of reusable prompts with {{variables}} you fill in before copying.',
    tags: ['prompt', 'ai', 'templates', 'library', 'snippets'],
    icon: 'sparkles',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'sql-formatter',
    name: 'SQL Formatter',
    category: 'developer',
    description:
      'Beautify SQL queries with dialect selection and keyword casing, entirely offline.',
    tags: ['sql', 'format', 'query', 'beautify'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'cron-explainer',
    name: 'Cron Helper',
    category: 'developer',
    description:
      'Explain cron expressions in plain language and preview their next five run times.',
    tags: ['cron', 'schedule', 'crontab'],
    icon: 'clock',
    version: '1.0.0',
    capabilities: {
      acceptsText: true
    }
  },
  {
    id: 'text-cases',
    name: 'Case Converter',
    category: 'text',
    description:
      'Convert text between camelCase, snake_case, kebab-case and more, with live counters.',
    tags: ['case', 'camel', 'snake', 'kebab', 'counter', 'words'],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'html-entities',
    name: 'HTML Entities & Slug',
    category: 'text',
    description: 'Escape and unescape HTML entities, or turn any phrase into a clean URL slug.',
    tags: ['html', 'entities', 'escape', 'slug', 'url'],
    icon: 'code',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'mime-lookup',
    name: 'MIME Type Lookup',
    category: 'developer',
    description: 'Search a curated reference of file extensions and MIME types — click to copy.',
    tags: ['mime', 'content-type', 'file', 'reference'],
    icon: 'search',
    version: '1.0.0',
    capabilities: {}
  },
  {
    id: 'http-status',
    name: 'HTTP Status Codes',
    category: 'developer',
    description:
      'Browse all HTTP status codes by class with plain-language meanings — click to copy.',
    tags: ['http', 'status', 'codes', 'reference'],
    icon: 'search',
    version: '1.0.0',
    capabilities: {}
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
    id: 'batch-rename',
    name: 'Batch Rename',
    category: 'files',
    description:
      'Rename many files in a folder at once — find/replace, prefix, suffix, numbering, case and extension rules with a live dry-run preview.',
    tags: ['rename', 'batch', 'files', 'bulk', 'pattern'],
    icon: 'folder',
    version: '1.0.0',
    capabilities: {
      supportsBatch: true
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
    id: 'pdf-rotate',
    name: 'PDF Rotator',
    category: 'documents',
    description:
      'Turn selected pages of a PDF by 90°, 180° or 270° — stacking on top of existing rotation.',
    tags: ['pdf', 'rotate', 'pages'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesFiles: true
    }
  },
  {
    id: 'pdf-compress',
    name: 'PDF Optimizer',
    category: 'documents',
    description:
      'Losslessly rewrite a PDF with compact object streams to shrink file size where possible.',
    tags: ['pdf', 'compress', 'optimize', 'size'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesFiles: true
    }
  },
  {
    id: 'pdf-reorder',
    name: 'PDF Page Reorderer',
    category: 'documents',
    description:
      'Arrange pages into any explicit order — "3, 1-2" puts page 3 first — as a new PDF.',
    tags: ['pdf', 'reorder', 'arrange', 'pages'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesFiles: true
    }
  },
  {
    id: 'images-to-pdf',
    name: 'Images → PDF',
    category: 'documents',
    description:
      'Combine JPG/PNG images into one PDF — one page per image at its natural pixel size.',
    tags: ['images', 'pdf', 'combine', 'jpg', 'png'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      acceptsMultipleFiles: true,
      producesFiles: true
    }
  },
  {
    id: 'pdf-to-images',
    name: 'PDF → Images',
    category: 'documents',
    description:
      'Render every page of a PDF to PNG or JPEG images locally and pack them into one ZIP.',
    tags: ['pdf', 'export', 'png', 'jpg', 'render'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'image-exif',
    name: 'EXIF Inspector',
    category: 'images',
    description:
      'Read camera, lens, exposure, capture date and GPS metadata from photos — entirely offline.',
    tags: ['exif', 'metadata', 'gps', 'camera', 'photo'],
    icon: 'image',
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
  },
  {
    id: 'color-converter',
    name: 'Color Converter',
    category: 'developer',
    description:
      'Convert HEX/RGB/HSL, check WCAG contrast and build shade, tint and harmony palettes.',
    tags: ['color', 'hex', 'rgb', 'hsl', 'palette', 'contrast'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      producesText: true
    }
  },
  {
    id: 'brand-bible',
    name: 'Brand Bible Creator',
    category: 'future',
    description:
      'Compose an exportable brand guide — colors with auto palettes, type pairing, voice and usage rules.',
    tags: ['brand', 'guidelines', 'identity', 'palette', 'style'],
    icon: 'sparkles',
    version: '1.0.0',
    capabilities: {
      producesText: true
    }
  },
  {
    id: 'json-to-types',
    name: 'JSON → TypeScript Types',
    category: 'developer',
    description:
      'Infer TypeScript interfaces or type aliases from any JSON sample, with optional-field detection.',
    tags: ['json', 'typescript', 'types', 'interface', 'codegen'],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {
      acceptsText: true,
      producesText: true
    }
  },
  {
    id: 'image-watermark',
    name: 'Image Watermarker',
    category: 'images',
    description:
      'Stamp a text watermark onto images with position, size, color and opacity control.',
    tags: ['watermark', 'brand', 'stamp', 'overlay'],
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
    id: 'icon-pack',
    name: 'Icon Pack Generator',
    category: 'developer',
    description:
      'Turn one logo into a complete app icon set — nine PNG sizes plus a favicon.ico, locally.',
    tags: ['favicon', 'icons', 'app', 'pack', 'export'],
    icon: 'image',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      supportsProgress: true,
      supportsCancellation: true,
      producesFiles: true
    }
  },
  {
    id: 'social-resizer',
    name: 'Social Preset Resizer',
    category: 'images',
    description:
      'Crop images to social sizes — OG image, X card, Instagram, YouTube, LinkedIn — with smart cropping.',
    tags: ['social', 'og-image', 'resize', 'presets', 'crop'],
    icon: 'crop',
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
    id: 'pdf-to-text',
    name: 'PDF → Text',
    category: 'documents',
    description:
      'Pull the text layer out of PDF pages locally — copy it or save it as a .txt with a page-range filter.',
    tags: ['pdf', 'text', 'extract', 'search'],
    icon: 'file-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesText: true,
      supportsProgress: true
    }
  },
  {
    id: 'image-ocr',
    name: 'Image OCR Extractor',
    category: 'documents',
    description:
      'Extract editable text from images, photos, scans, and screenshots locally using offline Tesseract OCR.',
    tags: ['ocr', 'text', 'extract', 'image', 'scan', 'tesseract', 'photo', 'receipt'],
    icon: 'scan-text',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
      producesText: true,
      supportsProgress: true
    }
  },
  {
    id: 'archive-inspect',
    name: 'Archive Inspector',
    category: 'files',
    description:
      'Inspect, search, and preview files inside archives in-memory without extracting them to disk.',
    tags: ['zip', 'archive', 'inspect', 'preview', 'extract', 'tar', 'unzip', 'password'],
    icon: 'folder',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: true,
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
const QrDecoderTool = lazy(() => import('./qr-decoder/QrDecoderTool'))
const PassphraseGeneratorTool = lazy(() => import('./passphrase-generator/PassphraseGeneratorTool'))
const RegexTesterTool = lazy(() => import('./regex-tester/RegexTesterTool'))
const JwtDecoderTool = lazy(() => import('./jwt-decoder/JwtDecoderTool'))
const TimestampConverterTool = lazy(() => import('./timestamp-converter/TimestampConverterTool'))
const HashGeneratorTool = lazy(() => import('./hash-generator/HashGeneratorTool'))
const UrlUtilsTool = lazy(() => import('./url-utils/UrlUtilsTool'))
const UuidGeneratorTool = lazy(() => import('./uuid-generator/UuidGeneratorTool'))
const PromptLibraryTool = lazy(() => import('./prompt-library/PromptLibraryTool'))
const SqlFormatterTool = lazy(() => import('./sql-formatter/SqlFormatterTool'))
const CronHelperTool = lazy(() => import('./cron-helper/CronHelperTool'))
const CaseConverterTool = lazy(() => import('./case-converter/CaseConverterTool'))
const HtmlEntitiesTool = lazy(() => import('./html-entities/HtmlEntitiesTool'))
const MimeLookupTool = lazy(() => import('./mime-lookup/MimeLookupTool'))
const HttpStatusTool = lazy(() => import('./http-status/HttpStatusTool'))
const ImageConvertTool = lazy(() => import('./image-convert/ImageConvertTool'))
const ImageCompressTool = lazy(() => import('./image-compress/ImageCompressTool'))
const ZipCreateTool = lazy(() => import('./zip-create/ZipCreateTool'))
const ZipExtractTool = lazy(() => import('./zip-extract/ZipExtractTool'))
const BatchRenameTool = lazy(() => import('./batch-rename/BatchRenameTool'))
const PdfMergeTool = lazy(() => import('./pdf-merge/PdfMergeTool'))
const PdfSplitTool = lazy(() => import('./pdf-split/PdfSplitTool'))
const PdfPreviewTool = lazy(() => import('./pdf-preview/PdfPreviewTool'))
const PdfRotateTool = lazy(() => import('./pdf-rotate/PdfRotateTool'))
const PdfCompressTool = lazy(() => import('./pdf-compress/PdfCompressTool'))
const PdfReorderTool = lazy(() => import('./pdf-reorder/PdfReorderTool'))
const ImagesToPdfTool = lazy(() => import('./images-to-pdf/ImagesToPdfTool'))
const PdfToImagesTool = lazy(() => import('./pdf-to-images/PdfToImagesTool'))
const ImageExifTool = lazy(() => import('./image-exif/ImageExifTool'))
const VideoConvertTool = lazy(() => import('./video-convert/VideoConvertTool'))
const VideoCompressTool = lazy(() => import('./video-compress/VideoCompressTool'))
const VideoGifTool = lazy(() => import('./video-gif/VideoGifTool'))
const AudioExtractTool = lazy(() => import('./audio-extract/AudioExtractTool'))
const AudioConvertTool = lazy(() => import('./audio-convert/AudioConvertTool'))
const ColorConverterTool = lazy(() => import('./color-converter/ColorConverterTool'))
const BrandBibleTool = lazy(() => import('./brand-bible/BrandBibleTool'))
const JsonToTypesTool = lazy(() => import('./json-to-types/JsonToTypesTool'))
const PdfToTextTool = lazy(() => import('./pdf-to-text/PdfToTextTool'))
const ImageWatermarkTool = lazy(() => import('./image-watermark/ImageWatermarkTool'))
const IconPackTool = lazy(() => import('./icon-pack/IconPackTool'))
const SocialResizerTool = lazy(() => import('./social-resizer/SocialResizerTool'))
const ImageOcrTool = lazy(() => import('./image-ocr/ImageOcrTool'))
const ArchiveInspectTool = lazy(() => import('./archive-inspect/ArchiveInspectTool'))

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
  'qr-decoder': QrDecoderTool,
  'passphrase-generator': PassphraseGeneratorTool,
  'regex-tester': RegexTesterTool,
  'jwt-decoder': JwtDecoderTool,
  'timestamp-converter': TimestampConverterTool,
  'hash-generator': HashGeneratorTool,
  'url-utils': UrlUtilsTool,
  'uuid-generator': UuidGeneratorTool,
  'prompt-library': PromptLibraryTool,
  'sql-formatter': SqlFormatterTool,
  'cron-explainer': CronHelperTool,
  'text-cases': CaseConverterTool,
  'html-entities': HtmlEntitiesTool,
  'mime-lookup': MimeLookupTool,
  'http-status': HttpStatusTool,
  'image-convert': ImageConvertTool,
  'image-compress': ImageCompressTool,
  'zip-create': ZipCreateTool,
  'zip-extract': ZipExtractTool,
  'batch-rename': BatchRenameTool,
  'pdf-merge': PdfMergeTool,
  'pdf-split': PdfSplitTool,
  'pdf-preview': PdfPreviewTool,
  'pdf-rotate': PdfRotateTool,
  'pdf-compress': PdfCompressTool,
  'pdf-reorder': PdfReorderTool,
  'images-to-pdf': ImagesToPdfTool,
  'pdf-to-images': PdfToImagesTool,
  'image-exif': ImageExifTool,
  'video-convert': VideoConvertTool,
  'video-compress': VideoCompressTool,
  'video-to-gif': VideoGifTool,
  'extract-audio': AudioExtractTool,
  'audio-convert': AudioConvertTool,
  'color-converter': ColorConverterTool,
  'brand-bible': BrandBibleTool,
  'json-to-types': JsonToTypesTool,
  'pdf-to-text': PdfToTextTool,
  'image-watermark': ImageWatermarkTool,
  'icon-pack': IconPackTool,
  'social-resizer': SocialResizerTool,
  'image-ocr': ImageOcrTool,
  'archive-inspect': ArchiveInspectTool
}
