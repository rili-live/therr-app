import KnexBuilder, { Knex } from 'knex';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { getDbCountQueryString } from 'therr-js-utilities/db';
// eslint-disable-next-line import/extensions, import/no-unresolved
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line no-restricted-syntax -- this is the sanctioned canonical reference
export const DIRECT_MESSAGES_TABLE_NAME = 'main.directMessages';

export interface ICreateDirectMessageParams {
    message: string;
    toUserId: string;
    fromUserId: string;
    isUnread: boolean;
    locale: string;
}

export interface IUpdateDirectMessageConditions {
    id: string;
}

export interface IUpdateDirectMessageParams {
    message: string;
    isUnread?: boolean;
}

export default class DirectMessagesStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // Brand-scoped per docs/NICHE_APP_DATABASE_GUIDELINES.md.
        // Stays in 'shadow' for one release cycle alongside the other Phase 3 stores.
        super(dbConnection, DIRECT_MESSAGES_TABLE_NAME, 'shadow');
    }

    countRecords(brand: BrandValue, params) {
        this.assertBrand(brand);
        const queryString = getDbCountQueryString({
            queryBuilder: knexBuilder,
            tableName: DIRECT_MESSAGES_TABLE_NAME,
            params,
            defaultConditions: { [`${DIRECT_MESSAGES_TABLE_NAME}.brandVariation`]: brand },
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    searchDirectMessages(brand: BrandValue, userId, conditions: any = {}, returning, shouldCheckReverse?: string) {
        this.assertBrand(brand);
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(DIRECT_MESSAGES_TABLE_NAME)
            .where(`${DIRECT_MESSAGES_TABLE_NAME}.brandVariation`, '=', brand)
            .orderBy(`${DIRECT_MESSAGES_TABLE_NAME}.updatedAt`, 'desc');

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.where('toUserId', userId).andWhere(conditions.filterBy, operator, query);
            if (shouldCheckReverse === 'true' && conditions.filterBy === 'fromUserId') {
                queryString = queryString.orWhere('fromUserId', userId)
                    .andWhere('toUserId', operator, query)
                    // The orWhere() above resets brand isolation in the OR branch — re-apply it
                    // so a Habits client's reverse search can't surface a Therr-stamped DM.
                    .andWhere(`${DIRECT_MESSAGES_TABLE_NAME}.brandVariation`, '=', brand);
            }
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            return configuredResponse;
        });
    }

    searchLatestDMs(brand: BrandValue, userId: string, conditions: any = {}) {
        this.assertBrand(brand);
        const offset = Number(conditions.pagination.itemsPerPage) * (Number(conditions.pagination.pageNumber) - 1);
        const limit = Number(conditions.pagination.itemsPerPage);
        // Brand filter is applied to BOTH the outer SELECT and the inner aggregate so a per-brand
        // thread is treated as distinct from the cross-brand thread between the same user pair.
        // Brand and userId are parameter-bound (not interpolated) to keep the no-string-concat
        // discipline consistent with the rest of the store, even though both values flow from
        // assertBrand-validated input and the gateway-set x-userid header. limit/offset are
        // coerced to Number so they're safe to embed numerically.
        const sql = `
        SELECT
            *
        FROM
            "main"."directMessages"
        WHERE "brandVariation" = ?
            AND ((least("fromUserId", "toUserId"), greatest("fromUserId", "toUserId")), "updatedAt")
        in(
            SELECT
                (least("fromUserId", "toUserId"), greatest("fromUserId", "toUserId")) AS users, max("updatedAt") AS "maxUpdated" FROM "main"."directMessages"
            WHERE "brandVariation" = ?
                AND ("fromUserId" = ?
                OR "toUserId" = ?)
        GROUP BY
            users
        ORDER BY
            "maxUpdated" DESC
        LIMIT ${limit}
        OFFSET ${offset})
        ORDER BY
            "updatedAt" DESC;
        `;
        const native = knexBuilder.raw(sql, [brand, brand, userId, userId]).toSQL().toNative();

        return this.db.read.query(native.sql, native.bindings as any[]).then((response) => response.rows);
    }

    createDirectMessage(brand: BrandValue, params: ICreateDirectMessageParams) {
        const queryString = this.scopedInsert(brand, { ...params })
            .returning(['id', 'updatedAt'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
