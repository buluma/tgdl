# Telegram Media Downloader — self-hosted, free, MIT

Download photos, videos, documents, voice messages, GIFs, stickers, and Stories from any Telegram channel, group, or chat your account can read. 

[![CI](https://github.com/buluma/tgdl/actions/workflows/ci.yml/badge.svg)](https://github.com/buluma/tgdl/actions/workflows/ci.yml)
[![CodeQL](https://github.com/buluma/tgdl/actions/workflows/codeql.yml/badge.svg)](https://github.com/buluma/tgdl/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/buluma/tgdl/pkgs/container/telegram-media-downloader)

---

## Why people use it

- **Archive a whole Telegram channel** — bulk-backfill thousands of past messages with date / count filters.
- **Mirror an active channel** — real-time monitor downloads new media the moment it arrives.
- **Save individual messages** — paste a `https://t.me/...` link, get the media into your library.
- **Save Stories** — pull active Stories from any user by username.
- **Capture self-destructing media** — TTL messages are fast-pathed to the front of the queue and stored locally before they expire.
- **Avoid Telegram bot limits** — User API has no 50 MB / 4 GB ceiling that the Bot API imposes.
- **Forward as you download** — auto-forward to another channel, group, or Saved Messages.
- **Share without logging in** — admin generates HMAC-signed `/share/<id>` URLs that friends can open or feed to a download manager (TTL configurable, including "never expires").
- **Backup off-host** — multi-provider mirror to S3-compatible storage (AWS / R2 / B2 / MinIO / Wasabi), an SFTP NAS, or a local mount. Continuous mirror as new files arrive, scheduled tar.gz snapshots, optional client-side AES-256-GCM encryption, persistent retry queue.
- **Find duplicates** — SHA-256 dedup at download time + on-demand library scan.
- **Sort 18+ vs not-18+** — opt-in in-process classifier (`@huggingface/transformers`, WASM, runs everywhere) flags photos that don't match the rest of the library so they can be reviewed and purged.
- **Local AI search & smart organisation** — opt-in CLIP semantic search ("show me beach photos"), face clustering (the **People** view), perceptual near-duplicate dedup, and ImageNet auto-tagging. Everything runs locally via WASM; no cloud APIs, no uploads. See [docs/AI.md](docs/AI.md).
- **One-click update** — opt-in watchtower sidecar lets the dashboard pull-and-recreate the container itself; data volume + DB are preserved (DB is snapshotted to `data/backups/` first).

---

## One-click deploy

| Provider | Button |
| --- | --- |
| **Render** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/buluma/tgdl) |
| **Railway** | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/?template=https://github.com/buluma/tgdl) |
| **Fly.io / Docker** | `docker run --pull=always -p 3000:3000 -v "$(pwd)/data:/app/data" ghcr.io/buluma/tgdl:latest` |

---

For more information, see the full documentation:

- [Getting Started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Features](./docs/features/)
- [Deployment](./docs/deployment/)
- [Development](./docs/development/)
- [Troubleshooting](./docs/troubleshooting.md)
