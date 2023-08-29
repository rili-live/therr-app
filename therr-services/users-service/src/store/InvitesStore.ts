import KnexBuilder, { Knex } from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const INVITES_TABLE_NAME = 'main.invites';

export interface ICreateInviteParams {
    requestingUserId: string;
    email?: string;
    phoneNumber?: string;
    isAccepted: boolean;
}

export interface IUpdateInviteConditions {
    id: string;
}

export interface IUpdateInviteParams {
    isAccepted: boolean;
}

export default class InvitesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getInvites(conditions: { email?: string; phoneNumber?: string; }) {
        const queryString = knexBuilder.select('*')
            .from(INVITES_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getInvitesForEmail(conditions: { email: string, isAccepted: boolean }) {
        return this.getInvites(conditions);
    }

    getInvitesForPhoneNumber(conditions: { phoneNumber: string, isAccepted: boolean }) {
        return this.getInvites(conditions);
    }

    createIfNotExist(invites: ICreateInviteParams[]) {
        // TODO: Filter out invites that have neither a phone number or email
        const queryString = knexBuilder.insert(invites)
            .into(INVITES_TABLE_NAME)
            .onConflict()
            .ignore()
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateInvite(conditions: IUpdateInviteConditions, params: IUpdateInviteParams) {
        const queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(INVITES_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
