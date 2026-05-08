module.exports = {
    apps: [
        {
            name: 'tgdl',
            script: 'src/index.ts',
            interpreter: './node_modules/.bin/tsx',

            // Restart policy
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 2000,

            // Keep stdout/stderr in data/logs alongside the app's own logs.
            out_file: 'data/logs/pm2-out.log',
            error_file: 'data/logs/pm2-err.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',

            // Expose PORT via environment
            env: {
                NODE_ENV: 'production',
                PORT: 3011,
            },

            // Example: override PORT for a staging instance.
            env_staging: {
                NODE_ENV: 'production',
                PORT: 3001,
            },
        },
    ],
};
