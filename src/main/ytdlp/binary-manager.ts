import { app } from 'electron'
import { execFile } from 'child_process'
import { access, chmod, mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import type { BinaryStatus } from './types'

const platform = os.platform()
const arch = os.arch()

function getUserBinDir(): string {
  return path.join(app.getPath('userData'), 'bin')
}

function getBundledBinDir(): string {
  // In dev mode, resources are in project root; in prod, in app.asar resources
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'resources', 'bin', `${platform}-${arch}`)
  }
  return path.join(process.resourcesPath, 'bin')
}

function ytdlpFilename(): string {
  if (platform === 'win32') return 'yt-dlp.exe'
  if (platform === 'darwin') return 'yt-dlp_macos'
  return 'yt-dlp'
}

function ffmpegFilename(): string {
  return platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function execPromise(command: string, args: string[], timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve(stdout.trim())
    })
  })
}

async function findInPath(binaryName: string): Promise<string | null> {
  // Check common known paths first (GUI apps often don't inherit shell PATH)
  const knownPaths = platform === 'darwin'
    ? [
        `/opt/homebrew/bin/${binaryName}`,
        `/usr/local/bin/${binaryName}`,
        `/usr/bin/${binaryName}`,
        `${os.homedir()}/.local/bin/${binaryName}`
      ]
    : platform === 'win32'
      ? [
          `C:\\ProgramData\\chocolatey\\bin\\${binaryName}`,
          `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links\\${binaryName}`
        ]
      : [
          `/usr/local/bin/${binaryName}`,
          `/usr/bin/${binaryName}`,
          `${os.homedir()}/.local/bin/${binaryName}`
        ]

  for (const knownPath of knownPaths) {
    if (await fileExists(knownPath)) {
      return knownPath
    }
  }

  // Fall back to which/where
  const cmd = platform === 'win32' ? 'where' : 'which'
  try {
    const result = await execPromise(cmd, [binaryName])
    const firstLine = result.split('\n')[0].trim()
    if (firstLine && (await fileExists(firstLine))) {
      return firstLine
    }
    return null
  } catch {
    return null
  }
}

type BinarySource = 'user' | 'bundled' | 'system'

interface ResolvedBinary {
  path: string
  source: BinarySource
}

interface BundledVersions {
  ytdlp?: string
  ffmpeg?: string
}

let cachedYtdlpPath: Promise<string> | null = null
let cachedFfmpegPath: Promise<string> | null = null

async function readUserVersion(userDirName: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(getUserBinDir(), `${userDirName}.version`), 'utf8')
    return raw.trim() || null
  } catch {
    return null
  }
}

async function writeUserVersion(userDirName: string, version: string | null): Promise<void> {
  if (!version) return
  await writeFile(path.join(getUserBinDir(), `${userDirName}.version`), version.trim())
}

