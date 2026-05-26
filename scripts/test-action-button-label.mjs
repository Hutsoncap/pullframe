import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const store = await readFile('src/renderer/src/stores/app-store.ts', 'utf8')
const statusBar = await readFile('src/renderer/src/components/UnifiedStatusBar.tsx', 'utf8')

assert.match(store, /export type SelectedActionKind = 'download' \| 'mux' \| 'convert' \| 'transcode'/, 'Store should classify selected action kinds')
assert.match(store, /selectedActionSummary: \(\) => SelectedActionSummary/, 'Store should expose selected action summary')
assert.match(store, /selectedFormatNeedsTranscode/, 'Selection summary should detect video transcodes')
assert.match(store, /selectedMergePresetActionKind/, 'Selection summary should classify synthetic best-quality merged presets')
assert.match(store, /formatId\.startsWith\('bestvideo\['\)/, 'Selection summary should not skip bestvideo merged preset selections')
assert.match(store, /selectedFormatNeedsConvert/, 'Selection summary should detect audio converts')
assert.match(store, /tab\.selectedSubtitles\.size > 0 && state\.subtitleFormat !== 'original'/, 'Selection summary should detect subtitle converts')
assert.match(store, /Transcode \+ Download/, 'Transcode selections should label the action clearly')
assert.match(store, /Convert \+ Download/, 'Convert selections should label the action clearly')
assert.match(store, /Mux \+ Download/, 'Mux selections should label the action clearly')

assert.match(statusBar, /selectedActionSummary = useAppStore/, 'Status bar should read selected action summary')
assert.match(statusBar, /\{actionSummary\.label\} \(\{selectedCount\}\)/, 'Status bar button should use dynamic action label')
assert.match(statusBar, /getActionButtonClass\(actionSummary\.kind\)/, 'Status bar button should use action-specific styling')
assert.match(statusBar, /bg-orange-500\/20/, 'Transcode action should use transcode orange styling')
assert.match(statusBar, /bg-amber-500\/20/, 'Convert action should use convert amber styling')
assert.match(statusBar, /bg-purple-500\/20/, 'Mux action should use mux purple styling')
