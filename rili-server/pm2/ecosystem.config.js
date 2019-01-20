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
    }, {
        name: 'rili-server-api',
        script: './build/server-api.js',
        env: {
            NODE_ENV: 'development',
        },
        env_production: {
            NODE_ENV: 'production',
        },
    }],
};
