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
  }
]

for (const definition of TOOL_DEFINITIONS) {
  toolRegistry.register(definition)
}

/** Lazily-loaded view per tool id. */
const JsonFormatTool = lazy(() => import('./json-format/JsonFormatTool'))
const Base64Tool = lazy(() => import('./base64/Base64Tool'))
const FileMetadataTool = lazy(() => import('./file-metadata/FileMetadataTool'))
const ImagePreviewTool = lazy(() => import('./image-preview/ImagePreviewTool'))
const QrGeneratorTool = lazy(() => import('./qr-generator/QrGeneratorTool'))
const ImageConvertTool = lazy(() => import('./image-convert/ImageConvertTool'))
const ImageCompressTool = lazy(() => import('./image-compress/ImageCompressTool'))
const ZipCreateTool = lazy(() => import('./zip-create/ZipCreateTool'))
const ZipExtractTool = lazy(() => import('./zip-extract/ZipExtractTool'))

export const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'json-format': JsonFormatTool,
  'base64-codec': Base64Tool,
  'file-metadata': FileMetadataTool,
  'image-preview': ImagePreviewTool,
  'qr-generator': QrGeneratorTool,
  'image-convert': ImageConvertTool,
  'image-compress': ImageCompressTool,
  'zip-create': ZipCreateTool,
  'zip-extract': ZipExtractTool
}
