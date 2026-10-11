import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { REWARD_CHESTS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type RewardChestSource = 'daily-streak';

export interface IDBRewardChest {
    id: string;
    userId: string;
    brandVariation: string;
    source: RewardChestSource;
    sourceKey: string;
    tier: string;
    rarity: string;
    rewardXp: number;
    openedAt: Date;
}

export interface ICreateRewardChestParams {
    userId: string;
    brandVariation: string;
    source: RewardChestSource;
    sourceKey: string;
    tier: string;
    rarity: string;
    rewardXp: number;
}

/**
 * The opened-chest ledger (`habits.reward_chests`). See migration 20261011000001 for why the roll
 * is written before it is paid.
 */
export default class RewardChestsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Record an opened chest. Null when this (user, source, sourceKey) was already opened — by a
     * double tap, a retry or another device — and the caller must then pay nothing.
     */
    claim(params: ICreateRewardChestParams): Promise<IDBRewardChest | null> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${REWARD_CHESTS_TABLE_NAME}
                ("userId", "brandVariation", "source", "sourceKey", "tier", "rarity", "rewardXp")
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
                Math.round(params.rewardXp),
            ],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows[0] || null);
    }

    /**
     * The chest already opened for this (user, source, sourceKey), if any. Pass `usePrimary`
     * straight after a conflicting `claim`, when a replica may not have the row yet.
     */
    get(userId: string, source: RewardChestSource, sourceKey: string, usePrimary = false): Promise<IDBRewardChest | null> {
        const queryString = knexBuilder
            .select('*')
            .from(REWARD_CHESTS_TABLE_NAME)
            .where({ userId, source, sourceKey })
            .limit(1)
            .toString();

        const pool = usePrimary ? this.db.write : this.db.read;
        return pool.query(queryString).then((response) => response.rows[0] || null);
    }
}
