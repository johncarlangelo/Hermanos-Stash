/**
 * Hermanos Stash — Official Workflow Templates & Recipes
 *
 * Curated multi-tool pipelines pre-configured with coordinate positions
 * and connected ports, ready to execute out of the box.
 */

import type { WorkflowTemplate } from './types'

export const BUILT_IN_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'template-id-photo-studio',
    name: 'Photo ID & Printable Passport Studio',
    description:
      'Prepare portrait photos for official submission: generate tiled 1x1/2x2 grids, stamp confidentiality markings, and export directly to a printable vector PDF.',
    category: 'images',
    tags: ['id-photo', 'passport', 'watermark', 'pdf', 'print'],
    createdAt: 1726000000000,
    updatedAt: 1726000000000,
    graph: {
      nodes: [
        {
          id: 'node-1',
          toolId: 'id-photo-maker',
          position: { x: 60, y: 120 },
          params: { sizePreset: '2x2', sheetSize: 'A4' }
        },
        {
          id: 'node-2',
          toolId: 'image-watermark',
          position: { x: 420, y: 120 },
          params: { text: 'FOR OFFICIAL USE ONLY' }
        },
        {
          id: 'node-3',
          toolId: 'images-to-pdf',
          position: { x: 780, y: 120 },
          params: { pageSize: 'a4', orientation: 'portrait' }
        }
      ],
      edges: [
        {
          id: 'edge-1-2',
          fromNodeId: 'node-1',
          fromPort: 'files',
          toNodeId: 'node-2',
          toPort: 'files'
        },
        {
          id: 'edge-2-3',
          fromNodeId: 'node-2',
          fromPort: 'files',
          toNodeId: 'node-3',
          toPort: 'files'
        }
      ]
    }
  },
  {
    id: 'template-media-transcode',
    name: 'Media Transcoder & Loudness Normalizer',
    description:
      'Ingest video clips, extract audio soundtrack to high-fidelity WAV/AAC, and normalize loudness to Spotify/streaming standards (-14 LUFS).',
    category: 'media',
    tags: ['video', 'audio', 'extract', 'loudness', 'lufs', 'ffmpeg'],
    createdAt: 1726000000000,
    updatedAt: 1726000000000,
    graph: {
      nodes: [
        {
          id: 'node-1',
          toolId: 'video-convert',
          position: { x: 60, y: 120 },
          params: { format: 'mp4', crf: 23 }
        },
        {
          id: 'node-2',
          toolId: 'extract-audio',
          position: { x: 420, y: 120 },
          params: { format: 'wav' }
        },
        {
          id: 'node-3',
          toolId: 'audio-normalize',
          position: { x: 780, y: 120 },
          params: { targetLufs: -14 }
        }
      ],
      edges: [
        {
          id: 'edge-1-2',
          fromNodeId: 'node-1',
          fromPort: 'files',
          toNodeId: 'node-2',
          toPort: 'files'
        },
        {
          id: 'edge-2-3',
          fromNodeId: 'node-2',
          fromPort: 'files',
          toNodeId: 'node-3',
          toPort: 'files'
        }
      ]
    }
  },
  {
    id: 'template-document-security',
    name: 'Document Bates Stamper & PDF Optimizer',
    description:
      'Extract page ranges, apply legal Bates page numbering, watermark diagonal notice, and compress PDF stream sizes.',
    category: 'documents',
    tags: ['pdf', 'bates', 'watermark', 'compress', 'legal'],
    createdAt: 1726000000000,
    updatedAt: 1726000000000,
    graph: {
      nodes: [
        {
          id: 'node-1',
          toolId: 'pdf-split',
          position: { x: 60, y: 120 },
          params: { range: '1-5' }
        },
        {
          id: 'node-2',
          toolId: 'pdf-numberer',
          position: { x: 420, y: 120 },
          params: { prefix: 'CONFIDENTIAL-DOC-' }
        },
        {
          id: 'node-3',
          toolId: 'pdf-watermark',
          position: { x: 780, y: 120 },
          params: { text: 'STRICTLY PRIVATE' }
        },
        {
          id: 'node-4',
          toolId: 'pdf-compress',
          position: { x: 1140, y: 120 },
          params: {}
        }
      ],
      edges: [
        {
          id: 'edge-1-2',
          fromNodeId: 'node-1',
          fromPort: 'files',
          toNodeId: 'node-2',
          toPort: 'files'
        },
        {
          id: 'edge-2-3',
          fromNodeId: 'node-2',
          fromPort: 'files',
          toNodeId: 'node-3',
          toPort: 'files'
        },
        {
          id: 'edge-3-4',
          fromNodeId: 'node-3',
          fromPort: 'files',
          toNodeId: 'node-4',
          toPort: 'files'
        }
      ]
    }
  },
  {
    id: 'template-developer-schema',
    name: 'API Payload Inspector & Schema Validator',
    description:
      'Convert raw cURL requests into JavaScript fetch calls, infer JSON Draft-07 schemas from responses, and pretty-print JSON payload.',
    category: 'developer',
    tags: ['curl', 'json', 'schema', 'api', 'types'],
    createdAt: 1726000000000,
    updatedAt: 1726000000000,
    graph: {
      nodes: [
        {
          id: 'node-1',
          toolId: 'curl-converter',
          position: { x: 60, y: 120 },
          params: {}
        },
        {
          id: 'node-2',
          toolId: 'json-schema',
          position: { x: 420, y: 120 },
          params: {}
        },
        {
          id: 'node-3',
          toolId: 'json-format',
          position: { x: 780, y: 120 },
          params: { indent: 2 }
        }
      ],
      edges: [
        {
          id: 'edge-1-2',
          fromNodeId: 'node-1',
          fromPort: 'text',
          toNodeId: 'node-2',
          toPort: 'text'
        },
        {
          id: 'edge-2-3',
          fromNodeId: 'node-2',
          fromPort: 'text',
          toNodeId: 'node-3',
          toPort: 'text'
        }
      ]
    }
  }
]
