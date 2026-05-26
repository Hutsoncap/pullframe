import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile('src/renderer/src/App.tsx', 'utf8')
const store = await readFile('src/renderer/src/stores/app-store.ts', 'utf8')
const types = await readFile('src/renderer/src/types/index.ts', 'utf8')
const mainTypes = await readFile('src/main/ytdlp/types.ts', 'utf8')
const preloadTypes = await readFile('src/preload/index.d.ts', 'utf8')
const fetcher = await readFile('src/main/ytdlp/format-fetcher.ts', 'utf8')
const tabBar = await readFile('src/renderer/src/components/TabBar.tsx', 'utf8')
const smartInput = await readFile('src/renderer/src/components/SmartInput.tsx', 'utf8')

assert.match(types, /interface PlaylistMetadata/, 'Renderer should expose playlist metadata')
assert.match(mainTypes, /interface PlaylistFetchResult/, 'Main process should return playlist entries with metadata')
assert.match(preloadTypes, /fetchPlaylist\(url: string, cookieBrowser[?]: CookieBrowser\): Promise<PlaylistFetchResult>/, 'Preload API should return playlist metadata')

assert.match(fetcher, /--dump-single-json/, 'Playlist fetch should request a single JSON payload so playlist-level metadata is available')
assert.match(fetcher, /fetchPlaylistEntryLines/, 'Playlist fetch should fall back to line-delimited entries when single JSON has no entries')
assert.match(fetcher, /channelName:/, 'Playlist fetch should derive channel metadata')
assert.match(fetcher, /playlistName:/, 'Playlist fetch should derive playlist metadata')

assert.match(store, /playlistMetadata: PlaylistMetadata \| null/, 'Tabs should store playlist metadata')
assert.match(store, /normalizePlaylistFetchResult/, 'Store should normalize old and new playlist IPC result shapes')

assert.match(app, /playlistMetadata=\{tab\?\.playlistMetadata/, 'Playlist view should receive metadata from the tab')
assert.match(app, /const normalizedEntries = Array\.isArray\(entries\)/, 'Playlist view should defensively normalize entries before filtering')
assert.match(app, /playlistTitle/, 'Playlist header should display derived playlist metadata')
assert.match(app, /channelName/, 'Playlist header should display derived channel metadata')
assert.match(app, /No videos found in this playlist/, 'Playlist view should not render blank when no entries are returned')
assert.match(app, /findExistingVideoTabId/, 'Playlist item clicks should find existing video tabs before adding a tab')
assert.match(app, /entry\.id/, 'Playlist item clicks should key the relationship by entry video id')
assert.match(app, /!tab\.playlistEntries/, 'Playlist tab reuse should not treat the playlist tab itself as an open video tab')
assert.match(app, /openEntryIds/, 'Playlist rows should compute which entries are already open in tabs')
assert.match(app, />\s*Open\s*</, 'Playlist rows should show an indicator for entries already open in a tab')
assert.match(app, /<\/div>\s*\{isOpen \? \(/, 'Playlist row open indicator should replace the far-right action icon')
assert.doesNotMatch(app, /useAppStore\(\(s\) => s\.openPlaylistEntry\)/, 'Playlist view should not depend on a new store action for item clicks')
assert.doesNotMatch(app, /Channel \/ Playlist/, 'Playlist header should not use the generic Channel / Playlist label')

assert.match(tabBar, /playlistMetadata/, 'Playlist tab titles should use playlist metadata when present')
assert.match(tabBar, /title=\{title \?\? displayTitle\}/, 'Tabs should expose the full title as a hover tooltip')
assert.match(tabBar, /tab\.playlistEntries \? \(/, 'Playlist tabs should render a playlist icon')
assert.match(tabBar, /<span className="text-\[11px\] font-medium min-w-0 truncate leading-5">/, 'Tab titles should use enough line height to avoid clipping descenders')
assert.match(smartInput, /z-10[\s\S]*animate-spin/, 'SmartInput loading spinner should render above the blurred input layer')
