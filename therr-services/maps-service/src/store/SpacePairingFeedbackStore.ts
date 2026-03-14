import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_PAIRING_FEEDBACK_TABLE_NAME = 'main.spacePairingFeedback';

export interface ICreateSpacePairingFeedbackParams {
    sourceSpaceId: string;
    pairedSpaceId: string;
    userId?: string;
    isHelpful: boolean;
}

export default class SpacePairingFeedbackStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    create(params: ICreateSpacePairingFeedbackParams) {
        if (params.userId) {
            // Upsert for authenticated users
            const queryString = knexBuilder.raw(`
                INSERT INTO main."spacePairingFeedback" ("sourceSpaceId", "pairedSpaceId", "userId", "isHelpful")
                VALUES (?, ?, ?, ?)
                ON CONFLICT ("sourceSpaceId", "pairedSpaceId", "userId") WHERE "userId" IS NOT NULL
                DO UPDATE SET "isHelpful" = EXCLUDED."isHelpful"
                RETURNING *
            `, [params.sourceSpaceId, params.pairedSpaceId, params.userId, params.isHelpful]).toString();

            return this.db.write.query(queryString).then((response) => response.rows);
        }

        // Simple insert for anonymous users
        const queryString = knexBuilder.insert({
            sourceSpaceId: params.sourceSpaceId,
            pairedSpaceId: params.pairedSpaceId,
            isHelpful: params.isHelpful,
        })
            .into(SPACE_PAIRING_FEEDBACK_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    getAggregateBySourceId(sourceSpaceId: string) {
        const queryString = knexBuilder
            .select(
                'pairedSpaceId',
                knexBuilder.raw('COUNT(*) FILTER (WHERE "isHelpful" = true) AS "helpfulCount"'),
                knexBuilder.raw('COUNT(*) FILTER (WHERE "isHelpful" = false) AS "notHelpfulCount"'),
            )
            .from(SPACE_PAIRING_FEEDBACK_TABLE_NAME)
            .where({ sourceSpaceId })
            .groupBy('pairedSpaceId')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }
}
