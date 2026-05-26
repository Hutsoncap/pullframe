import { useState, type ReactNode } from 'react'
import { useAppStore, useActiveTab } from '../stores/app-store'
import {
  sortFormats,
  getQualityLabel,
  getCodecLabel,
  formatBytes,
  getBestFormat,
  filterUsableFormats
} from '../lib/format-utils'
import type { YtdlpFormat } from '../types'

type FormatType = 'combined' | 'video-only' | 'audio-only'

interface SectionConfig {
  type: FormatType
  label: string
  subtitle?: string
  icon: ReactNode
}

const sections: SectionConfig[] = [
  {
    type: 'combined',
    label: 'Video + Audio',
    subtitle: 'Pre-combined by YouTube, lower bitrate',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    )
  },
  {
    type: 'video-only',
    label: 'Video Only',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    )
  },
  {
    type: 'audio-only',
    label: 'Audio Only',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    )
  }
]

// ── Merged quality presets ──────────────────────────────────────────────────

interface MergePreset {
  id: string
  label: string
  resolution: number
  formatString: string
  category: 'highest' | 'quick'
}

// Highest Quality: absolute best codec at each resolution, will transcode to MP4
// These use bestvideo which grabs VP9/AV1 (highest bitrate), then ffmpeg converts to H.264
const HIGHEST_QUALITY_PRESETS: MergePreset[] = [
  { id: 'hq-2160', label: '4K (2160p) + Best Audio', resolution: 2160, formatString: 'bestvideo[height<=2160]+bestaudio/best', category: 'highest' },
  { id: 'hq-1440', label: '1440p + Best Audio', resolution: 1440, formatString: 'bestvideo[height<=1440]+bestaudio/best', category: 'highest' },
  { id: 'hq-1080', label: '1080p + Best Audio', resolution: 1080, formatString: 'bestvideo[height<=1080]+bestaudio/best', category: 'highest' },
  { id: 'hq-720', label: '720p + Best Audio', resolution: 720, formatString: 'bestvideo[height<=720]+bestaudio/best', category: 'highest' }
]

// Quick MP4: H.264+AAC native, no re-encoding needed - just a fast mux
const QUICK_MP4_PRESETS: MergePreset[] = [
  { id: 'qk-2160', label: '4K (2160p) H.264 + AAC', resolution: 2160, formatString: 'bestvideo[height<=2160][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=2160][vcodec^=avc1]+bestaudio/best', category: 'quick' },
  { id: 'qk-1440', label: '1440p H.264 + AAC', resolution: 1440, formatString: 'bestvideo[height<=1440][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1440][vcodec^=avc1]+bestaudio/best', category: 'quick' },
  { id: 'qk-1080', label: '1080p H.264 + AAC', resolution: 1080, formatString: 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080][vcodec^=avc1]+bestaudio/best', category: 'quick' },
  { id: 'qk-720', label: '720p H.264 + AAC', resolution: 720, formatString: 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720][vcodec^=avc1]+bestaudio/best', category: 'quick' }
]

