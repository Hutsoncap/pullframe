import { useState } from 'react'
import { useAppStore, useActiveTab } from '../stores/app-store'
import { formatDuration, formatNumber, formatDate } from '../lib/format-utils'

export function VideoPreview() {
  const tab = useActiveTab()
  const videoInfo = tab?.videoInfo ?? null
  const reset = useAppStore((s) => s.reset)
  const [descExpanded, setDescExpanded] = useState(false)

  if (!videoInfo) return <></>

  const description = videoInfo.description ?? ''
  const descLines = description.split('\n')
  const shortDesc = descLines.slice(0, 2).join('\n')
  const hasMoreDesc = descLines.length > 2 || description.length > 200

  return (
    <div className="px-6 pt-4 pb-2 animate-slide-up">
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex gap-5 p-5">
          {/* Thumbnail */}
          <div className="shrink-0 w-72 aspect-video rounded-xl overflow-hidden shadow-lg shadow-black/30 bg-surface-800">
            <img
              src={videoInfo.thumbnail}
              alt={videoInfo.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-surface-50 leading-snug line-clamp-2">
                {videoInfo.title}
              </h2>
              <button
                onClick={reset}
                className="shrink-0 btn-secondary text-xs py-1.5 px-3 rounded-lg"
              >
                New URL
              </button>
            </div>

            {/* Channel + video link */}
            <div className="flex items-center gap-1.5 mt-2">
              <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {videoInfo.uploaderUrl ? (
                <button
                  onClick={() => window.api.openExternal(videoInfo.uploaderUrl!)}
                  className="text-sm text-accent-400 hover:text-accent-300 transition-colors truncate"
                >
                  {videoInfo.uploader}
                </button>
              ) : (
                <span className="text-sm text-surface-300 truncate">{videoInfo.uploader}</span>
              )}
              {tab?.url && (
                <>
                  <span className="text-surface-600">·</span>
                  <button
                    onClick={() => window.api.openExternal(tab.url)}
                    className="text-sm text-surface-500 hover:text-accent-400 transition-colors flex items-center gap-1"
                  >
                    Open video
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <StatBadge icon="clock">{formatDuration(videoInfo.duration)}</StatBadge>
              {videoInfo.viewCount !== null && (
                <StatBadge icon="eye">{formatNumber(videoInfo.viewCount)} views</StatBadge>
              )}
              {videoInfo.likeCount !== null && (
                <StatBadge icon="heart">{formatNumber(videoInfo.likeCount)} likes</StatBadge>
              )}
              {videoInfo.uploadDate && (
                <StatBadge icon="calendar">{formatDate(videoInfo.uploadDate)}</StatBadge>
              )}
            </div>

            {/* Tags */}
            {videoInfo.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {videoInfo.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium text-surface-400 bg-surface-800/80 px-2 py-0.5 rounded-full border border-surface-700/40"
                  >
                    {tag}
                  </span>
                ))}
                {videoInfo.tags.length > 5 && (
                  <span className="text-[10px] text-surface-500">+{videoInfo.tags.length - 5} more</span>
                )}
              </div>
            )}

            {/* Description preview */}
            {description && (
              <div className="mt-3 relative">
                {!descExpanded ? (
                  <>
                    <p className="text-xs text-surface-400 leading-relaxed whitespace-pre-line">
                      {shortDesc}
                    </p>
                    {hasMoreDesc && (
                      <button
                        onClick={() => setDescExpanded(true)}
                        className="text-[11px] text-accent-400 hover:text-accent-300 mt-1 transition-colors"
                      >
                        Show more
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-surface-900/40 p-2 border border-surface-700/30">
                      <p className="text-xs text-surface-400 leading-relaxed whitespace-pre-line select-text">
                        {description}
                      </p>
                    </div>
                    <button
                      onClick={() => setDescExpanded(false)}
                      className="text-[11px] text-accent-400 hover:text-accent-300 mt-1 transition-colors"
                    >
                      Show less
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

function StatBadge({
  icon,
  children
}: {
  icon: 'clock' | 'eye' | 'heart' | 'calendar'
  children: React.ReactNode
}) {
  const iconPaths: Record<string, React.ReactNode> = {
    clock: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    eye: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    ),
    heart: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    ),
    calendar: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-surface-300 bg-surface-800/60 px-2.5 py-1 rounded-lg">
      <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        {iconPaths[icon]}
      </svg>
      {children}
    </span>
  )
}
