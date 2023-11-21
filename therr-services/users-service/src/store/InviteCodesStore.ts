import KnexBuilder, { Knex } from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import { AccessLevels } from 'therr-js-utilities/constants';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const INVITE_CODES_TABLE_NAME = 'main.inviteCodes';

export interface ICreateInviteCodeParams {
    code: string;
    redemptionType: string;
    userEmail?: string;
    partner?: string;
    isRedeemed?: boolean;
}

export interface IUpdateInviteCodeConditions {
    id: string;
}

export interface IUpdateInviteCodeParams {
    userEmail?: boolean;
    isRedeemed: boolean;
}

export const getAccessForCodeType = (type: string) => {
    if (type === 'basic-subscription') {
        return [AccessLevels.DASHBOARD_SUBSCRIBER_BASIC];
    }
    if (type === 'advanced-subscription') {
        return [AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM];
    }
    if (type === 'pro-subscription') {
        return [AccessLevels.DASHBOARD_SUBSCRIBER_PRO];
    }

    return [];
};

export default class InviteCodesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getInviteCodes(conditions: { userEmail?: string; code?: string; isRedeemed?: boolean; }, notConditions?: { userEmail?: string; isRedeemed?: boolean; }) {
        let queryString = knexBuilder.select('*')
            .from(INVITE_CODES_TABLE_NAME)
            .where(conditions);

        if (notConditions) {
            queryString = queryString.andWhereNot(notConditions);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    createIfNotExist(invites: ICreateInviteCodeParams[]) {
        const queryString = knexBuilder.insert(invites)
            .into(INVITE_CODES_TABLE_NAME)
            .onConflict()
            .ignore()
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateInviteCode(conditions: IUpdateInviteCodeConditions, params: IUpdateInviteCodeParams) {
        const queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(INVITE_CODES_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
