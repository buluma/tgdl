# Getting Started

This guide will walk you through the process of setting up and using Telegram Media Downloader.

## Quick start

### Docker (recommended)

```bash
git clone https://github.com/buluma/tgdl.git
cd telegram-media-downloader
docker compose up -d
```

Open `http://localhost:3000`:

1. Set the dashboard password (first-run setup is local-only).
2. **Settings → Telegram API** — paste your `apiId` and `apiHash`.
3. **Settings → Telegram Accounts → Add account** — phone number, OTP, optional 2FA.
4. **Settings → Engine → Start monitor**, or just paste a `t.me/` link in the top bar.

Pre-built image: `ghcr.io/buluma/tgdl:latest`.

### Node

```bash
git clone https://github.com/buluma/tgdl.git
cd telegram-media-downloader
npm ci
npm run web        # web dashboard
# or
npm start          # interactive CLI menu
```

Long-running monitor under a watchdog (Linux / macOS): `TGDL_RUN=monitor ./runner.sh`. Windows: `pwsh ./watchdog.ps1`.
