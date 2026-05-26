import { app } from 'electron'
import { getInstallId, getLicenseState, type LicenseStore } from './license-manager'
import {
  buildAnalyticsEvent,
  buildFeedbackSubmission,
  mapFailureCode,
  type AppEventName,
  type FeedbackCategory,
  type TelemetryEnvironment
} from './telemetry-contract'

interface ProductEventInput {
  eventType: AppEventName
  properties?: Record<string, unknown>
}

interface FeedbackInput {
  category: FeedbackCategory
  message: string
  email?: string | null
  diagnostics?: Record<string, unknown>
}

function getApiBaseUrl(): string {
  return (process.env.PULLFRAME_API_BASE_URL ?? 'https://api.pullframe.app').replace(/\/$/, '')
}

function getTelemetryEnvironment(): TelemetryEnvironment {
  const env = process.env.PULLFRAME_TELEMETRY_ENV ?? process.env.NODE_ENV
  if (env === 'production' || env === 'staging' || env === 'development') return env
  return app.isPackaged ? 'production' : 'development'
}

function getUpdateChannel(): 'stable' | 'beta' {
  return app.getVersion().includes('-') ? 'beta' : 'stable'
}

function getArchitecture(): 'arm64' | 'x64' {
  return process.arch === 'arm64' ? 'arm64' : 'x64'
}

function getOsVersion(): string {
  const systemVersion = (process as NodeJS.Process & { getSystemVersion?: () => string }).getSystemVersion
  return systemVersion ? systemVersion() : 'unknown'
}

function getLicenseStateLabel(store: LicenseStore): 'trial' | 'licensed' | 'unlicensed' | 'expired' {
  const license = getLicenseState(store)
  if (license.isActivated) return 'licensed'
  if (license.isTrialExpired) return 'expired'
  return license.trialStartedAt ? 'trial' : 'unlicensed'
}

function getSafeMachineDiagnostics(store: LicenseStore): Record<string, unknown> {
  const license = getLicenseState(store)
  return {
    appVersion: app.getVersion(),
    osName: 'macOS',
    osVersion: getOsVersion(),
    architecture: getArchitecture(),
    updateChannel: getUpdateChannel(),
    installId: getInstallId(store),
    licenseState: getLicenseStateLabel(store),
    trialStatus: license.trialStatus,
    trialSource: license.trialSource,
    plan: license.entitlement?.plan
  }
}

export async function trackProductEvent(
  store: LicenseStore,
  input: ProductEventInput
): Promise<{ recorded: boolean }> {
  const analyticsEnabled = store.get<boolean>('settings.analyticsEnabled', true)
  if (!analyticsEnabled) {
    return { recorded: false }
  }

  const license = getLicenseState(store)
  const properties: Record<string, unknown> = {
    updateChannel: getUpdateChannel(),
    licenseState: getLicenseStateLabel(store),
    trialStatus: license.trialStatus,
    trialSource: license.trialSource,
    plan: license.entitlement?.plan,
    ...input.properties
  }
  if (input.eventType.endsWith('.failed') && properties.failureCode === undefined) {
    properties.failureCode = mapFailureCode(properties.failureReason)
  }

  const event = buildAnalyticsEvent({
    eventType: input.eventType,
    environment: getTelemetryEnvironment(),
    installId: getInstallId(store),
    licenseId: license.entitlement?.licenseId ?? null,
    activationId: license.entitlement?.activationId ?? null,
    appVersion: app.getVersion(),
    properties
  })

  await fetch(`${getApiBaseUrl()}/api/analytics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      events: [event]
    })
  }).catch(() => null)

  return { recorded: true }
}

export async function submitFeedback(
  store: LicenseStore,
  input: FeedbackInput
): Promise<{ received: true }> {
  const license = getLicenseState(store)
  const submission = buildFeedbackSubmission({
    category: input.category,
    message: input.message,
    email: input.email,
    installId: getInstallId(store),
    licenseId: license.entitlement?.licenseId ?? null,
    activationId: license.entitlement?.activationId ?? null,
    appVersion: app.getVersion(),
    diagnostics: {
      ...getSafeMachineDiagnostics(store),
      ...(input.diagnostics ?? {})
    }
  })

  const response = await fetch(`${getApiBaseUrl()}/api/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submission)
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? 'feedback submission failed')
  }

  trackProductEvent(store, {
    eventType: 'feedback.submitted',
    properties: { category: input.category, source: 'app' }
  }).catch(() => null)

  return { received: true }
}
