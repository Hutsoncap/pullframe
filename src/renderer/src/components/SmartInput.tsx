import { useState, useRef, useEffect } from 'react'
import { useAppStore, useActiveTab } from '../stores/app-store'
import { isYouTubeUrl } from '../lib/format-utils'

interface SmartInputProps {
  placeholder?: string
}

export function SmartInput({
  placeholder = 'Paste a YouTube URL to get started...'
}: SmartInputProps) {
  const tab = useActiveTab()
  const setUrl = useAppStore((s) => s.setUrl)
  const fetchVideoInfo = useAppStore((s) => s.fetchVideoInfo)
  const cookieBrowser = useAppStore((s) => s.cookieBrowser)

  const url = tab?.url ?? ''
  const isLoading = tab?.isLoading ?? false
  const error = tab?.error ?? null

  const [localValue, setLocalValue] = useState(url)
  const [clipboardValue, setClipboardValue] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRequestRef = useRef(0)

  // Sync local state when active tab changes
  const tabId = tab?.id
  useEffect(() => {
    setLocalValue(url)
  }, [tabId, url])

  useEffect(() => {
    inputRef.current?.focus()
  }, [tabId])

  useEffect(() => {
    const focusInput = (): void => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }

    window.addEventListener('pullframe:focus-url-input', focusInput)
    return () => window.removeEventListener('pullframe:focus-url-input', focusInput)
  }, [])

  // Check clipboard for a YouTube URL — auto-populate if input is empty
  const clipboardCheckedRef = useRef(false)
  useEffect(() => {
    clipboardCheckedRef.current = false
  }, [tabId])

  const tabs = useAppStore((s) => s.tabs)

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const currentVal = inputRef.current?.value ?? ''
        if (currentVal) return // Don't overwrite user's input
        const text = await navigator.clipboard.readText()
        const trimmed = text?.trim()
        if (trimmed && isYouTubeUrl(trimmed)) {
          // Don't auto-paste if another tab already has this URL loaded
          const alreadyOpen = tabs.some((t) => t.id !== tabId && t.url === trimmed)
          if (alreadyOpen) {
            clipboardCheckedRef.current = true
            return
          }
          setLocalValue(trimmed)
          setClipboardValue(trimmed)
          clipboardCheckedRef.current = true
          return
        }
        setClipboardValue(null)
      } catch {
        // Clipboard access denied
      }
    }

    if (!clipboardCheckedRef.current) {
      checkClipboard()
    }

    const onFocus = () => {
      const currentVal = inputRef.current?.value ?? ''
      if (!currentVal) checkClipboard()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [tabId])

  // ── Input handling ────────────────────────────────────────────────────────

  const handleChange = (value: string): void => {
    setLocalValue(value)
  }

  const handleSubmit = async (): Promise<void> => {
    const trimmed = localValue.trim()
    if (!trimmed || isLoading) return
    if (!isYouTubeUrl(trimmed)) return
    setUrl(trimmed)
    await fetchVideoInfo()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    const pasted = e.clipboardData.getData('text').trim()
    if (pasted && isYouTubeUrl(pasted)) {
      e.preventDefault()
      setLocalValue(pasted)
      setUrl(pasted)
      setTimeout(() => fetchVideoInfo(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  // ── Validation indicator ──────────────────────────────────────────────────

  const trimmedValue = localValue.trim()
  const isValid = trimmedValue.length > 0 && isYouTubeUrl(trimmedValue)
  const showClipboardButton = !!(trimmedValue && clipboardValue && localValue === clipboardValue && !isLoading && isValid)

  const typeHintText = trimmedValue ? (isValid ? 'YouTube URL detected' : null) : null

  useEffect(() => {
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId

    if (!isValid || isLoading) {
      setPreviewTitle(null)
      setPreviewLoading(false)
      return
    }

    setPreviewTitle(null)
    setPreviewLoading(true)

    const timer = window.setTimeout(() => {
      window.api.fetchUrlPreview(trimmedValue, cookieBrowser)
        .then((preview) => {
          if (previewRequestRef.current === requestId) {
            setPreviewTitle(preview.title)
          }
        })
        .catch(async () => {
          if (cookieBrowser !== 'none') {
            try {
              const preview = await window.api.fetchUrlPreview(trimmedValue, 'none')
              if (previewRequestRef.current === requestId) {
                setPreviewTitle(preview.title)
              }
              return
            } catch {
              // Fall through to clearing the preview.
            }
          }

          if (previewRequestRef.current === requestId) {
            setPreviewTitle(null)
          }
        })
        .finally(() => {
          if (previewRequestRef.current === requestId) {
            setPreviewLoading(false)
          }
        })
    }, 650)

    return () => {
      window.clearTimeout(timer)
    }
  }, [trimmedValue, isValid, isLoading, cookieBrowser])

  return (
    <div className="w-full">
      {/* Input field with glow effect */}
      <div className="relative group">
        <div
          className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-accent-500/20 via-purple-500/20 to-accent-500/20 blur-lg transition-opacity duration-500 ${
            isLoading ? 'opacity-100 animate-pulse-slow' : 'opacity-0 group-focus-within:opacity-100'
          }`}
        />

        <div className="relative flex items-center">
          <div className="relative flex-1">
            {isLoading && (
              <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-accent-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.45)]">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-35" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            <div className="flex rounded-xl border border-surface-700/50 bg-surface-900/60 backdrop-blur-sm transition-all duration-300 focus-within:border-accent-500/50 focus-within:ring-2 focus-within:ring-accent-500/40">
              <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => handleChange(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className={`min-w-0 flex-1 bg-transparent ${isLoading ? 'pl-12' : 'pl-5'} ${trimmedValue ? 'pr-10' : 'pr-4'} py-4 text-base text-surface-100 placeholder:text-surface-500 focus:outline-none disabled:opacity-60 ${
                  error ? 'text-error/90' : ''
                }`}
              />

            </div>

            {trimmedValue && !isLoading && (
              <button
                onClick={() => { setLocalValue(''); setClipboardValue(null); inputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-600 hover:text-surface-300 transition-colors p-1.5 rounded-md hover:bg-surface-800/60"
                title="Clear"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Type hint + Open button + error */}
      <div className="relative h-0">
        {typeHintText && !error && (
          <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-2 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
              <span className="text-xs text-accent-400">{typeHintText}</span>
              {previewTitle && (
                <>
                  <span className="h-1 w-1 rounded-full bg-surface-600" />
                  <span className="max-w-[420px] truncate text-xs text-surface-400" title={previewTitle}>
                    {previewTitle}
                  </span>
                </>
              )}
              {!previewTitle && previewLoading && (
                <>
                  <span className="h-1 w-1 rounded-full bg-surface-600" />
                  <span className="text-xs text-surface-500">Looking up title...</span>
                </>
              )}
            </div>
            {showClipboardButton && (
              <button
                onClick={() => handleSubmit()}
                className="text-accent-400 hover:text-accent-300 transition-colors text-xs font-medium px-2.5 py-0.5 rounded-md hover:bg-accent-500/10 flex items-center gap-1"
              >
                Open
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="absolute top-3 left-0 right-0 animate-slide-up">
            <div className="flex items-start gap-2 px-2">
              <svg className="w-4 h-4 text-error mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-error/90">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
