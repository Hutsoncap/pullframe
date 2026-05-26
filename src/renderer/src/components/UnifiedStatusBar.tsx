import { useMemo, useCallback } from 'react'
import { useAppStore, useActiveTab } from '../stores/app-store'
import { formatBytes } from '../lib/format-utils'
import type { LicenseState } from '../types'
import type { SelectedActionKind } from '../stores/app-store'

/**
 * Bottom status bar: shown when a YouTube video is loaded.
 * Selection count + size, output path, Download / Show Queue.
 */
interface UnifiedStatusBarProps {
  licenseState: LicenseState | null
  onExpiredDownload: () => void
}

export function UnifiedStatusBar({ licenseState, onExpiredDownload }: UnifiedStatusBarProps) {
  const tab = useActiveTab()
  const activeView = useAppStore((s) => s.activeView)
  const downloadDir = useAppStore((s) => s.downloadDir)
  const downloads = useAppStore((s) => s.downloads)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const totalSelectedCount = useAppStore((s) => s.totalSelectedCount)
  const selectedActionSummary = useAppStore((s) => s.selectedActionSummary)
  const estimatedTotalSize = useAppStore((s) => s.estimatedTotalSize)
  const startSelectedDownloads = useAppStore((s) => s.startSelectedDownloads)

  const hasVideoInfo = !!tab?.videoInfo

  // Download stats
  const stats = useMemo(() => {
    const all = Array.from(downloads.values())
    const active = all.filter(
      (d) => d.status === 'queued' || d.status === 'downloading' || d.status === 'merging' || d.status === 'transcoding'
    )
    const complete = all.filter((d) => d.status === 'complete')
    const totalPercent =
      all.length > 0
        ? all.reduce((sum, d) => sum + d.percent, 0) / all.length
        : 0
    return { total: all.length, active: active.length, complete: complete.length, totalPercent }
  }, [downloads])

  const handleChangeDir = useCallback(async () => {
    const dir = await window.api.selectDirectory()
    if (dir) useAppStore.getState().setDownloadDir(dir)
  }, [])

  const selectedCount = totalSelectedCount()
  const actionSummary = selectedActionSummary()
  const estSize = estimatedTotalSize()
  const isTrialBlocked =
    licenseState?.isTrialExpired === true &&
    !licenseState.isActivated &&
    (licenseState.isOfficialBuild || licenseState.trialSource === 'backend')

  const handleDownloadClick = useCallback(() => {
    if (isTrialBlocked) {
      onExpiredDownload()
      return
    }
    startSelectedDownloads()
  }, [isTrialBlocked, onExpiredDownload, startSelectedDownloads])

  // Hide on queue and empty tabs
  if (activeView === 'queue' || !hasVideoInfo) return null

  // ── Left section ───────────────────────────────────────────────────────

  const leftSection = (() => {
    if (stats.active > 0) {
      return (
        <button
          onClick={() => setActiveView('queue')}
          className="flex items-center gap-2 text-xs text-surface-200 hover:text-surface-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5 animate-spin text-accent-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="font-medium">{stats.active} active, {stats.complete} done</span>
          <span className="text-surface-500">({Math.round(stats.totalPercent)}%)</span>
        </button>
      )
    }

    if (stats.total > 0 && stats.complete === stats.total) {
      return (
        <button
          onClick={() => setActiveView('queue')}
          className="flex items-center gap-2 text-xs text-success hover:text-success/80 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">All downloads complete</span>
        </button>
      )
    }

    return (
      <span className="text-xs">
        <span className="font-semibold text-surface-300">{selectedCount}</span>
        <span className="text-surface-500"> item{selectedCount !== 1 ? 's' : ''} selected</span>
        {estSize != null && estSize > 0 && (
          <span className="text-surface-500 ml-1.5">~{formatBytes(estSize)}</span>
        )}
      </span>
    )
  })()

  // ── Right section ───────────────────────────────────────────────────────

  const queueButton = stats.total > 0 ? (
    <button
      onClick={() => setActiveView('queue')}
      className="px-3 py-1.5 rounded-md bg-surface-800 text-surface-200 hover:bg-surface-700 transition-colors text-xs font-medium"
    >
      Show Queue
    </button>
  ) : null

  const rightSection = (
    <div className="flex items-center gap-2">
      {queueButton}
      {selectedCount > 0 && (
        <button
          onClick={handleDownloadClick}
          className={`${getActionButtonClass(actionSummary.kind)} text-xs py-1.5 px-3 rounded-md font-medium transition-all duration-200 active:scale-[0.98]`}
        >
          {actionSummary.label} ({selectedCount})
        </button>
      )}
    </div>
  )

  return (
    <div className="shrink-0 border-t border-surface-700/50 bg-surface-950/90 backdrop-blur-sm overflow-hidden">
      {/* Progress bar for active downloads */}
      {stats.active > 0 && (
        <div className="h-0.5 bg-surface-800">
          <div
            className="h-full bg-gradient-to-r from-accent-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${stats.totalPercent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between px-4 h-10">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {leftSection}
        </div>

        {/* Center: output directory */}
        <button
          onClick={handleChangeDir}
          className="flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-surface-300 transition-colors truncate max-w-[300px] mx-4"
          title={downloadDir}
        >
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="truncate">{downloadDir}</span>
        </button>

        {/* Right */}
        <div className="shrink-0">
          {rightSection}
        </div>
      </div>
    </div>
  )
}

function getActionButtonClass(kind: SelectedActionKind): string {
  if (kind === 'transcode') {
    return 'border border-orange-500/40 bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 hover:border-orange-400/60'
  }
  if (kind === 'convert') {
    return 'border border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 hover:border-amber-400/60'
  }
  if (kind === 'mux') {
    return 'border border-purple-500/40 bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 hover:border-purple-400/60'
  }
  return 'btn-primary'
}
