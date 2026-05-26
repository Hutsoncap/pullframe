import { type ReactNode } from 'react'
import { useAppStore, useActiveTab } from '../stores/app-store'

type Tab = 'formats' | 'subtitles' | 'extras'

interface TabDef {
  id: Tab
  label: string
  icon: ReactNode
  countFn: () => { total: number; selected: number }
}

export function CategoryTabs() {
  const tab = useActiveTab()
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const activeTab = tab?.activeTab ?? 'formats'
  const videoInfo = tab?.videoInfo ?? null
  const selectedFormats = tab?.selectedFormats ?? new Set<string>()
  const selectedSubtitles = tab?.selectedSubtitles ?? new Set<string>()
  const selectedExtras = tab?.selectedExtras ?? new Set<string>()

  const tabs: TabDef[] = [
    {
      id: 'formats',
      label: 'Formats',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m1.5 2.625c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125" />
        </svg>
      ),
      countFn: () => ({
        total: videoInfo?.formats.length ?? 0,
        selected: selectedFormats.size
      })
    },
    {
      id: 'subtitles',
      label: 'Subtitles',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      countFn: () => {
        const manualCount = videoInfo ? Object.keys(videoInfo.subtitles).length : 0
        const autoCount = videoInfo ? Object.keys(videoInfo.automaticCaptions).length : 0
        return {
          total: manualCount + autoCount,
          selected: selectedSubtitles.size
        }
      }
    },
    {
      id: 'extras',
      label: 'Extras',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
      countFn: () => {
        let total = 0
        if (videoInfo) {
          total += videoInfo.thumbnails.length > 0 ? 1 : 0
          total += videoInfo.description ? 1 : 0
          total += 1 // info-json always available
          total += 1 // comments always available
          total += videoInfo.chapters.length > 0 ? 1 : 0
        }
        return { total, selected: selectedExtras.size }
      }
    }
  ]

  return (
    <div className="relative border-b border-surface-800/60">
      <div className="flex gap-1">
        {tabs.map((tab) => {
          const { total, selected } = tab.countFn()
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? 'text-accent-400'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>

              {/* Count badge */}
              {total > 0 && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-accent-500/20 text-accent-300'
                      : 'bg-surface-800 text-surface-400'
                  }`}
                >
                  {selected > 0 ? `${selected}/` : ''}
                  {total}
                </span>
              )}

              {/* Active underline */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
