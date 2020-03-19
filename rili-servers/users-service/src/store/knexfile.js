// Update with your config settings.
module.exports = {
    development: {
        client: 'pg',
        connection: {
            database: process.env.PG_DATABASE,
            host: process.env.PG_HOST,
            user: process.env.PG_USER,
            password: process.env.PG_PASSWORD,
            port: Number(process.env.PG_PORT),
        },
        migrations: {
            directory: './migrations',
        },
        seeds: {
            directory: './seeds',
        },
    },
    production: {
        client: 'pg',
        connection: {
            database: process.env.PG_DATABASE,
            host: process.env.PG_HOST,
            user: process.env.PG_USER,
            password: process.env.PG_PASSWORD,
            port: Number(process.env.PG_PORT),
        },
        migrations: {
            directory: './migrations',
        },
        seeds: {
            directory: './seeds',
        },
    },
};
