import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { INTERESTS_TABLE_NAME, USER_INTERESTS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// How long it takes an untouched affinity score to halve. A local-discovery product wants
// seasonal interests to fade within a quarter or so, and 45 days puts a score ~1% of its
// original value after 10 months of no engagement. Env-tunable because the right value can
// only be found from real consumption data, and changing it must not require a deploy.
const AFFINITY_HALF_LIFE_DAYS = Number(process.env.INTEREST_AFFINITY_HALF_LIFE_DAYS) || 45;
const AFFINITY_HALF_LIFE_SECONDS = AFFINITY_HALF_LIFE_DAYS * 24 * 60 * 60;

// Weight applied to affinity when engagement CREATES a row — i.e. the user engaged with an
// interest they never picked. Behavior is a weaker signal than an explicit choice, so a
// discovered interest starts below a declared one that saw the same engagement.
const IMPLICIT_DISCOVERY_DISCOUNT = Number(process.env.INTEREST_IMPLICIT_DISCOUNT) || 0.6;

export interface ICreateUserInterestParams {
    userId: string;
    interestId: string;
    isEnabled?: boolean;
    score?: number;
    engagementCount?: number;
}

export default class UserInterestsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string) {
        let queryString = knexBuilder
            .from(USER_INTERESTS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getByInterestId(interestId: string) {
        return this.get({ interestId });
    }

    getByUserId(userId: string) {
        return this.get({ userId }, 'score');
    }

    getById(id: string) {
        return this.get({ id });
    }

    getByUserIds(userIds: string[], conditions: any, orderBy?: string, returning?: string[]) {
        let queryString = knexBuilder
            .select(`${USER_INTERESTS_TABLE_NAME}.*`)
            .from(USER_INTERESTS_TABLE_NAME)
            .innerJoin(INTERESTS_TABLE_NAME, `${INTERESTS_TABLE_NAME}.id`, `${USER_INTERESTS_TABLE_NAME}.interestId`)
            .columns([
                `${INTERESTS_TABLE_NAME}.emoji`,
                `${INTERESTS_TABLE_NAME}.displayNameKey`,
            ])
            .where(conditions)
            .whereIn('userId', userIds);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        return this.db.read.query(queryString.toString())
            .then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'interests', propId: 'id' }]));
    }

    create(params: ICreateUserInterestParams[]) {
        const modifiedParams = params.map((param) => ({
            ...param,
            score: Math.min(param.score || 5, 5), // Ensure no greater than 5
        }));
        const queryString = knexBuilder.insert(modifiedParams)
            .into(USER_INTERESTS_TABLE_NAME)
            .onConflict(['userId', 'interestId'])
            .merge()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(USER_INTERESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }

    /**
     * Applies a different increment per interest key in one statement, decaying the stored
     * affinity toward the present as it goes, and creating a row when the user engages with
     * an interest they never declared.
     *
     * Engagement used to arrive one content view at a time, each becoming its own
     * cross-service request and its own multi-row UPDATE. Callers now coalesce a user's
     * views in-process and flush them as a single map, so the write volume tracks flush
     * intervals instead of impressions.
     *
     * Decay is applied on write rather than by a scheduled job:
     *
     *     affinityScore := affinityScore * 0.5 ^ (secondsSinceLastEngagement / halfLife) + weight
     *
     * so a row is only ever touched when that user engages, and no sweep over the whole
     * table is needed to keep scores current. A row read long after its last write is
     * "stale high", which is why any future read path must apply the same decay factor at
     * read time rather than trusting the stored number verbatim.
     *
     * Rows that do not exist are INSERTed as `source = 'implicit'` and `isEnabled = false`,
     * at a discount to declared interests: behavior is a weaker signal than an explicit
     * pick, and an implicit row must not start competing with declared ones on equal terms.
     * `isEnabled = false` keeps discovered interests out of every existing read path — they
     * accumulate evidence for a later "enable this?" prompt without silently changing what
     * the user sees today.
     *
     * SHADOW MODE: engagementCount is still maintained in step, and is still what
     * getInterestRanking ranks on. Nothing reads affinityScore yet.
     */
    incrementUserInterestsByKey(userId: string, incrementsByKey: { [displayNameKey: string]: number }) {
        const entries = Object.entries(incrementsByKey || {})
            .map(([key, incrBy]) => [key, Math.floor(Number(incrBy))] as [string, number])
            .filter(([key, incrBy]) => !!key && Number.isFinite(incrBy) && incrBy > 0);

        if (!userId || !entries.length) {
            return Promise.resolve([]);
        }

        // Built in the order the placeholders appear in the finished statement — pg numbers
        // them by position in the string, not by clause.
        const valuesBindings: any[] = [];
        entries.forEach(([key, incrBy]) => {
            valuesBindings.push(key, incrBy);
        });
        const bindings: any[] = [
            userId, // SELECT ?::uuid
            IMPLICIT_DISCOVERY_DISCOUNT, // v.incr * ?::real
            ...valuesBindings, // VALUES (?, ?::integer), ...
            AFFINITY_HALF_LIFE_SECONDS, // decay divisor in the conflict branch
        ];

        // Table names are written out rather than interpolated from the tableNames
        // constants: knex quotes identifiers for builder calls, but raw SQL does not, and
        // unquoted main.userInterests would fold to "userinterests" and fail.
        //
        // The INSERT..SELECT..ON CONFLICT shape (rather than an UPDATE..FROM) is what makes
        // discovery possible: the join against main.interests resolves displayNameKey to an
        // interestId whether or not the user already has a row for it.
        //
        // EXCLUDED."engagementCount" carries the *undiscounted* weight into the conflict
        // branch — the discount belongs only to rows this statement is creating, not to
        // interests the user actually declared.
        const valuesPlaceholders = entries.map(() => '(?, ?::integer)').join(', ');
        const queryString = knexBuilder.raw(
            `INSERT INTO main."userInterests"
                ("userId", "interestId", "affinityScore", "engagementCount", "lastEngagedAt", "isEnabled", "source")
             SELECT ?::uuid, i.id, v.incr * ?::real, v.incr, NOW(), false, 'implicit'
               FROM (VALUES ${valuesPlaceholders}) AS v(key, incr)
               JOIN main."interests" AS i ON i."displayNameKey" = v.key
             ON CONFLICT ("userId", "interestId") DO UPDATE SET
                "affinityScore" = main."userInterests"."affinityScore"
                    * POWER(
                        0.5,
                        EXTRACT(EPOCH FROM (NOW() - COALESCE(main."userInterests"."lastEngagedAt", NOW()))) / ?::real
                    )
                    + EXCLUDED."engagementCount",
                "engagementCount" = main."userInterests"."engagementCount" + EXCLUDED."engagementCount",
                "lastEngagedAt" = NOW(),
                "updatedAt" = NOW()
             RETURNING main."userInterests".*`,
            bindings,
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    delete(id: string, userId: string) {
        const queryString = knexBuilder.where({ id, userId })
            .delete()
            .into(USER_INTERESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
