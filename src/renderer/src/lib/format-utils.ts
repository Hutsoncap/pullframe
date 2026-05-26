import type { YtdlpFormat } from '../types'

/**
 * Format bytes into a human-readable string.
 * e.g. 1536 → "1.5 KB", 1073741824 → "1.0 GB"
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`
}

/**
 * Format seconds into a human-readable duration.
 * e.g. 225 → "3:45", 3750 → "1:02:30"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Format a date string into a readable date.
 * Accepts YYYYMMDD (yt-dlp style) or ISO format.
 * e.g. "20240315" → "Mar 15, 2024"
 */
export function formatDate(dateStr: string): string {
  let date: Date

  // yt-dlp returns dates as YYYYMMDD
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    date = new Date(`${year}-${month}-${day}`)
  } else {
    date = new Date(dateStr)
  }

  if (isNaN(date.getTime())) return dateStr

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format a number with abbreviated suffixes.
 * e.g. 1200000 → "1.2M", 340000 → "340K", 1234 → "1,234"
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 10_000) {
    return `${(n / 1_000).toFixed(0)}K`
  }
  if (n >= 1_000) {
    return n.toLocaleString('en-US')
  }
  return String(n)
}

/**
 * Get a quality label for a format.
 * e.g. "1080p60", "720p", "audio 128kbps"
 */
export function getQualityLabel(format: YtdlpFormat): string {
  if (format.type === 'audio-only') {
    const bitrate = format.abr ?? format.tbr
    const codec = normalizeCodecName(format.acodec)
    if (bitrate && codec) return `${codec} ${Math.round(bitrate)}kbps`
    if (bitrate) return `${Math.round(bitrate)}kbps`
    if (codec) return codec
    return format.formatNote || format.ext
  }

  if (!format.height) return format.resolution ?? format.formatNote ?? 'unknown'

  let label = `${format.height}p`
  if (format.fps && format.fps > 30) {
    label += format.fps
  }
  return label
}

/** Filter out junk/non-downloadable formats (mhtml, storyboard, etc.) */
const JUNK_EXTENSIONS = new Set(['mhtml', 'json', 'html'])

export function filterUsableFormats(formats: YtdlpFormat[]): YtdlpFormat[] {
  return formats.filter((f) => {
    if (JUNK_EXTENSIONS.has(f.ext)) return false
    if (f.formatNote?.toLowerCase().includes('storyboard')) return false
    // Filter formats with no codec info at all
    if (!f.vcodec && !f.acodec) return false
    if (f.vcodec === 'none' && f.acodec === 'none') return false
    return true
  })
}

/**
 * Get a codec label for a format.
 * e.g. "H.264 + AAC", "VP9", "Opus"
 */
export function getCodecLabel(format: YtdlpFormat): string {
  const videoCodec = normalizeCodecName(format.vcodec)
  const audioCodec = normalizeCodecName(format.acodec)

  if (videoCodec && audioCodec) {
    return `${videoCodec} + ${audioCodec}`
  }
  return videoCodec || audioCodec || format.ext
}

function normalizeCodecName(codec: string | null): string | null {
  if (!codec || codec === 'none') return null

  const lower = codec.toLowerCase()
  if (lower.startsWith('avc1') || lower.startsWith('h264')) return 'H.264'
  if (lower.startsWith('hev1') || lower.startsWith('hvc1') || lower.startsWith('h265'))
    return 'H.265'
  if (lower.startsWith('av01')) return 'AV1'
  if (lower.startsWith('vp9') || lower.startsWith('vp09')) return 'VP9'
  if (lower.startsWith('vp8')) return 'VP8'
  if (lower.startsWith('mp4a') || lower === 'aac') return 'AAC'
  if (lower.startsWith('opus')) return 'Opus'
  if (lower.startsWith('vorbis')) return 'Vorbis'
  if (lower.startsWith('mp3') || lower.startsWith('mp4a.6b')) return 'MP3'
  if (lower.startsWith('flac')) return 'FLAC'
  if (lower.startsWith('ec-3') || lower.startsWith('ec3')) return 'Dolby Digital+'

  return codec
}

/**
 * Sort formats by height descending, then by total bitrate descending.
 * Audio-only formats are sorted to the end.
 */
