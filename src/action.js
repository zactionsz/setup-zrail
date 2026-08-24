'use strict'

const { randomUUID } = require('node:crypto')
const { constants } = require('node:fs')
const {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { extractBinary } = require('./archive')
const {
  archiveName,
  binaryName,
  installDirectory,
  releaseUrl,
  requireSha256,
  requireVersion,
  resolveTarget
} = require('./contracts')
const { download } = require('./download')
const github = require('./github')
const { sha256File, verifyVersion } = require('./tool')

async function runAction(environment = process.env, overrides = {}) {
  const dependencies = {
    download,
    extractBinary,
    resolveTarget,
    sha256File,
    verifyVersion,
    ...overrides
  }
  const version = requireVersion(github.input('version', environment))
  const expectedSha256 = requireSha256(github.input('sha256', environment))
  const target = dependencies.resolveTarget()
  const toolCache = environment.RUNNER_TOOL_CACHE || environment.RUNNER_TEMP || os.tmpdir()
  const runnerTemp = environment.RUNNER_TEMP || os.tmpdir()
  const installDir = installDirectory(toolCache, version, target, expectedSha256)
  const installedBinary = path.join(installDir, binaryName(target))
  let cacheHit = await validCache(installDir, version, target, expectedSha256, dependencies)

  if (cacheHit) {
    github.info(`Using verified cached zrail ${version} for ${target}`)
  } else {
    const stagingRoot = path.resolve(
      runnerTemp,
      'setup-zrail-staging',
      `${version}-${target}-${randomUUID()}`
    )
    const archive = path.join(stagingRoot, archiveName(version, target))
    const extracted = path.join(stagingRoot, 'extracted')

    try {
      const url = releaseUrl(version, target)
      github.info(`Downloading zrail ${version} for ${target}`)
      await dependencies.download(url, archive)
      const actualSha256 = await dependencies.sha256File(archive)
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `SHA-256 mismatch for ${path.basename(archive)}: expected ` +
            `${expectedSha256}, received ${actualSha256}`
        )
      }

      const candidate = await dependencies.extractBinary(archive, extracted, target)
      dependencies.verifyVersion(candidate, version)
      await publishVerified(
        candidate,
        installDir,
        version,
        target,
        expectedSha256,
        dependencies
      )
    } finally {
      await rm(stagingRoot, { force: true, recursive: true })
    }
    cacheHit = false
  }

  github.addPath(installDir, environment)
  github.setOutput('version', version, environment)
  github.setOutput('target', target, environment)
  github.setOutput('sha256', expectedSha256, environment)
  github.setOutput('path', installedBinary, environment)
  github.setOutput('cache-hit', String(cacheHit), environment)
  github.info(`Installed and verified zrail ${version} for ${target}`)

  return { binaryPath: installedBinary, cacheHit, sha256: expectedSha256, target, version }
}

async function validCache(installDir, version, target, archiveSha256, dependencies) {
  const binaryPath = path.join(installDir, binaryName(target))
  const manifestPath = path.join(installDir, 'manifest.json')
  try {
    const [binaryMetadata, manifestMetadata, manifestText] = await Promise.all([
      lstat(binaryPath),
      lstat(manifestPath),
      readFile(manifestPath, 'utf8')
    ])
    if (
      !binaryMetadata.isFile() ||
      binaryMetadata.isSymbolicLink() ||
      !manifestMetadata.isFile() ||
      manifestMetadata.isSymbolicLink()
    ) {
      return false
    }

    const manifest = JSON.parse(manifestText)
    if (
      manifest.version !== version ||
      manifest.target !== target ||
      manifest.archiveSha256 !== archiveSha256 ||
      manifest.binarySha256 !== (await dependencies.sha256File(binaryPath))
    ) {
      return false
    }
    dependencies.verifyVersion(binaryPath, version)
    return true
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return false
    throw error
  }
}

async function publishVerified(
  source,
  installDir,
  version,
  target,
  archiveSha256,
  dependencies
) {
  await mkdir(path.dirname(installDir), { recursive: true })
  const publishDir = `${installDir}.${randomUUID()}.tmp`
  const destination = path.join(publishDir, binaryName(target))
  try {
    await mkdir(publishDir)
    await copyFile(source, destination, constants.COPYFILE_EXCL)
    if (!target.endsWith('-windows-msvc')) await chmod(destination, 0o755)
    const binarySha256 = await dependencies.sha256File(destination)
    dependencies.verifyVersion(destination, version)
    await writeFile(
      path.join(publishDir, 'manifest.json'),
      `${JSON.stringify({ archiveSha256, binarySha256, target, version })}\n`,
      { encoding: 'utf8', flag: 'wx' }
    )

    await rm(installDir, { force: true, recursive: true })
    await rename(publishDir, installDir)
  } finally {
    await rm(publishDir, { force: true, recursive: true })
  }
}

module.exports = { publishVerified, runAction, validCache }

