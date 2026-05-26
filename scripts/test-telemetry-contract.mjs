import assert from 'node:assert/strict'
import { rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const outdir = join(tmpdir(), `pullframe-telemetry-contract-${Date.now()}`)
await mkdir(outdir, { recursive: true })

try {
  const outfile = join(outdir, 'telemetry-contract.mjs')
  await esbuild.build({
    entryPoints: ['src/main/telemetry-contract.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['electron'],
    logLevel: 'silent'
  })

  const {
    buildAnalyticsEvent,
    buildFeedbackSubmission,
    mapFailureCode,
    sanitizeTelemetryProperties
  } = await import(pathToFileURL(outfile).href)

  const event = buildAnalyticsEvent({
    eventType: 'download.succeeded',
    environment: 'development',
    installId: 'install-123',
    appVersion: '1.0.0',
    licenseId: null,
    activationId: null,
    properties: {
      category: 'video',
      downloadType: 'video_audio',
      videoCount: 1,
      audioCount: 1,
      subtitleCount: 0,
      thumbnailCount: 0,
      metadataCount: 0,
      transcodeCount: 1,
      remuxCount: 1,
      hasTranscodes: true,
      sourceUrl: 'https://youtube.com/watch?v=secret',
      outputDir: '/Users/hutson/Downloads',
      filename: 'private.mov',
      failureReason: 'Error at /Users/hutson/Downloads/private.mov from https://youtube.com/watch?v=secret'
    }
  })

  assert.equal(event.schemaVersion, 1)
  assert.equal(event.source, 'app')
  assert.equal(event.environment, 'development')
  assert.match(event.eventId, /^[0-9a-f-]{36}$/)
  assert.equal(event.properties.category, 'video')
  assert.equal(event.properties.downloadType, 'video_audio')
  assert.equal(event.properties.videoCount, 1)
  assert.equal(event.properties.audioCount, 1)
  assert.equal(event.properties.subtitleCount, 0)
  assert.equal(event.properties.thumbnailCount, 0)
  assert.equal(event.properties.metadataCount, 0)
  assert.equal(event.properties.transcodeCount, 1)
  assert.equal(event.properties.remuxCount, 1)
  assert.equal(event.properties.hasTranscodes, true)
  assert.equal(event.properties.sourceUrl, undefined)
  assert.equal(event.properties.outputDir, undefined)
  assert.equal(event.properties.filename, undefined)
  assert.equal(event.properties.failureReason.includes('/Users/'), false)
  assert.equal(event.properties.failureReason.includes('youtube.com'), false)
  assert.equal(event.properties.failureReason.includes('private.mov'), false)

  assert.deepEqual(sanitizeTelemetryProperties({
    localPath: '/tmp/private',
    windowTitle: 'Private Window',
    result: 'failed'
  }), { result: 'failed' })

  assert.equal(mapFailureCode('Updates are only available in packaged builds'), 'update_not_available')
  assert.equal(mapFailureCode('license activation failed'), 'activation_request_failed')
  assert.equal(mapFailureCode('network timeout while fetching update'), 'request_timeout')

  const feedback = buildFeedbackSubmission({
    category: 'update',
    message: 'The updater failed.',
    email: '',
    installId: 'install-123',
    licenseId: null,
    activationId: null,
    appVersion: '1.0.0',
    diagnostics: {
      appVersion: '1.0.0',
      osName: 'macOS',
      osVersion: '15.5',
      architecture: 'arm64',
      installId: 'install-123',
      licenseState: 'unlicensed',
      lastErrorMessage: 'Raw stack at /Users/hutson/Downloads/private.mov'
    }
  })

  assert.equal(feedback.schemaVersion, 1)
  assert.equal(feedback.category, 'update')
  assert.equal(feedback.email, null)
  assert.equal(feedback.diagnostics.lastErrorMessage.includes('/Users/'), false)
  assert.equal(feedback.diagnostics.lastErrorMessage.includes('private.mov'), false)

  const ipcHandlers = await readFile('src/main/ipc-handlers.ts', 'utf8')
  assert.match(
    ipcHandlers,
    /phase: 'video_info'/,
    'Video info load failures should emit privacy-safe error telemetry'
  )
  assert.match(
    ipcHandlers,
    /phase: 'playlist_info'/,
    'Playlist load failures should emit privacy-safe error telemetry'
  )
} finally {
  await rm(outdir, { recursive: true, force: true })
}
