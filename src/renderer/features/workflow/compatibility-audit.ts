/** Independent audit oracle, not imported by application code.
 * Explicit receiver groups reviewed separately from the production domain table.
 * File-domain compatibility is conservative, not a codec/content/execution guarantee.
 */
export const AUDIT_INPUTS: Record<string, readonly string[]> = {
  image:
    'image-convert image-compress image-preview image-exif image-watermark image-palette image-slicer image-grid id-photo-maker image-to-ascii social-resizer images-to-pdf icon-pack image-ocr qr-decoder'.split(
      ' '
    ),
  document:
    'pdf-merge pdf-split pdf-rotate pdf-compress pdf-reorder pdf-numberer pdf-watermark pdf-preview pdf-to-text pdf-to-images'.split(
      ' '
    ),
  video: 'video-convert video-compress video-to-gif extract-audio'.split(' '),
  audio: 'audio-convert audio-trimmer audio-normalize'.split(' '),
  archive: ['zip-extract', 'archive-inspect'],
  textfile: ['token-counter'],
  any: 'file-metadata zip-create checksum-verifier duplicate-finder folder-analyzer hash-generator'.split(
    ' '
  )
}

/** Each row has exactly one audit classification: file input, file output,
 * text input/output. Mixed outputs are deliberately unknown at static wire time.
 */
export const AUDIT_ROWS = `
json-format|-|-|11
base64-codec|-|-|11
markdown-preview|-|-|11
yaml-json|-|-|11
csv-json|-|-|11
text-diff|-|-|11
file-metadata|any|-|00
image-preview|image|-|00
qr-generator|-|image|10
regex-tester|-|-|11
jwt-decoder|-|-|11
timestamp-converter|-|-|11
hash-generator|any|-|11
url-utils|-|-|11
uuid-generator|-|-|01
qr-decoder|image|-|01
passphrase-generator|-|-|01
prompt-library|-|-|11
sql-formatter|-|-|11
cron-explainer|-|-|10
text-cases|-|-|11
html-entities|-|-|11
mime-lookup|-|-|00
http-status|-|-|00
image-convert|image|image|00
image-compress|image|image|00
zip-create|any|archive|00
zip-extract|archive|any|00
batch-rename|-|-|00
pdf-merge|document|document|00
pdf-split|document|document|00
pdf-preview|document|-|00
pdf-rotate|document|document|00
pdf-compress|document|document|00
pdf-reorder|document|document|00
images-to-pdf|image|document|00
pdf-to-images|document|archive|00
image-exif|image|-|00
video-convert|video|video|00
video-compress|video|video|00
video-to-gif|video|image|00
extract-audio|video|audio|00
audio-convert|audio|audio|00
color-converter|-|-|01
brand-bible|-|-|01
json-to-types|-|-|11
image-watermark|image|image|00
icon-pack|image|image|00
social-resizer|image|image|00
pdf-to-text|document|-|01
image-ocr|image|-|01
archive-inspect|archive|any|00
svg-creator|-|image|01
ascii-banner|-|-|11
image-to-ascii|image|-|01
ascii-table|-|-|11
xml-json|-|-|11
text-analyzer|-|-|11
curl-converter|-|-|11
json-schema|-|-|11
chmod-calculator|-|-|01
keypair-generator|-|-|01
semver-calculator|-|-|11
image-palette|image|-|01
image-slicer|image|archive|00
image-grid|image|image|00
gradient-studio|-|image|01
pdf-numberer|document|document|00
pdf-watermark|document|document|00
markdown-to-pdf|-|document|10
duplicate-finder|any|-|01
folder-analyzer|any|-|01
checksum-verifier|any|-|01
audio-trimmer|audio|audio|00
audio-normalize|audio|audio|00
id-photo-maker|image|any|00
token-counter|textfile|-|11
local-llm-playground|-|-|11
`
  .trim()
  .split('\n')
  .map((line) => {
    const [id, input, output, text] = line.split('|')
    return { id, input, output, acceptsText: text[0] === '1', producesText: text[1] === '1' }
  })

export function expectedAuditPorts(
  from: (typeof AUDIT_ROWS)[number],
  to: (typeof AUDIT_ROWS)[number]
) {
  const receivers =
    from.output === '-'
      ? []
      : [...AUDIT_INPUTS.any, ...(AUDIT_INPUTS[from.output === 'any' ? '' : from.output] ?? [])]
  return { files: receivers.includes(to.id), text: from.producesText && to.acceptsText }
}