function httpsGet(url: string, maxRedirects = 5, timeoutMs = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Pullframe' } }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'))
          return
        }
        httpsGet(response.headers.location, maxRedirects - 1, timeoutMs).then(resolve).catch(reject)
        return
      }
      if (response.statusCode && response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out downloading ${url}`))
    })
    request.on('error', reject)
  })
}

function httpsGetJson<T>(url: string, timeoutMs?: number): Promise<T> {
  return httpsGet(url, 5, timeoutMs).then((data) => JSON.parse(data.toString('utf8')) as T)
}

async function readBundledVersions(): Promise<BundledVersions | null> {
  try {
    const raw = await readFile(path.join(getBundledBinDir(), 'versions.json'), 'utf8')
    const parsed = JSON.parse(raw) as BundledVersions
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function getYtdlpDownloadUrl(): string {
  const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'
  if (platform === 'win32') return `${base}/yt-dlp.exe`
  if (platform === 'darwin') return `${base}/yt-dlp_macos`
  if (arch === 'arm64') return `${base}/yt-dlp_linux_aarch64`
  return `${base}/yt-dlp_linux`
}

function getFfmpegDownloadUrl(): string {
  const base = 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download'
  if (platform === 'win32') {
    return arch === 'arm64' ? `${base}/ffmpeg-win32-arm64` : `${base}/ffmpeg-win32-x64`
  }
  if (platform === 'darwin') {
    return arch === 'arm64' ? `${base}/ffmpeg-darwin-arm64` : `${base}/ffmpeg-darwin-x64`
  }
  return arch === 'arm64' ? `${base}/ffmpeg-linux-arm64` : `${base}/ffmpeg-linux-x64`
}

async function ensureUserBinDir(): Promise<string> {
  const binDir = getUserBinDir()
  await mkdir(binDir, { recursive: true })
  return binDir
}

async function makeExecutable(filePath: string): Promise<void> {
  if (platform !== 'win32') {
    await chmod(filePath, 0o755)
  }
}

async function resolveBinaryInfo(
  bundledName: string,
  systemName: string,
  userDirName: string,
  bundledVersion?: string | null
): Promise<ResolvedBinary | null> {
  // Tier 1: User-updated binary
  const userPath = path.join(getUserBinDir(), userDirName)
  const bundledPath = path.join(getBundledBinDir(), bundledName)
  if (await fileExists(userPath)) {
    if (platform !== 'win32' && !(await isExecutable(userPath))) {
      await makeExecutable(userPath)
    }
    if (bundledVersion && (await fileExists(bundledPath))) {
      if (platform !== 'win32' && !(await isExecutable(bundledPath))) {
        await makeExecutable(bundledPath)
      }
      const userVersion = await readUserVersion(userDirName)
      if (!userVersion || isNewerVersion(userVersion, bundledVersion)) {
        return { path: bundledPath, source: 'bundled' }
      }
    }
    return { path: userPath, source: 'user' }
  }

  // Tier 2: Bundled binary
  if (await fileExists(bundledPath)) {
    if (platform !== 'win32' && !(await isExecutable(bundledPath))) {
      await makeExecutable(bundledPath)
    }
    return { path: bundledPath, source: 'bundled' }
  }

  // Tier 3: System PATH
  const systemPath = await findInPath(systemName)
  if (systemPath) return { path: systemPath, source: 'system' }

  return null
}

async function resolveBinary(
  bundledName: string,
  systemName: string,
  userDirName: string,
  bundledVersion?: string | null
): Promise<string | null> {
  return (await resolveBinaryInfo(bundledName, systemName, userDirName, bundledVersion))?.path ?? null
}

async function resolveYtdlpPath(): Promise<string> {
  const localName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const bundledVersions = await readBundledVersions()
  const existing = await resolveBinary(ytdlpFilename(), 'yt-dlp', localName, bundledVersions?.ytdlp)
  if (existing) return existing
  return downloadYtdlp()
}

async function resolveFfmpegPath(): Promise<string> {
  const name = ffmpegFilename()
  const bundledVersions = await readBundledVersions()
  const existing = await resolveBinary(name, 'ffmpeg', name, bundledVersions?.ffmpeg)
  if (existing) return existing
  return downloadFfmpeg()
}

export async function getYtdlpPath(): Promise<string> {
  if (!cachedYtdlpPath) {
    cachedYtdlpPath = resolveYtdlpPath().catch((err) => {
      cachedYtdlpPath = null
      throw err
    })
  }
  return cachedYtdlpPath
}

export async function getFfmpegPath(): Promise<string> {
  if (!cachedFfmpegPath) {
    cachedFfmpegPath = resolveFfmpegPath().catch((err) => {
      cachedFfmpegPath = null
      throw err
    })
  }
  return cachedFfmpegPath
}

export async function getVersion(binaryPath: string): Promise<string> {
  // ffmpeg uses -version, yt-dlp uses --version
  const isFfmpeg = binaryPath.toLowerCase().includes('ffmpeg')
  const flag = isFfmpeg ? '-version' : '--version'
  const versionTimeoutMs = 5000
  try {
    const output = await execPromise(binaryPath, [flag], versionTimeoutMs)
    return output.split('\n')[0].trim()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to get version for ${binaryPath}: ${message}`)
  }
}

export async function downloadYtdlp(): Promise<string> {
  const binDir = await ensureUserBinDir()
  const destName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const destPath = path.join(binDir, destName)
  const url = getYtdlpDownloadUrl()

  const data = await httpsGet(url)
  await writeFile(destPath, data)
  await makeExecutable(destPath)

  cachedYtdlpPath = Promise.resolve(destPath)
  return destPath
}

export async function downloadFfmpeg(): Promise<string> {
  const binDir = await ensureUserBinDir()
  const destName = ffmpegFilename()
  const destPath = path.join(binDir, destName)
  const url = getFfmpegDownloadUrl()

  const data = await httpsGet(url)
  await writeFile(destPath, data)
  await makeExecutable(destPath)

  cachedFfmpegPath = Promise.resolve(destPath)
  return destPath
}

async function getLatestYtdlpVersion(): Promise<string | null> {
  const latestReleaseTimeoutMs = 3000
  try {
    const release = await httpsGetJson<{ tag_name?: string }>('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', latestReleaseTimeoutMs)
    return release.tag_name ?? null
  } catch {
    return null
  }
}

async function getLatestFfmpegVersion(): Promise<string | null> {
  // ffmpeg-static release tags are package/build tags, not the version reported
  // by the ffmpeg binary itself. Comparing them to `ffmpeg -version` creates
  // false update prompts, so we only enable this when we have a binary-version source.
  return null
}

function normalizeVersion(value: string | null): string | null {
  if (!value) return null
  const ffmpegMatch = value.match(/ffmpeg version\s+([^\s]+)/i)
  return (ffmpegMatch ? ffmpegMatch[1] : value).replace(/^b/i, '').trim()
}

