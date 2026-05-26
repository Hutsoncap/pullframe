import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const store = await readFile('src/renderer/src/stores/app-store.ts', 'utf8')
const formatTable = await readFile('src/renderer/src/components/FormatTable.tsx', 'utf8')
const settingsPanel = await readFile('src/renderer/src/components/SettingsPanel.tsx', 'utf8')
const rendererTypes = await readFile('src/renderer/src/types/index.ts', 'utf8')
const preloadTypes = await readFile('src/preload/index.d.ts', 'utf8')
const mainTypes = await readFile('src/main/ytdlp/types.ts', 'utf8')
const downloader = await readFile('src/main/ytdlp/downloader.ts', 'utf8')
const telemetry = await readFile('src/renderer/src/telemetry/download-workflow.ts', 'utf8')

assert.match(store, /autoIncludeAudioWithProfessionalTranscodes: true/, 'Professional transcodes should include audio by default')
assert.match(store, /setAutoIncludeAudioWithProfessionalTranscodes/, 'Store should expose a setting setter for professional audio merge')
assert.ok(store.includes('`${formatId}+bestaudio/best`'), 'Video-only ProRes/DNxHR requests should merge best audio when enabled')
assert.match(store, /includeBestAudio: true/, 'Download request should mark explicit best-audio inclusion')

assert.match(formatTable, /Merge best audio/, 'Video Only section should expose a Merge best audio toggle')
assert.match(formatTable, /professionalAudioMerge/, 'FormatTable should wire the merge toggle for professional transcodes')
assert.match(formatTable, /videoTranscode\.format === 'prores' \\|\\| videoTranscode\.format === 'dnxhr'/, 'Merge toggle should only be active for professional transcodes')

assert.match(settingsPanel, /Automatically include audio with professional transcodes/, 'Settings should expose the default professional audio merge setting')

assert.match(rendererTypes, /includeBestAudio\?: boolean/, 'Renderer DownloadRequest should include the best-audio marker')
assert.match(preloadTypes, /includeBestAudio\?: boolean/, 'Preload DownloadRequest should include the best-audio marker')
assert.match(mainTypes, /includeBestAudio\?: boolean/, 'Main DownloadRequest should include the best-audio marker')

assert.match(downloader, /'-map', '0:v:0', '-map', '0:a\?'/, 'Professional transcodes should keep optional audio from merged inputs')
assert.match(downloader, /'-c:a', 'pcm_s16le'/, 'Professional transcodes should emit broadly editable PCM audio')

assert.match(telemetry, /audioCount: isMerged \? 1 : 0/, 'Telemetry should count merged professional audio coarsely')
assert.doesNotMatch(telemetry, /sourceUrl|fileName|filename|mediaTitle|videoTitle|channelName/i, 'Telemetry workflow fields should not include identifying media details')
