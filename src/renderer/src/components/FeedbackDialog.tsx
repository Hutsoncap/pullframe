import { useEffect, useMemo, useRef, useState } from 'react'
import type { BinaryStatus, LicenseState } from '../types'

type FeedbackCategory = 'general' | 'bug' | 'feature' | 'license' | 'download' | 'update'
type FeedbackMode = 'feedback' | 'support'

interface FeedbackDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null)
  const [mode, setMode] = useState<FeedbackMode>('feedback')
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const messageRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    window.api.getBinaryStatus().then(setBinaryStatus).catch(() => {})
    window.api.getAppVersion().then(setAppVersion).catch(() => {})
    window.api.getLicenseState().then(setLicenseState).catch(() => {})
    setResult(null)
    setIsSubmitted(false)
    setMode('feedback')
    window.setTimeout(() => messageRef.current?.focus(), 50)
  }, [isOpen])

  const diagnostics = useMemo(() => ({
    appVersion: appVersion ?? 'unknown',
    ytDlpVersion: binaryStatus?.ytdlpVersion ?? 'unknown',
    ffmpegVersion: shortFfmpegVersion(binaryStatus?.ffmpegVersion),
    licenseState: licenseState?.isActivated ? 'licensed' : licenseState?.trialStatus === 'voided' ? 'voided' : licenseState?.isTrialExpired ? 'expired' : 'trial',
    trialSource: licenseState?.trialSource ?? 'local',
    plan: licenseState?.entitlement?.plan ?? null
  }), [appVersion, binaryStatus, licenseState])

  const handleSubmit = async (): Promise<void> => {
    const trimmedMessage = message.trim()
    const trimmedEmail = email.trim()
    if (!trimmedMessage) return
    if (mode === 'support' && !isValidEmail(trimmedEmail)) {
      setResult('Support tickets require a valid email address.')
      return
    }

    setIsSubmitting(true)
    setResult(null)
    try {
      await window.api.submitFeedback({
        category,
        message: trimmedMessage,
        email: trimmedEmail || null,
        diagnostics: {
          ...diagnostics,
          requestKind: mode === 'support' ? 'support_ticket' : 'feedback',
          replyRequested: mode === 'support'
        }
      })
      setMessage('')
      setIsSubmitted(true)
    } catch (err) {
      setResult(`Feedback failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return <></>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-lg border border-surface-700/70 bg-surface-900 shadow-2xl shadow-black/50">
        {isSubmitted ? (
          <div className="relative flex min-h-[500px] flex-col px-5 py-4">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800/60 hover:text-surface-200"
              title="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <h3 className="max-w-xs text-xl font-semibold leading-snug text-surface-100">
                {mode === 'support' ? 'Support request sent, thank you!' : 'Feedback submitted, thank you!'}
              </h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-surface-400">
                {mode === 'support'
                  ? 'A confirmation will be sent to your email.'
                  : 'Your note and attached diagnostics were sent.'}
              </p>
            </div>
            <button onClick={onClose} className="btn-primary w-full px-3 py-2 text-xs">
              Dismiss
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-surface-800 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-surface-100">Send Feedback</h2>
                <p className="mt-1 text-xs text-surface-500">{mode === 'support' ? 'Send a support request with a reply address.' : 'Share a bug, request, or update issue.'}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800/60 hover:text-surface-200"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-surface-800 bg-surface-950/40 p-1">
                <button
                  type="button"
                  onClick={() => setMode('feedback')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${mode === 'feedback' ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:text-surface-200'}`}
                >
                  Feedback
                </button>
                <button
                  type="button"
                  onClick={() => setMode('support')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${mode === 'support' ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:text-surface-200'}`}
                >
                  Support ticket
                </button>
              </div>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                className="input-field w-full cursor-pointer border-surface-700 bg-surface-900 py-2 text-sm"
              >
                <option value="general">General</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="license">License</option>
                <option value="download">Download</option>
                <option value="update">Update</option>
              </select>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={mode === 'support' ? 'Email (required)' : 'Email (optional)'}
                aria-required={mode === 'support'}
                className="input-field w-full py-2 text-sm"
              />
              <textarea
                ref={messageRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Send feedback..."
                rows={5}
                className="input-field w-full resize-none py-2 text-sm"
              />
              <div className="rounded-lg border border-surface-800 bg-surface-950/40 p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-surface-500">Diagnostics attached</p>
                <div className="space-y-1">
                  <DiagnosticsRow label="App" value={`v${diagnostics.appVersion}`} />
                  <DiagnosticsRow label="yt-dlp" value={diagnostics.ytDlpVersion} />
                  <DiagnosticsRow label="ffmpeg" value={diagnostics.ffmpegVersion} />
                  <DiagnosticsRow label="License" value={formatFeedbackLicenseState(diagnostics.licenseState, diagnostics.plan)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="btn-secondary flex-1 px-3 py-1.5 text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || message.trim().length === 0 || (mode === 'support' && !isValidEmail(email.trim()))}
                  className="btn-primary flex-1 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : mode === 'support' ? 'Send Support Ticket' : 'Send Feedback'}
                </button>
              </div>
              {result && (
                <p className="text-[11px] text-error/80">
                  {result}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DiagnosticsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-surface-500">{label}</span>
      <span className="max-w-[230px] truncate text-right text-surface-300" title={value}>{value}</span>
    </div>
  )
}

function formatFeedbackLicenseState(licenseState: string, plan: string | null): string {
  if (licenseState === 'licensed') return plan ? `Licensed: ${plan}` : 'Licensed'
  if (licenseState === 'voided') return 'Trial unavailable'
  if (licenseState === 'expired') return 'Trial expired'
  return 'Trial'
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function shortFfmpegVersion(value: string | null | undefined): string {
  if (!value) return 'Bundled'
  const match = value.match(/ffmpeg version\s+([^\s]+)/i)
  return match ? match[1] : value.split('\n')[0]
}
