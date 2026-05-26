import { app } from 'electron'

declare global {
  interface ImportMetaEnv {
    readonly MAIN_VITE_OFFICIAL_BUILD?: string
  }
}

export interface LicenseEntitlement {
  licenseId: string
  activationId: string
  plan: 'solo' | 'personal' | 'extended' | 'custom'
  features: string[]
  updatePolicy: 'lifetime'
  maxActivations: number
  issuedAt: string
}

export type TrialStatus = 'active' | 'expired' | 'converted' | 'voided'
export type TrialSource = 'local' | 'backend'

export interface TrialStatusResponse {
  schemaVersion: 1
  installId: string
  trialStartedAt: string
  trialEndsAt: string
  trialDaysRemaining: number
  isTrialExpired: boolean
  status: TrialStatus
}

export interface LicenseState {
  isOfficialBuild: boolean
  trialStartedAt: string
  trialEndsAt: string
  trialDaysRemaining: number
  isTrialExpired: boolean
  trialStatus: TrialStatus
  trialSource: TrialSource
  isActivated: boolean
  entitlement: LicenseEntitlement | null
}

export interface LicenseStore {
  get<T = unknown>(key: string, defaultValue?: T): T
  set(key: string, value: unknown): void
  delete(key: string): void
}

const trialLengthDays = 14
const sourceBuildEntitlement: LicenseEntitlement = {
  licenseId: 'source-build',
  activationId: 'source-build',
  plan: 'custom',
  features: ['source-build'],
  updatePolicy: 'lifetime',
  maxActivations: 1,
  issuedAt: '1970-01-01T00:00:00.000Z'
}

export function getLicenseState(store: LicenseStore): LicenseState {
  const trialStartedAt = ensureTrialStarted(store)
  const trialEndsAt = addDays(trialStartedAt, trialLengthDays)
  const trialDaysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
  const entitlement = store.get<LicenseEntitlement | null>('license.entitlement', null)
  const isOfficialBuild = app.isPackaged && import.meta.env.MAIN_VITE_OFFICIAL_BUILD === '1'
  const effectiveEntitlement = isOfficialBuild ? entitlement : (entitlement ?? sourceBuildEntitlement)
  const localExpired = Date.now() > trialEndsAt.getTime()
  const backendTrial = store.get<TrialStatusResponse | null>('license.backendTrialStatus', null)

  if (isBackendTrialStatus(backendTrial)) {
    return {
      isOfficialBuild,
      trialStartedAt: backendTrial.trialStartedAt,
      trialEndsAt: backendTrial.trialEndsAt,
      trialDaysRemaining: Math.max(0, backendTrial.trialDaysRemaining),
      isTrialExpired: backendTrial.status === 'voided' ? true : backendTrial.isTrialExpired,
      trialStatus: backendTrial.status,
      trialSource: 'backend',
      isActivated: !isOfficialBuild || entitlement !== null,
      entitlement: effectiveEntitlement
    }
  }

  return {
    isOfficialBuild,
    trialStartedAt: trialStartedAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    trialDaysRemaining,
    isTrialExpired: localExpired,
    trialStatus: localExpired ? 'expired' : 'active',
    trialSource: 'local',
    isActivated: !isOfficialBuild || entitlement !== null,
    entitlement: effectiveEntitlement
  }
}

export async function refreshLicenseState(store: LicenseStore): Promise<LicenseState> {
  if (!shouldUseBackendTrialStatus()) {
    return getLicenseState(store)
  }

  await refreshBackendTrialStatus(store).catch(() => null)
  return getLicenseState(store)
}

export async function activateLicense(store: LicenseStore, licenseKey: string): Promise<LicenseState> {
  const apiBaseUrl = process.env.PULLFRAME_API_BASE_URL ?? 'https://api.pullframe.app'
  const installId = ensureInstallId(store)
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/license/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      installId,
      deviceName: app.getName(),
      appVersion: app.getVersion()
    })
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? 'license activation failed')
  }

  const body = await response.json()
  store.set('license.key', licenseKey)
  store.set('license.entitlement', body.entitlement)
  store.set('license.entitlementToken', body.entitlementToken)
  return refreshLicenseState(store)
}

export async function deactivateLicense(store: LicenseStore): Promise<LicenseState> {
  const licenseKey = store.get<string | null>('license.key', null)
  const installId = store.get<string | null>('license.installId', null)
  const apiBaseUrl = process.env.PULLFRAME_API_BASE_URL ?? 'https://api.pullframe.app'

  if (licenseKey && installId) {
    await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/license/deactivate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ licenseKey, installId })
    }).catch(() => {})
  }

  store.delete('license.key')
  store.delete('license.entitlement')
  store.delete('license.entitlementToken')
  return refreshLicenseState(store)
}

export function getInstallId(store: LicenseStore): string {
  return ensureInstallId(store)
}

function ensureTrialStarted(store: LicenseStore): Date {
  const existing = store.get<string | null>('license.trialStartedAt', null)
  if (existing) return new Date(existing)

  const now = new Date()
  store.set('license.trialStartedAt', now.toISOString())
  return now
}

function ensureInstallId(store: LicenseStore): string {
  const existing = store.get<string | null>('license.installId', null)
  if (existing) return existing

  const installId = crypto.randomUUID()
  store.set('license.installId', installId)
  return installId
}

function shouldUseBackendTrialStatus(): boolean {
  return (
    process.env.PULLFRAME_BACKEND_TRIALS === '1' ||
    (app.isPackaged && import.meta.env.MAIN_VITE_OFFICIAL_BUILD === '1')
  )
}

function getTrialApiBaseUrl(): string {
  return (process.env.PULLFRAME_TRIAL_API_BASE_URL ?? 'https://pullframe.app').replace(/\/$/, '')
}

function getTrialEnvironment(): 'production' | 'development' {
  return app.isPackaged && import.meta.env.MAIN_VITE_OFFICIAL_BUILD === '1' ? 'production' : 'development'
}

async function refreshBackendTrialStatus(store: LicenseStore): Promise<void> {
  const installId = ensureInstallId(store)
  const response = await fetch(`${getTrialApiBaseUrl()}/api/trial/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      installId,
      appVersion: app.getVersion(),
      source: 'app',
      environment: getTrialEnvironment()
    })
  })

  if (!response.ok) {
    return
  }

  const body = await response.json().catch(() => null)
  if (!isBackendTrialStatus(body) || body.installId !== installId) {
    return
  }

  store.set('license.backendTrialStatus', body)
}

function isBackendTrialStatus(value: unknown): value is TrialStatusResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as TrialStatusResponse
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.installId === 'string' &&
    typeof candidate.trialStartedAt === 'string' &&
    typeof candidate.trialEndsAt === 'string' &&
    Number.isInteger(candidate.trialDaysRemaining) &&
    candidate.trialDaysRemaining >= 0 &&
    typeof candidate.isTrialExpired === 'boolean' &&
    ['active', 'expired', 'converted', 'voided'].includes(candidate.status)
  )
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
