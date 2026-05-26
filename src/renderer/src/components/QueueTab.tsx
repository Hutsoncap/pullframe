import { useState, useMemo } from 'react'
import { useAppStore, type DownloadState } from '../stores/app-store'
import { formatBytes } from '../lib/format-utils'

type StatusFilter = 'all' | 'active' | 'queued' | 'completed' | 'failed'
type SortKey = 'date' | 'name' | 'status' | 'progress' | 'size'

export function QueueTab() {
  const downloads = useAppStore((s) => s.downloads)
  const cancelDownload = useAppStore((s) => s.cancelDownload)
  const pauseDownload = useAppStore((s) => s.pauseDownload)
  const resumeDownload = useAppStore((s) => s.resumeDownload)
  const retryDownload = useAppStore((s) => s.retryDownload)
  const pauseAll = useAppStore((s) => s.pauseAll)
  const resumeAll = useAppStore((s) => s.resumeAll)
  const cancelAll = useAppStore((s) => s.cancelAll)
  const retryFailed = useAppStore((s) => s.retryFailed)
  const clearCompleted = useAppStore((s) => s.clearCompleted)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')

  const all = useMemo(() => Array.from(downloads.values()), [downloads])

  const counts = useMemo(() => ({
    all: all.length,
    active: all.filter((d) => d.status === 'downloading' || d.status === 'merging' || d.status === 'transcoding').length,
    queued: all.filter((d) => d.status === 'queued' || d.status === 'paused').length,
    completed: all.filter((d) => d.status === 'complete').length,
    failed: all.filter((d) => d.status === 'error' || d.status === 'cancelled').length
  }), [all])

  const filtered = useMemo(() => {
    let list = all

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (d) =>
          d.label.toLowerCase().includes(q) ||
          (d.videoTitle?.toLowerCase().includes(q) ?? false)
      )
    }

    // Status filter
    switch (filter) {
      case 'active':
        list = list.filter((d) => d.status === 'downloading' || d.status === 'merging' || d.status === 'transcoding')
        break
      case 'queued':
        list = list.filter((d) => d.status === 'queued' || d.status === 'paused')
        break
      case 'completed':
        list = list.filter((d) => d.status === 'complete')
        break
      case 'failed':
        list = list.filter((d) => d.status === 'error' || d.status === 'cancelled')
        break
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.label.localeCompare(b.label)
        case 'status':
          return statusOrder(a.status) - statusOrder(b.status)
        case 'progress':
          return b.percent - a.percent
        case 'size':
          return (b.fileSize ?? 0) - (a.fileSize ?? 0)
        case 'date':
        default:
          return b.dateAdded - a.dateAdded
      }
    })

    return list
  }, [all, search, filter, sortKey])

  const hasActive = counts.active > 0 || counts.queued > 0

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'queued', label: 'Queued', count: counts.queued },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'failed', label: 'Failed', count: counts.failed }
  ]

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-surface-100">Download Queue</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasActive && (
              <>
                <button onClick={pauseAll} className="btn-secondary text-[11px] py-1.5 px-2.5">
                  Pause All
                </button>
                <button onClick={() => resumeAll()} className="btn-secondary text-[11px] py-1.5 px-2.5">
                  Resume All
                </button>
                <button onClick={cancelAll} className="btn-secondary text-[11px] py-1.5 px-2.5 text-error hover:text-error">
                  Cancel All
                </button>
              </>
            )}
            {counts.failed > 0 && (
              <button onClick={() => retryFailed()} className="btn-secondary text-[11px] py-1.5 px-2.5">
                Retry Failed
              </button>
            )}
            {(counts.completed > 0 || counts.failed > 0) && (
              <button onClick={clearCompleted} className="btn-secondary text-[11px] py-1.5 px-2.5">
                Clear Finished
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
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
            placeholder="Search downloads..."
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

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                filter === f.key
                  ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40'
                  : 'text-surface-400 hover:text-surface-200 bg-surface-800/40 border border-surface-700/30'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1 ${filter === f.key ? 'text-accent-400' : 'text-surface-500'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}

          <div className="flex-1" />

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-[11px] bg-surface-800/60 text-surface-400 border border-surface-700/30 rounded px-2 py-1 cursor-pointer"
          >
            <option value="date">Newest First</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="progress">Progress</option>
            <option value="size">Size</option>
          </select>
        </div>
      </div>

      {/* Download list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-500">
            <svg className="w-12 h-12 mb-3 text-surface-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <p className="text-sm">
              {counts.all === 0 ? 'No downloads yet' : 'No downloads match your filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              // Group downloads by video title
              const groups: { title: string; items: typeof filtered }[] = []
              const groupMap = new Map<string, typeof filtered>()
              for (const d of filtered) {
                const key = d.videoTitle ?? ''
                if (!groupMap.has(key)) {
                  const items: typeof filtered = []
                  groupMap.set(key, items)
                  groups.push({ title: key, items })
                }
                groupMap.get(key)!.push(d)
              }

              return groups.map((group) => (
                <div key={group.title || '__no_title'} className="space-y-1">
                  {group.title && (
                    <div className="text-[11px] text-surface-500 font-medium px-1 pt-1 truncate">
                      {group.title}
                    </div>
                  )}
                  {group.items.map((d) => (
                    <QueueItem
                      key={d.id}
                      download={d}
                      onPause={() => pauseDownload(d.id)}
                      onResume={() => resumeDownload(d.id)}
                      onCancel={() => cancelDownload(d.id)}
                      onRetry={() => retryDownload(d.id)}
                    />
                  ))}
                </div>
              ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function statusOrder(status: DownloadState['status']): number {
  const order: Record<string, number> = {
    downloading: 0, merging: 1, transcoding: 2,
    queued: 3, paused: 4, error: 5, cancelled: 6, complete: 7
  }
  return order[status] ?? 99
}

function QueueItem({
  download,
  onPause,
  onResume,
  onCancel,
  onRetry
}: {
  download: DownloadState
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRetry: () => void
}) {
  const d = download
  const isActive = d.status === 'downloading' || d.status === 'merging' || d.status === 'transcoding'
  const showProgress = isActive
  const isPaused = d.status === 'paused'
  const isComplete = d.status === 'complete'
  const isFailed = d.status === 'error' || d.status === 'cancelled'

  const handleShowInFolder = (): void => {
    if (d.filePath) {
      window.api.revealInFolder(d.filePath)
    }
  }

  return (
    <div className={`glass rounded-lg overflow-hidden transition-all ${
      isActive ? 'border-accent-500/20' : ''
    }`}>
      {/* Progress bar */}
      {(showProgress || isPaused) && (
        <div className="h-0.5 bg-surface-800">
          {(d.status === 'transcoding' || d.status === 'merging') && d.percent <= 0 ? (
            <div
              className={`h-full w-1/3 rounded-full ${
                d.status === 'transcoding' ? 'bg-orange-500' : 'bg-warning'
              }`}
              style={{ animation: 'indeterminate 1.5s ease-in-out infinite' }}
            />
          ) : (
            <div
              className={`h-full transition-all duration-300 ease-out ${
                isPaused
                  ? 'bg-surface-500'
                  : d.status === 'transcoding'
                    ? 'bg-orange-500'
                    : d.status === 'merging'
                      ? 'bg-warning'
                      : 'bg-gradient-to-r from-accent-500 to-accent-400'
              }`}
              style={{ width: `${d.percent}%` }}
            />
          )}
        </div>
      )}

      <div className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <StatusIcon status={d.status} />

          {/* Type badge */}
          <TypeBadge type={d.type} category={d.downloadCategory} />

          {/* Label */}
          <span className={`text-sm truncate flex-1 min-w-0 ${
            isComplete ? 'text-surface-300' : 'text-surface-200'
          }`}>
            {d.label}
          </span>

          {/* Progress / Speed / ETA */}
          {showProgress && (
            <div className="flex items-center gap-3 shrink-0">
              {d.speed && (
                <span className="text-xs text-surface-400 tabular-nums font-mono">{d.speed}</span>
              )}
              {d.eta && (
                <span className="text-xs text-surface-500 tabular-nums font-mono">ETA {d.eta}</span>
              )}
              <span className={`text-xs tabular-nums font-mono text-right font-medium shrink-0 ${
                d.status === 'transcoding' ? 'text-orange-400' : d.status === 'merging' ? 'text-warning' : 'text-surface-300'
              }`}>
                {d.status === 'merging'
                  ? 'Muxing...'
                  : d.status === 'transcoding'
                    ? (d.percent > 0 ? `Transcoding ${Math.round(d.percent)}%` : 'Transcoding...')
                    : `${Math.round(d.percent)}%`}
              </span>
            </div>
          )}

          {isPaused && (
            <span className="text-xs text-surface-500 font-medium">
              Paused{d.percent > 0 ? ` at ${Math.round(d.percent)}%` : ''}
            </span>
          )}

          {/* Size */}
          {d.fileSize && (
            <span className="text-xs text-surface-500 font-mono shrink-0">
              {formatBytes(d.fileSize)}
            </span>
          )}

          {/* Completed: timestamp */}
          {isComplete && d.dateCompleted && (
            <span className="text-[10px] text-surface-600 font-mono shrink-0">
              {new Date(d.dateCompleted).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isActive && (
              <ActionButton icon="pause" title="Pause" onClick={onPause} />
            )}
            {isPaused && d.originalRequest && (
              <ActionButton icon="play" title="Resume" onClick={onResume} />
            )}
            {(isActive || isPaused) && (
              <ActionButton icon="cancel" title="Cancel" onClick={onCancel} className="hover:text-error" />
            )}
            {isFailed && d.originalRequest && (
              <ActionButton icon="retry" title="Retry" onClick={onRetry} />
            )}
            {isComplete && d.filePath && (
              <ActionButton icon="folder" title="Show in Folder" onClick={handleShowInFolder} />
            )}
          </div>
        </div>

        {/* Error message */}
        {d.error && (
          <div className="pl-7 mt-1">
            <p className="text-[11px] text-error/70 truncate" title={d.error}>
              {d.error}
            </p>
            {/429|too many requests|sign in|bot|forbidden|403/i.test(d.error) && (
              <p className="text-[10px] text-surface-500 mt-0.5">
                Tip: Try enabling browser cookies in Settings to avoid rate limits
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: DownloadState['status'] }) {
  switch (status) {
    case 'downloading':
      return (
        <div className="w-4 h-4 shrink-0">
          <svg className="w-4 h-4 animate-spin text-accent-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )
    case 'merging':
      return (
        <svg className="w-4 h-4 text-warning shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      )
    case 'transcoding':
      return (
        <svg className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      )
    case 'queued':
      return (
        <svg className="w-4 h-4 text-surface-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'paused':
      return (
        <svg className="w-4 h-4 text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
      )
    case 'complete':
      return (
        <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'error':
      return (
        <svg className="w-4 h-4 text-error shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      )
    case 'cancelled':
      return (
        <svg className="w-4 h-4 text-surface-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )
  }
}

function TypeBadge({ type, category }: { type: string; category: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    format: { text: category === 'audio' ? 'AUD' : 'VID', color: category === 'audio' ? 'bg-purple-500/15 text-purple-400' : 'bg-accent-500/15 text-accent-400' },
    subtitle: { text: 'SUB', color: 'bg-success/15 text-success' },
    'auto-subtitle': { text: 'SUB', color: 'bg-warning/15 text-warning' },
    thumbnail: { text: 'IMG', color: 'bg-purple-500/15 text-purple-400' },
    description: { text: 'TXT', color: 'bg-blue-500/15 text-blue-400' },
    'info-json': { text: 'JSON', color: 'bg-orange-500/15 text-orange-400' },
    comments: { text: 'CMT', color: 'bg-pink-500/15 text-pink-400' }
  }

  const badge = labels[type] ?? { text: type.toUpperCase(), color: 'bg-surface-800 text-surface-400' }

  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}>
        {badge.text}
      </span>
    </span>
  )
}

function ActionButton({
  icon,
  title,
  onClick,
  className = ''
}: {
  icon: 'pause' | 'play' | 'cancel' | 'retry' | 'folder'
  title: string
  onClick: () => void
  className?: string
}) {
  const paths: Record<string, string> = {
    pause: 'M15.75 5.25v13.5m-7.5-13.5v13.5',
    play: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z',
    cancel: 'M6 18L18 6M6 6l12 12',
    retry: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182',
    folder: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
  }

  return (
    <button
      onClick={onClick}
      className={`p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800/60 transition-colors ${className}`}
      title={title}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={icon === 'cancel' ? 2.5 : 1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={paths[icon]} />
      </svg>
    </button>
  )
}
