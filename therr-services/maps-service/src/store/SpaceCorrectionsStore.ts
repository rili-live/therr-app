import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_CORRECTIONS_TABLE_NAME = 'main.spaceCorrections';

export type SpaceCorrectionFieldName = 'phoneNumber' | 'websiteUrl' | 'openingHours';

export interface IUpsertCorrectionParams {
    spaceId: string;
    userId?: string;
    submitterIdentityHash?: string;
    fieldName: SpaceCorrectionFieldName;
    submittedValue: unknown;
    normalizedValue: string;
    userAgent?: string;
}

export interface IApplyResult {
    didApply: boolean;
    agreementCount: number;
    spaceExists: boolean;
    isOwnerClaimed: boolean;
}

export interface ISubmitOptions {
    threshold: number;
    superAdminId: string;
}

// Pending rows older than this are not counted toward agreement. A real cron
// can sweep them and flip status to 'expired'; for v1 the lazy filter is fine.
const STALENESS_DAYS = 30;

// Columns on main.spaces that correctionable fields map to. Locked here so the
// SQL never substitutes an arbitrary identifier.
const FIELD_TO_COLUMN: Record<SpaceCorrectionFieldName, string> = {
    phoneNumber: 'phoneNumber',
    websiteUrl: 'websiteUrl',
    openingHours: 'openingHours',
};

export default class SpaceCorrectionsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    private async upsertOnClient(client: any, params: IUpsertCorrectionParams): Promise<void> {
        const isAuthed = !!params.userId;
        const conflictCols = isAuthed
            ? '("spaceId", "fieldName", "userId") WHERE "userId" IS NOT NULL'
            : '("spaceId", "fieldName", "submitterIdentityHash") WHERE "submitterIdentityHash" IS NOT NULL';

