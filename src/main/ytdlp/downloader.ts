import { spawn, type ChildProcess } from 'child_process'
import { stat, mkdir } from 'fs/promises'
import path from 'path'
import treeKill from 'tree-kill'
import { resolveCookieBrowserArgument } from './browser-cookies'
import type { DownloadRequest, DownloadProgress, DownloadComplete } from './types'

const activeDownloads = new Map<string, ChildProcess>()

/** Check if a request needs a separate ffmpeg transcode step after yt-dlp download */
function needsSeparateTranscode(request: DownloadRequest): boolean {
  const isMerge = (request.formatId ?? '').includes('+')
  const container = request.preferredContainer ?? 'mp4'
  // Explicit video transcodes always run through the separate ffmpeg pass. This
  // includes professional video+audio intermediates built from video-only rows.
  if (request.videoTranscodeTo) return true
  // Merge to MP4 with non-codec-filtered format = needs H.264 transcode
  if (isMerge && container === 'mp4') {
    const isCodecFiltered = (request.formatId ?? '').includes('[vcodec')
    if (!isCodecFiltered) return true
  }
  return false
}

/** Get the H.264 encoder args for the macOS-only distribution. */
function getH264Encoder(hwAccel?: 'cpu' | 'videotoolbox'): string[] {
  if (hwAccel === 'videotoolbox') {
    return ['-c:v', 'h264_videotoolbox', '-q:v', '65', '-allow_sw', '1']
  }

  return ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-threads', '0']
}

/** Get ffmpeg args for the separate transcode step */
function getTranscodeArgs(request: DownloadRequest): { ffmpegArgs: string[]; outputExt: string } {
  const hw = request.hwAccel
  const optionalAudioMap = ['-map', '0:v:0', '-map', '0:a?']

  if (request.videoTranscodeTo) {
    switch (request.videoTranscodeTo) {
      case 'h264-mp4':
        return { ffmpegArgs: [...optionalAudioMap, ...getH264Encoder(hw), '-c:a', 'aac', '-b:a', '320k'], outputExt: 'mp4' }
      case 'prores':
        // ProRes is CPU-only (no GPU encoder exists)
        return { ffmpegArgs: [...optionalAudioMap, '-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le', '-threads', '0', '-c:a', 'pcm_s16le'], outputExt: 'mov' }
      case 'dnxhr':
        // DNxHR is CPU-only
        return { ffmpegArgs: [...optionalAudioMap, '-c:v', 'dnxhd', '-profile:v', 'dnxhr_hq', '-pix_fmt', 'yuv422p', '-threads', '0', '-c:a', 'pcm_s16le'], outputExt: 'mxf' }
    }
  }
  // Merge to MP4 = H.264 transcode
  return { ffmpegArgs: [...getH264Encoder(hw), '-c:a', 'aac', '-b:a', '320k'], outputExt: 'mp4' }
}

