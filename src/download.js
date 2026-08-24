'use strict'

const { randomUUID } = require('node:crypto')
const { createWriteStream } = require('node:fs')
const { mkdir, rename, rm } = require('node:fs/promises')
const path = require('node:path')
const { Readable, Transform } = require('node:stream')
const { pipeline } = require('node:stream/promises')

const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024

async function download(url, destination, fetchImpl = fetch) {
  await mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.${randomUUID()}.tmp`

  try {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': 'zactionsz/setup-zrail' },
      redirect: 'follow'
    })
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status} for ${url}`)
    }
    if (!response.body) {
      throw new Error(`Download returned an empty response body for ${url}`)
    }

    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_BYTES) {
      throw new Error(`Download exceeds the ${MAX_ARCHIVE_BYTES}-byte safety limit`)
    }

    let received = 0
    const limit = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length
        if (received > MAX_ARCHIVE_BYTES) {
          callback(new Error(`Download exceeds the ${MAX_ARCHIVE_BYTES}-byte safety limit`))
          return
        }
        callback(null, chunk)
      }
    })

    await pipeline(
      Readable.fromWeb(response.body),
      limit,
      createWriteStream(temporary, { flags: 'wx' })
    )
    await rename(temporary, destination)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

module.exports = { MAX_ARCHIVE_BYTES, download }

