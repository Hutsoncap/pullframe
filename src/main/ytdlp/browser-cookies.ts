import { constants } from 'fs'
import { access, readdir, readFile } from 'fs/promises'
import { homedir } from 'os'
import { isAbsolute, join } from 'path'
import type { BrowserSignInStatus, CookieBrowser } from './types'

export const cookieBrowserLabels: Record<CookieBrowser, string> = {
  none: 'Off',
  chrome: 'Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  edge: 'Edge',
  brave: 'Brave',
  zen: 'Zen',
  helium: 'Helium'
}

export const cookieBrowserProcessNames: Record<CookieBrowser, string | null> = {
  none: null,
  chrome: 'Google Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  edge: 'Microsoft Edge',
  brave: 'Brave Browser',
  zen: 'zen',
  helium: 'Helium'
}

export function browserLabel(browser: CookieBrowser): string {
  return cookieBrowserLabels[browser]
}

export function browserProcessName(browser: CookieBrowser): string | null {
  return cookieBrowserProcessNames[browser]
}

export async function canReadSafariData(): Promise<boolean> {
  const cookieDirs = [
    join(homedir(), 'Library', 'Cookies'),
    join(homedir(), 'Library', 'Containers', 'com.apple.Safari', 'Data', 'Library', 'Cookies')
  ]

  for (const dir of cookieDirs) {
    try {
      await readdir(dir)
    } catch (err) {
      if (isPermissionDenied(err)) return false
    }
  }

  return true
}

export async function checkCookieBrowserReadiness(browser: CookieBrowser): Promise<BrowserSignInStatus> {
  const label = browserLabel(browser)
  if (browser === 'none') {
    return {
      browser,
      status: 'off',
      message: 'YouTube sign-in is off.'
    }
  }

  if (browser === 'safari') {
    return checkSafariReadiness(browser)
  }

  if (browser === 'zen') {
    const profile = await findZenProfile()
    if (!profile) {
      return {
        browser,
        status: 'not-found',
        message: 'Zen was not found or does not have a readable cookie store.'
      }
    }
    return readableCookieSourceStatus(browser, 'Zen cookie source is ready.', [
      join(profile, 'cookies.sqlite')
    ])
  }

  if (browser === 'helium') {
    const profile = await findHeliumProfile()
    if (!profile) {
      return {
        browser,
        status: 'not-found',
        message: 'Helium was not found or does not have a readable cookie store.'
      }
    }
    return readableCookieSourceStatus(browser, 'Helium cookie source is ready.', [
      join(profile, 'Cookies'),
      join(profile, 'Network', 'Cookies')
    ])
  }

  const sources = browserCookieSourceCandidates(browser)
  if (sources.length === 0) {
    return {
      browser,
      status: 'ready',
      message: `${label} cookie source is ready.`
    }
  }

  return readableCookieSourceStatus(browser, `${label} cookie source is ready.`, sources)
}

export async function resolveCookieBrowserArgument(browser: CookieBrowser | string | undefined): Promise<string | null> {
  if (!browser || browser === 'none') return null
  if (browser === 'zen') {
    const profile = await findZenProfile()
    return profile ? `firefox:${profile}` : 'firefox:__pullframe_zen_profile_missing__'
  }
  if (browser === 'helium') {
    const profile = await findHeliumProfile()
    return profile ? `chromium:${profile}` : 'chromium:__pullframe_helium_profile_missing__'
  }
  return browser
}

async function findZenProfile(): Promise<string | null> {
  const root = join(homedir(), 'Library', 'Application Support', 'zen')
  const profilesRoot = join(root, 'Profiles')
  const iniProfile = await readDefaultFirefoxStyleProfile(root)
  if (iniProfile && await hasFile(join(iniProfile, 'cookies.sqlite'))) return iniProfile

  try {
    const entries = await readdir(profilesRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const profile = join(profilesRoot, entry.name)
      if (await hasFile(join(profile, 'cookies.sqlite'))) return profile
    }
  } catch {
    return null
  }

  return null
}

