import type { DownloadRequest } from '../types'
import type { DownloadState } from '../stores/app-store'

export type DownloadWorkflowType =
  | 'video'
  | 'audio'
  | 'video_audio'
  | 'subtitles'
  | 'metadata'
  | 'thumbnail'
  | 'mixed'

export interface DownloadWorkflowProperties {
  downloadType: DownloadWorkflowType
  videoCount: number
  audioCount: number
  subtitleCount: number
  thumbnailCount: number
  metadataCount: number
  transcodeCount: number
  remuxCount: number
  hasTranscodes: boolean
}

const ZERO_COUNTS = {
  videoCount: 0,
  audioCount: 0,
  subtitleCount: 0,
  thumbnailCount: 0,
  metadataCount: 0,
  transcodeCount: 0,
  remuxCount: 0
}

export function buildDownloadWorkflowProperties(
  download: Pick<DownloadState, 'downloadCategory' | 'type' | 'originalRequest'> & {
    workflow?: DownloadWorkflowProperties
  }
): DownloadWorkflowProperties {
  if (download.workflow) return sanitizeWorkflowProperties(download.workflow)

  const request = download.originalRequest
  if (download.downloadCategory === 'audio') {
    return sanitizeWorkflowProperties({
      ...ZERO_COUNTS,
      downloadType: 'audio',
      audioCount: 1,
      transcodeCount: request?.audioConvertTo ? 1 : 0,
      hasTranscodes: !!request?.audioConvertTo
    })
  }

  if (download.downloadCategory === 'video') {
    return buildVideoWorkflow(request)
  }

  if (download.downloadCategory === 'subtitle') {
    return sanitizeWorkflowProperties({
      ...ZERO_COUNTS,
      downloadType: 'subtitles',
      subtitleCount: countCsvValues(request?.subtitleLang) || 1,
      hasTranscodes: false
    })
  }

  if (download.downloadCategory === 'thumbnail') {
    return sanitizeWorkflowProperties({
      ...ZERO_COUNTS,
      downloadType: 'thumbnail',
      thumbnailCount: 1,
      hasTranscodes: false
    })
  }

  return sanitizeWorkflowProperties({
    ...ZERO_COUNTS,
    downloadType: 'metadata',
    metadataCount: 1,
    hasTranscodes: false
  })
}

export function buildDownloadSucceededProperties(
  download: Pick<DownloadState, 'downloadCategory' | 'type' | 'originalRequest'> & {
    workflow?: DownloadWorkflowProperties
  }
): Record<string, unknown> {
  return {
    category: download.downloadCategory,
    type: download.type,
    result: 'succeeded',
    source: 'app',
    ...buildDownloadWorkflowProperties(download)
  }
}

export function buildFormatWorkflowProperties(
  formatType: 'combined' | 'video-only' | 'audio-only',
  request: DownloadRequest
): DownloadWorkflowProperties {
  if (formatType === 'audio-only') {
    return buildDownloadWorkflowProperties({
      downloadCategory: 'audio',
      type: 'format',
      originalRequest: request
    })
  }

  if (formatType === 'combined') {
    return sanitizeWorkflowProperties({
      ...ZERO_COUNTS,
      downloadType: 'video_audio',
      videoCount: 1,
      audioCount: 1,
      remuxCount: request.preferredContainer && request.preferredContainer !== 'auto' ? 1 : 0,
      hasTranscodes: false
    })
  }

  return buildDownloadWorkflowProperties({
    downloadCategory: 'video',
    type: 'format',
    originalRequest: request
  })
}

export function sanitizeWorkflowProperties(input: DownloadWorkflowProperties): DownloadWorkflowProperties {
  const sanitized = {
    downloadType: input.downloadType,
    videoCount: nonNegativeInteger(input.videoCount),
    audioCount: nonNegativeInteger(input.audioCount),
    subtitleCount: nonNegativeInteger(input.subtitleCount),
    thumbnailCount: nonNegativeInteger(input.thumbnailCount),
    metadataCount: nonNegativeInteger(input.metadataCount),
    transcodeCount: nonNegativeInteger(input.transcodeCount),
    remuxCount: nonNegativeInteger(input.remuxCount),
    hasTranscodes: Boolean(input.hasTranscodes)
  }

  sanitized.hasTranscodes = sanitized.transcodeCount > 0
  return sanitized
}

function buildVideoWorkflow(request: DownloadRequest | null): DownloadWorkflowProperties {
  const isMerged = (request?.formatId ?? '').includes('+')
  const transcodeCount = request && needsSeparateVideoTranscode(request) ? 1 : 0
  const remuxCount = request?.preferredContainer && request.preferredContainer !== 'auto' ? 1 : 0

  return sanitizeWorkflowProperties({
    ...ZERO_COUNTS,
    downloadType: isMerged ? 'video_audio' : 'video',
    videoCount: 1,
    audioCount: isMerged ? 1 : 0,
    transcodeCount,
    remuxCount,
    hasTranscodes: transcodeCount > 0
  })
}

function needsSeparateVideoTranscode(request: DownloadRequest): boolean {
  const isMerge = (request.formatId ?? '').includes('+')
  const container = request.preferredContainer ?? 'mp4'
  if (request.videoTranscodeTo) return true
  if (isMerge && container === 'mp4') {
    return !(request.formatId ?? '').includes('[vcodec')
  }
  return false
}

function countCsvValues(value: string | undefined): number {
  if (!value) return 0
  return value.split(',').filter((item) => item.trim().length > 0).length
}

function nonNegativeInteger(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0
}
