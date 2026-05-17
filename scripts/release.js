#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const bump = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/release.js [patch|minor|major]')
  process.exit(1)
}

// ─── Check clean working tree ─────────────────────────────────────────────────

const status = execSync('git status --porcelain').toString().trim()
if (status) {
  console.error('Working tree is not clean. Commit or stash changes first.')
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

// ─── Bump ─────────────────────────────────────────────────────────────────────

const rootPkgPath = resolve(root, 'package.json')
const rootPkg = readJson(rootPkgPath)
const current = rootPkg.version
const next = bumpVersion(current, bump)

console.log(`Bumping ${current} → ${next} (${bump})`)

rootPkg.version = next
writeJson(rootPkgPath, rootPkg)

const pkgPaths = readdirSync(resolve(root, 'packages')).map((name) =>
  join('packages', name, 'package.json')
)

for (const rel of pkgPaths) {
  const path = resolve(root, rel)
  const pkg = readJson(path)
  pkg.version = next
  writeJson(path, pkg)
  console.log(`  updated ${rel}`)
}

// ─── Commit, tag, push ────────────────────────────────────────────────────────

execSync(`git add package.json ${pkgPaths.join(' ')}`, { cwd: root })
execSync(`git commit -m "chore: release v${next}"`, { cwd: root, stdio: 'inherit' })
execSync(`git tag v${next}`, { cwd: root })
execSync(`git push origin main --tags`, { cwd: root, stdio: 'inherit' })

console.log(`\nReleased v${next} — publish workflow triggered.`)
