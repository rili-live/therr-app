import * as Knex from 'knex';
import printLogs from 'rili-public-library/utilities/print-logs';
import { shouldPrintSQLLogs } from '../../server-api';

const notProd = process.env.NODE_ENV !== 'production';

// TODO: Configure to maintain migrations
const createTables = (knex: Knex) => {
    // Users
    return knex.schema.hasTable('main.users').then((exists) => {
        if (!exists) {
            return knex.schema.createTable('main.users', (table) => {
                table.increments('id');
                table.string('user_name');
                table.string('first_name');
                table.string('last_name');
                table.string('password');
                table.string('phone_number').unique();
                table.timestamps();
            }).debug(notProd).then((table) => {
                printLogs({
                    shouldPrintLogs: shouldPrintSQLLogs,
                    messageOrigin: `SQL:CREATE_TABLE:USERS`,
                    messages: ['Users table created successfully'],
                });
            }).catch((err) => {
                printLogs({
                    shouldPrintLogs: shouldPrintSQLLogs,
                    messageOrigin: `SQL:CREATE_TABLE:USERS`,
                    messages: ['Users table failed to create', err.toString()],
                });
            });
        }
        return;
    });
};

export default createTables;
