'use strict'

const { chmod, lstat, mkdir } = require('node:fs/promises')
const path = require('node:path')
const { run } = require('./tool')
const { binaryName } = require('./contracts')

async function extractBinary(archivePath, destination, target, runCommand = run) {
  const binary = binaryName(target)
  const compressed = archivePath.endsWith('.tar.gz')
  const listing = runCommand('tar', [compressed ? '-tzf' : '-tf', archivePath]).output
  validateEntries(listing.split(/\r?\n/u).filter(Boolean), binary)

  await mkdir(destination, { recursive: true })
  runCommand('tar', [compressed ? '-xzf' : '-xf', archivePath, '-C', destination, binary])

  const binaryPath = path.join(destination, binary)
  const metadata = await lstat(binaryPath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Archive member ${binary} is not a regular file`)
  }
  if (!target.endsWith('-windows-msvc')) await chmod(binaryPath, 0o755)
  return binaryPath
}

function validateEntries(entries, binary) {
  const names = new Set()
  const caseInsensitiveNames = new Set()

  for (const entry of entries) {
    if (
      entry.includes('\\') ||
      entry.includes('\0') ||
      path.posix.isAbsolute(entry) ||
      entry.split('/').includes('..')
    ) {
      throw new Error(`Unsafe archive entry ${JSON.stringify(entry)}`)
    }
    if (names.has(entry) || caseInsensitiveNames.has(entry.toLowerCase())) {
      throw new Error(`Duplicate archive entry ${JSON.stringify(entry)}`)
    }
    names.add(entry)
    caseInsensitiveNames.add(entry.toLowerCase())
  }

  if (!names.has(binary)) {
    throw new Error(`Archive does not contain ${binary}`)
  }
}

module.exports = { extractBinary, validateEntries }
