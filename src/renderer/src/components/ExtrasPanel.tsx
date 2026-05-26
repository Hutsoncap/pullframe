import { useAppStore, useActiveTab } from '../stores/app-store'
import { formatDuration, formatNumber } from '../lib/format-utils'

function parseResPixels(res: string): number {
  const match = res.match(/(\d+)x(\d+)/)
  return match ? parseInt(match[1]) * parseInt(match[2]) : 0
}

export function ExtrasPanel() {
  const tab = useActiveTab()
  const toggleExtra = useAppStore((s) => s.toggleExtra)

  const videoInfo = tab?.videoInfo ?? null
  const selectedExtras = tab?.selectedExtras ?? new Set<string>()

  if (!videoInfo) return <></>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
      {/* Thumbnails Card */}
      {videoInfo.thumbnails.length > 0 && (
        <ThumbnailsCard
          thumbnails={videoInfo.thumbnails}
          selectedExtras={selectedExtras}
          toggleExtra={toggleExtra}
        />
      )}

      {/* Description Card */}
      {videoInfo.description && (
        <DescriptionCard
          description={videoInfo.description}
          isSelected={selectedExtras.has('description')}
          onToggle={() => toggleExtra('description')}
        />
      )}

      {/* Chapters Card */}
      <ChaptersCard
        chapters={videoInfo.chapters}
        selectedExtras={selectedExtras}
        toggleExtra={toggleExtra}
      />

      {/* Metadata Card */}
      <MetadataCard
        tags={videoInfo.tags}
        categories={videoInfo.categories}
        isSelected={selectedExtras.has('info-json')}
        onToggle={() => toggleExtra('info-json')}
      />

      {/* Comments Card */}
      <CommentsCard
        commentCount={videoInfo.viewCount ? Math.floor(videoInfo.viewCount * 0.01) : null}
        isSelected={selectedExtras.has('comments')}
        onToggle={() => toggleExtra('comments')}
      />
    </div>
  )
}

/* ────────────────────────────────────────── Thumbnails ────── */

