export type ChapterFormat = 'premiere-csv' | 'edl' | 'csv' | 'txt'

interface Chapter {
  title: string
  startTime: number
  endTime: number
}

/**
 * Convert seconds to HH:MM:SS:FF timecode (SMPTE-style).
 * Frames are calculated at the given fps (default 30).
 */
function toTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps)
  const ff = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const ss = totalSeconds % 60
  const mm = Math.floor(totalSeconds / 60) % 60
  const hh = Math.floor(totalSeconds / 3600)
  return (
    hh.toString().padStart(2, '0') +
    ':' +
    mm.toString().padStart(2, '0') +
    ':' +
    ss.toString().padStart(2, '0') +
    ':' +
    ff.toString().padStart(2, '0')
  )
}

/**
 * Convert seconds to HH:MM:SS format (no frames).
 */
function toHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return (
    h.toString().padStart(2, '0') +
    ':' +
    m.toString().padStart(2, '0') +
    ':' +
    s.toString().padStart(2, '0')
  )
}

/**
 * Generate Premiere Pro Markers CSV.
 *
 * Format:
 *   Marker Name,Description,In,Out,Duration,Marker Type
 *   Chapter 1,,0:00:00:00,0:01:47:00,0:01:47:00,Comment
 */
function generatePremiereCSV(chapters: Chapter[], fps: number): string {
  const lines = ['Marker Name\tDescription\tIn\tOut\tDuration\tMarker Type']

  for (const ch of chapters) {
    const inTC = toTimecode(ch.startTime, fps)
    const outTC = toTimecode(ch.endTime, fps)
    const duration = toTimecode(ch.endTime - ch.startTime, fps)
    // Premiere marker CSV is actually tab-delimited
    lines.push(`${ch.title}\t\t${inTC}\t${outTC}\t${duration}\tComment`)
  }

  return lines.join('\n') + '\n'
}

/**
 * Generate CMX 3600 EDL (Edit Decision List).
 */
function generateEDL(chapters: Chapter[], title: string, fps: number): string {
  const lines: string[] = []
  lines.push(`TITLE: ${title}`)
  lines.push('FCM: NON-DROP FRAME')
  lines.push('')

  let recordIn = 0

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    const editNum = (i + 1).toString().padStart(3, '0')
    const sourceIn = toTimecode(ch.startTime, fps)
    const sourceOut = toTimecode(ch.endTime, fps)
    const recIn = toTimecode(recordIn, fps)
    const recOut = toTimecode(recordIn + (ch.endTime - ch.startTime), fps)

    lines.push(
      `${editNum}  AX       V     C        ${sourceIn} ${sourceOut} ${recIn} ${recOut}`
    )
    lines.push(`* FROM CLIP NAME: ${ch.title}`)
    lines.push('')

    recordIn += ch.endTime - ch.startTime
  }

  return lines.join('\n')
}

/**
 * Generate a simple CSV with Chapter, Start, End, Duration columns.
 */
function generateSimpleCSV(chapters: Chapter[]): string {
  const lines = ['Chapter,Start,End,Duration']

  for (const ch of chapters) {
    const start = toHMS(ch.startTime)
    const end = toHMS(ch.endTime)
    const dur = toHMS(ch.endTime - ch.startTime)
    // Escape commas in title
    const safeTitle = ch.title.includes(',') ? `"${ch.title}"` : ch.title
    lines.push(`${safeTitle},${start},${end},${dur}`)
  }

  return lines.join('\n') + '\n'
}

/**
 * Generate YouTube-style chapter timestamps.
 * Format: 00:00 Chapter Name
 */
function generateYouTubeTXT(chapters: Chapter[]): string {
  const lines: string[] = []

  for (const ch of chapters) {
    const h = Math.floor(ch.startTime / 3600)
    const m = Math.floor((ch.startTime % 3600) / 60)
    const s = Math.floor(ch.startTime % 60)

    let timestamp: string
    if (h > 0) {
      timestamp = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    } else {
      timestamp = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    lines.push(`${timestamp} ${ch.title}`)
  }

  return lines.join('\n') + '\n'
}

/**
 * Generate chapter export content for a given format.
 * Returns the file content string and the appropriate file extension.
 */
export function generateChapterExport(
  chapters: Chapter[],
  title: string,
  format: ChapterFormat,
  fps = 30
): { content: string; extension: string } {
  switch (format) {
    case 'premiere-csv':
      return { content: generatePremiereCSV(chapters, fps), extension: 'csv' }
    case 'edl':
      return { content: generateEDL(chapters, title, fps), extension: 'edl' }
    case 'csv':
      return { content: generateSimpleCSV(chapters), extension: 'csv' }
    case 'txt':
      return { content: generateYouTubeTXT(chapters), extension: 'txt' }
  }
}
