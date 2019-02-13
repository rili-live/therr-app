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
    }],
};
