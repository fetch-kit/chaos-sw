import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const execFileAsync = promisify(execFile)

test('init copies the standalone worker into a public directory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'chaos-sw-'))
  try {
    const target = path.join(directory, 'public')
    await execFileAsync(process.execPath, ['bin/chaos-sw.mjs', 'init', target])

    const [source, copied] = await Promise.all([
      readFile('public/chaos-sw.js'),
      readFile(path.join(target, 'chaos-sw.js')),
    ])
    expect(copied).toEqual(source)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
