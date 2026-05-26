import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readme = await readFile('README.md', 'utf8')

assert.match(readme, /^# Pullframe/m, 'Public README should identify the project')
assert.match(readme, /https:\/\/pullframe\.app/, 'Public README should link to the website')
assert.match(readme, /npm ci --legacy-peer-deps/, 'Public README should include reproducible dependency install instructions')
assert.match(readme, /npm run dev/, 'Public README should include local dev instructions')
assert.match(readme, /npm run package:mac/, 'Public README should include macOS packaging instructions')
assert.match(readme, /Source-built apps are unlocked/, 'Public README should explain source-built license behavior')
assert.match(readme, /official update/, 'Public README should explain that official updates return to the official license and trial path')
assert.match(readme, /GPL-3\.0/, 'Public README should state the GPL-3.0 license')

const forbiddenPublicReadmeTerms = [
  ['For', 'gejo'].join(''),
  ['git', 'htsn', 'io'].join('.'),
  ['APPLE', 'APP', 'SPECIFIC', 'PASSWORD'].join('_'),
  ['PULLFRAME', 'NEXUS', 'PASSWORD'].join('_'),
  ['Developer', 'ID', 'Application'].join(' ')
]

for (const term of forbiddenPublicReadmeTerms) {
  assert.doesNotMatch(
    readme,
    new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'Public README should not expose private release infrastructure or signing details'
  )
}
