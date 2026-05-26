#!/usr/bin/env node
/**
 * download-binaries.mjs
 *
 * Downloads yt-dlp and ffmpeg binaries for bundling into the Electron app.
 * Run before packaging: node scripts/download-binaries.mjs [platform] [--force]
 *
 * Platforms: darwin-arm64, darwin-x64, win-x64, all
 * Default: current platform
 */

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs'
import { execFileSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const BINARIES = {
  'darwin-arm64': {
    ytdlp: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos', name: 'yt-dlp_macos' },
    ffmpeg: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-arm64', name: 'ffmpeg' }
  },
  'darwin-x64': {
    ytdlp: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos', name: 'yt-dlp_macos' },
    ffmpeg: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64', name: 'ffmpeg' }
  },
  'win-x64': {
    ytdlp: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', name: 'yt-dlp.exe' },
    ffmpeg: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-win32-x64', name: 'ffmpeg.exe' }
  }
}

function httpsGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Pullframe-Build' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'))
        return httpsGet(res.headers.location, maxRedirects - 1).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    request.setTimeout(30000, () => {
      request.destroy(new Error(`Timed out downloading ${url}`))
    })
    request.on('error', reject)
  })
}

async function downloadBinary(url, destPath, label, force = false) {
  if (existsSync(destPath) && !force) {
    console.log(`  ✓ ${label} already exists, skipping`)
    return
  }
  process.stdout.write(`  ⬇ ${force ? 'Refreshing' : 'Downloading'} ${label}...`)
  const data = await httpsGet(url)
  writeFileSync(destPath, data)
  // Make executable on non-Windows
  if (!destPath.endsWith('.exe')) {
    chmodSync(destPath, 0o755)
  }
  const sizeMB = (data.length / 1024 / 1024).toFixed(1)
  console.log(` ${sizeMB} MB ✓`)
}

function getBinaryVersion(filePath, kind) {
  const flag = kind === 'ffmpeg' ? '-version' : '--version'
  const output = execFileSync(filePath, [flag], {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
  const firstLine = output.split('\n')[0].trim()
  if (kind === 'ffmpeg') {
    const match = firstLine.match(/ffmpeg version\s+([^\s]+)/i)
    return match ? match[1] : firstLine
  }
  return firstLine
}

function writeBundleManifest(binDir, ytdlpPath, ffmpegPath) {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ytdlp: getBinaryVersion(ytdlpPath, 'ytdlp'),
    ffmpeg: getBinaryVersion(ffmpegPath, 'ffmpeg')
  }
  writeFileSync(resolve(binDir, 'versions.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`  ✓ versions.json (${manifest.ytdlp}, ${manifest.ffmpeg})`)
}

async function main() {
  const force = process.argv.includes('--force')
  const arg = process.argv.find((value, index) => index > 1 && value !== '--force') || 'current'
  let platforms

  if (arg === 'all') {
    platforms = Object.keys(BINARIES)
  } else if (arg === 'current') {
    const os = process.platform === 'win32' ? 'win' : process.platform
    const arch = process.arch
    const key = `${os}-${arch}`
    if (!BINARIES[key]) {
      console.error(`No binary config for platform: ${key}`)
      process.exit(1)
    }
    platforms = [key]
  } else {
    if (!BINARIES[arg]) {
      console.error(`Unknown platform: ${arg}. Valid: ${Object.keys(BINARIES).join(', ')}, all, current`)
      process.exit(1)
    }
    platforms = [arg]
  }

  for (const platform of platforms) {
    const binDir = resolve(ROOT, 'resources', 'bin', platform)
    mkdirSync(binDir, { recursive: true })
    console.log(`\n[${platform}] → ${binDir}`)

    const { ytdlp, ffmpeg } = BINARIES[platform]
    const ytdlpPath = resolve(binDir, ytdlp.name)
    const ffmpegPath = resolve(binDir, ffmpeg.name)
    await downloadBinary(ytdlp.url, ytdlpPath, `yt-dlp (${ytdlp.name})`, force)
    await downloadBinary(ffmpeg.url, ffmpegPath, `ffmpeg (${ffmpeg.name})`, force)
    writeBundleManifest(binDir, ytdlpPath, ffmpegPath)
  }

  console.log('\nDone! Binaries are ready for packaging.')
}

main().catch((err) => {
  console.error('\nFailed:', err.message)
  process.exit(1)
})