        const sql = `
            INSERT INTO main."spaceCorrections"
                ("spaceId", "userId", "submitterIdentityHash", "fieldName",
                 "submittedValue", "normalizedValue", "status", "userAgent",
                 "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'pending', $7, NOW(), NOW())
            ON CONFLICT ${conflictCols}
            DO UPDATE SET
                "submittedValue" = EXCLUDED."submittedValue",
                "normalizedValue" = EXCLUDED."normalizedValue",
                "status" = 'pending',
                "appliedAt" = NULL,
                "userAgent" = EXCLUDED."userAgent",
                "updatedAt" = NOW()
        `;
        await client.query(sql, [
            params.spaceId,
            params.userId || null,
            params.submitterIdentityHash || null,
            params.fieldName,
            JSON.stringify(params.submittedValue),
            params.normalizedValue,
            params.userAgent || null,
        ]);
    }

    private async countAgreementOnClient(
        client: any,
        spaceId: string,
        fieldName: SpaceCorrectionFieldName,
        normalizedValue: string,
    ): Promise<number> {
        const sql = `
            SELECT COUNT(*)::int AS count
            FROM main."spaceCorrections"
            WHERE "spaceId" = $1
              AND "fieldName" = $2
              AND "normalizedValue" = $3
              AND "status" = 'pending'
              AND "updatedAt" > NOW() - INTERVAL '${STALENESS_DAYS} days'
        `;
        const result = await client.query(sql, [spaceId, fieldName, normalizedValue]);
        return result.rows[0]?.count ?? 0;
    }

    /**
     * Atomically: upsert the submission, then count distinct identities for
     * the (spaceId, fieldName, normalizedValue) bucket. If autoApplyAllowed
     * is true AND the count meets the threshold, write to main.spaces and
     * flip statuses. Returns whether the apply happened plus the count
     * (post-upsert).
     *
     * The SELECT FOR UPDATE on main.spaces serializes concurrent
     * threshold-crossing submitters so we don't double-apply.
     */
    async submitAndMaybeApply(
        params: IUpsertCorrectionParams,
        opts: ISubmitOptions,
    ): Promise<IApplyResult> {
        const column = FIELD_TO_COLUMN[params.fieldName];
        if (!column) {
            throw new Error(`Unsupported correction field: ${params.fieldName}`);
        }

        const client = await this.db.write.connect();
        try {
            await client.query('BEGIN');
            // Lock the space row to serialize concurrent applies for the same space
            // AND read the ownership flags we need to decide auto-apply.
            const spaceRow = await client.query(
                `SELECT id, "fromUserId", "requestedByUserId"
                 FROM main.spaces WHERE id = $1 FOR UPDATE`,
                [params.spaceId],
            );
            if (spaceRow.rowCount === 0) {
                await client.query('ROLLBACK');
                return {
                    didApply: false, agreementCount: 0, spaceExists: false, isOwnerClaimed: false,
                };
            }
            const space = spaceRow.rows[0];
            const isOwnerClaimed = space.fromUserId !== opts.superAdminId || space.requestedByUserId != null;
            const autoApplyAllowed = !isOwnerClaimed;

            await this.upsertOnClient(client, params);
            const agreementCount = await this.countAgreementOnClient(
                client,
                params.spaceId,
                params.fieldName,
                params.normalizedValue,
            );

            let didApply = false;
            if (autoApplyAllowed && agreementCount >= opts.threshold) {
                // Idempotent write — IS DISTINCT FROM no-ops when a parallel txn already applied.
                // openingHours stores the canonical object as jsonb; phone/website are text columns
                // and the submittedValue is a JSON-encoded string, so we need different write paths.
                if (params.fieldName === 'openingHours') {
                    await client.query(
                        `UPDATE main.spaces
                         SET "${column}" = $2::jsonb, "updatedAt" = NOW()
                         WHERE id = $1 AND "${column}"::text IS DISTINCT FROM $2::jsonb::text`,
                        [params.spaceId, JSON.stringify(params.submittedValue)],
                    );
                } else {
                    // phoneNumber and websiteUrl are text columns. submittedValue
                    // is the JS string the submitter sent (the handler enforces
                    // this for these fields).
                    if (typeof params.submittedValue !== 'string') {
                        throw new Error(`Expected string for ${params.fieldName}`);
                    }
                    await client.query(
                        `UPDATE main.spaces
                         SET "${column}" = $2, "updatedAt" = NOW()
                         WHERE id = $1 AND "${column}" IS DISTINCT FROM $2`,
                        [params.spaceId, params.submittedValue],
                    );
                }

                await client.query(
                    `UPDATE main."spaceCorrections"
                     SET "status" = 'applied', "appliedAt" = NOW(), "updatedAt" = NOW()
                     WHERE "spaceId" = $1 AND "fieldName" = $2
                       AND "normalizedValue" = $3 AND "status" = 'pending'`,
                    [params.spaceId, params.fieldName, params.normalizedValue],
                );

                await client.query(
                    `UPDATE main."spaceCorrections"
                     SET "status" = 'superseded', "updatedAt" = NOW()
                     WHERE "spaceId" = $1 AND "fieldName" = $2
                       AND "normalizedValue" <> $3 AND "status" = 'pending'`,
                    [params.spaceId, params.fieldName, params.normalizedValue],
                );

                didApply = true;
            }

            await client.query('COMMIT');
            return {
                didApply, agreementCount, spaceExists: true, isOwnerClaimed,
            };
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch { /* ignore */ }
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Aggregate of pending corrections for a space, grouped by field and value.
     * Returns one row per distinct (fieldName, normalizedValue) with a count
     * and a sample submittedValue for display. Reads only.
     */
    getPendingSummary(spaceId: string) {
        const queryString = knexBuilder
            .select(
                'fieldName',
                'normalizedValue',
                knexBuilder.raw('COUNT(*)::int AS "agreementCount"'),
                knexBuilder.raw('MAX("submittedValue"::text) AS "sampleValue"'),
                knexBuilder.raw('MAX("updatedAt") AS "lastSubmittedAt"'),
            )
            .from(SPACE_CORRECTIONS_TABLE_NAME)
            .where({ spaceId, status: 'pending' })
            .andWhere(knexBuilder.raw(`"updatedAt" > NOW() - INTERVAL '${STALENESS_DAYS} days'`))
            .groupBy('fieldName', 'normalizedValue')
            .orderBy('fieldName')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }
}
