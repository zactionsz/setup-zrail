'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const {
  archiveName,
  binaryName,
  installDirectory,
  releaseUrl,
  requireSha256,
  requireVersion,
  resolveTarget
} = require('../src/contracts')

const VERSION = '0.0.2'
const SHA256 = 'FB535CF8A72CF15995F0C4D2EA640629624B300736C67C7961E058F4A12419D9'

test('normalizes exact public inputs', () => {
  assert.equal(requireVersion(` ${VERSION} `), VERSION)
  assert.equal(requireSha256(` ${SHA256} `), SHA256.toLowerCase())
})

test('rejects floating versions, paths, and malformed hashes', () => {
  assert.throws(() => requireVersion('latest'), /exact stable version/u)
  assert.throws(() => requireVersion('v0.0.2'), /exact stable version/u)
  assert.throws(() => requireVersion('../0.0.2'), /exact stable version/u)
  assert.throws(() => requireVersion('0.0.2-rc.1'), /exact stable version/u)
  assert.throws(() => requireSha256('abc'), /64 hexadecimal/u)
})

test('maps every supported zrail release target', () => {
  const glibc = { getReport: () => ({ header: { glibcVersionRuntime: '2.39' } }) }
  const musl = { getReport: () => ({ header: {} }) }
  assert.equal(resolveTarget('linux', 'x64', glibc), 'x86_64-unknown-linux-gnu')
  assert.equal(resolveTarget('linux', 'arm64', glibc), 'aarch64-unknown-linux-gnu')
  assert.equal(resolveTarget('linux', 'x64', musl), 'x86_64-unknown-linux-musl')
  assert.equal(resolveTarget('linux', 'arm64', musl), 'aarch64-unknown-linux-musl')
  assert.equal(resolveTarget('darwin', 'x64'), 'x86_64-apple-darwin')
  assert.equal(resolveTarget('darwin', 'arm64'), 'aarch64-apple-darwin')
  assert.equal(resolveTarget('win32', 'x64'), 'x86_64-pc-windows-msvc')
})

test('fails closed for unsupported runners', () => {
  assert.throws(() => resolveTarget('win32', 'arm64'), /Unsupported/u)
  assert.throws(() => resolveTarget('freebsd', 'x64'), /Unsupported/u)
})

test('builds immutable release and cache paths', () => {
  const target = 'x86_64-unknown-linux-gnu'
  assert.equal(archiveName(VERSION, target), `zrail-${VERSION}-${target}.tar.gz`)
  assert.equal(binaryName(target), 'zrail')
  assert.equal(binaryName('x86_64-pc-windows-msvc'), 'zrail.exe')
  assert.equal(
    releaseUrl(VERSION, target),
    `https://github.com/zsumz/zrail/releases/download/v${VERSION}/` +
      `zrail-${VERSION}-${target}.tar.gz`
  )
  assert.equal(
    installDirectory('/cache', VERSION, target, SHA256.toLowerCase()),
    path.resolve('/cache', 'zrail', VERSION, target, SHA256.toLowerCase())
  )
})