async function findHeliumProfile(): Promise<string | null> {
  const root = join(homedir(), 'Library', 'Application Support', 'net.imput.helium')
  const profile = join(root, 'Default')
  if (await hasFile(join(profile, 'Cookies')) || await hasFile(join(profile, 'Network', 'Cookies'))) {
    return profile
  }
  return null
}

async function checkSafariReadiness(browser: CookieBrowser): Promise<BrowserSignInStatus> {
  const dirs = [
    join(homedir(), 'Library', 'Cookies'),
    join(homedir(), 'Library', 'Containers', 'com.apple.Safari', 'Data', 'Library', 'Cookies')
  ]

  let foundReadableDir = false
  for (const dir of dirs) {
    try {
      await readdir(dir)
      foundReadableDir = true
    } catch (err) {
      if (isPermissionDenied(err)) {
        return {
          browser,
          status: 'permission-denied',
          message: 'macOS is blocking Safari sign-in access. Open Full Disk Access and allow Pullframe, then restart Pullframe.'
        }
      }
    }
  }

  return {
    browser,
    status: foundReadableDir ? 'ready' : 'not-found',
    message: foundReadableDir
      ? 'Safari cookie source is ready.'
      : 'Safari was not found or does not have a readable cookie store.'
  }
}

async function readableCookieSourceStatus(
  browser: CookieBrowser,
  readyMessage: string,
  candidates: string[]
): Promise<BrowserSignInStatus> {
  let sawPermissionDenied = false
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.R_OK)
      return {
        browser,
        status: 'ready',
        message: readyMessage
      }
    } catch (err) {
      if (isPermissionDenied(err)) sawPermissionDenied = true
    }
  }

  if (sawPermissionDenied) {
    return {
      browser,
      status: 'permission-denied',
      message: `macOS is blocking ${browserLabel(browser)} sign-in access. Allow Pullframe in Full Disk Access, then restart Pullframe.`
    }
  }

  return {
    browser,
    status: 'not-found',
    message: `${browserLabel(browser)} was not found or does not have a readable cookie store.`
  }
}

function browserCookieSourceCandidates(browser: CookieBrowser): string[] {
  const appSupport = join(homedir(), 'Library', 'Application Support')
  const roots: Partial<Record<CookieBrowser, string>> = {
    chrome: join(appSupport, 'Google', 'Chrome'),
    edge: join(appSupport, 'Microsoft Edge'),
    brave: join(appSupport, 'BraveSoftware', 'Brave-Browser'),
    firefox: join(appSupport, 'Firefox')
  }

  const root = roots[browser]
  if (!root) return []

  if (browser === 'firefox') {
    return [
      join(root, 'Profiles')
    ]
  }

  return [
    join(root, 'Default', 'Cookies'),
    join(root, 'Default', 'Network', 'Cookies')
  ]
}

async function readDefaultFirefoxStyleProfile(root: string): Promise<string | null> {
  try {
    const ini = await readFile(join(root, 'profiles.ini'), 'utf8')
    const sections = ini.split(/\n(?=\[Profile\d+\])/)
    const profiles = sections
      .map((section) => {
        const path = section.match(/^Path=(.+)$/m)?.[1]?.trim()
        const isRelative = section.match(/^IsRelative=(.+)$/m)?.[1]?.trim() !== '0'
        const isDefault = section.match(/^Default=1$/m) != null
        if (!path) return null
        return {
          path: isRelative || !isAbsolute(path) ? join(root, path) : path,
          isDefault
        }
      })
      .filter((profile): profile is { path: string; isDefault: boolean } => profile != null)

    return profiles.find((profile) => profile.isDefault)?.path ?? profiles[0]?.path ?? null
  } catch {
    return null
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function hasFile(path: string): Promise<boolean> {
  return pathExists(path)
}

function isPermissionDenied(err: unknown): boolean {
  return typeof err === 'object' &&
    err != null &&
    'code' in err &&
    (err.code === 'EACCES' || err.code === 'EPERM')
}
