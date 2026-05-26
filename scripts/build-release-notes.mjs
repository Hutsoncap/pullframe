#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function fail(message) {
  console.error(message)
  process.exit(1)
}

const root = process.cwd()
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const version = process.env.PULLFRAME_VERSION || packageJson.version

if (!version || typeof version !== 'string') {
  fail('Could not determine release version.')
}

if (version !== packageJson.version) {
  fail(`Release notes version ${version} does not match package version ${packageJson.version}.`)
}

const sourcePath = path.join(root, 'release-notes', `v${version}.md`)
let markdown
try {
  markdown = await readFile(sourcePath, 'utf8')
} catch {
  fail(`Release notes source not found: ${path.relative(root, sourcePath)}`)
}

const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
if (!title) {
  fail(`Release notes must start with an H1 title: ${path.relative(root, sourcePath)}`)
}

const distDir = process.env.PULLFRAME_DIST_DIR
  ? path.resolve(process.env.PULLFRAME_DIST_DIR)
  : path.join(root, 'dist')
await mkdir(distDir, { recursive: true })

const mdName = `release-notes-v${version}.md`
const jsonName = `release-notes-v${version}.json`
const generatedAt = process.env.PULLFRAME_RELEASE_NOTES_GENERATED_AT || new Date().toISOString()
const payload = {
  version,
  title,
  markdown,
  generatedAt
}

await writeFile(path.join(distDir, mdName), markdown)
await writeFile(path.join(distDir, jsonName), `${JSON.stringify(payload, null, 2)}\n`)

console.log(`release_notes_markdown=${path.join(distDir, mdName)}`)
console.log(`release_notes_json=${path.join(distDir, jsonName)}`)
