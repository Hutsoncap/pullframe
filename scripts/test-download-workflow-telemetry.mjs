import assert from 'node:assert/strict'
import { rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const outdir = join(tmpdir(), `pullframe-download-workflow-${Date.now()}`)
await mkdir(outdir, { recursive: true })

try {
  const outfile = join(outdir, 'download-workflow.mjs')
  await esbuild.build({
    entryPoints: ['src/renderer/src/telemetry/download-workflow.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent'
  })

  const {
    buildDownloadSucceededProperties,
    buildDownloadWorkflowProperties,
    buildFormatWorkflowProperties,
    sanitizeWorkflowProperties
  } = await import(pathToFileURL(outfile).href)

  assert.deepEqual(buildFormatWorkflowProperties('audio-only', {
    id: 'audio-1',
    url: 'https://example.invalid/private',
    type: 'format',
    formatId: '251',
    outputDir: '/Users/hutson/Downloads/private',
    audioConvertTo: 'mp3'
  }), {
    downloadType: 'audio',
    videoCount: 0,
    audioCount: 1,
    subtitleCount: 0,
    thumbnailCount: 0,
    metadataCount: 0,
    transcodeCount: 1,
    remuxCount: 0,
    hasTranscodes: true
  })

  assert.deepEqual(buildDownloadWorkflowProperties({
    downloadCategory: 'video',
    type: 'format',
    originalRequest: {
      id: 'merged-1',
      url: 'https://example.invalid/private',
      type: 'format',
      formatId: 'bestvideo[height<=1080]+bestaudio/best',
      outputDir: '/Users/hutson/Downloads/private',
      preferredContainer: 'mp4'
    }
  }), {
    downloadType: 'video_audio',
    videoCount: 1,
    audioCount: 1,
    subtitleCount: 0,
    thumbnailCount: 0,
    metadataCount: 0,
    transcodeCount: 1,
    remuxCount: 1,
    hasTranscodes: true
  })

  assert.deepEqual(buildDownloadWorkflowProperties({
    downloadCategory: 'subtitle',
    type: 'subtitle',
    originalRequest: {
      id: 'subs-1',
      url: 'https://example.invalid/private',
      type: 'subtitle',
      subtitleLang: 'en,es,fr',
      outputDir: '/Users/hutson/Downloads/private'
    }
  }), {
    downloadType: 'subtitles',
    videoCount: 0,
    audioCount: 0,
    subtitleCount: 3,
    thumbnailCount: 0,
    metadataCount: 0,
    transcodeCount: 0,
    remuxCount: 0,
    hasTranscodes: false
  })

  assert.deepEqual(buildDownloadWorkflowProperties({
    downloadCategory: 'thumbnail',
    type: 'thumbnail',
    originalRequest: null
  }).thumbnailCount, 1)

  assert.deepEqual(sanitizeWorkflowProperties({
    downloadType: 'mixed',
    videoCount: -1,
    audioCount: 1.5,
    subtitleCount: Number.NaN,
    thumbnailCount: 2,
    metadataCount: 1,
    transcodeCount: 0,
    remuxCount: 3,
    hasTranscodes: true
  }), {
    downloadType: 'mixed',
    videoCount: 0,
    audioCount: 0,
    subtitleCount: 0,
    thumbnailCount: 2,
    metadataCount: 1,
    transcodeCount: 0,
    remuxCount: 3,
    hasTranscodes: false
  })

  const emitted = buildDownloadSucceededProperties({
    downloadCategory: 'video',
    type: 'format',
    originalRequest: {
      id: 'private-download',
      url: 'https://youtube.com/watch?v=secret',
      type: 'format',
      formatId: 'bestvideo[height<=2160]+bestaudio/best',
      outputDir: '/Users/hutson/Downloads/private-client',
      filename: 'Client Launch Notes.mov',
      preferredContainer: 'mp4'
    }
  })

  assert.equal(emitted.result, 'succeeded')
  assert.equal(emitted.source, 'app')
  assert.equal(emitted.downloadType, 'video_audio')
  assert.equal(emitted.videoCount, 1)
  assert.equal(emitted.audioCount, 1)
  assert.equal(emitted.hasTranscodes, true)
  assert.equal('url' in emitted, false)
  assert.equal('sourceUrl' in emitted, false)
  assert.equal('outputDir' in emitted, false)
  assert.equal('filename' in emitted, false)
} finally {
  await rm(outdir, { recursive: true, force: true })
}
