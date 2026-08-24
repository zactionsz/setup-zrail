'use strict'

const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const { spawnSync } = require('node:child_process')

async function sha256File(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

function verifyVersion(binaryPath, version, runCommand = run) {
  const result = runCommand(binaryPath, ['--version'])
  const actual = result.output.trim()
  const expected = `zrail ${version}`
  if (actual !== expected) {
    throw new Error(`zrail reported ${JSON.stringify(actual)} instead of ${expected}`)
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  })
  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`)
  }
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}: ${output.trim()}`)
  }
  return { output }
}

module.exports = { run, sha256File, verifyVersion }
