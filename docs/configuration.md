# Configuration

This guide explains all the available configuration options for Telegram Media Downloader.

Runtime config lives in the `kv['config']` row of `data/db.sqlite` — self-heals to defaults on load, edited via the dashboard. Legacy `data/config.json` is auto-imported on first boot and renamed to `*.migrated`.

```jsonc
{
    "telegram":   { "apiId": "...", "apiHash": "..." },
    "accounts":   [/* populated by the wizard */],
    "groups":     [/* {id, name, enabled, filters, autoForward, topics, monitorAccount?, forwardAccount?} */],
    "download":   { "concurrent": 5, "retries": 5, "maxSpeed": 0, "path": "./data/downloads" },
    "rateLimits": { "requestsPerMinute": 15, "delayMs": { "min": 100, "max": 300 } },
    "diskManagement": { "maxTotalSize": "50GB", "maxVideoSize": null, "maxImageSize": null },
    "proxy":      { "type": "socks5", "host": "...", "port": 1080 },
    "allowDmDownloads": false,
    "web": {
        "enabled": true,
        "passwordHash":      { "algo": "scrypt", "salt": "…", "hash": "…" },
        "guestPasswordHash": { "algo": "scrypt", "salt": "…", "hash": "…" },
        "guestEnabled":      true,
        "shareSecret":       "<lazy-generated 64-char hex — never commit>"
    },
    "advanced": {
        "history":  { "autoFirstBackfill": true, "autoFirstLimit": 100,
                      "autoCatchUp": true, "autoCatchUpThreshold": 5,
                      "retentionDays": 30, "batchInsertSize": 50,
                      "backpressureCap": 500, "backpressureMaxWaitMs": 900000 },
        "share":    { "ttlMinSec": 60, "ttlMaxSec": 7776000, "ttlDefaultSec": 604800,
                      "rateLimitWindowMs": 60000, "rateLimitMax": 60 },
        "nsfw":     { "enabled": false, "model": "AdamCodd/vit-base-nsfw-detector",
                      "threshold": 0.6, "concurrency": 1, "fileTypes": ["photo"] },
        "downloader": { "minConcurrency": 3, "maxConcurrency": 20, "scalerIntervalSec": 5 },
        "integrity":  { "intervalMin": 60, "batchSize": 64 },
        "diskRotator":{ "sweepBatch": 50, "maxDeletesPerSweep": 5000 },
        "web":      { "sessionTtlDays": 7 }
    }
}
```

Every `advanced` field is clamped on save and applied immediately on `config_updated` — no restart needed.
