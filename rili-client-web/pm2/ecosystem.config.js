// config for pm2
module.exports = {
    apps: [{
        name: 'rili-server-client',
        script: './build/server-client.js',
        env: {
            NODE_ENV: 'development',
        },
        env_production: {
            NODE_ENV: 'production',
        },
        // output: '~/.pm2/logs/rili-server-client-out.log',
        // error: '~/.pm2/logs/rili-server-client-error.log',
        // log: '~/.pm2/logs/rili-server-client-outerr-combined.log',
        // merge_logs: true,
    }],
};
