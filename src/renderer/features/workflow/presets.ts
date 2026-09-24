/**
 * Hermanos Stash — Official Workflow Templates & Recipes
 *
 * Curated multi-tool pipelines pre-configured with coordinate positions
 * and connected ports, verified against the directional compatibility matrix.
 */

import type { WorkflowTemplate } from './types'

export const BUILT_IN_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'recipe-document-bates-stamper',
    name: 'Document Bates Stamper & PDF Optimizer',
    description:
      'Split multi-section legal documents, stamp sequential page/Bates numbers, apply confidentiality watermarks, and compress file size for email dispatch.',
    category: "Dev's Choice",
    tags: ['pdf', 'legal', 'watermark', 'compress', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-split',
          toolId: 'pdf-split',
          position: { x: 60, y: 140 },
          params: { pageSpec: 'all' }
        },
        {
          id: 'node-number',
          toolId: 'pdf-numberer',
          position: { x: 400, y: 140 },
          params: { position: 'bottom-right', startNumber: 1, prefix: 'BATES-' }
        },
        {
          id: 'node-watermark',
          toolId: 'pdf-watermark',
          position: { x: 740, y: 140 },
          params: { text: 'CONFIDENTIAL', fontSize: 44, opacity: 0.15 }
        },
        {
          id: 'node-compress',
          toolId: 'pdf-compress',
          position: { x: 1080, y: 140 },
          params: {}
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-split',
          fromPort: 'files',
          toNodeId: 'node-number',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-number',
          fromPort: 'files',
          toNodeId: 'node-watermark',
          toPort: 'files'
        },
        {
          id: 'edge-3',
          fromNodeId: 'node-watermark',
          fromPort: 'files',
          toNodeId: 'node-compress',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-video-soundtrack-master',
    name: 'Video Soundtrack Extractor & Master',
    description:
      'Rip raw soundtrack from video footage, trim intros/outros, normalize peak/RMS volume levels, and convert to high-fidelity MP3/WAV.',
    category: "Dev's Choice",
    tags: ['video', 'audio', 'ffmpeg', 'normalize', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-extract',
          toolId: 'extract-audio',
          position: { x: 60, y: 140 },
          params: { format: 'wav' }
        },
        {
          id: 'node-trim',
          toolId: 'audio-trimmer',
          position: { x: 400, y: 140 },
          params: { start: '0', end: '60' }
        },
        {
          id: 'node-norm',
          toolId: 'audio-normalize',
          position: { x: 740, y: 140 },
          params: { targetLufs: -14 }
        },
        {
          id: 'node-convert',
          toolId: 'audio-convert',
          position: { x: 1080, y: 140 },
          params: { format: 'mp3', bitrate: '320k' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-extract',
          fromPort: 'files',
          toNodeId: 'node-trim',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-trim',
          fromPort: 'files',
          toNodeId: 'node-norm',
          toPort: 'files'
        },
        {
          id: 'edge-3',
          fromNodeId: 'node-norm',
          fromPort: 'files',
          toNodeId: 'node-convert',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-ocr-searchable-pdf',
    name: 'Scanned Document OCR & Markdown Generator',
    description:
      'Extract text from image scans via Tesseract OCR, format and preview in Markdown, and export as a clean vector PDF document.',
    category: "Dev's Choice",
    tags: ['ocr', 'tesseract', 'markdown', 'pdf', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-ocr',
          toolId: 'image-ocr',
          position: { x: 60, y: 140 },
          params: { lang: 'eng' }
        },
        {
          id: 'node-md-preview',
          toolId: 'markdown-preview',
          position: { x: 400, y: 140 },
          params: {}
        },
        {
          id: 'node-md-pdf',
          toolId: 'markdown-to-pdf',
          position: { x: 740, y: 140 },
          params: { theme: 'editorial', pageSize: 'a4' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-ocr',
          fromPort: 'text',
          toNodeId: 'node-md-preview',
          toPort: 'text'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-md-preview',
          fromPort: 'text',
          toNodeId: 'node-md-pdf',
          toPort: 'text'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-social-web-packaging',
    name: 'Social & Web Image Optimization Suite',
    description:
      'Batch-scale assets to social media platform presets, stamp branding watermarks, compress web images losslessly, and pack into a clean ZIP archive.',
    category: "Dev's Choice",
    tags: ['image', 'social', 'watermark', 'archive', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-resizer',
          toolId: 'social-resizer',
          position: { x: 60, y: 140 },
          params: { platform: 'instagram', preset: 'square' }
        },
        {
          id: 'node-watermark',
          toolId: 'image-watermark',
          position: { x: 400, y: 140 },
          params: { text: 'HERMANOS STASH', position: 'bottom-right', opacity: 20 }
        },
        {
          id: 'node-compress',
          toolId: 'image-compress',
          position: { x: 740, y: 140 },
          params: { quality: 85 }
        },
        {
          id: 'node-zip',
          toolId: 'zip-create',
          position: { x: 1080, y: 140 },
          params: { archiveName: 'social-assets.zip' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-resizer',
          fromPort: 'files',
          toNodeId: 'node-watermark',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-watermark',
          fromPort: 'files',
          toNodeId: 'node-compress',
          toPort: 'files'
        },
        {
          id: 'edge-3',
          fromNodeId: 'node-compress',
          fromPort: 'files',
          toNodeId: 'node-zip',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-video-to-sticker-gif',
    name: 'Video Clip to Compressed WebP & GIF',
    description:
      'Trim and re-encode high-res video clips, convert into lightweight animated GIF stickers, and compress for web messaging or documentation.',
    category: "Dev's Choice",
    tags: ['video', 'gif', 'webp', 'compress', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-vid-conv',
          toolId: 'video-convert',
          position: { x: 60, y: 140 },
          params: { format: 'mp4', crf: 23 }
        },
        {
          id: 'node-vid-gif',
          toolId: 'video-to-gif',
          position: { x: 400, y: 140 },
          params: { fps: 15, width: 480 }
        },
        {
          id: 'node-img-comp',
          toolId: 'image-compress',
          position: { x: 740, y: 140 },
          params: { quality: 80 }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-vid-conv',
          fromPort: 'files',
          toNodeId: 'node-vid-gif',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-vid-gif',
          fromPort: 'files',
          toNodeId: 'node-img-comp',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-api-json-types-pipeline',
    name: 'API JSON Formatter & TypeScript Generator',
    description:
      'Beautify raw JSON payloads, inspect structure, and auto-generate TypeScript interface declarations for frontend development.',
    category: "Dev's Choice",
    tags: ['json', 'typescript', 'types', 'developer', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-json-fmt',
          toolId: 'json-format',
          position: { x: 60, y: 140 },
          params: { indent: 2, sortKeys: true }
        },
        {
          id: 'node-json-types',
          toolId: 'json-to-types',
          position: { x: 400, y: 140 },
          params: { rootTypeName: 'ApiResponse', targetLanguage: 'typescript' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-json-fmt',
          fromPort: 'text',
          toNodeId: 'node-json-types',
          toPort: 'text'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-crypto-hash-verification',
    name: 'Payload Base64 Encoder & Multi-Digest Hasher',
    description:
      'Encode secret payloads to standard Base64 and compute SHA-256 cryptographic checksums for secure verification and transmission.',
    category: "Dev's Choice",
    tags: ['base64', 'hash', 'security', 'crypto', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-b64',
          toolId: 'base64-codec',
          position: { x: 60, y: 140 },
          params: { mode: 'encode' }
        },
        {
          id: 'node-hash',
          toolId: 'hash-generator',
          position: { x: 400, y: 140 },
          params: { algorithm: 'sha256' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-b64',
          fromPort: 'text',
          toNodeId: 'node-hash',
          toPort: 'text'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-photo-collage-archiver',
    name: 'Multi-Image Grid Contact Sheet & ZIP Archiver',
    description:
      'Assemble multiple photos into a contact sheet collage grid, convert to high-efficiency WebP, and pack into an organized distribution ZIP.',
    category: "Dev's Choice",
    tags: ['image', 'grid', 'convert', 'archive', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-grid',
          toolId: 'image-grid',
          position: { x: 60, y: 140 },
          params: { columns: 3, spacing: 16 }
        },
        {
          id: 'node-conv',
          toolId: 'image-convert',
          position: { x: 400, y: 140 },
          params: { format: 'webp', quality: 90 }
        },
        {
          id: 'node-zip',
          toolId: 'zip-create',
          position: { x: 740, y: 140 },
          params: { archiveName: 'gallery-contact-sheet.zip' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-grid',
          fromPort: 'files',
          toNodeId: 'node-conv',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-conv',
          fromPort: 'files',
          toNodeId: 'node-zip',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-qr-brand-studio',
    name: 'Dynamic QR Code Generator & Brand Stamper',
    description:
      'Generate high-density vector QR codes from text/URLs, embed brand overlays, and optimize resolution for marketing collateral.',
    category: "Dev's Choice",
    tags: ['qr', 'watermark', 'compress', 'marketing', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-qr',
          toolId: 'qr-generator',
          position: { x: 60, y: 140 },
          params: { ecLevel: 'H', size: 512 }
        },
        {
          id: 'node-watermark',
          toolId: 'image-watermark',
          position: { x: 400, y: 140 },
          params: { text: 'SCAN TO VERIFY', position: 'bottom-center', opacity: 30 }
        },
        {
          id: 'node-comp',
          toolId: 'image-compress',
          position: { x: 740, y: 140 },
          params: { quality: 90 }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-qr',
          fromPort: 'files',
          toNodeId: 'node-watermark',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-watermark',
          fromPort: 'files',
          toNodeId: 'node-comp',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  },
  {
    id: 'recipe-pdf-reorder-cleaner',
    name: 'PDF Page Sequence Organizer & Archiver',
    description:
      'Reorder and sanitize PDF document sequences, compress object streams, and package into a timestamped archival ZIP.',
    category: "Dev's Choice",
    tags: ['pdf', 'reorder', 'compress', 'archive', 'dev-choice'],
    graph: {
      nodes: [
        {
          id: 'node-reorder',
          toolId: 'pdf-reorder',
          position: { x: 60, y: 140 },
          params: { sequence: '1-end' }
        },
        {
          id: 'node-compress',
          toolId: 'pdf-compress',
          position: { x: 400, y: 140 },
          params: {}
        },
        {
          id: 'node-zip',
          toolId: 'zip-create',
          position: { x: 740, y: 140 },
          params: { archiveName: 'organized-documents.zip' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-reorder',
          fromPort: 'files',
          toNodeId: 'node-compress',
          toPort: 'files'
        },
        {
          id: 'edge-2',
          fromNodeId: 'node-compress',
          fromPort: 'files',
          toNodeId: 'node-zip',
          toPort: 'files'
        }
      ]
    },
    createdAt: 1727220000000,
    updatedAt: 1727220000000
  }
]
