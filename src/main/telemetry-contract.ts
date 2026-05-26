export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type TelemetryEnvironment = 'production' | 'staging' | 'development'

export type AppEventName =
  | 'app.launched'
  | 'license.activation.started'
  | 'license.activation.succeeded'
  | 'license.activation.failed'
  | 'license.deactivation.succeeded'
  | 'license.recovery.started'
  | 'license.recovery.succeeded'
  | 'license.recovery.failed'
  | 'download.started'
  | 'download.succeeded'
  | 'download.failed'
  | 'update.check.started'
  | 'update.check.succeeded'
  | 'update.check.failed'
  | 'update.download.started'
  | 'update.download.succeeded'
  | 'update.download.failed'
  | 'feedback.opened'
  | 'feedback.submitted'

export type FeedbackCategory = 'general' | 'bug' | 'feature' | 'license' | 'download' | 'update'

export type FailureCode =
  | 'network_unavailable'
  | 'request_timeout'
  | 'server_unavailable'
  | 'invalid_response'
  | 'checkout_failed'
  | 'license_invalid'
  | 'license_expired'
  | 'activation_limit_reached'
  | 'activation_request_failed'
  | 'deactivation_request_failed'
  | 'license_recovery_failed'
  | 'update_manifest_unreachable'
  | 'update_not_available'
  | 'update_signature_invalid'
  | 'artifact_download_failed'
  | 'artifact_install_failed'
  | 'unknown_error'

export interface AnalyticsEvent {
  schemaVersion: 1
  eventId: string
  eventType: AppEventName
  occurredAt?: string
  source: 'app'
  environment: TelemetryEnvironment
  sessionId?: string
  installId?: string
  licenseId?: string | null
  activationId?: string | null
  appVersion?: string
  properties: Record<string, JsonValue>
}

export interface FeedbackSubmission {
  schemaVersion: 1
  category: FeedbackCategory
  message: string
  email?: string | null
  installId?: string
  licenseId?: string | null
  activationId?: string | null
  appVersion?: string
  diagnostics: Record<string, JsonValue>
}

interface BuildAnalyticsEventInput {
  eventType: AppEventName
  environment: TelemetryEnvironment
  installId: string
  licenseId?: string | null
  activationId?: string | null
  appVersion?: string
  properties?: Record<string, unknown>
}

interface BuildFeedbackSubmissionInput {
  category: FeedbackCategory
  message: string
  email?: string | null
  installId: string
  licenseId?: string | null
  activationId?: string | null
  appVersion?: string
  diagnostics?: Record<string, unknown>
}

const allowedAppEvents = new Set<AppEventName>([
  'app.launched',
  'license.activation.started',
  'license.activation.succeeded',
  'license.activation.failed',
  'license.deactivation.succeeded',
  'license.recovery.started',
  'license.recovery.succeeded',
  'license.recovery.failed',
  'download.started',
  'download.succeeded',
  'download.failed',
  'update.check.started',
  'update.check.succeeded',
  'update.check.failed',
  'update.download.started',
  'update.download.succeeded',
  'update.download.failed',
  'feedback.opened',
  'feedback.submitted'
])

const blockedPropertyKeys = new Set([
  'clipboard',
  'deviceName',
  'filename',
  'fileName',
  'filePath',
  'host',
  'hostname',
  'localPath',
  'log',
  'logs',
  'outputDir',
  'path',
  'rawLog',
  'serial',
  'sourceUrl',
  'stack',
  'title',
  'url',
  'username',
  'windowTitle'
])

export function buildAnalyticsEvent(input: BuildAnalyticsEventInput): AnalyticsEvent {
  if (!allowedAppEvents.has(input.eventType)) {
    throw new Error(`Unsupported analytics event: ${input.eventType}`)
  }

  return {
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    occurredAt: new Date().toISOString(),
    source: 'app',
    environment: input.environment,
    installId: input.installId,
    licenseId: input.licenseId ?? null,
    activationId: input.activationId ?? null,
    appVersion: input.appVersion,
    properties: sanitizeTelemetryProperties(input.properties ?? {})
  }
}

export function buildFeedbackSubmission(input: BuildFeedbackSubmissionInput): FeedbackSubmission {
  return {
    schemaVersion: 1,
    category: input.category,
    message: input.message,
    email: input.email?.trim() || null,
    installId: input.installId,
    licenseId: input.licenseId ?? null,
    activationId: input.activationId ?? null,
    appVersion: input.appVersion,
    diagnostics: sanitizeTelemetryProperties(input.diagnostics ?? {})
  }
}

export function sanitizeTelemetryProperties(input: Record<string, unknown>): Record<string, JsonValue> {
  const sanitized: Record<string, JsonValue> = {}

  for (const [key, value] of Object.entries(input)) {
    if (blockedPropertyKeys.has(key)) continue
    const cleanValue = sanitizeTelemetryValue(value)
    if (cleanValue !== undefined) {
      sanitized[key] = cleanValue
    }
  }

  return sanitized
}

export function mapFailureCode(message: unknown): FailureCode {
  const normalized = String(message ?? '').toLowerCase()
  if (normalized.includes('timeout') || normalized.includes('timed out')) return 'request_timeout'
  if (normalized.includes('network') || normalized.includes('offline') || normalized.includes('enotfound')) return 'network_unavailable'
  if (normalized.includes('server') || normalized.includes('5')) return 'server_unavailable'
  if (normalized.includes('invalid response') || normalized.includes('parse') || normalized.includes('json')) return 'invalid_response'
  if (normalized.includes('activation limit')) return 'activation_limit_reached'
  if (normalized.includes('expired')) return 'license_expired'
  if (normalized.includes('license') && normalized.includes('invalid')) return 'license_invalid'
  if (normalized.includes('license') && normalized.includes('activation')) return 'activation_request_failed'
  if (normalized.includes('deactivation')) return 'deactivation_request_failed'
  if (normalized.includes('recovery')) return 'license_recovery_failed'
  if (normalized.includes('not available') || normalized.includes('only available')) return 'update_not_available'
  if (normalized.includes('signature')) return 'update_signature_invalid'
  if (normalized.includes('manifest') || normalized.includes('update')) return 'update_manifest_unreachable'
  if (normalized.includes('download')) return 'artifact_download_failed'
  if (normalized.includes('install')) return 'artifact_install_failed'
  return 'unknown_error'
}

function sanitizeTelemetryValue(value: unknown): JsonValue | undefined {
  if (value === null) return null
  if (typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return sanitizeTelemetryString(value)
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeTelemetryValue(item))
      .filter((item): item is JsonValue => item !== undefined)
      .slice(0, 20)
  }
  if (typeof value === 'object') {
    return sanitizeTelemetryProperties(value as Record<string, unknown>)
  }
  return undefined
}

function sanitizeTelemetryString(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\/Users\/[^\s,;:)]+/g, '[local-path]')
    .replace(/\/(?:Volumes|private|var|tmp|Applications|Library|System)\/[^\s,;:)]+/g, '[local-path]')
    .replace(/[A-Z]:\\[^\s,;:)]+/gi, '[local-path]')
    .replace(/\b[^\s,;:)]+\.(?:mp4|mov|mkv|webm|mp3|wav|flac|srt|vtt|json|txt|csv|edl)\b/gi, '[file]')
    .slice(0, 240)
}
