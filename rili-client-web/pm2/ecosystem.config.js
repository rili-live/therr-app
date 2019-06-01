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
        args: ['dotenv_config_path=../.env'],
        node_args: ['--require=../node_modules/dotenv/config'],
        // output: '~/.pm2/logs/rili-server-client-out.log',
        // error: '~/.pm2/logs/rili-server-client-error.log',
        // log: '~/.pm2/logs/rili-server-client-outerr-combined.log',
        // merge_logs: true,
    }],
};
