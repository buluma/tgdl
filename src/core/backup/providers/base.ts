/**
 * Base class for all remote backup providers.
 *
 * All providers MUST implement:
 *   1. `static get providerId()`   — short id (e.g. 's3', 'dropbox')
 *   2. `static get displayName()`  — human label
 *   3. `static get configSchema()` — array of {name, label, type, required}
 *   4. `init(cfg, ctx)`           — startup (auth, root check)
 *   5. `upload(local, remote, opts, ctx)` — stream upload
 *   6. `delete(remote, ctx)`      — delete file
 *   7. `stat(remote, ctx)`        — metadata check
 *   8. `list(prefix, ctx)`        — async generator of entries
 *   9. `testConnection(ctx)`      — credential probe
 */



/**
 * @typedef {Object} BackupContext
 * @property {AbortSignal} [signal]
 */
export interface BackupContext {
    signal?: AbortSignal;
}

export interface UploadResult {
    remotePath: string;
    bytes: number;
    etag?: string;
    remoteId?: string;
}

export interface StatResult {
    size: number;
    mtime: number;
    etag?: string;
}

export interface ListEntry {
    name: string;
    size: number;
    mtime: number;
}

export interface TestResult {
    ok: boolean;
    detail: string;
}

export class BackupProvider {
    static get providerId(): string { throw new Error('subclass must override static providerId'); }
    static get displayName(): string { return (this.constructor as typeof BackupProvider).providerId; }
    static get configSchema(): Record<string, unknown>[] { return []; }

    /**
     * Validate config and warm up any long-lived clients (HTTP keep-alive,
     * SFTP socket, etc.). Called once per Provider instance.
     *
     * @param {object} _cfg
     * @param {BackupContext} _ctx
     */
    async init(_cfg: Record<string, unknown>, _ctx: BackupContext): Promise<void> { throw new Error('not implemented'); }

    /**
     * Stream-upload `localPath` to `remotePath`.
     *
     * @param {string} _localPath
     * @param {string} _remotePath  POSIX-style; manager.js builds this
     * @param {{onProgress?:Function, encryptKey?:Buffer, throttleBps?:number}} _opts
     * @param {BackupContext} _ctx
     * @returns {Promise<UploadResult>}
     */
    async upload(_localPath: string, _remotePath: string, _opts: Record<string, unknown>, _ctx: BackupContext): Promise<UploadResult> { throw new Error('not implemented'); }

    /**
     * Idempotent delete. Succeeds even if the remote object is already
     * gone — the snapshot retention loop double-deletes on retry and
     * mustn't fail the second time.
     *
     * @param {string} _remotePath
     * @param {BackupContext} _ctx
     */
    async delete(_remotePath: string, _ctx: BackupContext): Promise<void> { throw new Error('not implemented'); }

    /**
     * Stat one remote object. Returns null when absent — distinguishes
     * "doesn't exist" from "auth/network error" (which throws).
     *
     * @param {string} _remotePath
     * @param {BackupContext} _ctx
     * @returns {Promise<StatResult|null>}
     */
    async stat(_remotePath: string, _ctx: BackupContext): Promise<StatResult | null> { throw new Error('not implemented'); }

    /**
     * List all objects under `prefix`. Returns a generator of ListEntry.
     *
     * @param {string} _prefix
     * @param {BackupContext} _ctx
     * @returns {AsyncGenerator<ListEntry>}
     */
    async *list(_prefix: string, _ctx: BackupContext): AsyncGenerator<ListEntry> {
        yield* []; // subclass must override
    }

    /**
     * Verify credentials + write access. Returns {ok, detail}.
     *
     * @param {BackupContext} _ctx
     * @returns {Promise<TestResult>}
     */
    async testConnection(_ctx: BackupContext): Promise<TestResult> { throw new Error('not implemented'); }

    /** Graceful cleanup. */
    async close(): Promise<void> {}
}

/** Small helper to format "missing optional dependency" errors. */
export function optionalDepError(pkg: string, provider: string): Error {
    return new Error(
        `Backup provider '${provider}' needs optional dependency '${pkg}'. ` +
        `Install it with: npm install ${pkg}`,
    );
}
