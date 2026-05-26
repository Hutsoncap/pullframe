#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const root = process.cwd()
const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pullframe-ci-release-scripts-'))

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8'
  })
}

function runAsync(command, args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('close', status => {
      resolve({ status, stdout, stderr })
    })
  })
}

async function makeRepo(name, version = '9.9.9') {
  const repo = path.join(tmpDir, name)
  await mkdir(path.join(repo, 'scripts'), { recursive: true })
  await writeFile(path.join(repo, 'package.json'), JSON.stringify({ version }, null, 2))
  await cp(path.join(root, 'scripts/ci-release-preflight.sh'), path.join(repo, 'scripts/ci-release-preflight.sh'))
  await cp(path.join(root, 'scripts/write-release-evidence.mjs'), path.join(repo, 'scripts/write-release-evidence.mjs'))
  await chmod(path.join(repo, 'scripts/ci-release-preflight.sh'), 0o755)
  await chmod(path.join(repo, 'scripts/write-release-evidence.mjs'), 0o755)
  assert.equal(run('git', ['init', '-b', 'main'], { cwd: repo }).status, 0)
  assert.equal(run('git', ['config', 'user.email', 'test@example.invalid'], { cwd: repo }).status, 0)
  assert.equal(run('git', ['config', 'user.name', 'Release Test'], { cwd: repo }).status, 0)
  assert.equal(run('git', ['add', '.'], { cwd: repo }).status, 0)
  assert.equal(run('git', ['commit', '-m', 'initial'], { cwd: repo }).status, 0)
  return repo
}

try {
  const noTagRepo = await makeRepo('no-tag')
  const noTag = run('scripts/ci-release-preflight.sh', [], { cwd: noTagRepo })
  assert.notEqual(noTag.status, 0)
  assert.match(noTag.stderr, /exact git tag/)

  const mismatchRepo = await makeRepo('mismatch')
  assert.equal(run('git', ['tag', 'v9.9.8'], { cwd: mismatchRepo }).status, 0)
  const mismatch = run('scripts/ci-release-preflight.sh', [], { cwd: mismatchRepo })
  assert.notEqual(mismatch.status, 0)
  assert.match(mismatch.stderr, /does not match package version/)

  const evidenceRepo = await makeRepo('evidence', '9.9.9')
  assert.equal(run('git', ['tag', 'v9.9.9'], { cwd: evidenceRepo }).status, 0)
  const dist = path.join(evidenceRepo, 'dist')
  await mkdir(dist, { recursive: true })
  const artifacts = {
    'Pullframe-9.9.9-arm64.dmg': 'fake dmg',
    'Pullframe-9.9.9-arm64.zip': 'fake zip',
    'Pullframe-9.9.9-arm64.dmg.blockmap': 'fake dmg blockmap',
    'Pullframe-9.9.9-arm64.zip.blockmap': 'fake zip blockmap',
    'latest-mac.yml': 'version: 9.9.9\npath: Pullframe-9.9.9-arm64.zip\n',
    'release-notes-v9.9.9.md': '# Pullframe 9.9.9\n',
    'release-notes-v9.9.9.json': '{"version":"9.9.9"}',
    SHA256SUMS: 'placeholder\n'
  }
  for (const [name, content] of Object.entries(artifacts)) {
    await writeFile(path.join(dist, name), content)
  }
  const evidence = run(process.execPath, ['scripts/write-release-evidence.mjs'], { cwd: evidenceRepo })
  assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout)
  const evidenceText = await readFile(path.join(dist, 'release-evidence-v9.9.9.md'), 'utf8')
  assert.match(evidenceText, /Version: 9\.9\.9/)
  assert.match(evidenceText, /Tag: v9\.9\.9/)
  assert.match(evidenceText, /Pullframe-9\.9\.9-arm64\.dmg/)
  const expectedDmgSha = createHash('sha256').update('fake dmg').digest('hex')
  assert.match(evidenceText, new RegExp(expectedDmgSha))

  const server = createServer((req, res) => {
    const url = req.url || '/'
    if (url.endsWith('/latest-mac.yml')) {
      res.writeHead(200, { 'content-type': 'text/yaml' })
      res.end('version: 9.9.8\npath: Pullframe-9.9.8-arm64.zip\n')
      return
    }
    if (req.method === 'HEAD') {
      res.writeHead(200)
      res.end()
      return
    }
    if (url.endsWith('/SHA256SUMS')) {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('abc  Pullframe-9.9.9-arm64.dmg\n')
      return
    }
    res.writeHead(200)
    res.end('{}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`
  const feeds = await runAsync('scripts/verify-release-feeds.sh', [], {
    env: {
      PULLFRAME_VERSION: '9.9.9',
      PULLFRAME_NEXUS_RELEASE_BASE_URL: `${base}/v9.9.9`,
      PULLFRAME_NEXUS_CHANNEL_BASE_URL: `${base}/stable`,
      PULLFRAME_NEXUS_LATEST_BASE_URL: `${base}/latest`
    }
  })
  server.close()
  assert.notEqual(feeds.status, 0)
  assert.match(feeds.stderr, /does not report version 9\.9\.9/)
} finally {
  await rm(tmpDir, { recursive: true, force: true })
}

console.log('test-ci-release-scripts passed')
