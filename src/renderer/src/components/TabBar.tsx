import { useRef, useEffect, useState, useMemo } from 'react'
import { useAppStore } from '../stores/app-store'

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const activeView = useAppStore((s) => s.activeView)
  const switchTab = useAppStore((s) => s.switchTab)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const addTab = useAppStore((s) => s.addTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const reorderTabs = useAppStore((s) => s.reorderTabs)
  const downloads = useAppStore((s) => s.downloads)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [badgePulse, setBadgePulse] = useState(false)
  const prevActiveCount = useRef(0)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Count active downloads for the badge
  const activeDownloadCount = useMemo(() => {
    let count = 0
    for (const d of downloads.values()) {
      if (d.status === 'downloading' || d.status === 'queued' || d.status === 'merging' || d.status === 'transcoding' || d.status === 'paused') {
        count++
      }
    }
    return count
  }, [downloads])

  // Pulse badge when new items arrive
  useEffect(() => {
    if (activeDownloadCount > prevActiveCount.current && activeDownloadCount > 0) {
      setBadgePulse(true)
      const timer = setTimeout(() => setBadgePulse(false), 600)
      prevActiveCount.current = activeDownloadCount
      return () => clearTimeout(timer)
    }
    prevActiveCount.current = activeDownloadCount
    return undefined
  }, [activeDownloadCount])

  // Scroll active tab into view when it changes
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const activeEl = container.querySelector(`[data-tab-id="${activeTabId}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeTabId])

  const canClose = tabs.length > 1
  const isQueueView = activeView === 'queue'

  const handleTabClick = (tabId: string): void => {
    if (activeView === 'queue') {
      setActiveView('video')
    }
    switchTab(tabId)
  }

  const handleQueueClick = (): void => {
    setActiveView(activeView === 'queue' ? 'video' : 'queue')
  }

  return (
    <div
      className="h-9 flex items-stretch bg-surface-950/80 backdrop-blur-sm border-b border-surface-800/50 shrink-0 select-none"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Scrollable tab area */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-stretch overflow-x-auto scrollbar-none min-w-0"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId && !isQueueView
          const title = tab.videoInfo?.title
            ?? (tab.playlistEntries && tab.playlistEntries.length > 0
              ? tab.playlistMetadata?.title
                ?? tab.playlistMetadata?.playlistName
                ?? `Playlist (${tab.playlistEntries.length} videos)`
              : null)
            ?? (tab.url ? tab.url.replace(/^https?:\/\/(www\.)?youtube\.com\/?/, '').replace(/^@/, '') || null : null)
          const displayTitle = title
            ? title.length > 28
              ? title.slice(0, 26) + '...'
              : title
            : tab.isLoading
              ? 'Loading...'
              : 'New Tab'

          const isDragging = dragIndex === index
          const isDropTarget = dropIndex === index && dragIndex !== index

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault(); setDropIndex(index) }}
              onDragLeave={() => setDropIndex(null)}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null && dragIndex !== index) {
                  reorderTabs(dragIndex, index)
                }
                setDragIndex(null)
                setDropIndex(null)
              }}
              onDragEnd={() => { setDragIndex(null); setDropIndex(null) }}
              className={`group relative flex items-center gap-1.5 min-w-0 max-w-[200px] px-3 cursor-pointer transition-colors duration-150 border-r border-surface-800/30 ${
                isDragging ? 'opacity-40' : ''
              } ${
                isDropTarget ? 'border-l-2 border-l-accent-500' : ''
              } ${
                isActive
                  ? 'bg-surface-900/80 text-surface-100'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900/40'
              }`}
              title={title ?? displayTitle}
              onClick={() => handleTabClick(tab.id)}
            >
              {/* Loading indicator or content icon */}
              {tab.isLoading ? (
                <svg className="w-3 h-3 animate-spin text-accent-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : tab.videoInfo ? (
                <svg className="w-3 h-3 shrink-0 text-accent-400/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              ) : tab.playlistEntries ? (
                <svg className="w-3 h-3 shrink-0 text-accent-400/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h11M8 12h11M8 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
                </svg>
              ) : null}

              {/* Tab title */}
              <span className="text-[11px] font-medium min-w-0 truncate leading-5">
                {displayTitle}
              </span>

              {/* Close button */}
              {canClose && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className={`ml-auto p-0.5 rounded transition-colors shrink-0 ${
                    isActive
                      ? 'text-surface-400 hover:text-surface-100 hover:bg-surface-700/60'
                      : 'text-surface-500 opacity-0 group-hover:opacity-100 hover:text-surface-200 hover:bg-surface-700/60'
                  }`}
                  title="Close tab"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-accent-500 rounded-full" />
              )}
            </div>
          )
        })}
      </div>

      {/* New tab button */}
      <button
        onClick={() => { addTab(); if (isQueueView) setActiveView('video') }}
        className="px-2.5 flex items-center justify-center text-surface-500 hover:text-surface-200 hover:bg-surface-800/60 transition-colors shrink-0 border-l border-surface-800/30"
        title="New tab"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Queue tab - pinned right */}
      <button
        data-queue-tab
        onClick={handleQueueClick}
        className={`relative px-3 flex items-center gap-1.5 transition-colors shrink-0 border-l border-surface-800/30 ${
          isQueueView
            ? 'bg-surface-900/80 text-surface-100'
            : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900/40'
        }`}
        title="Download Queue"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <span className="text-[11px] font-medium leading-5">Queue</span>
        {activeDownloadCount > 0 && (
          <span className={`min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-accent-500 rounded-full px-1 ${
            badgePulse ? 'animate-queue-badge-pulse' : ''
          }`}>
            {activeDownloadCount}
          </span>
        )}
        {isQueueView && (
          <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-accent-500 rounded-full" />
        )}
      </button>

      {/* Hide scrollbar with CSS */}
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