function ThumbnailsCard({
  thumbnails,
  selectedExtras,
  toggleExtra
}: {
  thumbnails: { id: string; url: string; width: number | null; height: number | null; resolution: string }[]
  selectedExtras: Set<string>
  toggleExtra: (key: string) => void
}) {
  // Sort by resolution (largest first), then dedup to show best thumbnails
  const sorted = [...thumbnails].sort((a, b) => {
    const aPixels = (a.width ?? 0) * (a.height ?? 0) || parseResPixels(a.resolution)
    const bPixels = (b.width ?? 0) * (b.height ?? 0) || parseResPixels(b.resolution)
    return bPixels - aPixels
  })
  const seen = new Set<string>()
  const unique = sorted.filter((t) => {
    const key = t.resolution || `${t.width}x${t.height}`
    if (seen.has(key) || key === 'nullxnull') return false
    seen.add(key)
    return true
  }).slice(0, 6)

  const thumbnailKeys = unique.map((_, i) => `thumbnail:${i}`)
  const allSelected = thumbnailKeys.length > 0 && thumbnailKeys.every((k) => selectedExtras.has(k))
  const toggleAll = () => {
    for (const key of thumbnailKeys) {
      if (allSelected) {
        // Only remove if currently selected
        if (selectedExtras.has(key)) toggleExtra(key)
      } else {
        // Only add if not already selected
        if (!selectedExtras.has(key)) toggleExtra(key)
      }
    }
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <h3 className="text-sm font-medium text-surface-200">Thumbnails</h3>
          <span className="text-xs text-surface-500">({unique.length})</span>
        </div>
        <CardCheckbox label="Download All" isSelected={allSelected} onToggle={toggleAll} />
      </div>

      <div className="p-3 grid grid-cols-3 gap-2">
        {unique.map((thumb, index) => {
          const thumbKey = `thumbnail:${index}`
          const isThumbSelected = selectedExtras.has(thumbKey)
          return (
            <button
              key={thumb.id}
              onClick={() => toggleExtra(thumbKey)}
              className={`relative aspect-video rounded-lg overflow-hidden bg-surface-800 group transition-all duration-200 ${
                isThumbSelected ? 'ring-2 ring-accent-500/60' : 'ring-1 ring-surface-700/40 hover:ring-surface-600/60'
              }`}
            >
              <img
                src={thumb.url}
                alt={`Thumbnail ${thumb.resolution}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Resolution label */}
              <span className="absolute bottom-1 right-1 text-[9px] font-mono text-white/80 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                {thumb.resolution}
              </span>
              {/* Checkmark overlay */}
              {isThumbSelected && (
                <div className="absolute inset-0 bg-accent-500/10 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-accent-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────── Description ────── */

function DescriptionCard({
  description,
  isSelected,
  onToggle
}: {
  description: string
  isSelected: boolean
  onToggle: () => void
}) {
  const lines = description.split('\n').slice(0, 3).join('\n')
  const truncated = lines.length < description.length

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <h3 className="text-sm font-medium text-surface-200">Description</h3>
        </div>
        <CardCheckbox label="Download .txt" isSelected={isSelected} onToggle={onToggle} />
      </div>

      <div className="px-4 py-3">
        <p className="text-xs text-surface-400 leading-relaxed whitespace-pre-line">
          {lines}
          {truncated && <span className="text-surface-500">...</span>}
        </p>
        <div className="mt-2 text-[10px] text-surface-500 font-mono">
          {formatNumber(description.length)} characters
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────── Metadata ────── */

function MetadataCard({
  tags,
  categories,
  isSelected,
  onToggle
}: {
  tags: string[]
  categories: string[]
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          <h3 className="text-sm font-medium text-surface-200">Info JSON</h3>
        </div>
        <CardCheckbox label="Download" isSelected={isSelected} onToggle={onToggle} />
      </div>

      <div className="px-4 py-3 space-y-3">
        {categories.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold uppercase text-surface-500 tracking-wider">Categories</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {categories.map((cat) => (
                <span key={cat} className="text-[11px] text-surface-300 bg-surface-800/80 px-2 py-0.5 rounded-full border border-surface-700/40">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold uppercase text-surface-500 tracking-wider">Tags</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tags.slice(0, 10).map((tag) => (
                <span key={tag} className="text-[11px] text-surface-300 bg-surface-800/80 px-2 py-0.5 rounded-full border border-surface-700/40">
                  {tag}
                </span>
              ))}
              {tags.length > 10 && (
                <span className="text-[10px] text-surface-500 self-center">+{tags.length - 10} more</span>
              )}
            </div>
          </div>
        )}
        {tags.length === 0 && categories.length === 0 && (
          <p className="text-xs text-surface-500">Full video metadata in JSON format</p>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────── Comments ────── */

function CommentsCard({
  commentCount,
  isSelected,
  onToggle
}: {
  commentCount: number | null
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
          <h3 className="text-sm font-medium text-surface-200">Comments</h3>
        </div>
        <CardCheckbox label="Download" isSelected={isSelected} onToggle={onToggle} />
      </div>

      <div className="px-4 py-3 space-y-2">
        {commentCount !== null && commentCount > 0 && (
          <p className="text-xs text-surface-400">
            Estimated ~{formatNumber(commentCount)} comments
          </p>
        )}
        <div className="flex items-start gap-2 bg-warning/5 border border-warning/10 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-[11px] text-warning/80 leading-relaxed">
            Downloading comments may take a while for popular videos
          </p>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────── Chapters ────── */

const CHAPTER_EXPORT_FORMATS = [
  { key: 'chapters:premiere-csv', label: 'Premiere Pro Markers', desc: 'Marker CSV import for Adobe Premiere Pro' },
  { key: 'chapters:edl', label: 'EDL', desc: 'CMX 3600 Edit Decision List' },
  { key: 'chapters:csv', label: 'CSV', desc: 'Simple spreadsheet format' },
  { key: 'chapters:txt', label: 'YouTube TXT', desc: 'Timestamp + title format' }
] as const

function ChaptersCard({
  chapters,
  selectedExtras,
  toggleExtra
}: {
  chapters: { title: string; startTime: number; endTime: number }[]
  selectedExtras: Set<string>
  toggleExtra: (key: string) => void
}) {
  const anySelected = CHAPTER_EXPORT_FORMATS.some((f) => selectedExtras.has(f.key))
  const hasChapters = chapters.length > 0

  return (
    <div className="glass rounded-xl overflow-hidden lg:col-span-2">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <h3 className="text-sm font-medium text-surface-200">Chapter Markers</h3>
          <span className="text-xs text-surface-500">({chapters.length})</span>
        </div>
      </div>

      {hasChapters ? (
        <div className="divide-y divide-surface-800/40 max-h-48 overflow-y-auto">
          {chapters.map((chapter, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2">
              <span className="text-[10px] font-mono text-surface-500 w-5 text-right shrink-0">
                {i + 1}
              </span>
              <span className="text-xs font-mono text-accent-400/80 shrink-0 w-20">
                {formatDuration(chapter.startTime)}
                <span className="text-surface-600 mx-1">-</span>
                {formatDuration(chapter.endTime)}
              </span>
              <span className="text-sm text-surface-300 truncate">{chapter.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4">
          <p className="text-xs text-surface-500">
            No chapter markers found for this video.
          </p>
        </div>
      )}

      {/* Export formats */}
      {hasChapters && (
        <div className={`px-4 py-3 border-t border-surface-800/40 ${anySelected ? 'bg-accent-500/5' : ''}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="text-[10px] font-semibold uppercase text-surface-500 tracking-wider">Download Chapter Markers</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CHAPTER_EXPORT_FORMATS.map((fmt) => {
            const isSelected = selectedExtras.has(fmt.key)
            return (
              <button
                key={fmt.key}
                onClick={() => toggleExtra(fmt.key)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border transition-all duration-150 text-left ${
                  isSelected
                    ? 'bg-accent-500/10 border-accent-500/40 ring-1 ring-accent-500/20'
                    : 'bg-surface-800/40 border-surface-700/40 hover:border-surface-600/60 hover:bg-surface-800/60'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <div
                    className={`w-3 h-3 rounded border flex items-center justify-center transition-all duration-150 shrink-0 ${
                      isSelected
                        ? 'bg-accent-500 border-accent-500'
                        : 'border-surface-600 bg-surface-900/50'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${isSelected ? 'text-accent-300' : 'text-surface-200'}`}>
                    {fmt.label}
                  </span>
                </div>
                <span className="text-[10px] text-surface-500 pl-[18px]">{fmt.desc}</span>
              </button>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────── Shared ────── */

function CardCheckbox({
  label,
  isSelected,
  onToggle
}: {
  label: string
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-xs text-surface-300 hover:text-surface-100 transition-colors"
    >
      <div
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-150 ${
          isSelected
            ? 'bg-accent-500 border-accent-500'
            : 'border-surface-600 bg-surface-900/50'
        }`}
      >
        {isSelected && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>
      {label}
    </button>
  )
}
