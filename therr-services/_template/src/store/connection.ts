import { Pool } from 'pg';

export interface IConnection {
    read: Pool;
    write: Pool;
}

const read: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_READ,
    user: process.env.DB_USER_MAIN_READ,
    password: process.env.DB_PASSWORD_MAIN_READ,
    database: process.env.NEW_SERVICE_PG_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_READ),
});

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.NEW_SERVICE_PG_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE),
});

export default {
    read,
    write,
};
