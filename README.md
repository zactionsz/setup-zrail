# setup-zrail

Install an exact, checksum-pinned [zrail](https://github.com/zsumz/zrail)
release in a GitHub Actions job.

## Usage

Pin both the Action and the platform archive:

```yaml
- name: Set up zrail
  uses: zactionsz/setup-zrail@e6f8b7b742b94d4d42ed1133df500f75eb465aa2
  with:
    version: "0.0.2"
    sha256: "<platform archive digest>"

- run: zrail check
```

`setup-zrail` installs the CLI and adds it to `PATH`. It does not run a zrail
operation. The consumer chooses whether to use `zrail check`, `zrail diff`,
`zrail review`, `zrail explain`, or another command.

## zrail 0.0.2 archive digests

| Runner | Release target | SHA-256 |
| --- | --- | --- |
| Linux x64, glibc | `x86_64-unknown-linux-gnu` | `fb535cf8a72cf15995f0c4d2ea640629624b300736c67c7961e058f4a12419d9` |
| Linux ARM64, glibc | `aarch64-unknown-linux-gnu` | `d2d4d55b56a0fd5c3d4e981f182dbbfe9839aae4717a4ea8248087ab9b63c74d` |
| Linux x64, musl | `x86_64-unknown-linux-musl` | `5d6caa4b60bbdc8da44838dd9d1b1277a8d4459a45752118d6d862ab51fb4fba` |
| Linux ARM64, musl | `aarch64-unknown-linux-musl` | `e3b0ca1e3753b5ee9b6edf51efc0abebb6ade5c32aa5e4e871491d43e1d89935` |
| macOS Intel | `x86_64-apple-darwin` | `fd8202f523b4e7adce5e966197d545753e1e36faa86728ac863c855640001916` |
| macOS Apple Silicon | `aarch64-apple-darwin` | `efc191a76b71d75e61b195f50759f55562830a4d8ad6c3a2a3bc7b1d8c741141` |
| Windows x64 | `x86_64-pc-windows-msvc` | `0d1d97ae29fc532d503fb0edba3b18d02a85ce55735bd2d0ad868cbeaebb5a58` |

The digest is for the release archive selected for the current runner. A job
matrix should include the matching digest alongside each runner label.

## Inputs

| Input | Required | Contract |
| --- | --- | --- |
| `version` | Yes | Exact stable zrail release version, without a leading `v` |
| `sha256` | Yes | Exact 64-character SHA-256 digest for this runner's archive |

Floating versions such as `latest`, version ranges, and missing checksums are
rejected.

## Outputs

| Output | Value |
| --- | --- |
| `version` | Verified zrail version |
| `target` | Selected zrail release target |
| `sha256` | Verified lowercase archive digest |
| `path` | Absolute path to the installed executable |
| `cache-hit` | `true` when a verified tool-cache entry was reused |

## Verification

The Action selects one of the seven targets published by zrail, downloads the
versioned archive from its GitHub release, verifies the caller-pinned
SHA-256 before extraction, rejects unsafe archive paths, extracts only the
zrail executable, and requires an exact `zrail <version>` identity response.
Only then does it publish the executable to the runner tool cache and add it to
`PATH` for later steps.

## Development

The Action is authored in strict TypeScript under `src/`. GitHub executes the
committed `dist/index.js` bundle, and the complete gate verifies that the bundle
matches its source:

```sh
npm ci
npm run check
```

## License

MIT
