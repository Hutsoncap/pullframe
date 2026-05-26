import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const extrasPanel = await readFile('src/renderer/src/components/ExtrasPanel.tsx', 'utf8')
const store = await readFile('src/renderer/src/stores/app-store.ts', 'utf8')
const mainHandlers = await readFile('src/main/ipc-handlers.ts', 'utf8')
const chapterExport = await readFile('src/main/ytdlp/chapter-export.ts', 'utf8')
const preloadTypes = await readFile('src/preload/index.d.ts', 'utf8')

assert.match(extrasPanel, /Chapter Markers/, 'Extras should expose a chapter marker section')
assert.match(extrasPanel, /No chapter markers found/, 'Extras should explain when a video has no exportable chapter markers')
assert.doesNotMatch(extrasPanel, /videoInfo\.chapters\.length > 0 && \(\s*<ChaptersCard/, 'Extras should not hide chapter marker availability completely')
assert.match(extrasPanel, /Premiere Pro Markers/, 'Extras should offer Adobe Premiere Pro marker export')
assert.match(extrasPanel, /Marker CSV import for Adobe Premiere Pro/, 'Premiere option should explain that it is importable marker CSV')
assert.match(extrasPanel, /chapters:premiere-csv/, 'Premiere marker option should use the chapter export key')
assert.match(store, /'chapters:premiere-csv'/, 'Store should support selecting Premiere chapter marker exports')
assert.match(store, /window\.api\.exportChapters/, 'Store should export chapters through IPC instead of yt-dlp media download')
assert.match(mainHandlers, /export-chapters/, 'Main process should expose chapter export IPC')
assert.match(mainHandlers, /generateChapterExport/, 'Main process should use the shared chapter export generator')
assert.match(chapterExport, /Marker Name\\tDescription\\tIn\\tOut\\tDuration\\tMarker Type/, 'Premiere export should include marker import columns')
assert.match(chapterExport, /case 'premiere-csv'/, 'Chapter exporter should support Premiere CSV')
assert.match(preloadTypes, /format: 'premiere-csv' \| 'edl' \| 'csv' \| 'txt'/, 'Preload types should expose Premiere chapter export format')