export function FormatTable() {
  const tab = useActiveTab()
  const toggleFormat = useAppStore((s) => s.toggleFormat)
  const selectAllFormats = useAppStore((s) => s.selectAllFormats)
  const deselectAllFormats = useAppStore((s) => s.deselectAllFormats)
  const ffmpegAvailable = useAppStore((s) => s.ffmpegAvailable)
  const audioConvertFormat = useAppStore((s) => s.audioConvertFormat)
  const setAudioConvertFormat = useAppStore((s) => s.setAudioConvertFormat)
  const videoTranscodeFormat = useAppStore((s) => s.videoTranscodeFormat)
  const setVideoTranscodeFormat = useAppStore((s) => s.setVideoTranscodeFormat)
  const autoIncludeAudioWithProfessionalTranscodes = useAppStore((s) => s.autoIncludeAudioWithProfessionalTranscodes)
  const setAutoIncludeAudioWithProfessionalTranscodes = useAppStore((s) => s.setAutoIncludeAudioWithProfessionalTranscodes)
  const preferredContainer = useAppStore((s) => s.preferredContainer)
  const setPreferredContainer = useAppStore((s) => s.setPreferredContainer)

  const videoInfo = tab?.videoInfo ?? null
  const selectedFormats = tab?.selectedFormats ?? new Set<string>()

  if (!videoInfo) return <></>

  const usable = filterUsableFormats(videoInfo.formats)
  const sorted = sortFormats(usable)

  // Merge presets
  const videoOnlyFormats = usable.filter((f) => f.type === 'video-only')
  const maxHeight = Math.max(0, ...videoOnlyFormats.map((f) => f.height ?? 0))
  const containerNeedsTranscode = preferredContainer === 'mp4'
  const containers = ['mp4', 'mkv', 'webm', 'auto'] as const

  const highestPresets = maxHeight > 0
    ? HIGHEST_QUALITY_PRESETS.filter((p) => p.resolution <= maxHeight)
    : []
  // Only show FAST presets at resolutions where H.264 actually exists
  const h264Heights = new Set(
    videoOnlyFormats
      .filter((f) => f.vcodec?.startsWith('avc1'))
      .map((f) => f.height)
      .filter((h): h is number => h != null)
  )
  // Check which resolutions have non-H.264 codecs (VP9/AV1) as the best video
  // Only show FAST presets at resolutions where the best codec ISN'T H.264 already
  // (otherwise the "highest" preset already picks H.264 and FAST would be redundant)
  const resolutionsWithNonH264Best = new Set(
    highestPresets
      .filter((p) => {
        const best = videoOnlyFormats
          .filter((f) => (f.height ?? 0) <= p.resolution)
          .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0))[0]
        return best && !best.vcodec?.startsWith('avc1')
      })
      .map((p) => p.resolution)
  )
  const quickPresets = containerNeedsTranscode
    ? QUICK_MP4_PRESETS.filter((p) => h264Heights.has(p.resolution) && resolutionsWithNonH264Best.has(p.resolution))
    : []
  const allPresets = [...highestPresets, ...quickPresets]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Best Quality (Merged) */}
      {allPresets.length > 0 && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-200">
              <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <span>Best Quality (Merged)</span>
              <span className="text-[10px] text-surface-500 font-normal">Requires ffmpeg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-surface-500">Container:</span>
              {containers.map((c) => (
                <button
                  key={c}
                  onClick={() => setPreferredContainer(c)}
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-all ${
                    preferredContainer === c
                      ? 'bg-accent-500/20 text-accent-300'
                      : 'text-surface-500 hover:text-surface-300'
                  }`}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-surface-800/40">
            {allPresets.map((preset) => {
              const isSelected = selectedFormats.has(preset.formatString)

              // For "quick" (H.264) presets, find the H.264 format specifically
              // For "highest" presets, find the best video (VP9/AV1) at that resolution
              const isQuick = preset.category === 'quick'
              const matchingVideo = usable
                .filter((f) => {
                  if (f.type !== 'video-only') return false
                  if ((f.height ?? 0) > preset.resolution) return false
                  if (isQuick && !f.vcodec?.startsWith('avc1')) return false
                  return true
                })
                .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0))[0]
              const bestAudio = usable
                .filter((f) => f.type === 'audio-only')
                .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0]

              // Get the actual best codec name (the one yt-dlp will pick)
              const bestCodecName = (() => {
                const v = matchingVideo?.vcodec
                if (!v || v === 'none') return 'auto'
                if (v.startsWith('avc1')) return 'H.264'
                if (v.startsWith('av01')) return 'AV1'
                if (v.startsWith('vp9') || v.startsWith('vp09')) return 'VP9'
                if (v.startsWith('hev') || v.startsWith('hvc')) return 'HEVC'
                return v.split('.')[0].toUpperCase()
              })()

              // Check if the best video at this resolution is already H.264
              const bestVideoIsH264 = matchingVideo?.vcodec?.startsWith('avc1') ?? false
              // Container-aware badge logic:
              // MKV/WebM accept any codec natively → always MUX
              // MP4: H.264 source = MUX, VP9/AV1 source = TRANSCODE
              const containerAcceptsAnything = preferredContainer === 'mkv' || preferredContainer === 'webm' || preferredContainer === 'auto'
              const needsTranscode = preset.category === 'highest' && containerNeedsTranscode && !bestVideoIsH264 && !containerAcceptsAnything
              const isMux = preset.category === 'highest' && !needsTranscode

              const vSize = matchingVideo?.filesize ?? matchingVideo?.filesizeApprox ?? null
              const aSize = bestAudio?.filesize ?? bestAudio?.filesizeApprox ?? null
              const rawSize = vSize ? (aSize ? vSize + aSize : vSize) : null
              const estSize = rawSize ? Math.round(rawSize) : null

              // Badge + note
              let badgeText: string
              let badgeClass: string
              let noteText: string
              if (needsTranscode) {
                badgeText = 'TRANSCODE'
                badgeClass = 'text-orange-400 bg-orange-500/10'
                noteText = `${bestCodecName} → H.264 · slower`
              } else if (isMux) {
                badgeText = 'MUX'
                badgeClass = 'text-purple-400 bg-purple-500/10'
                noteText = bestVideoIsH264 ? `H.264 · instant` : `${bestCodecName} · direct mux`
              } else {
                badgeText = 'FAST'
                badgeClass = 'text-success bg-success/10'
                noteText = 'H.264 + AAC'
              }

              return (
                <button
                  key={preset.id}
                  onClick={() => toggleFormat(preset.formatString)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 glass-hover ${
                    isSelected ? 'bg-accent-500/5' : ''
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-accent-500 border-accent-500' : 'border-surface-600 bg-surface-900/50'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-surface-100">{preset.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                    {badgeText}
                  </span>
                  <span className="flex-1" />
                  {estSize && (
                    <span className="text-[11px] text-surface-400 font-mono">~{formatBytes(estSize)}</span>
                  )}
                  <span className="text-[11px] text-surface-500 hidden sm:inline">
                    {noteText}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sections.map((section) => {
        const formats = sorted.filter((f) => f.type === section.type)
        if (formats.length === 0) return null

        const best = getBestFormat(usable, section.type)
        const allSelected = formats.every((f) => selectedFormats.has(f.formatId))
        const someSelected = formats.some((f) => selectedFormats.has(f.formatId))

        return (
          <FormatSection
            key={section.type}
            config={section}
            formats={formats}
            bestFormatId={best?.formatId ?? null}
            selectedFormats={selectedFormats}
            allSelected={allSelected}
            someSelected={someSelected}
            duration={videoInfo.duration}
            onToggle={toggleFormat}
            onSelectAll={() => selectAllFormats(section.type)}
            onDeselectAll={() => deselectAllFormats(section.type)}
            videoTranscode={section.type === 'video-only' ? {
              format: videoTranscodeFormat,
              ffmpegAvailable,
              onChange: setVideoTranscodeFormat,
              professionalAudioMerge: autoIncludeAudioWithProfessionalTranscodes,
              onProfessionalAudioMergeChange: setAutoIncludeAudioWithProfessionalTranscodes
            } : undefined}
            audioConvert={section.type === 'audio-only' ? {
              format: audioConvertFormat,
              ffmpegAvailable,
              onChange: setAudioConvertFormat
            } : undefined}
          />
        )
      })}
    </div>
  )
}

interface FormatSectionProps {
  config: SectionConfig
  formats: YtdlpFormat[]
  bestFormatId: string | null
  selectedFormats: Set<string>
  allSelected: boolean
  someSelected: boolean
  duration: number
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  videoTranscode?: {
    format: 'original' | 'h264-mp4' | 'prores' | 'dnxhr'
    ffmpegAvailable: boolean
    onChange: (fmt: 'original' | 'h264-mp4' | 'prores' | 'dnxhr') => void
    professionalAudioMerge: boolean
    onProfessionalAudioMergeChange: (enabled: boolean) => void
  }
  audioConvert?: {
    format: 'original' | 'wav' | 'flac' | 'mp3'
    ffmpegAvailable: boolean
    onChange: (fmt: 'original' | 'wav' | 'flac' | 'mp3') => void
  }
}

function FormatRow({
  format,
  isSelected,
  isBest,
  duration,
  onToggle,
  videoTranscodeFormat,
  audioConvertFormat
}: {
  format: YtdlpFormat
  isSelected: boolean
  isBest: boolean
  duration: number
  onToggle: (id: string) => void
  videoTranscodeFormat?: 'original' | 'h264-mp4' | 'prores' | 'dnxhr'
  audioConvertFormat?: 'original' | 'wav' | 'flac' | 'mp3'
}) {
  const knownSize = format.filesize ?? format.filesizeApprox
  const computedSize =
    !knownSize && format.tbr && duration
      ? (format.tbr * 1000 / 8) * duration
      : null
  const originalSize = knownSize ?? computedSize
  const bitrate = format.tbr

  // Transcode/convert extension preview
  const videoTranscodeExtMap: Record<string, string> = {
    'h264-mp4': 'mp4',
    'prores': 'mov',
    'dnxhr': 'mxf'
  }
  const isVideoTranscoding = format.type === 'video-only' && videoTranscodeFormat && videoTranscodeFormat !== 'original'
  const isAudioConverting = format.type === 'audio-only' && audioConvertFormat && audioConvertFormat !== 'original'
  const targetExt = isVideoTranscoding
    ? videoTranscodeExtMap[videoTranscodeFormat!]
    : isAudioConverting
      ? audioConvertFormat!
      : null
  const converting = !!(isVideoTranscoding || isAudioConverting)

  // Estimate transcoded/converted output size
  const transcodedSize = (() => {
    if (!converting || !duration) return null
    const w = format.width ?? 1920
    const h = format.height ?? 1080
    const fps = format.fps ?? 30
    const pixels = w * h

    if (isVideoTranscoding) {
      switch (videoTranscodeFormat) {
        case 'prores':
          // ProRes 422: ~0.3 bytes per pixel per frame
          return pixels * fps * 0.3 * duration
        case 'dnxhr':
          // DNxHR HQ: ~0.44 bytes per pixel per frame
          return pixels * fps * 0.44 * duration
        case 'h264-mp4':
          // CRF 18 H.264: roughly 1.2x source size (less efficient than VP9/AV1)
          return originalSize ? originalSize * 1.2 : null
        default:
          return null
      }
    }
    if (isAudioConverting) {
      const sampleRate = format.sampleRate ?? 48000
      const channels = format.audioChannels ?? 2
      switch (audioConvertFormat) {
        case 'wav':
          // Uncompressed: sampleRate * bitDepth(16) * channels / 8
          return sampleRate * 2 * channels * duration
        case 'flac':
          // ~55% of WAV
          return sampleRate * 2 * channels * duration * 0.55
        case 'mp3':
          // VBR quality 0 ≈ 320kbps
          return (320 * 1000 / 8) * duration
        default:
          return null
      }
    }
    return null
  })()

  const size = transcodedSize ?? originalSize
  const showTranscodeSize = converting && transcodedSize != null

  return (
    <button
      key={format.formatId}
      onClick={() => onToggle(format.formatId)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 glass-hover ${
        isSelected ? 'bg-accent-500/5' : ''
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-150 ${
          isSelected
            ? 'bg-accent-500 border-accent-500'
            : 'border-surface-600 bg-surface-900/50'
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>

      {/* Quality label */}
      <span className="text-sm font-semibold text-surface-100 shrink-0">
        {getQualityLabel(format)}
      </span>

      {/* BEST badge */}
      {isBest && (
        <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded-full shrink-0">
          BEST
        </span>
      )}

      {/* Codec */}
      <span className="text-xs text-surface-400 flex-1 min-w-0 truncate">
        {getCodecLabel(format)}
      </span>

      {/* Container badge with transcode/convert preview */}
      {converting && targetExt ? (
        <span className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono text-surface-500 bg-surface-800/80 px-1.5 py-0.5 rounded">
            .{format.ext}
          </span>
          <svg className="w-3 h-3 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <span className="text-[10px] font-mono text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded font-bold">
            .{targetExt}
          </span>
        </span>
      ) : (
        <span className="text-[10px] font-mono text-surface-300 bg-surface-800/80 px-2 py-0.5 rounded shrink-0">
          .{format.ext}
        </span>
      )}

      {/* Bitrate */}
      {bitrate && (
        <span className="text-[11px] text-surface-500 w-16 text-right shrink-0 tabular-nums font-mono">
          {Math.round(bitrate)}kbps
        </span>
      )}

      {/* File size */}
      <span className={`text-xs w-16 text-right shrink-0 tabular-nums font-mono ${
        showTranscodeSize ? 'text-orange-400' : 'text-surface-300'
      }`}>
        {size ? `~${formatBytes(size)}` : '--'}
      </span>
    </button>
  )
}

function FormatSection({
  config,
  formats,
  bestFormatId,
  selectedFormats,
  allSelected,
  someSelected,
  duration,
  onToggle,
  onSelectAll,
  onDeselectAll,
  videoTranscode,
  audioConvert
}: FormatSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Split formats into visible (shown by default) and folded (hidden behind toggle)
  const heightThreshold = config.type !== 'audio-only' ? 720 : null
  const countThreshold = config.type === 'audio-only' ? 4 : null

  let visibleFormats: YtdlpFormat[]
  let foldedFormats: YtdlpFormat[]

  if (heightThreshold) {
    visibleFormats = formats.filter(f => (f.height ?? 0) >= heightThreshold)
    foldedFormats = formats.filter(f => (f.height ?? 0) < heightThreshold)
  } else if (countThreshold) {
    visibleFormats = formats.slice(0, countThreshold)
    foldedFormats = formats.slice(countThreshold)
  } else {
    visibleFormats = formats
    foldedFormats = []
  }

  const foldedSelectedCount = foldedFormats.filter(f => selectedFormats.has(f.formatId)).length
  const showProfessionalAudioMerge =
    !!videoTranscode &&
    (videoTranscode.format === 'prores' || videoTranscode.format === 'dnxhr')

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-800/30">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-medium text-surface-200 hover:text-surface-50 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          {config.icon}
          <span>{config.label}</span>
          <span className="text-xs text-surface-500">({formats.length})</span>
          {config.subtitle && (
            <span className="text-[10px] text-surface-500 font-normal ml-1 hidden sm:inline">
              {config.subtitle}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3">
          {videoTranscode && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-surface-500">Transcode:</span>
              <select
                value={videoTranscode.format}
                onChange={(e) => {
                  e.stopPropagation()
                  videoTranscode.onChange(e.target.value as 'original' | 'h264-mp4' | 'prores' | 'dnxhr')
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={!videoTranscode.ffmpegAvailable && videoTranscode.format === 'original'}
                className="text-[11px] bg-surface-800/80 text-surface-300 border border-surface-700/50 rounded px-1.5 py-0.5 cursor-pointer hover:border-surface-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="original">Original</option>
                <option value="h264-mp4">H.264 MP4</option>
                <option value="prores">ProRes 422</option>
                <option value="dnxhr">DNxHR HQ</option>
              </select>
              {!videoTranscode.ffmpegAvailable && videoTranscode.format !== 'original' && (
                <span className="text-[10px] text-warning/80">ffmpeg required</span>
              )}
              {showProfessionalAudioMerge && (
                <label
                  className="ml-2 flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-surface-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={videoTranscode.professionalAudioMerge}
                    onChange={(e) => videoTranscode.onProfessionalAudioMergeChange(e.target.checked)}
                    className="h-3 w-3 accent-accent-500"
                  />
                  <span>Merge best audio</span>
                </label>
              )}
            </div>
          )}
          {audioConvert && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-surface-500">Convert:</span>
              <select
                value={audioConvert.format}
                onChange={(e) => {
                  e.stopPropagation()
                  audioConvert.onChange(e.target.value as 'original' | 'wav' | 'flac' | 'mp3')
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={!audioConvert.ffmpegAvailable && audioConvert.format === 'original'}
                className="text-[11px] bg-surface-800/80 text-surface-300 border border-surface-700/50 rounded px-1.5 py-0.5 cursor-pointer hover:border-surface-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="original">Original</option>
                <option value="wav">WAV</option>
                <option value="flac">FLAC</option>
                <option value="mp3">MP3</option>
              </select>
              {!audioConvert.ffmpegAvailable && audioConvert.format !== 'original' && (
                <span className="text-[10px] text-warning/80">ffmpeg required</span>
              )}
            </div>
          )}
          <button
            onClick={allSelected || someSelected ? onDeselectAll : onSelectAll}
            className="text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
            {allSelected || someSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Format Rows */}
      {!collapsed && (
        <div className="divide-y divide-surface-800/40">
          {visibleFormats.map((format) => (
            <FormatRow
              key={format.formatId}
              format={format}
              isSelected={selectedFormats.has(format.formatId)}
              isBest={format.formatId === bestFormatId}
              duration={duration}
              onToggle={onToggle}
              videoTranscodeFormat={videoTranscode?.format}
              audioConvertFormat={audioConvert?.format}
            />
          ))}

          {showAll && foldedFormats.map((format) => (
            <FormatRow
              key={format.formatId}
              format={format}
              isSelected={selectedFormats.has(format.formatId)}
              isBest={format.formatId === bestFormatId}
              duration={duration}
              onToggle={onToggle}
              videoTranscodeFormat={videoTranscode?.format}
              audioConvertFormat={audioConvert?.format}
            />
          ))}

          {foldedFormats.length > 0 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              <span>
                {showAll
                  ? 'Show less'
                  : `Show ${foldedFormats.length} more formats`}
                {!showAll && foldedSelectedCount > 0 && (
                  <span className="text-accent-400 ml-1">({foldedSelectedCount} selected below)</span>
                )}
              </span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
