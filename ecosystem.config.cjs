module.exports = {
    apps: [{
        name: 'tgdl2',
        script: './src/index.ts',
        interpreter: './node_modules/.bin/tsx',
        cwd: __dirname,
        env: {
            PORT: '3000',
            PATH: `/Users/shadowwalker/.local/share/fnm/node-versions/v25.9.0/installation/bin:${process.env.PATH}`,
            FNM_CURRENT_PRESET: 'v25.9.0',
        },
        error_file: './data/logs/pm2-err.log',
        out_file: './data/logs/pm2-out.log',
        max_restarts: 10,
        min_uptime: 10000,
        restart_delay: 2000,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }],
};
