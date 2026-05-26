#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pullframe-release-notes-'))

try {
  const result = spawnSync(process.execPath, ['scripts/build-release-notes.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PULLFRAME_DIST_DIR: tmpDir,
      PULLFRAME_RELEASE_NOTES_GENERATED_AT: '2026-05-24T00:00:00.000Z'
    },
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)

  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const markdown = await readFile(path.join(tmpDir, `release-notes-v${packageJson.version}.md`), 'utf8')
  const json = JSON.parse(await readFile(path.join(tmpDir, `release-notes-v${packageJson.version}.json`), 'utf8'))
  const expectedTitle = `Pullframe ${packageJson.version}`

  assert.match(markdown, new RegExp(`^# ${expectedTitle.replaceAll('.', '\\.')}$`, 'm'))
  assert.equal(json.version, packageJson.version)
  assert.equal(json.title, expectedTitle)
  assert.equal(json.markdown, markdown)
  assert.equal(json.generatedAt, '2026-05-24T00:00:00.000Z')

  const mismatch = spawnSync(process.execPath, ['scripts/build-release-notes.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PULLFRAME_VERSION: '9.9.9',
      PULLFRAME_DIST_DIR: tmpDir
    },
    encoding: 'utf8'
  })
  assert.notEqual(mismatch.status, 0)
  assert.match(mismatch.stderr, /does not match package version/)
} finally {
  await rm(tmpDir, { recursive: true, force: true })
}

console.log('test-release-notes passed')