function isNewerVersion(current: string | null, latest: string | null): boolean {
  const normalizedCurrent = normalizeVersion(current)
  const normalizedLatest = normalizeVersion(latest)
  if (!normalizedCurrent || !normalizedLatest) return false
  const currentParts = normalizedCurrent.split(/[.-]/).map((part) => Number.parseInt(part, 10))
  const latestParts = normalizedLatest.split(/[.-]/).map((part) => Number.parseInt(part, 10))
  if (currentParts.some(Number.isNaN) || latestParts.some(Number.isNaN)) {
    return normalizedCurrent !== normalizedLatest
  }
  const length = Math.max(currentParts.length, latestParts.length)
  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] ?? 0
    const latestPart = latestParts[index] ?? 0
    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }
  return false
}

export async function getBinaryStatus(includeLatest = false): Promise<BinaryStatus> {
  const status: BinaryStatus = {
    ytdlpPath: null,
    ytdlpVersion: null,
    ytdlpSource: null,
    ytdlpLatestVersion: null,
    ytdlpUpdateAvailable: false,
    ffmpegPath: null,
    ffmpegVersion: null,
    ffmpegSource: null,
    ffmpegLatestVersion: null,
    ffmpegUpdateAvailable: false
  }

  const bundledVersions = await readBundledVersions()
  let latestYtdlpVersion: string | null = null
  let latestFfmpegVersion: string | null = null
  if (includeLatest) {
    ;[latestYtdlpVersion, latestFfmpegVersion] = await Promise.all([
      getLatestYtdlpVersion(),
      getLatestFfmpegVersion()
    ])
    status.ytdlpLatestVersion = latestYtdlpVersion
    status.ffmpegLatestVersion = latestFfmpegVersion
  }

  try {
    const localName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    const ytdlp = await resolveBinaryInfo(ytdlpFilename(), 'yt-dlp', localName, bundledVersions?.ytdlp)
    if (ytdlp) {
      status.ytdlpPath = ytdlp.path
      status.ytdlpSource = ytdlp.source
      try {
        status.ytdlpVersion = ytdlp.source === 'bundled' && bundledVersions?.ytdlp
          ? bundledVersions.ytdlp
          : await getVersion(ytdlp.path)
      } catch {
        status.ytdlpVersion = latestYtdlpVersion
      }
      status.ytdlpUpdateAvailable = isNewerVersion(status.ytdlpVersion, latestYtdlpVersion)
    }
  } catch {
    // leave as null
  }

  try {
    const name = ffmpegFilename()
    const ffmpeg = await resolveBinaryInfo(name, 'ffmpeg', name, bundledVersions?.ffmpeg)
    if (ffmpeg) {
      status.ffmpegPath = ffmpeg.path
      status.ffmpegSource = ffmpeg.source
      status.ffmpegVersion = ffmpeg.source === 'bundled' && bundledVersions?.ffmpeg
        ? bundledVersions.ffmpeg
        : await getVersion(ffmpeg.path)
      status.ffmpegUpdateAvailable = isNewerVersion(status.ffmpegVersion, latestFfmpegVersion)
    }
  } catch {
    // leave as null
  }

  return status
}

export async function updateYtdlp(): Promise<string> {
  const latest = await getLatestYtdlpVersion()
  const updatedPath = await downloadYtdlp()
  const destName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  await writeUserVersion(destName, latest)
  cachedYtdlpPath = Promise.resolve(updatedPath)
  return updatedPath
}

export async function updateFfmpeg(): Promise<string> {
  const latest = await getLatestFfmpegVersion()
  const updatedPath = await downloadFfmpeg()
  await writeUserVersion(ffmpegFilename(), latest)
  cachedFfmpegPath = Promise.resolve(updatedPath)
  return updatedPath
}

export async function useBundledYtdlp(): Promise<BinaryStatus> {
  const destName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  await unlink(path.join(getUserBinDir(), destName)).catch(() => {})
  await unlink(path.join(getUserBinDir(), `${destName}.version`)).catch(() => {})
  cachedYtdlpPath = null
  return getBinaryStatus()
}

export async function useBundledFfmpeg(): Promise<BinaryStatus> {
  const destName = ffmpegFilename()
  await unlink(path.join(getUserBinDir(), destName)).catch(() => {})
  await unlink(path.join(getUserBinDir(), `${destName}.version`)).catch(() => {})
  cachedFfmpegPath = null
  return getBinaryStatus()
}

/** Check if yt-dlp version is older than maxAgeDays and auto-update if so. */
export async function ensureYtdlpFresh(maxAgeDays = 30): Promise<void> {
  try {
    const ytdlpPath = await getYtdlpPath()
    const version = await getVersion(ytdlpPath)
    // yt-dlp versions are date-based: "2025.09.05" or "2026.03.15"
    const dateMatch = version.match(/(\d{4})\.(\d{2})\.(\d{2})/)
    if (!dateMatch) return

    const versionDate = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    )
    const ageDays = (Date.now() - versionDate.getTime()) / (1000 * 60 * 60 * 24)

    if (ageDays > maxAgeDays) {
      console.log(`yt-dlp version ${version} is ${Math.floor(ageDays)} days old, auto-updating...`)
      await downloadYtdlp()
    }
  } catch {
    // Non-fatal: if update fails, we'll use whatever version is available
  }
}
