import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { DAILY_BONUSES_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type DailyBonusSource = 'daily-streak';

export interface IDBDailyBonus {
    id: string;
    userId: string;
    brandVariation: string;
    source: DailyBonusSource;
    sourceKey: string;
    tier: string;
    rarity: string;
    bonusXp: number;
    awardedAt: Date;
}

export interface ICreateDailyBonusParams {
    userId: string;
    brandVariation: string;
    source: DailyBonusSource;
    sourceKey: string;
    tier: string;
    rarity: string;
    bonusXp: number;
}

/**
 * The daily-bonus ledger (`habits.daily_bonuses`). See migration 20261011000001 for why the roll
 * is written before it is paid.
 */
export default class DailyBonusesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Record a rolled bonus. Null when this (user, source, sourceKey) already has one — a retry,
     * a re-done check-in or another device got there first — and the caller must pay nothing.
     */
    claim(params: ICreateDailyBonusParams): Promise<IDBDailyBonus | null> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${DAILY_BONUSES_TABLE_NAME}
                ("userId", "brandVariation", "source", "sourceKey", "tier", "rarity", "bonusXp")
             VALUES (?::uuid, ?, ?, ?, ?, ?, ?)
             ON CONFLICT ("userId", "source", "sourceKey") DO NOTHING
             RETURNING *`,
            [
                params.userId,
                params.brandVariation,
                params.source,
                params.sourceKey,
                params.tier,
                params.rarity,
                Math.round(params.bonusXp),
            ],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows[0] || null);
    }

    /**
     * The bonus already awarded for this (user, source, sourceKey), if any. Reads the write pool:
     * the celebration that shows it is built straight after the check-in that wrote it, when a
     * replica may not have the row yet.
     */
    get(userId: string, source: DailyBonusSource, sourceKey: string): Promise<IDBDailyBonus | null> {
        const queryString = knexBuilder
            .select('*')
            .from(DAILY_BONUSES_TABLE_NAME)
            .where({ userId, source, sourceKey })
            .limit(1)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0] || null);
    }
}
