'use strict'

const assert = require('node:assert/strict')
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { addPath, input, setOutput } = require('../src/github')

test('reads inputs and writes explicit workflow command files', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-zrail-github-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  const output = path.join(root, 'output')
  const pathFile = path.join(root, 'path')
  await Promise.all([writeFile(output, ''), writeFile(pathFile, '')])
  const environment = {
    GITHUB_OUTPUT: output,
    GITHUB_PATH: pathFile,
    INPUT_VERSION: '0.0.2'
  }

  assert.equal(input('version', environment), '0.0.2')
  setOutput('target', 'x86_64-unknown-linux-gnu', environment)
  addPath('/tool cache/zrail', environment)

  assert.match(await readFile(output, 'utf8'), /^target=x86_64-unknown-linux-gnu\r?\n$/u)
  assert.match(await readFile(pathFile, 'utf8'), /^\/tool cache\/zrail\r?\n$/u)
})

test('rejects multiline workflow command values', () => {
  assert.throws(() => addPath('/safe\nunsafe', { GITHUB_PATH: '/tmp/unused' }), /multiline/u)
})

