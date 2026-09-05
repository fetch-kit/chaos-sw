#!/usr/bin/env node

import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , command, targetDirectory] = process.argv

if (command !== 'init' || !targetDirectory) {
  console.error('Usage: chaos-sw init <public-directory>')
  process.exitCode = 1
} else {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const source = path.join(packageRoot, 'public', 'chaos-sw.js')
  const target = path.resolve(targetDirectory, 'chaos-sw.js')

  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(source, target)
  console.log(`Copied chaos-sw Service Worker to ${target}`)
}
