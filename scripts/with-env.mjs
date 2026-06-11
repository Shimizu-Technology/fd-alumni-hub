#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = resolve(repoRoot, 'apps/web')
const mode = process.env.NODE_ENV || 'development'

function parseDotenv(content) {
  const env = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue

    const [, key, rawValue] = match
    let value = rawValue.trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const commentIndex = value.indexOf(' #')
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trim()
    }

    env[key] = value
  }

  return env
}

function loadEnvFile(path, target) {
  if (!existsSync(path)) return
  Object.assign(target, parseDotenv(readFileSync(path, 'utf8')))
}

const loaded = {}
for (const root of [repoRoot, appRoot]) {
  loadEnvFile(resolve(root, '.env'), loaded)
  loadEnvFile(resolve(root, `.env.${mode}`), loaded)
  if (mode !== 'test') loadEnvFile(resolve(root, '.env.local'), loaded)
  loadEnvFile(resolve(root, `.env.${mode}.local`), loaded)
}

const env = { ...loaded, ...process.env }
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Usage: node scripts/with-env.mjs <command> [...args]')
  process.exit(1)
}

const result = spawnSync(args[0], args.slice(1), {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 0)
