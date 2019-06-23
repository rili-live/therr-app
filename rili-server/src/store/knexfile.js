// Update with your config settings.
module.exports = {
    development: {
        client: 'postgresql',
        connection: {
            database: process.env.PG_DATABASE,
            user: process.env.PG_USER,
            password: process.env.PG_PASSWORD,
            port: process.env.PG_PORT,
        },
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            directory: './migrations',
        },
        seeds: {
            directory: './seeds',
        },
    },
};
