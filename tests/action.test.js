'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { runAction } = require('../src/action')
const { installDirectory } = require('../src/contracts')
const { verifyVersion } = require('../src/tool')

const VERSION = '0.0.2'
const TARGET = 'x86_64-unknown-linux-gnu'

test('installs a verified binary and only probes its version', async (context) => {
  const fixture = await createFixture(context, 'archive bytes')
  const versionProbes = []

  const result = await runAction(fixture.environment, {
    download: async (_url, archive) => {
      await mkdir(path.dirname(archive), { recursive: true })
      await writeFile(archive, 'archive bytes')
    },
    extractBinary: async (_archive, destination) => {
      await mkdir(destination, { recursive: true })
      const binary = path.join(destination, 'zrail')
      await writeFile(binary, 'zrail binary')
      return binary
    },
    resolveTarget: () => TARGET,
    verifyVersion: (binary, version) => versionProbes.push({ binary, version })
  })

  assert.equal(result.version, VERSION)
  assert.equal(result.target, TARGET)
  assert.equal(result.cacheHit, false)
  assert.equal(await readFile(result.binaryPath, 'utf8'), 'zrail binary')
  assert.equal(versionProbes.length, 2)
  assert.deepEqual(versionProbes.map(({ version }) => version), [VERSION, VERSION])
  assert.match(await readFile(fixture.pathFile, 'utf8'), new RegExp(`${fixture.sha256}\\r?\\n$`, 'u'))
  assert.match(await readFile(fixture.outputFile, 'utf8'), /cache-hit=false/u)
})

test('reuses a verified cache entry without downloading', async (context) => {
  const fixture = await createFixture(context, 'archive bytes')
  const installDir = installDirectory(fixture.toolCache, VERSION, TARGET, fixture.sha256)
  const binary = path.join(installDir, 'zrail')
  await mkdir(installDir, { recursive: true })
  await writeFile(binary, 'cached binary')
  const binarySha256 = createHash('sha256').update('cached binary').digest('hex')
  await writeFile(
    path.join(installDir, 'manifest.json'),
    `${JSON.stringify({
      archiveSha256: fixture.sha256,
      binarySha256,
      target: TARGET,
      version: VERSION
    })}\n`
  )

  const result = await runAction(fixture.environment, {
    download: () => assert.fail('download should not run'),
    resolveTarget: () => TARGET,
    verifyVersion: () => undefined
  })

  assert.equal(result.cacheHit, true)
  assert.equal(result.binaryPath, binary)
  assert.match(await readFile(fixture.outputFile, 'utf8'), /cache-hit=true/u)
})

test('does not extract, cache, or export a download with the wrong digest', async (context) => {
  const fixture = await createFixture(context, 'expected archive')

  await assert.rejects(
    runAction(fixture.environment, {
      download: async (_url, archive) => {
        await mkdir(path.dirname(archive), { recursive: true })
        await writeFile(archive, 'wrong archive')
      },
      extractBinary: () => assert.fail('extraction should not run'),
      resolveTarget: () => TARGET,
      verifyVersion: () => assert.fail('version probe should not run')
    }),
    /SHA-256 mismatch/u
  )

  assert.equal(await readFile(fixture.outputFile, 'utf8'), '')
  assert.equal(await readFile(fixture.pathFile, 'utf8'), '')
})

test('the binary identity probe invokes only --version', () => {
  let invocation
  verifyVersion('/cache/zrail', VERSION, (command, args) => {
    invocation = { args, command }
    return { output: `zrail ${VERSION}\n` }
  })
  assert.deepEqual(invocation, { args: ['--version'], command: '/cache/zrail' })
})

async function createFixture(context, archiveContents) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-zrail-action-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  const outputFile = path.join(root, 'output')
  const pathFile = path.join(root, 'path')
  const sha256 = createHash('sha256').update(archiveContents).digest('hex')
  const toolCache = path.join(root, 'cache')
  await Promise.all([writeFile(outputFile, ''), writeFile(pathFile, '')])

  return {
    environment: {
      GITHUB_OUTPUT: outputFile,
      GITHUB_PATH: pathFile,
      INPUT_SHA256: sha256,
      INPUT_VERSION: VERSION,
      RUNNER_TEMP: path.join(root, 'temp'),
      RUNNER_TOOL_CACHE: toolCache
    },
    outputFile,
    pathFile,
    sha256,
    toolCache
  }
}

