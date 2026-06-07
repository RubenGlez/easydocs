#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const bump = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/release.mjs [patch|minor|major]')
  process.exit(1)
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}

function get(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
}

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

const branch = get('git rev-parse --abbrev-ref HEAD')
if (branch !== 'main') {
  console.error(`Must be on main (currently on ${branch})`)
  process.exit(1)
}

const status = get('git status --porcelain')
if (status) {
  console.error('Working tree is dirty — commit or stash changes first')
  process.exit(1)
}

run('git fetch origin main')
const behind = get('git rev-list HEAD..origin/main --count')
if (behind !== '0') {
  console.error(`Branch is ${behind} commit(s) behind origin/main — pull first`)
  process.exit(1)
}

run('pnpm --filter \'./packages/*\' build')
run('pnpm lint')
run('pnpm typecheck')
run('pnpm test')
run('pnpm audit --audit-level=high --prod')

const rootPkgPath = resolve(root, 'package.json')
const rootPkg = readJson(rootPkgPath)
const current = rootPkg.version
const next = bumpVersion(current, bump)

console.log(`Bumping ${current} → ${next} (${bump})`)

rootPkg.version = next
writeJson(rootPkgPath, rootPkg)

const pkgPaths = [
  ...readdirSync(resolve(root, 'packages')).map((name) => join('packages', name, 'package.json')),
  join('apps', 'dashboard', 'package.json'),
]

for (const rel of pkgPaths) {
  const path = resolve(root, rel)
  const pkg = readJson(path)
  pkg.version = next
  writeJson(path, pkg)
  console.log(`  updated ${rel}`)
}

run(`git add package.json ${pkgPaths.join(' ')}`)
run(`git commit -m "v${next}"`)
run(`git tag v${next}`)
run('git push origin main --tags')

run('pnpm publish -r --access public --no-git-checks --filter \'./packages/*\' --filter \'@easydocs/dashboard\'')
