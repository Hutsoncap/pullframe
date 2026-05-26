import { useState, useEffect } from 'react'
import { bundledBinaryStatus } from '../bundled-binary-versions'
import { useAppStore } from '../stores/app-store'
import type { AppUpdateStatus, BinaryStatus, BrowserSignInStatus, LicenseState } from '../types'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  initialBinaryStatus: BinaryStatus | null
}

export function SettingsPanel({ isOpen, onClose, initialBinaryStatus }: SettingsPanelProps) {
  const downloadDir = useAppStore((s) => s.downloadDir)
  const setDownloadDir = useAppStore((s) => s.setDownloadDir)
  const subtitleFormat = useAppStore((s) => s.subtitleFormat)
  const setSubtitleFormat = useAppStore((s) => s.setSubtitleFormat)
  const preferredContainer = useAppStore((s) => s.preferredContainer)
  const setPreferredContainer = useAppStore((s) => s.setPreferredContainer)
  const cookieBrowser = useAppStore((s) => s.cookieBrowser)
  const setCookieBrowser = useAppStore((s) => s.setCookieBrowser)
  const audioConvertFormat = useAppStore((s) => s.audioConvertFormat)
  const setAudioConvertFormat = useAppStore((s) => s.setAudioConvertFormat)
  const autoIncludeAudioWithProfessionalTranscodes = useAppStore((s) => s.autoIncludeAudioWithProfessionalTranscodes)
  const setAutoIncludeAudioWithProfessionalTranscodes = useAppStore((s) => s.setAutoIncludeAudioWithProfessionalTranscodes)
  const organizeIntoFolders = useAppStore((s) => s.organizeIntoFolders)
  const setOrganizeIntoFolders = useAppStore((s) => s.setOrganizeIntoFolders)
  const hwAccel = useAppStore((s) => s.hwAccel)
  const setHwAccel = useAppStore((s) => s.setHwAccel)
  const analyticsEnabled = useAppStore((s) => s.analyticsEnabled)
  const setAnalyticsEnabled = useAppStore((s) => s.setAnalyticsEnabled)

  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus | null>(initialBinaryStatus)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseResult, setLicenseResult] = useState<string | null>(null)
  const [isActivatingLicense, setIsActivatingLicense] = useState(false)
  const [updatingTool, setUpdatingTool] = useState<'ytdlp' | 'ffmpeg' | null>(null)
  const [toolUpdateResult, setToolUpdateResult] = useState<string | null>(null)
  const [versionMenuOpen, setVersionMenuOpen] = useState<'ytdlp' | 'ffmpeg' | null>(null)
  const [signInStatus, setSignInStatus] = useState<BrowserSignInStatus | null>(null)
  const [isCheckingSignIn, setIsCheckingSignIn] = useState(false)

  useEffect(() => {
    const unsubscribe = window.api.onAppUpdateStatus((status) => {
      setUpdateStatus(status)
      if (status.state !== 'checking') {
        setIsCheckingUpdates(false)
      }
      if (status.state !== 'downloading') {
        setIsDownloadingUpdate(false)
      }
    })

    if (isOpen) {
      setBinaryStatus(initialBinaryStatus)
      window.api.getBinaryStatus().then(setBinaryStatus)
      window.api.getBinaryStatus(true).then(setBinaryStatus).catch(() => {})
      window.api.getAppVersion().then(setAppVersion)
      window.api.getLicenseState().then(setLicenseState)
      setLicenseResult(null)
      setToolUpdateResult(null)
      setVersionMenuOpen(null)
    }

    return unsubscribe
  }, [isOpen, initialBinaryStatus])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setIsCheckingSignIn(cookieBrowser !== 'none')

    window.api.checkBrowserSignIn(cookieBrowser)
      .then((status) => {
        if (!cancelled) setSignInStatus(status)
      })
      .catch(() => {
        if (!cancelled) {
          setSignInStatus({
            browser: cookieBrowser,
            status: 'error',
            message: `Could not check ${formatCookieBrowserLabel(cookieBrowser)} sign-in.`
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSignIn(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, cookieBrowser])

  const refreshBinaryStatus = async (): Promise<void> => {
    setBinaryStatus(await window.api.getBinaryStatus())
    window.api.getBinaryStatus(true).then(setBinaryStatus).catch(() => {})
  }

  const handleSelectDir = async (): Promise<void> => {
    const dir = await window.api.selectDirectory()
    if (dir) setDownloadDir(dir)
  }

  const handleCheckUpdates = async (): Promise<void> => {
    setIsCheckingUpdates(true)
    setUpdateStatus({ state: 'checking' })
    try {
      const result = await window.api.checkForUpdates()
      setUpdateStatus({
        state: result.status === 'available' ? 'available' : 'not-available',
        version: result.version
      })
    } catch (err) {
      setUpdateStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    setIsDownloadingUpdate(true)
    setUpdateStatus((current) => ({ state: 'downloading', version: current?.version, percent: 0 }))
    try {
      await window.api.downloadAppUpdate()
    } catch (err) {
      setUpdateStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      setIsDownloadingUpdate(false)
    }
  }

  const handleInstallUpdate = async (): Promise<void> => {
    await window.api.installAppUpdate()
  }

  const handleCheckBrowserSignIn = async (): Promise<void> => {
    setIsCheckingSignIn(true)
    setSignInStatus(null)
    try {
      setSignInStatus(await window.api.checkBrowserSignIn(cookieBrowser))
    } catch {
      setSignInStatus({
        browser: cookieBrowser,
        status: 'error',
        message: `Could not check ${formatCookieBrowserLabel(cookieBrowser)} sign-in.`
      })
    } finally {
      setIsCheckingSignIn(false)
    }
  }

  const handleOpenFullDiskAccess = async (): Promise<void> => {
    await window.api.openFullDiskAccessSettings()
  }

  const handleActivateLicense = async (): Promise<void> => {
    setIsActivatingLicense(true)
    setLicenseResult(null)
    try {
      const state = await window.api.activateLicense(licenseKey.trim())
      setLicenseState(state)
      setLicenseKey('')
      setLicenseResult('License activated')
      window.api.checkForUpdates().catch(() => {})
    } catch (err) {
      setLicenseResult(`Activation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsActivatingLicense(false)
    }
  }

  const handleDeactivateLicense = async (): Promise<void> => {
    const state = await window.api.deactivateLicense()
    setLicenseState(state)
    setLicenseResult('License deactivated on this Mac')
  }

  const handleBuyLicense = async (): Promise<void> => {
    await window.api.openExternal('https://pullframe.app/#pricing')
  }

  const handleRestoreLicense = async (): Promise<void> => {
    window.api.trackEvent({
      eventType: 'license.recovery.started',
      properties: { source: 'settings' }
    }).catch(() => {})
    await window.api.openExternal('https://pullframe.app/license/recovery')
  }

  const handleUpdateYtdlp = async (): Promise<void> => {
    setUpdatingTool('ytdlp')
    setToolUpdateResult(null)
    try {
      await window.api.updateYtdlp()
      await refreshBinaryStatus()
      setToolUpdateResult('yt-dlp updated')
    } catch (err) {
      setToolUpdateResult(`yt-dlp update failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUpdatingTool(null)
    }
  }

  const handleUpdateFfmpeg = async (): Promise<void> => {
    setUpdatingTool('ffmpeg')
    setToolUpdateResult(null)
    try {
      await window.api.updateFfmpeg()
      await refreshBinaryStatus()
      setToolUpdateResult('ffmpeg updated')
    } catch (err) {
      setToolUpdateResult(`ffmpeg update failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUpdatingTool(null)
    }
  }

  const handleUseBundledYtdlp = async (): Promise<void> => {
    setUpdatingTool('ytdlp')
    setToolUpdateResult(null)
    try {
      setBinaryStatus(await window.api.useBundledYtdlp())
      setToolUpdateResult('Using bundled yt-dlp')
      setVersionMenuOpen(null)
    } catch (err) {
      setToolUpdateResult(`yt-dlp rollback failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUpdatingTool(null)
    }
  }

  const handleUseBundledFfmpeg = async (): Promise<void> => {
    setUpdatingTool('ffmpeg')
    setToolUpdateResult(null)
    try {
      setBinaryStatus(await window.api.useBundledFfmpeg())
      setToolUpdateResult('Using bundled ffmpeg')
      setVersionMenuOpen(null)
    } catch (err) {
      setToolUpdateResult(`ffmpeg rollback failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUpdatingTool(null)
    }
  }

  if (!isOpen) return <></>

  const displayBinaryStatus = binaryStatus ?? bundledBinaryStatus
  const ytdlpSource = displayBinaryStatus.ytdlpSource
  const ffmpegSource = displayBinaryStatus.ffmpegSource
  const ytdlpUpdateAvailable = displayBinaryStatus.ytdlpUpdateAvailable
  const ffmpegUpdateAvailable = displayBinaryStatus.ffmpegUpdateAvailable
  const ytdlpVersionLabel = formatToolVersion(displayBinaryStatus.ytdlpVersion, ytdlpSource, displayBinaryStatus.ytdlpPath)
  const ffmpegVersionLabel = formatToolVersion(shortFfmpegVersion(displayBinaryStatus.ffmpegVersion), ffmpegSource, displayBinaryStatus.ffmpegPath)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-96 max-w-[90vw] z-50 bg-surface-900/95 backdrop-blur-xl border-l border-surface-700/50 shadow-2xl shadow-black/40 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800/50">
          <h2 className="text-base font-semibold text-surface-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {licenseState ? (
            <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
              licenseState.isActivated
                ? 'border-surface-800/70 bg-surface-950/25'
                : 'border-surface-700/60 bg-surface-950/45'
            }`}>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-surface-100">
                  {formatLicenseBannerHeading(licenseState)}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-surface-500">
                  {formatLicenseBannerDetail(licenseState)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleBuyLicense}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                  licenseState.isActivated
                    ? 'border border-surface-700/70 bg-surface-900/70 text-surface-300 hover:border-surface-600 hover:bg-surface-800/80 hover:text-surface-100'
                    : 'border border-warning/70 bg-warning text-surface-950 shadow-sm shadow-warning/20 hover:border-yellow-300 hover:bg-yellow-400 hover:shadow-warning/30'
                }`}
              >
                {licenseState.isActivated ? 'Add Seats' : 'Get License'}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-surface-700/60 bg-surface-950/45 p-3 text-xs text-surface-500">
              Loading license...
            </div>
          )}

          {/* Download Directory */}
          <SettingsSection
            title="Download Directory"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            }
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 input-field py-2 text-xs font-mono text-surface-300 truncate cursor-default">
                {downloadDir || 'Not set'}
              </div>
              <button onClick={handleSelectDir} className="btn-secondary py-2 px-3 text-xs shrink-0">
                Browse
              </button>
            </div>
          </SettingsSection>

          {/* Organize into folders */}
          <SettingsSection
            title="Folder Organization"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
            }
          >
            <ScopeToggle
              label="Organize downloads into folders"
              checked={organizeIntoFolders}
              onChange={setOrganizeIntoFolders}
              hint="Creates subfolders: video/, audio/, subtitles/, thumbnails/, extras/"
            />
          </SettingsSection>

          {/* Subtitle Format */}
          <SettingsSection
            title="Subtitle Format"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            }
          >
            <div className="flex gap-2">
              {(['original', 'srt', 'vtt', 'ass'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSubtitleFormat(fmt)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    subtitleFormat === fmt
                      ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
                      : 'bg-surface-800/60 text-surface-400 border border-surface-700/40 hover:text-surface-200 hover:border-surface-600/50'
                  }`}
                >
                  {fmt === 'original' ? 'Original' : `.${fmt}`}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Container Format */}
          <SettingsSection
            title="Container Format"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m0 0l2.25 2.25M9.75 14.25l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6.75A2.25 2.25 0 0018 4.5H6A2.25 2.25 0 003.75 6.75V18A2.25 2.25 0 006 20.25z" />
              </svg>
            }
          >
            <p className="text-[11px] text-surface-500 mb-3 leading-relaxed">
              Output container when merging video + audio streams. MP4 is the most compatible format.
            </p>
            <div className="flex gap-2">
              {([['mp4', 'MP4'], ['mkv', 'MKV'], ['webm', 'WebM'], ['auto', 'Auto']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setPreferredContainer(value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    preferredContainer === value
                      ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
                      : 'bg-surface-800/60 text-surface-400 border border-surface-700/40 hover:text-surface-200 hover:border-surface-600/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Audio Format */}
          <SettingsSection
            title="Audio Format"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            }
          >
            <p className="text-[11px] text-surface-500 mb-3 leading-relaxed">
              Convert audio-only downloads to a specific format. Useful for audio production workflows. Requires ffmpeg.
            </p>
            <div className="flex gap-2">
              {([['original', 'Original'], ['wav', 'WAV'], ['flac', 'FLAC'], ['mp3', 'MP3']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setAudioConvertFormat(value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    audioConvertFormat === value
                      ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
                      : 'bg-surface-800/60 text-surface-400 border border-surface-700/40 hover:text-surface-200 hover:border-surface-600/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Professional video audio */}
          <SettingsSection
            title="Professional Video"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            }
          >
            <ScopeToggle
              label="Automatically include audio with professional transcodes"
              checked={autoIncludeAudioWithProfessionalTranscodes}
              onChange={setAutoIncludeAudioWithProfessionalTranscodes}
              hint="Adds best available audio to ProRes and DNxHR video-only selections, then writes PCM audio into the final file."
            />
          </SettingsSection>

          {/* GPU Encoding */}
          <SettingsSection
            title="Hardware Encoding"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
          >
            <ScopeToggle
              label="Use Apple hardware encoder"
              checked={hwAccel === 'videotoolbox'}
              onChange={(enabled) => setHwAccel(enabled ? 'videotoolbox' : 'cpu')}
              hint="Uses VideoToolbox for H.264 local renders on macOS."
            />
          </SettingsSection>

          <SettingsSection
            title="Analytics"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          >
            <ScopeToggle
              label="Share diagnostic and usage data"
              checked={analyticsEnabled}
              onChange={setAnalyticsEnabled}
              hint="Sends app version, license state, update/download outcomes, and error categories. URLs and local file paths are not sent."
            />
          </SettingsSection>

          {/* YouTube Sign-in */}
          <SettingsSection
            title="YouTube Sign-in"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
          >
            <p className="text-[11px] text-surface-500 mb-3 leading-relaxed">
              Optional. Use a browser where you are signed into YouTube when YouTube asks for sign-in or bot verification. Leave off unless a video needs it. Fully quit the selected browser before downloading.
            </p>
            <select
              value={cookieBrowser}
              onChange={(e) => setCookieBrowser(e.target.value as typeof cookieBrowser)}
              className="input-field w-full py-2 text-sm bg-surface-900 border-surface-700 cursor-pointer"
            >
              <option value="none">Off - no browser sign-in</option>
              <option value="chrome">Chrome</option>
              <option value="firefox">Firefox</option>
              <option value="safari">Safari</option>
              <option value="edge">Edge</option>
              <option value="brave">Brave</option>
              <option value="zen">Zen</option>
              <option value="helium">Helium</option>
            </select>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={`min-w-0 text-[11px] leading-relaxed ${getSignInStatusClass(signInStatus, isCheckingSignIn)}`}>
                {formatSignInStatusText(cookieBrowser, signInStatus, isCheckingSignIn)}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (shouldShowFullDiskAccessAction(cookieBrowser, signInStatus)) {
                    handleOpenFullDiskAccess().catch(() => {})
                    return
                  }
                  handleCheckBrowserSignIn().catch(() => {})
                }}
                disabled={isCheckingSignIn}
                className="btn-secondary shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {isCheckingSignIn ? 'Checking...' : shouldShowFullDiskAccessAction(cookieBrowser, signInStatus) ? 'Open Full Disk Access' : 'Check sign-in'}
              </button>
            </div>
          </SettingsSection>

          {/* Updates */}
          <SettingsSection
            title="Updates"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
          >
            <div className="space-y-2">
              <button
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdates || isDownloadingUpdate}
                className="btn-secondary text-xs py-1.5 px-3 w-full disabled:opacity-50"
              >
                {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
              </button>
              {updateStatus?.state === 'available' && (
                <button
                  onClick={handleDownloadUpdate}
                  disabled={isDownloadingUpdate}
                  className="btn-primary text-xs py-1.5 px-3 w-full disabled:opacity-50"
                >
                  Download Update
                </button>
              )}
              {updateStatus?.state === 'downloading' && (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
                    <div
                      className="h-full rounded-full bg-accent-400 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, updateStatus.percent ?? 0))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-surface-500">
                    {formatUpdateStatus(updateStatus)}
                  </p>
                </div>
              )}
              {updateStatus?.state === 'downloaded' && (
                <button
                  onClick={handleInstallUpdate}
                  className="btn-primary text-xs py-1.5 px-3 w-full"
                >
                  Install and Restart
                </button>
              )}
              {updateStatus && updateStatus.state !== 'downloading' && (
                <p className={`text-[11px] ${updateStatus.state === 'error' ? 'text-error/80' : 'text-surface-500'}`}>
                  {formatUpdateStatus(updateStatus)}
                </p>
              )}
            </div>
          </SettingsSection>

          <LicenseSettingsSection
            licenseState={licenseState}
            licenseKey={licenseKey}
            licenseResult={licenseResult}
            isActivatingLicense={isActivatingLicense}
            onLicenseKeyChange={setLicenseKey}
            onBuyLicense={handleBuyLicense}
            onRestoreLicense={handleRestoreLicense}
            onActivateLicense={handleActivateLicense}
            onDeactivateLicense={handleDeactivateLicense}
          />

          {/* About */}
          <SettingsSection
            title="About"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  <span className="bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent">Pull</span><span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">frame</span>
                </span>
                <span className="text-xs text-surface-500 font-mono">v{appVersion ?? '...'}</span>
              </div>
              <p className="text-xs text-surface-500 leading-relaxed">
                Pull any frame. Any format.
              </p>
              <div className="space-y-2 rounded-lg border border-surface-800/70 bg-surface-950/35 p-3">
                <ToolVersionRow
                  label="yt-dlp"
                  value={ytdlpVersionLabel}
                  tone={ytdlpUpdateAvailable ? 'warning' : 'default'}
                  source={ytdlpSource}
                  isOpen={versionMenuOpen === 'ytdlp'}
                  onToggle={() => setVersionMenuOpen((current) => current === 'ytdlp' ? null : 'ytdlp')}
                  onUseBundled={handleUseBundledYtdlp}
                  disabled={updatingTool !== null}
                />
                <ToolVersionRow
                  label="ffmpeg"
                  value={ffmpegVersionLabel}
                  tone={ffmpegUpdateAvailable ? 'warning' : 'default'}
                  source={ffmpegSource}
                  isOpen={versionMenuOpen === 'ffmpeg'}
                  onToggle={() => setVersionMenuOpen((current) => current === 'ffmpeg' ? null : 'ffmpeg')}
                  onUseBundled={handleUseBundledFfmpeg}
                  disabled={updatingTool !== null}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleUpdateYtdlp}
                  disabled={updatingTool !== null || !ytdlpUpdateAvailable}
                  className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                  title={displayBinaryStatus.ytdlpLatestVersion ? `Latest: ${displayBinaryStatus.ytdlpLatestVersion}` : undefined}
                >
                  {updatingTool === 'ytdlp' ? 'Updating...' : 'Update yt-dlp'}
                </button>
                <button
                  onClick={handleUpdateFfmpeg}
                  disabled={updatingTool !== null || !ffmpegUpdateAvailable}
                  className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                  title={displayBinaryStatus.ffmpegLatestVersion ? `Latest bundle: ${displayBinaryStatus.ffmpegLatestVersion}` : undefined}
                >
                  {updatingTool === 'ffmpeg' ? 'Updating...' : 'Update ffmpeg'}
                </button>
              </div>
              {toolUpdateResult && (
                <p className={`text-[11px] ${toolUpdateResult.includes('failed') ? 'text-error/80' : 'text-success/80'}`}>
                  {toolUpdateResult}
                </p>
              )}
            </div>
          </SettingsSection>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </>
  )
}

/* ────────────────────────────────────────── Helpers ────── */

function SettingsSection({
  title,
  icon,
  children
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-surface-400">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500">
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

function LicenseSettingsSection({
  licenseState,
  licenseKey,
  licenseResult,
  isActivatingLicense,
  onLicenseKeyChange,
  onBuyLicense,
  onRestoreLicense,
  onActivateLicense,
  onDeactivateLicense
}: {
  licenseState: LicenseState | null
  licenseKey: string
  licenseResult: string | null
  isActivatingLicense: boolean
  onLicenseKeyChange: (value: string) => void
  onBuyLicense: () => void
  onRestoreLicense: () => void
  onActivateLicense: () => void
  onDeactivateLicense: () => void
}) {
  return (
    <SettingsSection
      title="License"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-.991-.026-1.303.286L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.305-6.305c.312-.312.383-.74.286-1.303A6 6 0 1121.75 8.25z" />
        </svg>
      }
    >
      {licenseState ? (
        <div className="space-y-3">
          {!licenseState.isActivated ? (
            <div className="space-y-2">
              <input
                value={licenseKey}
                onChange={(event) => onLicenseKeyChange(event.target.value)}
                placeholder="PF-XXXX-XXXX-XXXX-XXXX"
                className="input-field w-full py-2 text-sm font-mono"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onBuyLicense}
                  className="rounded-lg border border-warning/70 bg-warning px-3 py-1.5 text-xs font-semibold text-surface-950 shadow-sm shadow-warning/20 transition-all duration-200 hover:bg-yellow-400 hover:border-yellow-300 hover:shadow-warning/30 active:scale-[0.98]"
                >
                  Buy Lifetime License
                </button>
                <button
                  type="button"
                  onClick={onRestoreLicense}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Restore License
                </button>
              </div>
              <button
                onClick={onActivateLicense}
                disabled={isActivatingLicense || licenseKey.trim().length === 0}
                className="btn-primary text-xs py-1.5 px-3 w-full disabled:opacity-50"
              >
                {isActivatingLicense ? 'Activating...' : 'Activate License'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onBuyLicense}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Add Seats
              </button>
              <button onClick={onDeactivateLicense} className="btn-secondary text-xs py-1.5 px-3">
                Deactivate This Mac
              </button>
            </div>
          )}

          {licenseResult && (
            <p className={`text-[11px] ${licenseResult.startsWith('Activation failed') ? 'text-error/80' : 'text-success/80'}`}>
              {licenseResult}
            </p>
          )}
        </div>
      ) : (
        <div className="text-xs text-surface-500">Loading...</div>
      )}
    </SettingsSection>
  )
}

function ToolVersionRow({
  label,
  value,
  tone = 'default',
  source,
  isOpen,
  onToggle,
  onUseBundled,
  disabled
}: {
  label: string
  value: string
  tone?: 'default' | 'warning'
  source: BinaryStatus['ytdlpSource']
  isOpen: boolean
  onToggle: () => void
  onUseBundled: () => void
  disabled: boolean
}) {
  const canUseBundled = source === 'user'

  return (
    <div className="relative flex items-start justify-between gap-2">
      <span className="text-xs text-surface-500">{label}</span>
      <button
        type="button"
        onClick={canUseBundled ? onToggle : undefined}
        disabled={disabled || !canUseBundled}
        className={`grid w-[160px] ${canUseBundled ? 'grid-cols-[1fr_12px]' : 'grid-cols-1'} items-center gap-1 rounded px-1 text-xs transition-colors disabled:cursor-default disabled:opacity-100 ${
          tone === 'warning'
            ? `text-warning ${canUseBundled ? 'hover:bg-warning/10' : ''}`
            : `text-surface-300 ${canUseBundled ? 'hover:bg-surface-800/70' : ''}`
        }`}
        title={canUseBundled ? `${value} - switch back to bundled version` : value}
      >
        <span className="min-w-0 truncate text-right">{value}</span>
        {canUseBundled && (
          <svg
            className={`h-3 w-3 shrink-0 text-surface-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9l3.75 3.75L15.75 9" />
          </svg>
        )}
      </button>
      {isOpen && canUseBundled && (
        <div className="absolute right-0 top-6 z-10 w-44 rounded-lg border border-surface-700 bg-surface-900 p-1 shadow-xl shadow-black/30">
          <button
            type="button"
            onClick={onUseBundled}
            disabled={disabled}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-surface-300 transition-colors hover:bg-surface-800 disabled:cursor-default disabled:opacity-50"
          >
            Remove local update
          </button>
        </div>
      )}
    </div>
  )
}

function formatUpdateStatus(status: AppUpdateStatus): string {
  if (status.state === 'checking') return 'Checking for updates...'
  if (status.state === 'downloading') {
    const percent = typeof status.percent === 'number' ? `${status.percent.toFixed(1)}%` : 'Starting'
    return `Downloading update... ${percent}`
  }
  if (status.state === 'available') return `Update available${status.version ? `: v${status.version}` : ''}.`
  if (status.state === 'downloaded') return `Update downloaded${status.version ? `: v${status.version}` : ''}.`
  if (status.state === 'error') return status.message ? `Update check failed: ${status.message}` : 'Update check failed.'
  return status.version ? `You are up to date on v${status.version}.` : 'You are up to date.'
}

function shortFfmpegVersion(value: string | null | undefined): string {
  if (!value) return 'Bundled'
  const match = value.match(/ffmpeg version\s+([^\s]+)/i)
  return match ? match[1] : value.split('\n')[0]
}

function isBundledTool(source: BinaryStatus['ytdlpSource'], binaryPath: string | null | undefined): boolean {
  return source === 'bundled' || /[/\\]resources[/\\]bin[/\\]/.test(binaryPath ?? '')
}

function formatToolVersion(value: string | null | undefined, source: BinaryStatus['ytdlpSource'], binaryPath?: string | null): string {
  const version = value ?? 'Checking...'
  return isBundledTool(source, binaryPath) ? `${version} (bundled)` : version
}

function formatCookieBrowserLabel(browser: BrowserSignInStatus['browser']): string {
  const labels: Record<BrowserSignInStatus['browser'], string> = {
    none: 'Off',
    chrome: 'Chrome',
    firefox: 'Firefox',
    safari: 'Safari',
    edge: 'Edge',
    brave: 'Brave',
    zen: 'Zen',
    helium: 'Helium'
  }
  return labels[browser]
}

function getSignInStatusClass(status: BrowserSignInStatus | null, isChecking: boolean): string {
  if (isChecking) return 'text-surface-400'
  if (status?.status === 'ready') return 'text-success/80'
  if (
    status?.status === 'not-found' ||
    status?.status === 'browser-open' ||
    status?.status === 'permission-denied' ||
    status?.status === 'error'
  ) return 'text-warning/85'
  return 'text-surface-500'
}

function formatSignInStatusText(
  browser: BrowserSignInStatus['browser'],
  status: BrowserSignInStatus | null,
  isChecking: boolean
): string {
  if (isChecking) return `Checking ${formatCookieBrowserLabel(browser)} sign-in...`
  if (status?.status === 'ready') return status.message || `${formatCookieBrowserLabel(browser)} sign-in ready.`
  return status?.message ?? 'Choose a browser to check sign-in readiness.'
}

function shouldShowFullDiskAccessAction(
  browser: BrowserSignInStatus['browser'],
  status: BrowserSignInStatus | null
): boolean {
  return browser === 'safari' && status?.status === 'permission-denied'
}

function formatLicenseBannerHeading(licenseState: LicenseState): string {
  if (licenseState.isActivated) return 'Activated'
  if (licenseState.trialStatus === 'voided') return 'Trial unavailable'
  if (licenseState.isTrialExpired) return 'Trial expired'
  return `Trial active · ${licenseState.trialDaysRemaining} day${licenseState.trialDaysRemaining === 1 ? '' : 's'} left`
}

function formatLicenseBannerDetail(licenseState: LicenseState): string {
  if (licenseState.isActivated && licenseState.entitlement) {
    return `${licenseState.entitlement.plan} license · ${licenseState.entitlement.maxActivations} Mac${licenseState.entitlement.maxActivations === 1 ? '' : 's'} included`
  }
  if (licenseState.isActivated) return 'License active on this Mac'
  if (licenseState.trialStatus === 'voided') return 'Get a license to continue using Pullframe'
  if (licenseState.isTrialExpired) return 'Get a license to keep using Pullframe'
  return 'Official signed build and lifetime updates'
}

function ScopeToggle({
  label,
  checked,
  onChange,
  hint
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-800/40 transition-colors cursor-pointer group">
      <div className="flex flex-col">
        <span className="text-xs text-surface-300 group-hover:text-surface-100 transition-colors">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-surface-500 leading-tight mt-0.5">{hint}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-400/40 ${
          checked
            ? 'border-accent-400/60 bg-accent-500 shadow-sm shadow-accent-500/30'
            : 'border-surface-600 bg-surface-800'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-md shadow-black/30 ring-1 ring-black/5 transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