export function sortFormats(formats: YtdlpFormat[]): YtdlpFormat[] {
  return [...formats].sort((a, b) => {
    // Combined first, then video-only, then audio-only
    const typeOrder = { combined: 0, 'video-only': 1, 'audio-only': 2 }
    const typeDiff = typeOrder[a.type] - typeOrder[b.type]
    if (typeDiff !== 0) return typeDiff

    // Higher resolution first
    const heightA = a.height ?? 0
    const heightB = b.height ?? 0
    if (heightA !== heightB) return heightB - heightA

    // Higher bitrate first
    const tbrA = a.tbr ?? 0
    const tbrB = b.tbr ?? 0
    return tbrB - tbrA
  })
}

/**
 * Get the highest quality format of a given type.
 */
export function getBestFormat(
  formats: YtdlpFormat[],
  type: 'combined' | 'video-only' | 'audio-only'
): YtdlpFormat | null {
  const matching = formats.filter((f) => f.type === type)
  if (matching.length === 0) return null

  return matching.reduce((best, f) => {
    const bestScore = (best.height ?? 0) * 1000 + (best.tbr ?? 0)
    const fScore = (f.height ?? 0) * 1000 + (f.tbr ?? 0)
    return fScore > bestScore ? f : best
  })
}

/**
 * Validate whether a URL looks like a YouTube URL.
 * Matches youtube.com/watch, youtu.be, youtube.com/playlist, youtube.com/shorts, etc.
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    return (
      host === 'youtube.com' ||
      host === 'youtu.be' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    )
  } catch {
    return false
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  aa: 'Afar',
  ab: 'Abkhazian',
  af: 'Afrikaans',
  am: 'Amharic',
  ar: 'Arabic',
  as: 'Assamese',
  az: 'Azerbaijani',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bo: 'Tibetan',
  bs: 'Bosnian',
  ca: 'Catalan',
  cs: 'Czech',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fil: 'Filipino',
  fr: 'French',
  ga: 'Irish',
  gl: 'Galician',
  gu: 'Gujarati',
  ha: 'Hausa',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  hy: 'Armenian',
  id: 'Indonesian',
  ig: 'Igbo',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  jv: 'Javanese',
  ka: 'Georgian',
  kk: 'Kazakh',
  km: 'Khmer',
  kn: 'Kannada',
  ko: 'Korean',
  ku: 'Kurdish',
  ky: 'Kyrgyz',
  la: 'Latin',
  lo: 'Lao',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mg: 'Malagasy',
  mi: 'Maori',
  mk: 'Macedonian',
  ml: 'Malayalam',
  mn: 'Mongolian',
  mr: 'Marathi',
  ms: 'Malay',
  mt: 'Maltese',
  my: 'Burmese',
  ne: 'Nepali',
  nl: 'Dutch',
  no: 'Norwegian',
  ny: 'Chichewa',
  pa: 'Punjabi',
  pl: 'Polish',
  ps: 'Pashto',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  rw: 'Kinyarwanda',
  sd: 'Sindhi',
  si: 'Sinhala',
  sk: 'Slovak',
  sl: 'Slovenian',
  sm: 'Samoan',
  sn: 'Shona',
  so: 'Somali',
  sq: 'Albanian',
  sr: 'Serbian',
  st: 'Sesotho',
  su: 'Sundanese',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  tg: 'Tajik',
  th: 'Thai',
  tk: 'Turkmen',
  tl: 'Tagalog',
  tr: 'Turkish',
  tt: 'Tatar',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  xh: 'Xhosa',
  yi: 'Yiddish',
  yo: 'Yoruba',
  zh: 'Chinese',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  zu: 'Zulu'
}

/**
 * Map a language code to its English name.
 * Falls back to the code itself if not found.
 */
export function getLanguageName(code: string): string {
  // Handle YouTube's special "orig" suffix (e.g., "en-orig" = original auto-generated transcript)
  if (code.endsWith('-orig')) {
    const base = code.replace('-orig', '')
    const name = LANGUAGE_NAMES[base] ?? base
    return `${name} (Original Transcript)`
  }

  // Try exact match first
  if (LANGUAGE_NAMES[code]) return LANGUAGE_NAMES[code]

  // Try base language (e.g. "en-US" → "en")
  const base = code.split('-')[0]
  if (LANGUAGE_NAMES[base]) return LANGUAGE_NAMES[base]

  return code
}
