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
    token?: string;
    // The brand the invite was minted in. Omit to accept the column default ('therr').
    brandVariation?: string;
}

export interface IInviteWithInviter {
    id: string;
    requestingUserId: string;
    email?: string;
    phoneNumber?: string;
    isAccepted: boolean;
    // Origin brand of the invite. The landing page uses this to deep-link the invitee to
    // the app the invite came from, rather than whichever brand happened to open the link.
    brandVariation: string;
    inviterFirstName?: string;
    inviterLastName?: string;
    inviterUserName?: string;
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

    /**
     * Resolves a magic invite-link token to the invite plus the inviter's
     * display fields. Used (a) by the public invite-landing endpoint to
     * pre-fill the invitee's known email/phone and show who invited them,
     * and (b) during token-aware registration to trust the contact channel
     * the token was delivered on. Returns undefined for an unknown token.
     */
    getInviteByToken(token: string): Promise<IInviteWithInviter | undefined> {
        const queryString = knexBuilder
            .select([
                `${INVITES_TABLE_NAME}.id`,
                `${INVITES_TABLE_NAME}.requestingUserId`,
                `${INVITES_TABLE_NAME}.email`,
                `${INVITES_TABLE_NAME}.phoneNumber`,
                `${INVITES_TABLE_NAME}.isAccepted`,
                `${INVITES_TABLE_NAME}.brandVariation`,
                'main.users.firstName as inviterFirstName',
                'main.users.lastName as inviterLastName',
                'main.users.userName as inviterUserName',
            ])
            .from(INVITES_TABLE_NAME)
            .leftJoin('main.users', 'main.users.id', `${INVITES_TABLE_NAME}.requestingUserId`)
            .where(`${INVITES_TABLE_NAME}.token`, token)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Returns prior invites this user has sent within the given window. Used
     * by the bulk-invite handler to dedupe email/SMS sends so a user can't
     * spam the same recipient. Returns empty for empty input arrays — guards
     * against `WHERE email IN ()` which Postgres rejects.
     */
    getRecentByRequestingUser(
        requestingUserId: string,
        emails: string[],
        phones: string[],
        sinceDate: Date,
    ) {
        if (!requestingUserId || (emails.length === 0 && phones.length === 0)) {
            return Promise.resolve([] as Array<{ email?: string; phoneNumber?: string }>);
        }
        const queryBuilder = knexBuilder.select('email', 'phoneNumber')
            .from(INVITES_TABLE_NAME)
            .where('requestingUserId', requestingUserId)
            .andWhere('createdAt', '>=', sinceDate)
            .andWhere((qb) => {
                if (emails.length > 0) {
                    qb.whereIn('email', emails);
                }
                if (phones.length > 0) {
                    qb.orWhereIn('phoneNumber', phones);
                }
            });

        return this.db.read.query(queryBuilder.toString())
            .then((response) => response.rows as Array<{ email?: string; phoneNumber?: string }>);
    }

    /**
     * Upserts invites for a single contact channel and returns each row's
     * token. Used by the bulk-invite flow so the magic link embedded in the
     * outbound email/SMS matches the persisted row — including when a row
     * already existed from a prior invite (its token is refreshed so a stale
     * link can't be reused after a fresh invite). `channel` is the unique
     * column to conflict on ('email' or 'phoneNumber').
     *
     * `requestingUserId` is merged alongside the token: email/phoneNumber are
     * globally unique in this table, so a contact previously invited by someone
     * else already owns the row. Refreshing only the token would hand the new
     * inviter's magic link to the *original* inviter's row — the invitee would
     * be auto-connected to, and the coins credited to, the wrong user. Since
     * the refreshed token invalidates the older link, the latest inviter is the
     * only one who can convert this invite, so they own it.
     *
     * Callers must de-duplicate by `channel` first: Postgres rejects an
     * ON CONFLICT DO UPDATE that touches the same row twice in one statement.
     */
    upsertInvitesWithTokens(channel: 'email' | 'phoneNumber', invites: ICreateInviteParams[]) {
        if (!invites.length) {
            return Promise.resolve([] as Array<{ email?: string; phoneNumber?: string; token: string }>);
        }
        const queryString = knexBuilder.insert(invites)
            .into(INVITES_TABLE_NAME)
            .onConflict(channel)
            // brandVariation is merged alongside the token: re-inviting a contact mints a
            // fresh token and invalidates the old link, so the row's origin brand must move
            // with it. Without this, a Habits re-invite of a contact first invited from Therr
            // would hand the invitee a live Habits link on a row still marked 'therr'.
            .merge(['token', 'requestingUserId', 'brandVariation', 'updatedAt'])
            .returning(['email', 'phoneNumber', 'token'])
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows as Array<{ email?: string; phoneNumber?: string; token: string }>);
    }

    createIfNotExist(invites: ICreateInviteParams[]) {
        // knex emits an empty string for `.insert([])`, and pg rejects an empty
        // query. The bulk-invite flow now passes only the existing-user subset
        // here, which is empty whenever every invited contact is new to the
        // platform — the common case. Without this guard that rejection
        // short-circuits the caller's promise chain.
        if (!invites.length) {
            return Promise.resolve([] as Array<{ id: string }>);
        }
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
