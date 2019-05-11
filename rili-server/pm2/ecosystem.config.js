// config for pm2
module.exports = {
    apps: [{
        name: 'rili-server-socket-io',
        script: './build/server-socket-io.js',
        env: {
            NODE_ENV: 'development',
        },
        env_production: {
            NODE_ENV: 'production',
        },
        args: 'withAllLogs',
        // output: '~/.pm2/logs/rili-server-socket-io-out.log',
        // error: '~/.pm2/logs/rili-server-socket-io-error.log',
        // log: '~/.pm2/logs/rili-server-socket-io-outerr-combined.log',
        // merge_logs: true,
    }, {
        name: 'rili-server-api',
        script: './build/server-api.js',
        env: {
            NODE_ENV: 'development',
        },
        env_production: {
            NODE_ENV: 'production',
        },
        // output: '~/.pm2/logs/rili-server-api-out.log',
        // error: '~/.pm2/logs/rili-server-api-error.log',
        // log: '~/.pm2/logs/rili-server-api-outerr-combined.log',
        // merge_logs: true,
    }],
};
