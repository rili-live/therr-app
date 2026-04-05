import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_DISPLAY_REQUESTS_TABLE_NAME = 'main.spaceDisplayRequests';

export type DisplayType = 'coaster' | 'table_tent' | 'window_cling';
export type DisplayRequestStatus = 'pending' | 'printed' | 'shipped' | 'delivered' | 'cancelled';

export interface ICreateSpaceDisplayRequestParams {
    spaceId: string;
    fromUserId: string;
    displayType: DisplayType;
    shippingName?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingRegion?: string;
    shippingPostalCode?: string;
    shippingCountry?: string;
    notes?: string;
}

export interface IListSpaceDisplayRequestsParams {
    status?: DisplayRequestStatus;
    fromUserId?: string;
    spaceId?: string;
    limit?: number;
    offset?: number;
}

export default class SpaceDisplayRequestsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    create(params: ICreateSpaceDisplayRequestParams) {
        const queryString = knexBuilder.insert({
            spaceId: params.spaceId,
            fromUserId: params.fromUserId,
            displayType: params.displayType,
            shippingName: params.shippingName,
            shippingAddress: params.shippingAddress,
            shippingCity: params.shippingCity,
            shippingRegion: params.shippingRegion,
            shippingPostalCode: params.shippingPostalCode,
            shippingCountry: params.shippingCountry || 'US',
            notes: params.notes,
        })
            .into(SPACE_DISPLAY_REQUESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    list(params: IListSpaceDisplayRequestsParams = {}) {
        const query = knexBuilder
            .select('*')
            .from(SPACE_DISPLAY_REQUESTS_TABLE_NAME)
            .orderBy('requestedAt', 'desc')
            .limit(params.limit || 100)
            .offset(params.offset || 0);

        if (params.status) {
            query.where('status', params.status);
        }
        if (params.fromUserId) {
            query.where('fromUserId', params.fromUserId);
        }
        if (params.spaceId) {
            query.where('spaceId', params.spaceId);
        }

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    listPendingWithSpaceInfo() {
        const queryString = knexBuilder.raw(`
            SELECT
                r.id,
                r."spaceId",
                r."fromUserId",
                r."displayType",
                r."status",
                r."requestedAt",
                r."shippingName",
                r."shippingAddress",
                r."shippingCity",
                r."shippingRegion",
                r."shippingPostalCode",
                r."shippingCountry",
                s."notificationMsg" AS "businessName",
                s."addressStreetAddress",
                s."addressLocality",
                s."addressRegion",
                s."postalCode"
            FROM main."spaceDisplayRequests" r
            JOIN main.spaces s ON r."spaceId" = s.id
            WHERE r.status = 'pending'
            ORDER BY r."requestedAt" ASC
        `).toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }
}
