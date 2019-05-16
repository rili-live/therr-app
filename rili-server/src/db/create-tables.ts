import { Client } from 'pg';
import printLogs from 'rili-public-library/utilities/print-logs';
import { shouldPrintSQLLogs } from '../server-api';

// TODO: Configure to maintain migrations
const createTables = (connection: Client) => {
    // Users
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(255) NOT NULL,
            PRIMARY KEY (id)
        );
    `;
    return connection.query(sql)
        .then((results) => {
            printLogs({
                shouldPrintLogs: shouldPrintSQLLogs,
                messageOrigin: `SQL:CREATE_TABLE:USERS`,
                messages: ['Users table created successfully', results],
            });
        }).catch((err) => {
            printLogs({
                shouldPrintLogs: shouldPrintSQLLogs,
                messageOrigin: `SQL:CREATE_TABLE:USERS`,
                messages: ['Users table failed to create', err.toString()],
            });
        });
};

export default createTables;
