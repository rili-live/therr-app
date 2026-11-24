import KnexBuilder, { Knex } from 'knex';
import { withBrandOnInsert } from 'therr-js-utilities/db';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';
import { IDropRow } from '../utilities/drops';

// eslint-disable-next-line therr/no-direct-brand-scoped-table -- this is the sanctioned canonical reference
export const DROPS_TABLE_NAME = 'main.drops';

export interface ICreateDropRow {
    batchId: string;
    fromUserId: string;
    toUserId: string;
    message: string;
    mediaPath: string | null;
    mediaType: string | null;
    latitude: number;
    longitude: number;
    unlockRadiusMeters: number;
    placeName: string | null;
    spaceId: string | null;
    expiresAt: Date;
}

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

const LIST_LIMIT = 100;

/**
 * `main.drops` — one row per (drop, recipient). See the table migration and docs/DROPS.md.
 *
 * Every read is brand-scoped and also scoped to the requesting user as sender or recipient;
 * there is no method that returns a drop to an arbitrary caller. Deciding what each of them may
 * *see* of a row is `serializeDrop`'s job (utilities/drops.ts), not this store's.
 */
export default class DropsStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // 'enforce' from day one: there are no legacy rows and every caller has a brand in hand.
        super(dbConnection, DROPS_TABLE_NAME, 'enforce');
    }

    createMany(brand: BrandValue, rows: ICreateDropRow[]): Promise<IDropRow[]> {
        if (!rows.length) {
            return Promise.resolve([]);
        }
        this.assertBrand(brand);
        const queryString = knexBuilder
            .insert(rows.map((row) => withBrandOnInsert({ ...row }, brand)))
            .into(this.tableName)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /** The row for this drop if the requester is its sender or its recipient; undefined otherwise. */
    getForParticipant(brand: BrandValue, id: string, userId: string): Promise<IDropRow | undefined> {
        const queryString = this.scopedQuery(brand)
            .select('*')
            .andWhere(`${this.tableName}.id`, id)
            .andWhere((builder) => builder
                .where(`${this.tableName}.fromUserId`, userId)
                .orWhere(`${this.tableName}.toUserId`, userId))
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * The recipient's inbox, newest first: everything not dismissed, with expired drops kept for
     * a week so a drop that ran out is seen to have run out rather than silently vanishing.
     */
    listReceived(brand: BrandValue, userId: string, now: Date = new Date()): Promise<IDropRow[]> {
        const expiredGraceCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const queryString = this.scopedQuery(brand)
            .select('*')
            .andWhere(`${this.tableName}.toUserId`, userId)
            .whereNull(`${this.tableName}.recipientDismissedAt`)
            .andWhere((builder) => builder
                .whereNotNull(`${this.tableName}.openedAt`)
                .orWhere(`${this.tableName}.expiresAt`, '>', expiredGraceCutoff))
            .orderBy(`${this.tableName}.createdAt`, 'desc')
            .limit(LIST_LIMIT)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    listSent(brand: BrandValue, userId: string): Promise<IDropRow[]> {
        const queryString = this.scopedQuery(brand)
            .select('*')
            .andWhere(`${this.tableName}.fromUserId`, userId)
            .orderBy(`${this.tableName}.createdAt`, 'desc')
            .limit(LIST_LIMIT)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    countSentSince(brand: BrandValue, userId: string, since: Date): Promise<number> {
        const queryString = this.scopedQuery(brand)
            .count('* as count')
            .andWhere(`${this.tableName}.fromUserId`, userId)
            .andWhere(`${this.tableName}.createdAt`, '>=', since.toISOString())
            .toString();

        return this.db.read.query(queryString).then((response) => Number(response.rows[0]?.count || 0));
    }

    /**
     * Mark a drop opened by its recipient. Only the first open writes, so the returned row tells
     * the caller whether this request is the one that opened it — the sender is notified once,
     * however many times the recipient (or a retry) asks.
     */
    markOpened(brand: BrandValue, id: string, recipientUserId: string, now: Date = new Date()): Promise<IDropRow | undefined> {
        const queryString = this.scopedUpdate(brand, { id, toUserId: recipientUserId })
            .whereNull(`${this.tableName}.openedAt`)
            .update({ openedAt: now.toISOString(), updatedAt: now.toISOString() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    dismissForRecipient(brand: BrandValue, id: string, recipientUserId: string, now: Date = new Date()): Promise<number> {
        const queryString = this.scopedUpdate(brand, { id, toUserId: recipientUserId })
            .whereNull(`${this.tableName}.recipientDismissedAt`)
            .update({ recipientDismissedAt: now.toISOString(), updatedAt: now.toISOString() })
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }

    /**
     * Rows still pointing at this photo. One drop left for several friends shares one upload
     * across its rows, so a sender deleting one copy must not delete the photo the others show.
     * Reads the write pool: it runs straight after a delete and must see it.
     */
    countByMediaPath(brand: BrandValue, mediaPath: string): Promise<number> {
        const queryString = this.scopedQuery(brand)
            .count('* as count')
            .andWhere(`${this.tableName}.mediaPath`, mediaPath)
            .toString();

        return this.db.write.query(queryString).then((response) => Number(response.rows[0]?.count || 0));
    }

    deleteForSender(brand: BrandValue, id: string, senderUserId: string): Promise<number> {
        const queryString = this.scopedUpdate(brand, { id, fromUserId: senderUserId })
            .delete()
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }
}
