#!/usr/bin/env node
import assert from 'node:assert/strict'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()

const success = spawnSync(process.execPath, ['scripts/verify-public-export.mjs'], {
  cwd: root,
  encoding: 'utf8'
})
assert.equal(success.status, 0, success.stderr || success.stdout)
assert.match(success.stdout, /verify-public-export passed/)

const tmpDir = await mkdtempCompat()
try {
  await cp(path.join(root, 'public-export-manifest.json'), path.join(tmpDir, 'public-export-manifest.json'))
  await cp(path.join(root, 'LICENSE'), path.join(tmpDir, 'LICENSE'))
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  await writeFile(path.join(tmpDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
  await writeFile(path.join(tmpDir, 'package-lock.json'), `${JSON.stringify({ name: 'pullframe', version: packageJson.version }, null, 2)}\n`)
  await writeFile(path.join(tmpDir, 'README.md'), '# Pullframe\n')
  await mkdir(path.join(tmpDir, 'src'), { recursive: true })
  const blockedName = ['Ico', 'nik'].join('')
  await writeFile(path.join(tmpDir, 'src', 'leak.ts'), `export const oldInternalName = "${blockedName}"\n`)

  const failure = spawnSync(process.execPath, [path.join(root, 'scripts/verify-public-export.mjs'), tmpDir], {
    cwd: root,
    encoding: 'utf8'
  })
  assert.notEqual(failure.status, 0)
  assert.match(failure.stderr, new RegExp(blockedName))
} finally {
  await rm(tmpDir, { recursive: true, force: true })
}

console.log('test-public-export passed')

async function mkdtempCompat() {
  const { mkdtemp } = await import('node:fs/promises')
  return mkdtemp(path.join(os.tmpdir(), 'pullframe-public-export-'))
}
