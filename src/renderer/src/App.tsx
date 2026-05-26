import { useEffect, useState, useMemo, useRef } from 'react'
import { useAppStore, useActiveTab } from './stores/app-store'
import { useDownloadEvents } from './hooks/useDownloadEvents'
import { TitleBar } from './components/TitleBar'
import { TabBar } from './components/TabBar'
import { SmartInput } from './components/SmartInput'
import { VideoPreview } from './components/VideoPreview'
import { CategoryTabs } from './components/CategoryTabs'
import { FormatTable } from './components/FormatTable'
import { SubtitleList } from './components/SubtitleList'
import { ExtrasPanel } from './components/ExtrasPanel'
import { UnifiedStatusBar } from './components/UnifiedStatusBar'
import { QueueTab } from './components/QueueTab'
import { SettingsPanel } from './components/SettingsPanel'
import { FeedbackDialog } from './components/FeedbackDialog'
import { bundledBinaryStatus } from './bundled-binary-versions'
import type { DownloadState } from './stores/app-store'
import type { BinaryStatus, LicenseState } from './types'

type AppShortcutCommand =
  | 'open-settings'
  | 'new-tab'
  | 'reopen-closed-tab'
  | 'close-tab'
  | 'reload-tab'
  | 'focus-url'
  | `switch-tab:${number}`

