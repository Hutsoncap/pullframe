import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const subtitleList = await readFile('src/renderer/src/components/SubtitleList.tsx', 'utf8')
const store = await readFile('src/renderer/src/stores/app-store.ts', 'utf8')
const downloader = await readFile('src/main/ytdlp/downloader.ts', 'utf8')
const mainTypes = await readFile('src/main/ytdlp/types.ts', 'utf8')
const rendererTypes = await readFile('src/renderer/src/types/index.ts', 'utf8')
const preloadTypes = await readFile('src/preload/index.d.ts', 'utf8')

assert.match(subtitleList, /Subtitle output/, 'Subtitle tab should expose an inline output format control')
assert.match(subtitleList, /\(\['original', 'srt', 'vtt', 'ass'\] as const\)/, 'Subtitle output should support original, srt, vtt, and ass')
assert.match(subtitleList, /setSubtitleFormat\(fmt\)/, 'Subtitle conversion control should update the shared subtitle output format')
assert.match(subtitleList, /fmt === 'original' \? 'Original'/, 'Subtitle output control should label the original source option clearly')
assert.match(subtitleList, /subtitleFormat === 'original' \|\| row\.ext === subtitleFormat/, 'Subtitle rows should preserve source extension for original output')
assert.match(subtitleList, /\$\{row\.ext\} → \$\{subtitleFormat\}/, 'Subtitle rows should show source-to-output conversion when converting')

assert.match(store, /subtitleSourceFormat: formatSubtitleSourcePreference\(manualSourceFormats\)/, 'Manual subtitle requests should preserve source format preference')
assert.match(store, /subtitleSourceFormat: formatSubtitleSourcePreference\(autoSourceFormats\)/, 'Auto subtitle requests should preserve source format preference')
assert.match(store, /return formats\.length === 1 \? `\$\{formats\[0\]\}\/best` : 'best'/, 'Mixed subtitle source formats should fall back to best source')
assert.match(store, /subtitleFormat: 'original' as const/, 'Original subtitle output should be the default')
assert.match(store, /formatSubtitleOutputLabel/, 'Download queue labels should show original source format when not converting')

assert.match(downloader, /'--sub-format', request\.subtitleSourceFormat \?\? 'best'/, 'Downloader should download available source subtitles')
assert.match(downloader, /request\.subtitleFormat && request\.subtitleFormat !== 'original'/, 'Downloader should skip conversion for original subtitle output')
assert.match(downloader, /'--convert-subs', request\.subtitleFormat/, 'Downloader should convert subtitles to requested non-original output format')

assert.match(mainTypes, /subtitleSourceFormat\?: string/, 'Main DownloadRequest should include subtitle source format')
assert.match(rendererTypes, /subtitleSourceFormat\?: string/, 'Renderer DownloadRequest should include subtitle source format')
assert.match(preloadTypes, /subtitleSourceFormat\?: string/, 'Preload DownloadRequest should include subtitle source format')
