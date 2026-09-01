import { useEffect, useState } from 'react'
import { Check, Copy, Download, Eye, EyeOff, Key, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  generateKeypair,
  type GeneratedKeypair,
  type KeyAlgorithmType,
  type KeyGenOptions
} from './logic'

export default function KeypairGeneratorTool() {
  const [options, setOptions] = useState<KeyGenOptions>({
    algorithm: 'RSA',
    rsaModulus: 2048,
    ecNamedCurve: 'P-256'
  })
  const [keypair, setKeypair] = useState<GeneratedKeypair | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPrivate, setShowPrivate] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await generateKeypair(options)
      setKeypair(res)
      toastSuccess(`Generated ${res.algorithmDetails} Keypair`)
      recordHistoryQuietly('keypair-generator', 'Keypair & Certificate Generator', 'developer')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to generate keypair: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess('Copied to clipboard')
    recordHistoryQuietly('keypair-generator', 'Keypair & Certificate Generator', 'developer')
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/x-pem-file;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Downloaded ${filename}`)
    recordHistoryQuietly('keypair-generator', 'Keypair & Certificate Generator', 'developer')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">
            Cryptographic Keypair & Certificate Generator
          </h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Offline WebCrypto · SPKI / PKCS#8
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="gap-1.5 cursor-pointer text-[11.5px]"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Generating...' : 'Generate New Keypair'}
        </Button>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Options Panel */}
        <Panel className="lg:col-span-4 p-3.5 flex flex-col gap-3 overflow-y-auto">
          {/* Algorithm Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-faint">
              Cryptographic Algorithm
            </label>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              {(['RSA', 'ECDSA', 'Ed25519'] as KeyAlgorithmType[]).map((algo) => (
                <button
                  key={algo}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, algorithm: algo }))}
                  className={`py-2 rounded border font-medium text-center transition-colors cursor-pointer ${
                    options.algorithm === algo
                      ? 'border-accent bg-surface text-accent font-semibold shadow-xs'
                      : 'border-line bg-base text-dim hover:text-ink'
                  }`}
                >
                  {algo}
                </button>
              ))}
            </div>
          </div>

          {/* Algorithm Specific Options */}
          {options.algorithm === 'RSA' ? (
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">Key Length</label>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                {([2048, 3072, 4096] as const).map((bits) => (
                  <button
                    key={bits}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, rsaModulus: bits }))}
                    className={`py-1.5 rounded border text-center font-mono cursor-pointer ${
                      options.rsaModulus === bits
                        ? 'border-accent bg-surface text-accent font-bold'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {bits} bits
                  </button>
                ))}
              </div>
            </div>
          ) : options.algorithm === 'ECDSA' ? (
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">
                Elliptic Curve
              </label>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                {(['P-256', 'P-384', 'P-521'] as const).map((curve) => (
                  <button
                    key={curve}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, ecNamedCurve: curve }))}
                    className={`py-1.5 rounded border text-center font-mono cursor-pointer ${
                      options.ecNamedCurve === curve
                        ? 'border-accent bg-surface text-accent font-bold'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {curve}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded border border-line bg-base/50 p-2.5 text-[11px] text-faint space-y-1">
              <div className="font-semibold text-ink">Ed25519 Curve</div>
              <div>High performance Edwards-curve digital signature algorithm.</div>
            </div>
          )}

          {/* Key Fingerprint Card */}
          {keypair && (
            <div className="rounded border border-line bg-base/60 p-3 space-y-2 text-[11px] mt-auto">
              <div className="text-faint uppercase font-semibold text-[10px]">
                Public Key Fingerprint (SHA-256)
              </div>
              <div className="font-mono text-[10.5px] text-dim break-all bg-base p-1.5 rounded border border-line select-all">
                {keypair.fingerprintSha256}
              </div>
              <div className="flex justify-between text-[10px] text-faint pt-1">
                <span>{keypair.algorithmDetails}</span>
                <span>{new Date(keypair.generatedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </Panel>

        {/* Right Output Panels */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Public Key Card */}
          <Panel className="flex-1 p-3 flex flex-col gap-1.5 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Lock size={13} className="text-emerald-400" />
                <span className="text-[11px] uppercase font-semibold text-faint">
                  Public Key (SPKI)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => keypair && handleCopy(keypair.publicKeyPem, 'pub')}
                  disabled={!keypair}
                  className="text-[10.5px] py-0.5 cursor-pointer"
                >
                  {copied === 'pub' ? <Check size={11} /> : <Copy size={11} />}
                  {copied === 'pub' ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => keypair && handleDownload(keypair.publicKeyPem, 'public_key.pem')}
                  disabled={!keypair}
                  className="text-[10.5px] py-0.5 cursor-pointer"
                >
                  <Download size={11} />
                  Download .pem
                </Button>
              </div>
            </div>

            <pre className="flex-1 rounded border border-line bg-base/90 p-2 font-mono text-[10.5px] text-dim overflow-auto select-all leading-tight">
              {keypair?.publicKeyPem || 'Generating public key...'}
            </pre>
          </Panel>

          {/* Private Key Card */}
          <Panel className="flex-1 p-3 flex flex-col gap-1.5 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Key size={13} className="text-amber-400" />
                <span className="text-[11px] uppercase font-semibold text-faint">
                  Private Key (PKCS#8)
                </span>
                <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 rounded">
                  Keep Secret
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPrivate((p) => !p)}
                  className="text-[10.5px] py-0.5 cursor-pointer"
                >
                  {showPrivate ? <EyeOff size={11} /> : <Eye size={11} />}
                  {showPrivate ? 'Mask' : 'Reveal'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => keypair && handleCopy(keypair.privateKeyPem, 'priv')}
                  disabled={!keypair}
                  className="text-[10.5px] py-0.5 cursor-pointer"
                >
                  {copied === 'priv' ? <Check size={11} /> : <Copy size={11} />}
                  {copied === 'priv' ? 'Copied' : 'Copy'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    keypair && handleDownload(keypair.privateKeyPem, 'private_key.pem')
                  }
                  disabled={!keypair}
                  className="text-[10.5px] py-0.5 cursor-pointer"
                >
                  <Download size={11} />
                  Download .key
                </Button>
              </div>
            </div>

            <pre className="flex-1 rounded border border-line bg-base/90 p-2 font-mono text-[10.5px] text-dim overflow-auto select-all leading-tight">
              {keypair
                ? showPrivate
                  ? keypair.privateKeyPem
                  : `-----BEGIN PRIVATE KEY-----\n${'•'.repeat(48)}\n[Private Key Hidden for Security — Click "Reveal" above]\n${'•'.repeat(48)}\n-----END PRIVATE KEY-----`
                : 'Generating private key...'}
            </pre>
          </Panel>
        </div>
      </div>
    </div>
  )
}
