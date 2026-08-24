'use strict'

const assert = require('node:assert/strict')
const { writeFileSync } = require('node:fs')
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { extractBinary, validateEntries } = require('../src/archive')

test('accepts the release layout and rejects unsafe entries', () => {
  assert.doesNotThrow(() => validateEntries(['zrail', 'LICENSE', 'README.md'], 'zrail'))
  assert.throws(() => validateEntries(['../zrail'], 'zrail'), /Unsafe/u)
  assert.throws(() => validateEntries(['/zrail'], 'zrail'), /Unsafe/u)
  assert.throws(() => validateEntries(['dir\\zrail'], 'zrail'), /Unsafe/u)
  assert.throws(() => validateEntries(['zrail', 'ZRAIL'], 'zrail'), /Duplicate/u)
  assert.throws(() => validateEntries(['README.md'], 'zrail'), /does not contain/u)
})

test('lists the archive and extracts only the expected binary', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-zrail-archive-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  const archive = path.join(root, 'release.tar.gz')
  const destination = path.join(root, 'out')
  const calls = []

  const binary = await extractBinary(
    archive,
    destination,
    'x86_64-unknown-linux-gnu',
    (command, args) => {
      calls.push([command, args])
      if (args[0] === '-tzf') return { output: 'zrail\nLICENSE\nREADME.md\n' }
      writeFileSync(path.join(destination, 'zrail'), 'binary')
      return { output: '' }
    }
  )

  assert.equal(await readFile(binary, 'utf8'), 'binary')
  assert.deepEqual(calls[0], ['tar', ['-tzf', archive]])
  assert.deepEqual(calls[1], [
    'tar',
    ['-xzf', archive, '-C', destination, 'zrail']
  ])
})
