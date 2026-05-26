import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile('src/main/app-updater.ts', 'utf8')

assert.match(
  source,
  /https:\/\/nexus\.htsn\.io\/repository\/raw-hosted\/pullframe/,
  'Default update feed should use the public Nexus raw-hosted release feed'
)

assert.match(
  source,
  /return `\$\{pullframeUpdateFeedBaseUrl\}\/\$\{getPullframeUpdateChannel\(version\)\}\/`/,
  'Update feed URLs should include the stable/beta channel directory'
)

assert.match(
  source,
  /url: getPullframeUpdateFeedUrl\(app\.getVersion\(\)\)/,
  'electron-updater should be configured with the channel feed URL, not the unqualified API root'
)

assert.doesNotMatch(
  source,
  /updates\.pullframe\.app\/api\/updates/,
  'Update checks should not request latest-mac.yml from the protected website API route'
)
