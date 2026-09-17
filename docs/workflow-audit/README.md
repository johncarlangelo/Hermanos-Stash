# Workflow compatibility audit — local v0.3.0 candidate

## Generated Markdown reference

[COMPATIBILITY_MATRIX.md](./COMPATIBILITY_MATRIX.md) lists all four port verdicts for every ordered pair, grouped by source.

- `npm run workflow:matrix`: runs workflow tests against the live registry and independent audit fixture in a temporary directory, then publishes the Markdown and both CSVs.
- `npm run workflow:matrix:check`: runs the same validation, compares generated content and exits nonzero for missing/stale artifacts; never rewrites tracked files.
- For a new tool: declare registry capabilities, classify actual input/output domains, update the independent audit fixture and receiver groups, then run both commands. N² / 4N² counts grow automatically; missing fixture entries fail registry checks.
- Commit all three generated files with the tool change. AGENTS.md mandates this process. No CI workflow or Git hook is currently installed; the check command is ready to be added to CI.

## Scope and reproducibility

The registry contains 78 tools. `tools.csv` records each tool's declared file and text ports plus independently reviewed file-domain expectations. `compatibility.csv` contains **6,084 unique ordered tool pairs**. There are 450 permitted file-port links and 1,148 permitted text-port links at this abstraction level.

`workflow.test.ts` compares the production validator with the independent `compatibility-audit.ts` receiver groups for every pair and all four port combinations (24,336 combinations). It also checks the exact catalog membership and port declarations; adding/removing a tool fails the audit until reviewed.

Regenerate CSVs explicitly from the repo root in Git Bash:

```sh
STASH_EXPORT_COMPATIBILITY=1 npm test -- src/renderer/features/workflow/workflow.test.ts
```

Normal test runs do not write audit files. CSV rows are test-verified before export.

## Directional rules

- Sidebar category is never evidence of file compatibility.
- Input/output domains are distinct: video -> audio extraction, video -> GIF, images -> PDF.
- Universal **consumers** accept any audited output. Unknown/mixed **outputs** cannot feed specialized processors without artifact selection.
- ZIP is a container, not its contents. PDF-to-images exports ZIPs; Image Slicer exports individual images or ZIP and is classified as mixed.
- Token Counter reads text/code files, not arbitrary images/audio/archives.
- Missing file capabilities and unaudited domains reject by default.
- Text ports remain content-agnostic: a text wire does not promise valid JSON, SQL, etc.
- The diagonal describes two distinct nodes using the same tool. Actual self-node connections and graph cycles remain rejected separately.

## Source-backed exceptions

| Tool/group | Evidence | Decision |
|---|---|---|
| Icon Pack, QR Decoder, Image OCR | `src/renderer/tools/{icon-pack,qr-decoder,image-ocr}/*Tool.tsx` | Image consumers even under developer/documents categories |
| Audio Extractor | `src/renderer/tools/audio-extract/AudioExtractTool.tsx` | Video input, audio output |
| PDF -> Images | `src/renderer/tools/pdf-to-images/PdfToImagesTool.tsx` (`generateAsync`, ZIP save) | PDF input, archive output |
| Image Slicer | `src/renderer/tools/image-slicer/ImageSlicerTool.tsx` | Image input, mixed individual images / archive output |
| ID Photo Maker | `src/renderer/tools/id-photo-maker/IdPhotoMakerTool.tsx` | Image input; mixed PNG/PDF/DOCX exports, conservatively unknown output |
| Token Counter | `src/renderer/tools/token-counter/TokenCounterTool.tsx` | Text-file input; text output |
| ZIP Extractor / Archive Inspector | `src/renderer/tools/{zip-extract,archive-inspect}/*Tool.tsx` and `src/main/processing/archives.ts` | Archive input; unclassified extracted output |
| SVG Creator / Gradient Studio / QR Generator | respective tool views and `src/renderer/tools/index.ts` | Image output, without inferring domain from UI category |
| PDF manipulators | `src/main/processing/pdf.ts`, PDF tool views | Document here means PDF, not general Office documents |

## Explicit limitations (not completion claims)

This is an exhaustive **static port/media-domain** audit, not 6,084 real file conversions.

- Same-domain codecs/extensions can still differ. For example, SVG/GIF/ICO are images but not accepted by every image consumer; Images-to-PDF embeds JPG/PNG. Runtime artifact/format checks and parameter-aware outputs are future work.
- File/text ports reflect registry declarations, not every standalone view's export button. Some text utilities can save files but do not declare file ports; this audit does not add unsupported workflow ports.
- Mixed-output producers are conservative: valid selected PNG exports from ID Photo Studio cannot currently be distinguished from its PDF/DOCX exports at wire time.
- The built-in Photo ID recipe contains `id-photo-maker -> image-watermark`; the new pre-run gate rejects that legacy wire. Graphs can still load for editing; no saved graph is silently rewritten.
- Linear Queue still uses its existing capability-only validator. Its mock invokers and the canvas's simulated `executeStep` remain unchanged. This work does **not** connect real processing adapters or create actual pipeline artifacts.
- Malformed import schema validation, folder-vs-file cardinality, immediate imported-wire badges, and format-aware chaining remain separate follow-ups.

## Real UI probe

```sh
npm run build
node scripts/e2e-workflow-compatibility.mjs
```

The probe launches a separate Electron user-data directory, drops three real catalog nodes into the built renderer, and dispatches DOM pointer events through the actual canvas handlers (not direct validator calls). It asserts incompatible preview, semantic toast, zero wires for Audio Extractor -> Icon Pack, then compatible preview and one wire for Image Compressor -> Icon Pack. It captures DOM text/screenshots and console errors, checks source/build freshness and data isolation, and terminates only its own Electron process tree. This is not an OS-native mouse or drag/drop certification.

Human branch testing and approval are still required before any push or merge.