/** For transcode jobs, compute a deterministic temp path for the intermediate file */
function getIntermediatePath(request: DownloadRequest): string {
  // Use request.id as a unique, deterministic filename for the intermediate
  const safeId = request.id.replace(/[<>:"/\\|?*\[\]+]/g, '_')
  return path.join(request.outputDir, `_pullframe_temp_${safeId}.%(ext)s`)
}

function buildFormatArgs(request: DownloadRequest): string[] {
  // For transcode jobs, use a deterministic temp filename so we know exactly where the file is
  const outputTemplate = needsSeparateTranscode(request)
    ? getIntermediatePath(request)
    : request.filename
      ? path.join(request.outputDir, request.filename)
      : path.join(request.outputDir, '%(title)s [%(format_id)s]_pullframe.%(ext)s')

  const args = [
    '-f', request.formatId ?? 'best',
    '--newline',
    '--no-part',
    '--progress-template',
    'download:%(progress._percent_str)s|||%(progress._speed_str)s|||%(progress._eta_str)s|||%(progress._total_bytes_str)s',
    '-o', outputTemplate
  ]

  const isMerge = (request.formatId ?? '').includes('+')
  const container = request.preferredContainer ?? 'mp4'

  if (isMerge && container !== 'auto') {
    if (needsSeparateTranscode(request)) {
      // Merge to MKV first (fast mux, accepts any codec), transcode separately after
      args.push('--merge-output-format', 'mkv')
    } else {
      args.push('--merge-output-format', container)
    }
  }

  // If separate transcode is needed, DON'T add --recode-video here
  // Audio conversion is still handled by yt-dlp (it's fast)
  if (!needsSeparateTranscode(request)) {
    if (request.videoTranscodeTo && !isMerge) {
      switch (request.videoTranscodeTo) {
        case 'h264-mp4':
          args.push('--recode-video', 'mp4', '--postprocessor-args', 'ffmpeg:-c:v libx264 -crf 18 -preset medium -threads 0')
          break
        case 'prores':
          args.push('--postprocessor-args', 'ffmpeg:-c:v prores_ks -profile:v 2 -pix_fmt yuv422p10le -threads 0', '--recode-video', 'mov')
          break
        case 'dnxhr':
          args.push('--postprocessor-args', 'ffmpeg:-c:v dnxhd -profile:v dnxhr_hq -pix_fmt yuv422p -threads 0', '--recode-video', 'mxf')
          break
      }
    }
  }

  if (request.audioConvertTo && !isMerge) {
    args.push('--extract-audio')
    args.push('--audio-format', request.audioConvertTo)
    args.push('--audio-quality', '0')
  }

  args.push(request.url)
  return args
}

function buildNonFormatArgs(request: DownloadRequest): string[] {
  const outputTemplate = request.filename
    ? path.join(request.outputDir, request.filename)
    : path.join(request.outputDir, '%(title)s.%(ext)s')

  const args: string[] = []

  switch (request.type) {
    case 'subtitle':
      args.push(
        '--write-subs',
        '--sub-langs', request.subtitleLang ?? 'en',
        '--sub-format', request.subtitleSourceFormat ?? 'best',
        '--skip-download',
        '--sleep-subtitles', '1'
      )
      if (request.subtitleFormat && request.subtitleFormat !== 'original') {
        args.push('--convert-subs', request.subtitleFormat)
      }
      break
    case 'auto-subtitle':
      args.push(
        '--write-auto-subs',
        '--sub-langs', request.subtitleLang ?? 'en',
        '--sub-format', request.subtitleSourceFormat ?? 'best',
        '--skip-download',
        '--sleep-subtitles', '1'
      )
      if (request.subtitleFormat && request.subtitleFormat !== 'original') {
        args.push('--convert-subs', request.subtitleFormat)
      }
      break
    case 'thumbnail':
      args.push(
        '--write-thumbnail',
        '--convert-thumbnails', 'png',
        '--skip-download'
      )
      break
    case 'description':
      args.push('--write-description', '--skip-download')
      break
    case 'info-json':
      args.push('--write-info-json', '--skip-download')
      break
    case 'comments':
      args.push('--write-comments', '--skip-download')
      break
  }

  args.push('-o', outputTemplate, request.url)
  return args
}

function parseProgressLine(line: string, downloadId: string): DownloadProgress | null {
  const trimmed = line.trim()

  // Progress template output may or may not have the "download:" prefix
  let data: string
  if (trimmed.startsWith('download:')) {
    data = trimmed.slice('download:'.length)
  } else if (trimmed.includes('|||')) {
    data = trimmed
  } else {
    return null
  }

  const parts = data.split('|||')
  if (parts.length < 3) return null

  const percentStr = parts[0].trim().replace('%', '')
  const percent = parseFloat(percentStr)

  return {
    id: downloadId,
    percent: isNaN(percent) ? 0 : percent,
    speed: parts[1].trim(),
    eta: parts[2].trim(),
    totalSize: parts[3].trim(),
    stage: 'downloading'
  }
}

function detectStageFromLine(line: string): DownloadProgress['stage'] | null {
  const lower = line.toLowerCase()
  if (lower.includes('[merger]') || lower.includes('merging formats')) return 'merging'
  if (lower.includes('[ffmpeg]') || lower.includes('[videoconvertor]') ||
      lower.includes('[extractaudio]') || lower.includes('post-process') ||
      lower.includes('converting video') || lower.includes('converting audio') ||
      lower.includes('[fixupm3u8]') || lower.includes('[recodevideopp]')) {
    return 'postprocessing'
  }
  return null
}

async function resolveOutputFile(outputDir: string, _url: string, _request: DownloadRequest): Promise<{ filePath: string; fileSize: number }> {
  // Try to find the most recently modified file in outputDir
  // that might match our download
  const { readdir } = await import('fs/promises')

  try {
    const files = await readdir(outputDir)
    let bestFile = ''
    let bestMtime = 0

    for (const file of files) {
      const filePath = path.join(outputDir, file)
      try {
        const info = await stat(filePath)
        if (info.isFile() && info.mtimeMs > bestMtime) {
          bestMtime = info.mtimeMs
          bestFile = filePath
        }
      } catch {
        continue
      }
    }

    if (bestFile) {
      const info = await stat(bestFile)
      return { filePath: bestFile, fileSize: info.size }
    }
  } catch {
    // directory read failed
  }

  return { filePath: path.join(outputDir, 'unknown'), fileSize: 0 }
}

/** Run ffmpeg as a separate process for transcoding with real-time progress */
function runSeparateTranscode(
  inputFile: string,
  request: DownloadRequest,
  ffmpegPath: string,
  videoDuration: number,
  onProgress: (p: DownloadProgress) => void
): Promise<DownloadComplete> {
  return new Promise((resolve, reject) => {
    const { ffmpegArgs, outputExt } = getTranscodeArgs(request)
    // Use video title from request for the final output name
    const title = request.videoTitle ?? 'video'
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
    // Tag indicating transcode codec
    const transcodeTag = request.videoTranscodeTo === 'prores' ? 'ProRes422'
      : request.videoTranscodeTo === 'dnxhr' ? 'DNxHR'
      : request.hwAccel === 'videotoolbox' ? 'H264_VIDEOTOOLBOX'
      : 'H264'
    const outputFile = path.join(request.outputDir, `${safeTitle} [${transcodeTag}]_pullframe.${outputExt}`)

    onProgress({
      id: request.id,
      percent: 0,
      speed: '',
      eta: '',
      stage: 'postprocessing',
      filename: outputFile
    })

    // Normalize paths for the current platform
    const normalizedInput = path.resolve(inputFile)
    const normalizedOutput = path.resolve(outputFile)
    const normalizedArgs = ['-y', '-i', normalizedInput, ...ffmpegArgs, normalizedOutput]
    console.log(`[Transcode] Input: ${normalizedInput}`)
    console.log(`[Transcode] Output: ${normalizedOutput}`)
    console.log(`[Transcode] Running: ${ffmpegPath} ${normalizedArgs.join(' ')}`)

    const ffmpeg = spawn(ffmpegPath, normalizedArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    activeDownloads.set(request.id, ffmpeg)
    let stderrOutput = ''

    ffmpeg.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      stderrOutput += text
      for (const line of text.split(/[\r\n]+/)) {
        if (!line.trim()) continue

        const timeMatch = line.match(/time=\s*(\d{1,2}):(\d{2}):(\d{2})[\.\d]*/)
        if (timeMatch && videoDuration > 0) {
          const hours = parseInt(timeMatch[1])
          const mins = parseInt(timeMatch[2])
          const secs = parseInt(timeMatch[3])
          const currentTime = hours * 3600 + mins * 60 + secs
          const percent = Math.min(99, Math.round((currentTime / videoDuration) * 100))

          const speedMatch = line.match(/speed=\s*([\d.]+)x/)
          const speed = speedMatch ? `${speedMatch[1]}x` : ''

          const remaining = videoDuration - currentTime
          const ffmpegSpeed = speedMatch ? parseFloat(speedMatch[1]) : 1
          const etaSecs = ffmpegSpeed > 0 ? Math.round(remaining / ffmpegSpeed) : 0
          const etaMins = Math.floor(etaSecs / 60)
          const eta = etaSecs > 0 ? `${etaMins}:${String(etaSecs % 60).padStart(2, '0')}` : ''

          onProgress({
            id: request.id,
            percent,
            speed,
            eta,
            stage: 'postprocessing',
            filename: outputFile
          })
        }
      }
    })

    ffmpeg.on('close', async (code) => {
      activeDownloads.delete(request.id)

      if (code === 0) {
        // Delete the intermediate file (MKV/webm)
        try { await import('fs/promises').then(fs => fs.unlink(normalizedInput)) } catch { /* ignore */ }

        onProgress({
          id: request.id,
          percent: 100,
          speed: '',
          eta: '',
          stage: 'complete',
          filename: outputFile
        })

        try {
          const info = await stat(outputFile)
          resolve({ id: request.id, filePath: outputFile, fileSize: info.size })
        } catch {
          resolve({ id: request.id, filePath: outputFile, fileSize: 0 })
        }
      } else {
        // Extract meaningful error from ffmpeg stderr
        const errorLines = stderrOutput.split('\n').filter(l => l.trim()).slice(-5).join(' ').trim()
        const errorMsg = errorLines || `exit code ${code}`
        console.error(`[Transcode] Failed: ${errorMsg}`)
        reject(new Error(`FFmpeg transcode failed: ${errorMsg}`))
      }
    })

    ffmpeg.on('error', (err) => {
      activeDownloads.delete(request.id)
      console.error(`[Transcode] Spawn error: ${err.message}`)
      reject(new Error(`FFmpeg failed to start: ${err.message}`))
    })
  })
}

export function startDownload(
  request: DownloadRequest,
  ytdlpPath: string,
  onProgress: (p: DownloadProgress) => void,
  ffmpegPath?: string
): Promise<DownloadComplete> {
  return new Promise(async (resolve, reject) => {
    // Ensure output directory exists (for folder organization)
    try { await mkdir(request.outputDir, { recursive: true }) } catch { /* ignore */ }

    const args = request.type === 'format'
      ? buildFormatArgs(request)
      : buildNonFormatArgs(request)

    // Force overwrite partial/temp files from previous attempts
    args.unshift('--force-overwrites')

    // Tell yt-dlp where ffmpeg is for merging video+audio
    if (ffmpegPath) {
      args.unshift('--ffmpeg-location', ffmpegPath)
    }

    // Pass browser cookies for YouTube authentication
    const cookieBrowserArgument = await resolveCookieBrowserArgument(request.cookieBrowser)
    if (cookieBrowserArgument) {
      args.unshift('--cookies-from-browser', cookieBrowserArgument)
    }

    const child = spawn(ytdlpPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    activeDownloads.set(request.id, child)

    let lastFilename: string | undefined
    let stderrOutput = ''
    const videoDuration = request.videoDuration ?? 0

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      for (const line of text.split('\n')) {
        if (!line.trim()) continue

        // Check for filename in yt-dlp output
        const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/)
        if (destMatch) {
          lastFilename = destMatch[1].trim()
        }

        const mergeMatch = line.match(/\[Merger\]\s+Merging formats into "(.+)"/)
        if (mergeMatch) {
          lastFilename = mergeMatch[1].trim()
        }

        // Parse progress
        const progress = parseProgressLine(line, request.id)
        if (progress) {
          if (lastFilename) progress.filename = lastFilename
          onProgress(progress)
          continue
        }

        // Detect stage changes
        let stage = detectStageFromLine(line)
        if (stage) {
          // If this download involves transcoding (recode-video or videoTranscodeTo),
          // show "postprocessing" (Transcoding) instead of "merging"
          const isTranscodeJob = args.some(a => a === '--recode-video') ||
            request.videoTranscodeTo != null
          if (stage === 'merging' && isTranscodeJob) {
            stage = 'postprocessing'
          }
          onProgress({
            id: request.id,
            percent: 0,
            speed: '',
            eta: '',
            stage,
            filename: lastFilename
          })
        }
      }
    })

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      stderrOutput += text

      // ffmpeg uses \r for progress updates on same line, split on both
      for (const line of text.split(/[\r\n]+/)) {
        if (!line.trim()) continue

        // Detect stage changes
        const stage = detectStageFromLine(line)
        if (stage) {
          onProgress({
            id: request.id,
            percent: 0,
            speed: '',
            eta: '',
            stage,
            filename: lastFilename
          })
        }

        // Parse ffmpeg progress: "time=00:01:23.45"
        const timeMatch = line.match(/time=\s*(\d{1,2}):(\d{2}):(\d{2})[\.\d]*/)
        if (timeMatch && videoDuration > 0) {
          const hours = parseInt(timeMatch[1])
          const mins = parseInt(timeMatch[2])
          const secs = parseInt(timeMatch[3])
          const currentTime = hours * 3600 + mins * 60 + secs
          const percent = Math.min(99, Math.round((currentTime / videoDuration) * 100))

          // Parse speed from ffmpeg output
          const speedMatch = line.match(/speed=\s*([\d.]+)x/)
          const speed = speedMatch ? `${speedMatch[1]}x` : ''

          // Estimate ETA
          const remaining = videoDuration - currentTime
          const ffmpegSpeed = speedMatch ? parseFloat(speedMatch[1]) : 1
          const etaSecs = ffmpegSpeed > 0 ? Math.round(remaining / ffmpegSpeed) : 0
          const etaMins = Math.floor(etaSecs / 60)
          const eta = etaSecs > 0 ? `${etaMins}:${String(etaSecs % 60).padStart(2, '0')}` : ''

          onProgress({
            id: request.id,
            percent,
            speed,
            eta,
            stage: 'postprocessing',
            filename: lastFilename
          })
        }
      }
    })

    child.on('close', async (code) => {
      activeDownloads.delete(request.id)

      if (code === 0) {
        const doTranscode = needsSeparateTranscode(request)

        // For transcode jobs, we know exactly where the intermediate file is
        if (doTranscode && ffmpegPath) {
          // Compute the deterministic intermediate path (matches getIntermediatePath)
          const safeId = request.id.replace(/[<>:"/\\|?*\[\]+]/g, '_')
          // yt-dlp replaces %(ext)s with the actual extension (mkv for merges)
          const { readdir } = await import('fs/promises')
          let intermediateFile: string | null = null

          // Find the temp file by our known prefix
          try {
            const files = await readdir(request.outputDir)
            const tempFile = files.find(f => f.startsWith(`_pullframe_temp_${safeId}`))
            if (tempFile) {
              intermediateFile = path.join(request.outputDir, tempFile)
            }
          } catch { /* ignore */ }

          // Fallback: use lastFilename from yt-dlp output
          if (!intermediateFile && lastFilename) {
            try { await stat(lastFilename); intermediateFile = lastFilename } catch { /* ignore */ }
          }

          if (!intermediateFile) {
            onProgress({ id: request.id, percent: 0, speed: '', eta: '', stage: 'error' })
            reject(new Error('Could not find intermediate file for transcoding'))
            return
          }

          try {
            const transcodeResult = await runSeparateTranscode(
              intermediateFile, request, ffmpegPath, videoDuration, onProgress
            )
            resolve(transcodeResult)
          } catch (err) {
            onProgress({ id: request.id, percent: 0, speed: '', eta: '', stage: 'error' })
            reject(err)
          }
          return
        }

        // Non-transcode: standard completion
        onProgress({
          id: request.id,
          percent: 100,
          speed: '',
          eta: '',
          stage: 'complete',
          filename: lastFilename
        })

        if (lastFilename) {
          try {
            const info = await stat(lastFilename)
            resolve({ id: request.id, filePath: lastFilename, fileSize: info.size })
            return
          } catch {
            // fall through to resolveOutputFile
          }
        }

        const result = await resolveOutputFile(request.outputDir, request.url, request)
        resolve({ id: request.id, filePath: result.filePath, fileSize: result.fileSize })
      } else {
        onProgress({
          id: request.id,
          percent: 0,
          speed: '',
          eta: '',
          stage: 'error'
        })
        const errorLines = stderrOutput
          .split('\n')
          .filter((line) => line.includes('ERROR:'))
          .map((line) => line.replace(/^.*ERROR:\s*/, '').trim())
        const cleanError = errorLines.length > 0
          ? errorLines.join('. ')
          : stderrOutput.trim().split('\n').pop() ?? `yt-dlp exited with code ${code}`
        reject(new Error(cleanError))
      }
    })

    child.on('error', (err) => {
      activeDownloads.delete(request.id)
      onProgress({
        id: request.id,
        percent: 0,
        speed: '',
        eta: '',
        stage: 'error'
      })
      reject(err)
    })
  })
}

export function cancelDownload(id: string): void {
  const child = activeDownloads.get(id)
  if (!child || child.pid == null) return

  treeKill(child.pid, 'SIGTERM', (err) => {
    if (err) {
      if (child.pid != null) {
        treeKill(child.pid, 'SIGKILL')
      }
    }
  })
  activeDownloads.delete(id)
}

/** Kill all active download processes. Call on app quit. */
export function killAllDownloads(): void {
  for (const [id, child] of activeDownloads) {
    if (child.pid != null) {
      treeKill(child.pid, 'SIGKILL')
    }
    activeDownloads.delete(id)
  }
}
