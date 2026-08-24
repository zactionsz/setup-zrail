'use strict'

const path = require('node:path')

const RELEASE_BASE_URL = 'https://github.com/zsumz/zrail/releases/download'
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/u

function requireVersion(value) {
  const version = value.trim()
  if (!VERSION_PATTERN.test(version)) {
    throw new Error('Invalid version; expected an exact stable version such as 0.0.2')
  }
  return version
}

function requireSha256(value) {
  const sha256 = value.trim()
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error('Invalid sha256; expected exactly 64 hexadecimal characters')
  }
  return sha256.toLowerCase()
}

function resolveTarget(
  platform = process.platform,
  architecture = process.arch,
  report = process.report
) {
  if (platform === 'darwin') {
    if (architecture === 'x64') return 'x86_64-apple-darwin'
    if (architecture === 'arm64') return 'aarch64-apple-darwin'
  }

  if (platform === 'win32' && architecture === 'x64') {
    return 'x86_64-pc-windows-msvc'
  }

  if (platform === 'linux' && ['x64', 'arm64'].includes(architecture)) {
    const machine = architecture === 'x64' ? 'x86_64' : 'aarch64'
    return `${machine}-unknown-linux-${linuxLibc(report)}`
  }

  throw new Error(`Unsupported zrail runner ${platform}/${architecture}`)
}

function linuxLibc(report) {
  try {
    const runtime = report?.getReport().header?.glibcVersionRuntime
    return runtime ? 'gnu' : 'musl'
  } catch (error) {
    throw new Error(`Unable to detect the Linux C library: ${error.message}`)
  }
}

function archiveName(version, target) {
  const extension = target.endsWith('-windows-msvc') ? 'zip' : 'tar.gz'
  return `zrail-${version}-${target}.${extension}`
}

function releaseUrl(version, target) {
  return `${RELEASE_BASE_URL}/v${version}/${archiveName(version, target)}`
}

function installDirectory(toolCache, version, target, sha256) {
  return path.resolve(toolCache, 'zrail', version, target, sha256)
}

function binaryName(target) {
  return target.endsWith('-windows-msvc') ? 'zrail.exe' : 'zrail'
}

module.exports = {
  archiveName,
  binaryName,
  installDirectory,
  releaseUrl,
  requireSha256,
  requireVersion,
  resolveTarget
}

