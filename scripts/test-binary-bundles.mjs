import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'

const bundleScript = await readFile('scripts/download-binaries.mjs', 'utf8')
const macEntitlements = await readFile('build/entitlements.mac.plist', 'utf8')

assert.match(
  macEntitlements,
  /com\.apple\.security\.cs\.disable-library-validation/,
  'Signed macOS bundles must allow bundled yt-dlp to load its PyInstaller Python runtime'
)

assert.match(
  bundleScript,
  /--force/,
  'Bundled binary downloader should support --force so release builds can refresh latest assets'
)
assert.match(
  bundleScript,
  /process\.argv\.includes\('--force'\)/,
  'Bundled binary downloader should parse --force from argv'
)
assert.match(
  bundleScript,
  /request\.setTimeout/,
  'Bundled binary downloader should time out stalled release downloads'
)
assert.match(
  bundleScript,
  /writeBundleManifest/,
  'Bundled binary downloader should write a version manifest next to bundled tools'
)

const binaryManager = await readFile('src/main/ytdlp/binary-manager.ts', 'utf8')
assert.match(
  binaryManager,
  /readBundledVersions/,
  'Runtime binary status should read bundled versions from the manifest before running binaries'
)
assert.match(
  binaryManager,
  /bundledVersions\?\.ytdlp/,
  'yt-dlp bundled status should use the manifest version immediately'
)
assert.match(
  binaryManager,
  /bundledVersions\?\.ffmpeg/,
  'ffmpeg bundled status should use the manifest version immediately'
)
assert.match(
  binaryManager,
  /includeLatest = false/,
  'Binary status should not wait for online latest-release checks by default'
)
assert.match(
  binaryManager,
  /if \(includeLatest\)/,
  'Online latest-release checks should only run when explicitly requested'
)
assert.match(
  binaryManager,
  /latestReleaseTimeoutMs = 3000/,
  'yt-dlp update checks should use a short timeout so local tool versions do not sit missing at launch'
)
assert.match(
  binaryManager,
  /ffmpeg-static release tags are package\/build tags/,
  'ffmpeg update checks should not compare ffmpeg-static package tags to binary versions'
)
assert.match(
  binaryManager,
  /async function getLatestFfmpegVersion\(\): Promise<string \| null> \{[\s\S]*return null[\s\S]*\}/,
  'ffmpeg update availability should stay disabled until a real binary-version source is available'
)
assert.match(
  binaryManager,
  /readUserVersion/,
  'Runtime binary resolution should read local update version markers without executing a potentially broken local binary'
)
assert.match(
  binaryManager,
  /writeUserVersion/,
  'Local tool updates should record a version marker for future binary selection'
)
assert.match(
  binaryManager,
  /const userVersion = await readUserVersion\(userDirName\)/,
  'Runtime binary resolution should not run local updated binaries to decide whether to use them'
)
assert.match(
  binaryManager,
  /!userVersion \|\| isNewerVersion\(userVersion, bundledVersion\)/,
  'Runtime binary resolution should fall back to the bundled binary when a local update cannot report its version'
)
assert.match(
  binaryManager,
  /return \{ path: bundledPath, source: 'bundled' \}/,
  'Runtime binary resolution should prefer a newer bundled app binary over an older local update'
)
assert.match(
  binaryManager,
  /status\.ytdlpVersion = latestYtdlpVersion/,
  'yt-dlp status should fall back to the latest release version if the version command is slow at launch'
)
assert.match(
  binaryManager,
  /process\.cwd\(\), 'resources', 'bin'/,
  'Dev bundled binary lookup should use the repo resources/bin directory'
)
assert.match(
  binaryManager,
  /let cachedYtdlpPath: Promise<string> \| null = null/,
  'yt-dlp path resolution should be cached after the first successful lookup'
)
assert.match(
  binaryManager,
  /let cachedFfmpegPath: Promise<string> \| null = null/,
  'ffmpeg path resolution should be cached after the first successful lookup'
)
assert.match(
  binaryManager,
  /cachedYtdlpPath = resolveYtdlpPath\(\)\.catch/,
  'yt-dlp path cache should not cache failed lookups'
)
assert.match(
  binaryManager,
  /cachedFfmpegPath = resolveFfmpegPath\(\)\.catch/,
  'ffmpeg path cache should not cache failed lookups'
)
assert.match(
  binaryManager,
  /cachedYtdlpPath = Promise\.resolve\(updatedPath\)/,
  'yt-dlp update should switch future work to the updated local binary'
)
assert.match(
  binaryManager,
  /cachedFfmpegPath = Promise\.resolve\(updatedPath\)/,
  'ffmpeg update should switch future work to the updated local binary'
)
assert.match(
  binaryManager,
  /cachedYtdlpPath = null[\s\S]*return getBinaryStatus\(\)/,
  'Switching back to bundled yt-dlp should clear the cached local path'
)
assert.match(
  binaryManager,
  /cachedFfmpegPath = null[\s\S]*return getBinaryStatus\(\)/,
  'Switching back to bundled ffmpeg should clear the cached local path'
)

await access('resources/bin/darwin-arm64/yt-dlp_macos', constants.X_OK)
await access('resources/bin/darwin-arm64/ffmpeg', constants.X_OK)

const manifest = JSON.parse(await readFile('resources/bin/darwin-arm64/versions.json', 'utf8'))
assert.equal(typeof manifest.ytdlp, 'string', 'Bundled version manifest should include yt-dlp')
assert.equal(typeof manifest.ffmpeg, 'string', 'Bundled version manifest should include ffmpeg')