export default function App() {
  const tab = useActiveTab()
  const setDownloadDir = useAppStore((s) => s.setDownloadDir)
  const downloads = useAppStore((s) => s.downloads)
  const activeView = useAppStore((s) => s.activeView)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [expiredDownloadOpen, setExpiredDownloadOpen] = useState(false)
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null)
  const [initialBinaryStatus, setInitialBinaryStatus] = useState<BinaryStatus>(bundledBinaryStatus)

  useDownloadEvents()

  const setFfmpegAvailable = useAppStore((s) => s.setFfmpegAvailable)
  const restoreState = useAppStore((s) => s.restorePersistedState)

  const [, setInitialized] = useState(false)

  useEffect(() => {
    window.api.loadPersistedState().then((persisted) => {
      if (persisted?.settings) {
        restoreState({ settings: persisted.settings, tabUrls: [] })
      }
      const store = useAppStore.getState()
      if (!store.downloadDir) {
        window.api.getDefaultDownloadDir().then((dir) => setDownloadDir(dir))
      }
      setInitialized(true)
    }).catch(() => {
      window.api.getDefaultDownloadDir().then((dir) => setDownloadDir(dir))
      setInitialized(true)
    })

    window.api.loadDownloadHistory().then((history) => {
      if (Array.isArray(history) && history.length > 0) {
        const restored = new Map<string, DownloadState>()
        for (const item of history) {
          const d = item as DownloadState
          if (!d.id) continue
          if (d.status === 'downloading' || d.status === 'queued' || d.status === 'merging' || d.status === 'transcoding') {
            d.status = 'error'
            d.error = 'Interrupted (app closed)'
            d.speed = ''
            d.eta = ''
          }
          restored.set(d.id, d)
        }
        if (restored.size > 0) {
          useAppStore.setState({ downloads: restored })
        }
      }
    }).catch(() => {})

    const refreshLicenseState = (): void => {
      window.api.getLicenseState().then((state) => {
        setLicenseState(state)
      }).catch(() => {})
    }
    window.api.getLicenseState().then((state) => {
      setLicenseState(state)
      window.api.trackEvent({
        eventType: 'app.launched',
        properties: {
          licenseState: state.isActivated ? 'licensed' : state.isTrialExpired ? 'expired' : 'trial',
          trialDaysRemaining: state.trialDaysRemaining,
          trialStatus: state.trialStatus,
          trialSource: state.trialSource
        }
      }).catch(() => {})
    }).catch(() => {})
    const licenseRefreshTimer = window.setInterval(refreshLicenseState, 60_000)
    window.addEventListener('focus', refreshLicenseState)

    const preventDragNav = (e: DragEvent): void => { e.preventDefault() }
    document.addEventListener('dragover', preventDragNav)
    document.addEventListener('drop', preventDragNav)

    const checkFfmpeg = () => {
      window.api.getBinaryStatus().then((status) => {
        setInitialBinaryStatus(status)
        setFfmpegAvailable(!!status.ffmpegVersion)
      })
      window.api.getBinaryStatus(true).then((status) => {
        setInitialBinaryStatus(status)
        setFfmpegAvailable(!!status.ffmpegVersion)
      }).catch(() => {})
    }
    checkFfmpeg()
    const timer = setTimeout(checkFfmpeg, 10000)

    const runAppShortcut = (command: AppShortcutCommand): void => {
      const store = useAppStore.getState()

      if (command === 'open-settings') {
        setSettingsOpen(true)
        return
      }

      if (command === 'reopen-closed-tab') {
        store.reopenClosedTab()
        return
      }

      if (command === 'new-tab') {
        store.addTab()
        store.setActiveView('video')
        return
      }

      if (command === 'close-tab') {
        if (store.activeTabId) {
          store.closeTab(store.activeTabId)
        }
        return
      }

      if (command.startsWith('switch-tab:')) {
        const tabNumber = command.replace('switch-tab:', '')
        const targetIndex = tabNumber === '9' ? store.tabs.length - 1 : Number(tabNumber) - 1
        const targetTab = store.tabs[targetIndex]
        if (targetTab) {
          store.switchTab(targetTab.id)
          store.setActiveView('video')
        }
        return
      }

      if (command === 'reload-tab') {
        const activeTab = store.tabs.find((t) => t.id === store.activeTabId)
        if (activeTab?.url) {
          store.fetchVideoInfo()
        }
        return
      }

      if (command === 'focus-url') {
        store.setActiveView('video')
        window.dispatchEvent(new CustomEvent('pullframe:focus-url-input'))
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return

      const hasCommandModifier = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (!hasCommandModifier) return

      if (key === ',') {
        e.preventDefault()
        runAppShortcut('open-settings')
        return
      }

      if (key === 't' && e.shiftKey) {
        e.preventDefault()
        runAppShortcut('reopen-closed-tab')
        return
      }

      if (key === 't') {
        e.preventDefault()
        runAppShortcut('new-tab')
        return
      }

      if (key === 'w') {
        e.preventDefault()
        runAppShortcut('close-tab')
        return
      }

      if (/^[1-9]$/.test(key)) {
        e.preventDefault()
        runAppShortcut(`switch-tab:${Number(key)}`)
        return
      }

      if (key === 'r') {
        e.preventDefault()
        runAppShortcut('reload-tab')
        return
      }

      if (key === 'l') {
        e.preventDefault()
        runAppShortcut('focus-url')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const removeAppShortcutListener = window.api.onAppShortcut(runAppShortcut)

    return () => {
      clearTimeout(timer)
      clearInterval(licenseRefreshTimer)
      window.removeEventListener('focus', refreshLicenseState)
      document.removeEventListener('dragover', preventDragNav)
      document.removeEventListener('drop', preventDragNav)
      window.removeEventListener('keydown', handleKeyDown)
      removeAppShortcutListener()
    }
  }, [])

  const settingsJson = useAppStore((s) => JSON.stringify({
    downloadDir: s.downloadDir,
    subtitleFormat: s.subtitleFormat,
    cookieBrowser: s.cookieBrowser,
    preferredContainer: s.preferredContainer,
    audioConvertFormat: s.audioConvertFormat,
    videoTranscodeFormat: s.videoTranscodeFormat,
    autoIncludeAudioWithProfessionalTranscodes: s.autoIncludeAudioWithProfessionalTranscodes,
    organizeIntoFolders: s.organizeIntoFolders,
    hwAccel: s.hwAccel,
    analyticsEnabled: s.analyticsEnabled,
    downloadAllIncludes: s.downloadAllIncludes,
  }))
  const tabUrlsJson = useAppStore((s) => JSON.stringify(s.tabs.map(t => t.url).filter(Boolean)))

  useEffect(() => {
    const timeout = setTimeout(() => {
      window.api.savePersistedState({
        settings: JSON.parse(settingsJson),
        tabUrls: JSON.parse(tabUrlsJson)
      })
    }, 1000)
    return () => clearTimeout(timeout)
  }, [settingsJson, tabUrlsJson])

  const downloadsRef = useRef(downloads)
  downloadsRef.current = downloads

  useEffect(() => {
    const timeout = setTimeout(() => {
      const all = Array.from(downloadsRef.current.values())
      const toSave = all.filter(
        (d) => d.status === 'complete' || d.status === 'error' || d.status === 'cancelled' || d.status === 'paused' ||
          d.status === 'downloading' || d.status === 'queued' || d.status === 'merging' || d.status === 'transcoding'
      ).map((d) => ({
        ...d,
        originalRequest: d.status === 'complete' ? null : d.originalRequest
      }))
      if (toSave.length > 0) {
        window.api.saveDownloadHistory(toSave)
      }
    }, 2000)
    return () => clearTimeout(timeout)
  }, [downloads])

  const videoInfo = tab?.videoInfo ?? null
  const playlistEntries = tab?.playlistEntries ?? null
  const activeContentTab = tab?.activeTab ?? 'formats'
  const openSettings = (): void => {
    setSettingsOpen(true)
  }

  const openFeedback = (): void => {
    setFeedbackOpen(true)
    window.api.trackEvent({
      eventType: 'feedback.opened',
      properties: { source: 'app' }
    }).catch(() => {})
  }

  const openLicensePurchase = (): void => {
    window.api.openExternal('https://pullframe.app/#pricing').catch(() => {})
  }

  return (
    <div className="flex flex-col h-screen bg-surface-950 overflow-hidden">
      <TitleBar
        onSettingsClick={openSettings}
        onFeedbackClick={openFeedback}
        onLicenseClick={openLicensePurchase}
        licenseState={licenseState}
      />
      <TabBar />

      <main className="flex-1 overflow-y-auto">
        {activeView === 'queue' ? (
          <QueueTab />
        ) : videoInfo ? (
          <div className="animate-fade-in">
            <VideoPreview />
            <div className="px-6 pb-6">
              <CategoryTabs />
              <div className="mt-4">
                {activeContentTab === 'formats' && <FormatTable />}
                {activeContentTab === 'subtitles' && <SubtitleList />}
                {activeContentTab === 'extras' && <ExtrasPanel />}
              </div>
            </div>
          </div>
        ) : playlistEntries ? (
          <PlaylistView entries={playlistEntries} playlistMetadata={tab?.playlistMetadata ?? null} />
        ) : (
          <div className="grid min-h-full place-items-center px-6 py-10">
            <div className="w-full max-w-2xl -translate-y-12 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold">
                  <span className="bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent">Pull</span><span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">frame</span>
                </h1>
              </div>
              <SmartInput
                placeholder="Paste a YouTube URL to get started..."
              />
            </div>
          </div>
        )}
      </main>

      <UnifiedStatusBar licenseState={licenseState} onExpiredDownload={() => setExpiredDownloadOpen(true)} />
      {expiredDownloadOpen && (
        <TrialExpiredDialog
          onClose={() => setExpiredDownloadOpen(false)}
          onGetLicense={() => {
            setExpiredDownloadOpen(false)
            openLicensePurchase()
          }}
          onActivated={(state) => {
            setLicenseState(state)
            setExpiredDownloadOpen(false)
          }}
        />
      )}
      <SettingsPanel
        isOpen={settingsOpen}
        initialBinaryStatus={initialBinaryStatus}
        onClose={async () => {
          setSettingsOpen(false)
          window.api.getLicenseState().then(setLicenseState).catch(() => {})
        }}
      />
      <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  )
}

interface PlaylistViewProps {
  entries: import('./types').PlaylistEntry[]
  playlistMetadata: import('./types').PlaylistMetadata | null
}

type SortMode = 'default' | 'title' | 'duration-asc' | 'duration-desc'

function TrialExpiredDialog({
  onClose,
  onGetLicense,
  onActivated
}: {
  onClose: () => void
  onGetLicense: () => void
  onActivated: (state: LicenseState) => void
}) {
  const [mode, setMode] = useState<'summary' | 'activate'>('summary')
  const [licenseKey, setLicenseKey] = useState('')
  const [activationResult, setActivationResult] = useState<string | null>(null)
  const [isActivating, setIsActivating] = useState(false)

  const handleActivateLicense = async (): Promise<void> => {
    const trimmed = licenseKey.trim()
    if (!trimmed || isActivating) return
    setIsActivating(true)
    setActivationResult(null)
    try {
      const state = await window.api.activateLicense(trimmed)
      onActivated(state)
    } catch (err) {
      setActivationResult(`Activation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-lg border border-surface-700/70 bg-surface-900 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between border-b border-surface-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-surface-100">Trial expired</h2>
            <p className="mt-1 text-xs text-surface-500">
              {mode === 'activate' ? 'Enter your license key to unlock downloads.' : 'Activate Pullframe to start downloads.'}
            </p>
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
        {mode === 'activate' ? (
          <>
            <div className="space-y-3 px-5 py-4">
              <input
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleActivateLicense().catch(() => {})
                  }
                }}
                placeholder="PF-XXXX-XXXX-XXXX-XXXX"
                autoFocus
                className="input-field w-full py-2 text-sm font-mono"
              />
              {activationResult && (
                <p className="text-xs text-error/80">{activationResult}</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-surface-800 px-5 py-4">
              <button onClick={() => setMode('summary')} className="btn-secondary px-3 py-2 text-xs">
                Back
              </button>
              <button onClick={onGetLicense} className="btn-secondary px-3 py-2 text-xs">
                Get License
              </button>
              <button
                onClick={() => handleActivateLicense().catch(() => {})}
                disabled={isActivating || licenseKey.trim().length === 0}
                className="btn-primary px-3 py-2 text-xs disabled:opacity-50"
              >
                {isActivating ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-surface-300">
                Videos can still be loaded and inspected, but downloads require an active license after the trial ends.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-surface-800 px-5 py-4">
              <button onClick={onClose} className="btn-secondary px-3 py-2 text-xs">
                Not Now
              </button>
              <button onClick={() => setMode('activate')} className="btn-secondary px-3 py-2 text-xs">
                Enter Key
              </button>
              <button
                onClick={onGetLicense}
                className="rounded-lg border border-warning/70 bg-warning px-3 py-2 text-xs font-semibold text-surface-950 shadow-sm shadow-warning/20 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-400 hover:shadow-warning/30 active:scale-[0.98]"
              >
                Get License
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PlaylistView({ entries, playlistMetadata }: PlaylistViewProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('default')
  const normalizedEntries = Array.isArray(entries) ? entries : []
  const tabs = useAppStore((s) => s.tabs)
  const openEntryIds = useMemo(() => getOpenPlaylistEntryIds(tabs), [tabs])
  const playlistTitle = formatPlaylistTitle(playlistMetadata)
  const totalCount = playlistMetadata?.count ?? normalizedEntries.length

  const filtered = useMemo(() => {
    let list = normalizedEntries
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((e) => e.title.toLowerCase().includes(q))
    }
    switch (sort) {
      case 'title':
        list = [...list].sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'duration-asc':
        list = [...list].sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0))
        break
      case 'duration-desc':
        list = [...list].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        break
    }
    return list
  }, [normalizedEntries, search, sort])

  return (
    <div className="animate-fade-in px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-surface-100">
          {playlistTitle}
          <span className="text-surface-500 font-normal ml-2 text-sm">
            {filtered.length === normalizedEntries.length
              ? `${totalCount} videos`
              : `${filtered.length} of ${totalCount} videos`}
          </span>
        </h2>
        <button
          onClick={() => useAppStore.getState().reset()}
          className="btn-secondary text-xs py-1.5 px-3"
        >
          New URL
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
            fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos..."
            className="input-field w-full pl-9 py-2 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="input-field py-2 text-sm bg-surface-900 border-surface-700 cursor-pointer"
        >
          <option value="default">Original order</option>
          <option value="title">Title A→Z</option>
          <option value="duration-desc">Longest first</option>
          <option value="duration-asc">Shortest first</option>
        </select>
      </div>

      <div className="space-y-1">
        {filtered.length === 0 && (
          <p className="text-center text-surface-500 py-8 text-sm">
            {normalizedEntries.length === 0
              ? 'No videos found in this playlist.'
              : `No videos match "${search}"`}
          </p>
        )}
        {filtered.map((entry, i) => {
          const isOpen = openEntryIds.has(entry.id)
          return (
            <button
              key={entry.id}
              onClick={() => {
                openPlaylistEntryTab(entry)
              }}
              className={`w-full flex items-center gap-0 pr-3 py-2.5 glass rounded-lg glass-hover text-left ${
                isOpen ? 'border-accent-500/40 bg-accent-500/5' : ''
              }`}
            >
              <span className="text-[11px] font-mono text-surface-500 w-11 shrink-0 text-center">
                {i + 1}
              </span>
              {entry.thumbnail && (
                <img
                  src={entry.thumbnail}
                  alt=""
                  className="w-20 h-12 rounded object-cover shrink-0 bg-surface-800 mr-2.5"
                />
              )}
              <div className="flex-1 min-w-0 ml-0.5">
                <p className="text-sm text-surface-200 truncate">{entry.title}</p>
                {entry.duration != null && (
                  <p className="text-[11px] text-surface-500">
                    {Math.floor(entry.duration / 60)}:{String(entry.duration % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
              {isOpen ? (
                <span className="shrink-0 rounded border border-accent-500/30 bg-accent-500/10 px-2 py-1 text-[10px] font-medium text-accent-300">
                  Open
                </span>
              ) : (
                <svg
                  className="w-4 h-4 text-surface-500 shrink-0"
                  fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function openPlaylistEntryTab(entry: import('./types').PlaylistEntry): void {
  const store = useAppStore.getState()
  const targetUrl = getPlaylistEntryUrl(entry)
  const existingTabId = findExistingVideoTabId(store.tabs, entry.id, targetUrl)

  store.setActiveView('video')
  if (existingTabId) {
    store.switchTab(existingTabId)
    return
  }

  const newTabId = store.addTab()
  store.switchTab(newTabId)
  store.setUrl(targetUrl)
  window.setTimeout(() => {
    useAppStore.getState().fetchVideoInfo().catch(() => {})
  }, 50)
}

function getPlaylistEntryUrl(entry: import('./types').PlaylistEntry): string {
  return entry.url.startsWith('http')
    ? entry.url
    : `https://www.youtube.com/watch?v=${entry.id}`
}

function findExistingVideoTabId(
  tabs: ReturnType<typeof useAppStore.getState>['tabs'],
  entryId: string,
  targetUrl: string
): string | null {
  const normalizedTarget = normalizeYouTubeVideoUrl(targetUrl, entryId)
  return tabs.find((tab) => {
    if (tab.playlistEntries) return false
    if (tab.videoInfo?.id === entryId) return true
    return !tab.playlistEntries && normalizeYouTubeVideoUrl(tab.url) === normalizedTarget
  })?.id ?? null
}

function getOpenPlaylistEntryIds(tabs: ReturnType<typeof useAppStore.getState>['tabs']): Set<string> {
  const ids = new Set<string>()
  for (const tab of tabs) {
    if (tab.playlistEntries) continue
    if (tab.videoInfo?.id) {
      ids.add(tab.videoInfo.id)
      continue
    }
    const videoId = getYouTubeVideoId(tab.url)
    if (videoId) ids.add(videoId)
  }
  return ids
}

function normalizeYouTubeVideoUrl(url: string, fallbackId?: string): string {
  const videoId = getYouTubeVideoId(url) ?? fallbackId
  return videoId ? `youtube:${videoId}` : url.trim()
}

function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('v') ?? (
      parsed.hostname.includes('youtu.be')
        ? parsed.pathname.replace(/^\//, '').split('/')[0]
        : null
    )
  } catch {
    return null
  }
}

function formatPlaylistTitle(metadata: import('./types').PlaylistMetadata | null): string {
  if (!metadata) return 'Playlist'
  return metadata.title
    || [metadata.channelName, metadata.playlistName].filter(Boolean).join(' / ')
    || metadata.playlistName
    || metadata.channelName
    || 'Playlist'
}
