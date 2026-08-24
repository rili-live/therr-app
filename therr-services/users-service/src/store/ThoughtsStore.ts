import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import {
    BrandVariations,
    Categories,
    Content,
    getReadableBrands,
} from 'therr-js-utilities/constants';
import { withBrandOnInsert } from 'therr-js-utilities/db';
import { detectLocality, getBoundingBox } from 'therr-js-utilities/location';
import type { IBoundingBox } from 'therr-js-utilities/location';
import {
    IAlgorithmProfile,
    getDefaultAlgorithmProfile,
    getScoreSqlExpression,
} from 'therr-js-utilities/content-ranking';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { IConnection } from './connection';
import { isTextUnsafe } from '../utilities/contentSafety';
import UsersStore from './UsersStore';
import UserLocationsStore from './UserLocationsStore';

type BrandValue = BrandVariations | string;

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const THOUGHTS_TABLE_NAME = 'main.thoughts';

/**
 * The thought's own coordinates as a PostGIS point.
 *
 * Built on the fly rather than stored: `main.thoughts` holds plain lat/long doubles, which
 * is what keeps the writers simple (therr-ai-automator writes this table directly from
 * another repository) and what the partial btree index is on. Only rows that already
 * passed the bounding-box filter ever reach this expression.
 */
const THOUGHT_POINT_SQL = `ST_MakePoint(${THOUGHTS_TABLE_NAME}."longitude", ${THOUGHTS_TABLE_NAME}."latitude")`;

/** A point to find thoughts near, plus how far "near" reaches. */
export interface INearLocation {
    latitude: number;
    longitude: number;
    radiusMeters: number;
}

interface INormalizedNearLocation extends INearLocation {
    box: IBoundingBox;
}

/**
 * Validates a caller-supplied point and precomputes its bounding box.
 *
 * Returns undefined — meaning "run the ordinary, non-local query" — for anything unusable
 * rather than throwing or emitting NaN into SQL. The coordinates originate in
 * `main.userLocations`, where latitude and longitude are nullable, so a user with a
 * half-written location row is an expected input on the feed's hot path, not an error.
 */
const normalizeNearLocation = (location?: INearLocation): INormalizedNearLocation | undefined => {
    if (!location) {
        return undefined;
    }

    const { latitude, longitude, radiusMeters } = location;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !(radiusMeters > 0)) {
        return undefined;
    }

    return {
        latitude,
        longitude,
        radiusMeters,
        box: getBoundingBox(latitude, longitude, radiusMeters),
    };
};

// The hot-score expression now comes from therr-js-utilities `content-ranking`, which emits it
// from the user's selected algorithm profile. Under the default (PULSE) it produces the exact
// string this file used to hardcode — content-ranking's tests assert that byte-for-byte, and
// the tests in this file still assert it here, so the default ranking cannot move silently.
//
// The GREATEST(..., 0) age clamp moved with it and is still load-bearing: a thought dated in
// the future makes (age + 2) negative, and POWER(<negative>, 1.5) is a hard Postgres ERROR
// ("a negative number raised to a non-integer power yields a complex result"), not a NULL.
// That aborts the whole candidate query, so a single future-dated row silently froze the
// activation feed for every user. therr-ai-automator post-dates generated thoughts, so such
// rows are routinely present. The candidate pool below also excludes future rows; the clamp is
// the second line of defense, because the cost of getting it wrong is a total feed outage
// rather than one mis-ranked post.

// The subset of an original thought that a repost embed renders. Deliberately narrow: the
// embed is a preview, and selecting `*` here would ship every moderation/valuation column of
// somebody else's post to the client on every feed page that contains a repost.
const REPOST_ORIGINAL_COLUMNS = [
    'id',
    'fromUserId',
    'message',
    'category',
    'hashTags',
    'isPublic',
    'createdAt',
];

export interface ICreateThoughtParams {
    parentId?: string;
    areaType?: string;
    category?: string;
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    isMatureContent?: boolean;
    isRepost?: boolean;
    repostThoughtId?: string;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    media?: any;
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
    interestsKeys?: string[];
    /**
     * Set by `create` when the message names a city — never accepted from a caller. See the
     * comment at the assignment for why, and note the pair-or-nothing rule: the local
     * candidate query filters on `latitude IS NOT NULL` and computes distance from both
     * columns, so half a pair is a row claiming to be somewhere while matching nothing.
     */
    latitude?: number;
    longitude?: number;
    locality?: string;
}

interface IDeleteThoughtsParams {
    fromUserId: string;
    ids: string[];
}

/**
 * Where the previous page of the journal stopped, as the journal defines it.
 *
 * Structurally identical to `IJournalFeedCursor` in `JournalEntriesStore`, and
 * deliberately re-declared rather than imported: this store must not take a
 * dependency on the journal's module just to name a pair of strings.
 */
export interface IThoughtJournalCursor {
    occurredAt: string;
    id: string | null;
}

/**
 * One of the user's own posts, shaped for the journal feed.
 *
 * The journal only needs enough to render a row and open the thought, so this
 * deliberately does not return the full thought record.
 */
export interface IThoughtJournalRow {
    id: string;
    occurredAt: Date;
    message: string;
    category: string | null;
    isPublic: boolean;
    hashTags: string | null;
}

export default class ThoughtsStore {
    db: IConnection;

    usersStore: UsersStore;

    /**
     * Reads the author's own location, to check they are near the city their post names.
     *
     * Optional so the many places that build a ThoughtsStore for a read path do not have to
     * supply one. When it is absent, `create` tags nothing at all — city detection fails
     * closed rather than falling back to "tag it anyway", because the only thing this
     * dependency does is enforce a check on user-controlled input.
     */
    userLocationsStore?: UserLocationsStore;

    constructor(dbConnection, usersStore, userLocationsStore?: UserLocationsStore) {
        this.db = dbConnection;
        this.usersStore = usersStore;
        this.userLocationsStore = userLocationsStore;
    }

    /**
     * The author's own coordinates, or undefined if we cannot establish them.
     *
     * Deliberately the same lookup the thought distributor uses to decide which local feed a
     * user is served (`getPrimary`), which is what keeps the write rule and the read rule
     * symmetrical: you can only tag a city whose local content you would yourself see.
     *
     * Never throws. Somebody's post must not fail to save because a location lookup did, and
     * the degraded outcome — an untagged post — is exactly what every post did before this
     * feature existed.
     */
    private async getAuthorLocation(fromUserId?: string) {
        if (!this.userLocationsStore || !fromUserId) {
            return undefined;
        }

        try {
            return await this.userLocationsStore.getPrimary(fromUserId);
        } catch (error: any) {
            logSpan({
                level: 'error',
                messageOrigin: 'SQL:THOUGHTS_STORE',
                messages: [error?.message],
                traceArgs: {
                    issue: 'failed to resolve author location for city detection',
                    'user.id': fromUserId,
                },
            });

            return undefined;
        }
    }

    // Combine with search to avoid getting count out of sync
    countRecords(brand: BrandValue, params, fromUserIds) {
        let queryString = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .count('*');

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            queryString = queryString.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (params.filterBy === 'fromUserIds') {
            queryString = queryString.andWhere((builder) => {
                builder.whereIn('fromUserId', fromUserIds);
            });
        } else if (params.query != undefined) { // eslint-disable-line eqeqeq
            queryString = queryString.andWhere({
                [params.filterBy]: params.query || '',
            });
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    /**
     * Selects candidate thoughts to activate for a user's stream, ranked by a "hot" score:
     * reply count (the strongest engagement signal available in this DB) dampened by age
     * (Hacker-News-style gravity). The score can't use an index, so candidates are first
     * bounded to the most recent pool via an index-friendly inner query, then re-ranked.
     *
     * The correlated reply-count subquery is deliberate — do NOT rewrite it as a join
     * against a GROUP BY "parentId" aggregate. Benchmarked on pg15 with 100k parents /
     * 500k replies (2026-07-21): correlated = 200 index-only probes on the parentId
     * index, ~14ms; grouped join = full aggregate over every reply row, ~74ms, and it
     * degrades with total reply volume while the correlated shape scales only with
     * candidatePoolSize.
     *
     * Rows come back as { ...returning, hotScore }. `hotScore` is persisted onto the
     * reaction row at activation (thoughtReactions.relevanceScore) and is what the stream
     * is ordered by on read.
     *
     * `nearLocation` restricts candidates to thoughts *about* somewhere near a point — posts
     * carrying coordinates of their own (20260821000001_main.thoughts.location.js), which
     * today means therr-ai-automator's location-aware bots. Omitted, the query is unchanged
     * and location-tagged rows compete on hotness like anything else; supplied, the caller
     * gets only local candidates back, and every row is guaranteed to have coordinates, so
     * profiles with a geo weight can rank by proximity.
     */
    /* eslint-disable default-param-last */
    // `nearLocation` is optional and goes after the params that already have defaults;
    // reordering the signature to satisfy the rule would break every existing caller.
    getRecentThoughts(
        brand: BrandValue,
        limit = 1,
        relatedInterestsKeys: string[] = [],
        returning = ['id'],
        profile: IAlgorithmProfile = getDefaultAlgorithmProfile(),
        nearLocation?: INearLocation,
    ) {
        /* eslint-enable default-param-last */
        const interestsPlaceholders = relatedInterestsKeys.map(() => '?').join(', ');
        const location = normalizeNearLocation(nearLocation);
        // Built once and reused in the SELECT, the ORDER BY, and (when capping per author) the
        // window function, so the persisted score always explains the order the rows came back
        // in. Under PULSE this emits the exact expression that shipped before profiles existed.
        const scoreExpression = getScoreSqlExpression(profile, {
            engagementCount: '"replyCount"',
            createdAt: '"createdAt"',
            // Referenced by alias rather than recomputing ST_Distance in the outer query:
            // the inner query already paid for it, and two copies of the expression are two
            // chances for the SELECTed score and the ORDER BY to drift.
            distanceMeters: location ? '"distanceMeters"' : undefined,
        });
        // PULSE caps at 0 (uncapped), which must skip the extra query layer entirely rather
        // than emit a no-op window — that is what keeps the default path's SQL unchanged.
        const shouldCapPerAuthor = profile.maxPerAuthor > 0;
        const candidateColumns = shouldCapPerAuthor
            ? [...returning, 'createdAt', 'fromUserId']
            : [...returning, 'createdAt'];

        let innerQuery = knexBuilder.select(candidateColumns)
            .select(knexBuilder.raw(
                `(SELECT COUNT(*) FROM ${THOUGHTS_TABLE_NAME} AS c WHERE c."parentId" = ${THOUGHTS_TABLE_NAME}.id) AS "replyCount"`,
            ))
            .from(THOUGHTS_TABLE_NAME)
            .whereNull('parentId') // only parent thoughts get stream slots; replies activate with their parent
            .andWhere({
                isPublic: true,
                isMatureContent: false,
            })
            // Future-dated thoughts are a scheduling queue, not feed candidates. therr-ai-automator
            // post-dates generated thoughts to drip them out over the gap until its next run, and
            // `ThoughtsStore.find` will not render one until its timestamp arrives. Activating it
            // early burns a stream slot on a post that comes back as nothing — and, before the
            // GREATEST clamp above, made the hot score error out and killed the whole query.
            .andWhereRaw(`${THOUGHTS_TABLE_NAME}."createdAt" <= NOW()`)
            .orderBy('createdAt', 'desc')
            .limit(profile.candidatePoolSize);

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            innerQuery = innerQuery.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (relatedInterestsKeys?.length) {
            // TODO: Test this with various interests lists
            innerQuery = innerQuery.whereRaw(`"interestsKeys" \\?| ARRAY[${interestsPlaceholders}]::text[]`, relatedInterestsKeys);
        }

        if (location) {
            // Two-stage radius search. The bounding box is what the partial index on
            // ("latitude", "longitude") can actually serve; ST_DWithin then trims the corners
            // of the box that fall outside the circle. Doing only the exact test would mean a
            // sequential scan of every thought ever posted, and doing only the box would let
            // in points up to ~41% past the radius at the diagonals.
            const {
                box,
                latitude,
                longitude,
                radiusMeters,
            } = location;
            innerQuery = innerQuery
                .whereNotNull(`${THOUGHTS_TABLE_NAME}.latitude`)
                .andWhereBetween(`${THOUGHTS_TABLE_NAME}.latitude`, [box.minLatitude, box.maxLatitude]);

            // A box spanning the antimeridian has a min greater than its max, so BETWEEN
            // matches nothing. Dropping the predicate costs index selectivity for the handful
            // of users near ±180° and keeps the result correct, which ST_DWithin still
            // guarantees on its own.
            if (!box.wrapsAntimeridian) {
                innerQuery = innerQuery.andWhereBetween(`${THOUGHTS_TABLE_NAME}.longitude`, [box.minLongitude, box.maxLongitude]);
            }

            innerQuery = innerQuery
                .andWhereRaw(
                    `ST_DWithin(${THOUGHT_POINT_SQL}::geography, ST_MakePoint(?, ?)::geography, ?)`,
                    [longitude, latitude, radiusMeters],
                )
                .select(knexBuilder.raw(
                    `ST_Distance(${THOUGHT_POINT_SQL}::geography, ST_MakePoint(?, ?)::geography) AS "distanceMeters"`,
                    [longitude, latitude],
                ));
        }

        // Author diversity, for profiles that ask for it (FOCUS keeps 2 per author). Ranked by
        // score rather than recency so each author keeps their *best* candidates, not their
        // newest — a prolific poster should lose their weakest posts, not their strongest.
        // Applied as its own layer so the cap runs against the already-filtered pool.
        const candidateSource: any = shouldCapPerAuthor
            ? knexBuilder
                .select('*')
                .select(knexBuilder.raw(`ROW_NUMBER() OVER (PARTITION BY "fromUserId" ORDER BY ${scoreExpression} DESC) AS "authorRank"`))
                .from(innerQuery.as('candidates'))
                .as('ranked')
            : innerQuery.as('candidates');

        let query = knexBuilder.select(returning)
            // Returned alongside the id so the caller can persist it onto the reaction row.
            // Without this the ranking below only decides which thoughts activate and is then
            // lost — the feed reads reactions back in activation order, not score order.
            .select(knexBuilder.raw(`${scoreExpression} AS "hotScore"`))
            .from(candidateSource);

        if (shouldCapPerAuthor) {
            query = query.where('authorRank', '<=', profile.maxPerAuthor);
        }

        query = query
            .orderByRaw(`${scoreExpression} DESC`)
            .limit(limit);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    search(brand: BrandValue, conditions: any = {}, returning, fromUserIds = [], overrides?: any, includePublicResults = true) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select((returning && returning.length) ? returning : '*')
            .from(THOUGHTS_TABLE_NAME)
            // This query had no ORDER BY at all, which made its LIMIT/OFFSET pagination
            // unsound — Postgres is free to return rows in any order, so paging could repeat
            // and skip rows. createdAt is indexed (idx from 20221222143544_main.thoughts);
            // id breaks ties so a page boundary can't land mid-tie. updatedAt is deliberately
            // still avoided here — it is unindexed and was measured as slow.
            // TODO: Determine a better way to select thoughts that are most relevant to the user
            .orderBy(`${THOUGHTS_TABLE_NAME}.createdAt`, 'desc')
            .orderBy(`${THOUGHTS_TABLE_NAME}.id`, 'desc')
            .where({
                isMatureContent: false, // content that has been blocked
            });

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            queryString = queryString.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (conditions.filterBy && conditions.query != undefined) { // eslint-disable-line eqeqeq
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;

            if (conditions.filterBy === 'fromUserIds') {
                queryString = queryString.andWhere((builder) => {
                    builder.whereIn('fromUserId', fromUserIds);
                    if (includePublicResults) {
                        builder.orWhere({ isPublic: true });
                    }
                });
            } else {
                queryString = queryString.andWhere(conditions.filterBy, operator, query);
                queryString = queryString.andWhere((builder) => {
                    builder.where(conditions.filterBy, operator, query);
                    if (includePublicResults) {
                        builder.orWhere({ isPublic: true });
                    }
                });
            }
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then(async (response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            await this.attachRepostDetails(brand, configuredResponse);
            return configuredResponse;
        });
    }

    /**
     * Loads the originals behind whichever rows in `thoughts` are reposts, plus how many times
     * each row in `thoughts` has itself been reposted, and attaches both in place as
     * `repostOf` / `repostCount`.
     *
     * Shared by every read path (`find`, `getById`, `search`) so a repost renders identically
     * in the feed, the details view, and a profile — a repost whose embed is missing on one
     * surface reads to the user as a broken empty post, not as a subtle inconsistency.
     *
     * Brand scoping is applied to the originals lookup, not just inherited from the outer
     * query: the repost and its original are separate rows and nothing stops a Therr user
     * (who reads 'all') from reposting something a HABITS reader must not see. An original
     * that is out of brand, mature, or deleted simply yields no embed, which clients already
     * have to handle.
     *
     * Both queries are skipped when they would be no-ops, so the common case of a page with
     * no reposts on it costs one extra indexed GROUP BY and nothing else.
     *
     * Nested reply previews are decorated too. `find`/`getById` attach up to three replies per
     * parent via a lateral join, and the details view renders a repost control against each —
     * so a reply left out of this walk renders a permanently blank count next to a control that
     * works. Their ids cost nothing extra: they join the same IN-list the parents already use.
     */
    async attachRepostDetails(brand: BrandValue, thoughts: any[]) {
        if (!thoughts?.length) {
            return thoughts;
        }

        const readable = getReadableBrands(brand);
        // Parents and their reply previews, as one flat list. Replies come from the lateral
        // join, whose column list has no `repostThoughtId` — they can only ever take a count,
        // never an embed, which is correct: the insert drops `parentId` on a repost, so a
        // reply is never itself a repost.
        const decoratable = thoughts.reduce((acc: any[], thought) => {
            acc.push(thought);
            (thought?.replies || []).forEach((reply) => acc.push(reply));
            return acc;
        }, []);
        const originalIds = [...new Set(
            decoratable.map((thought) => thought.repostThoughtId).filter((id) => !!id),
        )];
        const thoughtIds = [...new Set(
            decoratable.map((thought) => thought.id).filter((id) => !!id),
        )];

        let originalsQuery = knexBuilder
            .select(REPOST_ORIGINAL_COLUMNS)
            .from(THOUGHTS_TABLE_NAME)
            .whereIn('id', originalIds)
            .andWhere(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false);
        let countsQuery = knexBuilder
            .select('repostThoughtId')
            .count('* as count')
            .from(THOUGHTS_TABLE_NAME)
            .whereIn('repostThoughtId', thoughtIds)
            .groupBy('repostThoughtId');

        if (readable !== 'all') {
            originalsQuery = originalsQuery.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
            countsQuery = countsQuery.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        // Both lookups decorate the page; neither is what the caller asked for. A failure here
        // therefore degrades to "no embed, no count" rather than propagating, because this runs
        // inside every thoughts read path and a throw would take the whole feed down.
        //
        // The case that makes this load-bearing rather than defensive is the deploy window:
        // `_bin/cicd/run-migrations.sh` applies migrations AFTER `kubectl set image`, so the
        // new pod serves traffic against the pre-migration schema for a minute or two. The
        // counts query names "repostThoughtId" on every non-empty page, so without this the
        // entire feed 500s until the migration lands.
        const decorationQuery = (queryString: string, description: string) => this.db.read
            .query(queryString)
            .then((response) => response.rows)
            .catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'SQL:THOUGHTS_STORE',
                    messages: [`failed to load ${description} for repost hydration`],
                    traceArgs: {
                        'error.message': err?.message,
                    },
                });
                return [];
            });

        const [originalRows, countRows] = await Promise.all([
            originalIds.length
                ? decorationQuery(originalsQuery.toString(), 'repost originals')
                : Promise.resolve([]),
            thoughtIds.length
                ? decorationQuery(countsQuery.toString(), 'repost counts')
                : Promise.resolve([]),
        ]);

        // Author details for the embeds. A separate lookup rather than a join because the
        // callers that also fetch users do so for the *reposters*, and merging the two id
        // sets would make an embed's author depend on whether the outer query asked for users.
        const originalAuthors = originalRows.length
            ? await this.usersStore.findUsers({ ids: originalRows.map((row) => row.fromUserId) }).catch(() => [])
            : [];
        const authorsById = (originalAuthors || []).reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        const originalsById = originalRows.reduce((acc, row) => {
            const author = authorsById[row.fromUserId];
            acc[row.id] = {
                ...row,
                fromUserName: author?.userName,
                fromUserFirstName: author?.firstName,
                fromUserLastName: author?.lastName,
                fromUserMedia: author?.media,
                fromUserIsSuperUser: author?.isSuperUser,
            };
            return acc;
        }, {});

        // pg returns COUNT(*) as a bigint string; clients render/compare it as a number
        const countsById = countRows.reduce((acc, row) => {
            acc[row.repostThoughtId] = parseInt(row.count || 0, 10);
            return acc;
        }, {});

        decoratable.forEach((thought) => {
            const modifiedThought = thought;
            modifiedThought.repostCount = countsById[modifiedThought.id] || 0;
            if (modifiedThought.repostThoughtId) {
                modifiedThought.repostOf = originalsById[modifiedThought.repostThoughtId] || null;
            }
        });

        return thoughts;
    }

    /**
     * This is used to check for duplicates before creating a new thought.
     * Scoped to the caller's readable brand set so a duplicate is only flagged
     * against thoughts the caller can actually see.
     */
    get(brand: BrandValue, filters) {
        // hard limit to prevent overloading client
        let query = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .where({
                fromUserId: filters.fromUserId,
                message: filters.message,
            });

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            query = query.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (!filters.parentId) {
            query = query.whereNull('parentId');
        } else {
            query = query.where('parentId', filters.parentId);
        }

        // Reposts are keyed by what they re-share, not only by their text. A plain (unquoted)
        // repost has an empty message, so without this every plain repost after a user's first
        // one would be rejected as a duplicate of it. Discriminating on the column also keeps
        // the check meaningful in the other direction: re-posting the *same* original twice
        // still trips it, which is the "you already reposted this" guard we want.
        if (!filters.repostThoughtId) {
            query = query.whereNull('repostThoughtId');
        } else {
            query = query.where('repostThoughtId', filters.repostThoughtId);
        }

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    /**
     * The user's own posts, newest first, for their journal.
     *
     * In the HABITS app a thought IS a goal — the profile's Goals tab and the
     * journal's "Share a goal" both write here (see the note on
     * `20260427000001_main.thoughts.brandVariation`). So the journal lists them
     * alongside notes and check-ins rather than making the user go to a
     * different screen to see what they posted.
     *
     * WHY THIS IS NOT IN THE JOURNAL'S UNION QUERY
     *
     * `JournalEntriesStore.getFeed` unions the four `habits.*` sources in SQL
     * because they share a schema and need no brand context. This one needs the
     * brand allowlist (`getReadableBrands`), which lives here with the rest of
     * the thoughts access. It is therefore merged in `handlers/journal.ts`, the
     * same way achievements are — which is sound because this returns
     * `limit + 1` rows under exactly the ordering and cursor comparison the
     * other half uses, so the merged top `limit` can never contain an item that
     * fell outside either source's own window.
     *
     * ORDERING must stay `("createdAt" DESC, id::text COLLATE "C" DESC)`. The
     * handler re-sorts both halves together and compares ids with JavaScript's
     * code-point `<`; a locale collation gives punctuation variable weight and
     * would order the dashes in a uuid differently, letting the two halves
     * disagree about what "after the cursor" means and silently drop a row.
     */
    getForJournal(
        brand: BrandValue,
        userId: string,
        before: IThoughtJournalCursor | null,
        limit: number,
    ): Promise<IThoughtJournalRow[]> {
        let query = knexBuilder
            .select([
                `${THOUGHTS_TABLE_NAME}.id`,
                `${THOUGHTS_TABLE_NAME}.message`,
                `${THOUGHTS_TABLE_NAME}.category`,
                `${THOUGHTS_TABLE_NAME}.isPublic`,
                `${THOUGHTS_TABLE_NAME}.hashTags`,
                // Aliased in object form, not as "col AS alias" in a string —
                // knex only splits string aliases on a lowercase " as ".
                { occurredAt: `${THOUGHTS_TABLE_NAME}.createdAt` },
            ])
            .from(THOUGHTS_TABLE_NAME)
            .where(`${THOUGHTS_TABLE_NAME}.fromUserId`, userId)
            // Replies are not goals — they are comments on someone else's post,
            // and a journal full of the user's own replies is noise.
            .whereNull(`${THOUGHTS_TABLE_NAME}.parentId`)
            .where(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false)
            // therr-ai-automator drips a run's output out over ~30h by writing
            // future-dated rows (see the note above `ICreateThoughtParams`). A
            // journal is a record of what already happened, so a row dated
            // tomorrow must not open a section headed with tomorrow's date; it
            // appears on its own once the clock reaches it.
            .whereRaw(`${THOUGHTS_TABLE_NAME}."createdAt" <= now()`);

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            query = query.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (before?.id) {
            query = query.whereRaw(
                `(${THOUGHTS_TABLE_NAME}."createdAt" < ?::timestamptz
                    OR (${THOUGHTS_TABLE_NAME}."createdAt" = ?::timestamptz
                        AND ${THOUGHTS_TABLE_NAME}."id"::text COLLATE "C" < ?))`,
                [before.occurredAt, before.occurredAt, before.id],
            );
        } else if (before) {
            // A bare-ISO cursor from an earlier build stays timestamp-exclusive,
            // matching what `JournalEntriesStore.getFeed` does with one.
            query = query.whereRaw(`${THOUGHTS_TABLE_NAME}."createdAt" < ?::timestamptz`, [before.occurredAt]);
        }

        query = query
            .orderByRaw(`${THOUGHTS_TABLE_NAME}."createdAt" DESC`)
            .orderByRaw(`${THOUGHTS_TABLE_NAME}."id"::text COLLATE "C" DESC`)
            .limit(limit);

        return this.db.read.query(query.toString()).then((response) => response.rows as IThoughtJournalRow[]);
    }

    getById(brand: BrandValue, thoughtId, filters, options: any = {}) {
        // hard limit to prevent overloading client
        let query = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .where(`${THOUGHTS_TABLE_NAME}.id`, thoughtId);

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            query = query.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (options.withReplies) {
            // Restrict the self-join: a HABITS reader must not see therr-brand replies under
            // a habits parent (and vice versa). 'all'-readers (Therr by default) see every reply.
            //
            // Replies deliberately carry NO isPublic filter: clients mint every reply with
            // isPublic=false (see TherrMobile ViewThought handleSubmitReply), so the flag is
            // not a privacy signal on replies — visibility follows the parent thought.
            const repliesJoinClause = readable === 'all'
                ? undefined
                : `replies."brandVariation" IN (${readable.map((b) => `'${b}'`).join(',')})`;

            // Nested reply count powers the reply-count icon in the thought details view (mobile + web).
            // The brand restriction is mirrored from the reply join so the count can never advertise
            // replies the caller would not be allowed to open. It is deliberately a correlated
            // subquery rather than a second join: the details view loads one parent, so this is a
            // handful of index probes on the parentId index, and a GROUP BY join would aggregate
            // every reply row in the table.
            const nestedRepliesBrandClause = readable === 'all'
                ? ''
                : ` AND nested."brandVariation" IN (${readable.map((b) => `'${b}'`).join(',')})`;
            query = query
                .leftJoin(`${THOUGHTS_TABLE_NAME} as replies`, function joinReplies() {
                    this.on('replies.parentId', '=', `${THOUGHTS_TABLE_NAME}.id`);
                    if (repliesJoinClause) {
                        this.andOn(knexBuilder.raw(repliesJoinClause));
                    }
                })
                .columns([
                    `${THOUGHTS_TABLE_NAME}.*`,
                    // The CASE is load-bearing, not defensive: on a thought with no replies the
                    // left join yields a row of NULL reply columns, but COUNT(*) still returns 0
                    // — never NULL. formatSQLJoinAsJSON treats any non-null `replies[].*` value as
                    // proof a reply exists, so an unguarded count fabricates a phantom reply
                    // `{ replyCount: 0 }` with no id, which then renders as an empty card and
                    // 404s the moment it is opened.
                    knexBuilder.raw(
                        'CASE WHEN replies.id IS NULL THEN NULL ELSE '
                        + `(SELECT COUNT(*) FROM ${THOUGHTS_TABLE_NAME} AS nested `
                        + `WHERE nested."parentId" = replies.id${nestedRepliesBrandClause}) END AS "replies[].replyCount"`,
                    ),
                    'replies.id as replies[].id',
                    'replies.fromUserId as replies[].fromUserId',
                    'replies.parentId as replies[].parentId',
                    'replies.isPublic as replies[].isPublic',
                    'replies.isRepost as replies[].isRepost',
                    'replies.message as replies[].message',
                    'replies.mediaIds as replies[].mediaIds',
                    'replies.mentionsIds as replies[].mentionsIds',
                    'replies.hashTags as replies[].hashTags',
                    'replies.maxViews as replies[].maxViews',
                    'replies.isMatureContent as replies[].isMatureContent',
                    'replies.isModeratorApproved as replies[].isModeratorApproved',
                    'replies.isForSale as replies[].isForSale',
                    'replies.isHirable as replies[].isHirable',
                    'replies.isPromotional as replies[].isPromotional',
                    'replies.isExclusiveToGroups as replies[].isExclusiveToGroups',
                    'replies.category as replies[].category',
                    'replies.isScheduledAt as replies[].isScheduledAt',
                    'replies.createdAt as replies[].createdAt',
                    'replies.updatedAt as replies[].updatedAt',
                ]);
        }

        if (options?.shouldHideMatureContent) {
            query = query.where(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false);
        }

        return this.db.read.query(query.toString()).then(async ({ rows }) => {
            const thoughts = formatSQLJoinAsJSON(rows, [{ propKey: 'replies', propId: 'id' }]);

            if (options.withReplies) {
                thoughts.forEach((thought) => {
                    const modifiedThought = thought;
                    // Every consumer of `replies` assumes an addressable row. Dropping id-less
                    // entries keeps that invariant even if a future always-non-null aliased
                    // column re-introduces the phantom the CASE above guards against.
                    modifiedThought.replies = (modifiedThought.replies || []).filter((reply) => !!reply.id);
                    // pg returns COUNT(*) as a bigint string; clients render/compare it as a number
                    modifiedThought.replies.forEach((reply) => {
                        const modifiedReply = reply;
                        modifiedReply.replyCount = parseInt(modifiedReply.replyCount || 0, 10);
                    });
                });
            }

            await this.attachRepostDetails(brand, thoughts);

            if (options.withParent) {
                // A reply has no visible thread context of its own, so the details view renders a
                // banner linking up to the parent — that needs the parent's author and a snippet
                // of its message. Deliberately its own bounded query rather than a second
                // self-join: joined onto the replies join it would multiply (parent rows x reply
                // rows) and formatSQLJoinAsJSON would have to de-dupe the product.
                const parentIds: string[] = [...new Set<string>(thoughts.map((thought) => thought.parentId).filter((id) => !!id))];

                if (parentIds.length) {
                    // This query is deliberately NOT an authorization boundary — it filters on
                    // brand and mature content only, and will happily return a private parent.
                    // `isPublic` and `fromUserId` are selected because the caller is what decides
                    // whether the row may be shown: getThoughtDetails drops `parent` unless the
                    // requesting user could open it in its own right. Any new consumer of
                    // `withParent` has to make that same decision — returning these rows straight
                    // to a client leaks the message of a thought the reader cannot access.
                    let parentQuery = knexBuilder
                        .select([
                            'id',
                            'parentId',
                            'fromUserId',
                            'message',
                            'isPublic',
                            'isMatureContent',
                            'createdAt',
                        ])
                        .from(THOUGHTS_TABLE_NAME)
                        .whereIn('id', parentIds);

                    // Mirrors the reply join's restriction: a habits reader must never be handed a
                    // therr-brand parent, since the banner links to a thought they cannot open.
                    if (readable !== 'all') {
                        parentQuery = parentQuery.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
                    }

                    if (options?.shouldHideMatureContent) {
                        parentQuery = parentQuery.where(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false);
                    }

                    const parentRows = await this.db.read.query(parentQuery.toString()).then(({ rows: pRows }) => pRows);
                    const parentsMap = parentRows.reduce((acc, parent) => {
                        acc[parent.id] = parent;
                        return acc;
                    }, {});

                    thoughts.forEach((thought) => {
                        const modifiedThought = thought;
                        // Left undefined (not null) when the parent is filtered out or deleted, so
                        // clients fall back to "this is a reply" without a broken link target.
                        if (modifiedThought.parentId && parentsMap[modifiedThought.parentId]) {
                            modifiedThought.parent = parentsMap[modifiedThought.parentId];
                        }
                    });
                }
            }

            if (options.withUser) {
                const userIds: string[] = [];
                const thoughtDetailsPromises: Promise<any>[] = [];

                thoughts.forEach((thought) => {
                    userIds.push(thought.fromUserId);

                    if (options.withReplies) {
                        thought.replies.forEach((reply) => {
                            userIds.push(reply.fromUserId);
                        });
                    }

                    if (thought.parent) {
                        userIds.push(thought.parent.fromUserId);
                    }
                });
                // TODO: Try fetching from redis/cache first, before fetching remaining media from DB
                thoughtDetailsPromises.push(options.withUser
                    ? this.usersStore.findUsers({ ids: userIds })
                    : Promise.resolve(null));

                const [users] = await Promise.all(thoughtDetailsPromises);
                const usersMap = (users || []).reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});

                const mappedThoughts = thoughts.map((thought) => {
                    const modifiedThought = thought;

                    // USER
                    const matchingUser = usersMap[modifiedThought.fromUserId];
                    if (matchingUser) {
                        modifiedThought.user = matchingUser;
                        modifiedThought.fromUserName = matchingUser.userName;
                        modifiedThought.fromUserFirstName = matchingUser.firstName;
                        modifiedThought.fromUserLastName = matchingUser.lastName;
                        modifiedThought.fromUserMedia = matchingUser.media;
                        modifiedThought.fromUserIsSuperUser = matchingUser.isSuperUser;

                        // Replies
                        if (options.withReplies) {
                            modifiedThought.replies = modifiedThought.replies.map((reply) => {
                                const modifiedReply = reply;
                                const matchingReplyUser = usersMap[modifiedReply.fromUserId];
                                if (matchingReplyUser) {
                                    modifiedReply.user = matchingReplyUser;
                                    modifiedReply.fromUserName = matchingReplyUser.userName;
                                    modifiedReply.fromUserFirstName = matchingReplyUser.firstName;
                                    modifiedReply.fromUserLastName = matchingReplyUser.lastName;
                                    modifiedReply.fromUserMedia = matchingReplyUser.media;
                                    modifiedReply.fromUserIsSuperUser = matchingReplyUser.isSuperUser;
                                }

                                return modifiedReply;
                            });
                        }
                    }

                    // Parent author, hydrated outside the `matchingUser` branch above: the banner
                    // names the *parent's* author, so it must not go unnamed just because the
                    // reply's own author row is missing.
                    if (modifiedThought.parent) {
                        const matchingParentUser = usersMap[modifiedThought.parent.fromUserId];
                        if (matchingParentUser) {
                            modifiedThought.parent = {
                                ...modifiedThought.parent,
                                fromUserName: matchingParentUser.userName,
                                fromUserFirstName: matchingParentUser.firstName,
                                fromUserLastName: matchingParentUser.lastName,
                                fromUserMedia: matchingParentUser.media,
                                fromUserIsSuperUser: matchingParentUser.isSuperUser,
                            };
                        }
                    }

                    return modifiedThought;
                });

                return {
                    thoughts: mappedThoughts,
                    users: usersMap,
                };
            }

            return {
                thoughts,
                media: {},
                users: {},
            };
        });
    }

    find(brand: BrandValue, thoughtIds, filters, options: any = {}) {
        // hard limit to prevent overloading client
        const restrictedLimit = (filters.limit) > 1000 ? 1000 : filters.limit;
        const orderBy = filters.orderBy || `${THOUGHTS_TABLE_NAME}.createdAt`;
        const order = filters.order || 'DESC';

        let query = knexBuilder
            .from(THOUGHTS_TABLE_NAME)
            .orderBy(orderBy, order)
            // Tiebreak so the author-profile path (which pages with a `before` cursor on
            // createdAt) can't skip a thought that shares a timestamp with the page boundary.
            .orderBy(`${THOUGHTS_TABLE_NAME}.id`, order)
            .offset(filters.offset || 0)
            .where(`${THOUGHTS_TABLE_NAME}.createdAt`, '<', filters.before || new Date(Date.now() + 24 * 60 * 60 * 1000))
            .andWhere(`${THOUGHTS_TABLE_NAME}.parentId`, null)
            .limit(restrictedLimit);

        const readable = getReadableBrands(brand);
        if (readable !== 'all') {
            query = query.whereIn(`${THOUGHTS_TABLE_NAME}.brandVariation`, readable);
        }

        if (filters.authorId) {
            query = query.andWhere((builder) => {
                if (options.isFriend) {
                    // TODO: Verify this is a non-public option
                    builder
                        .andWhere(`${THOUGHTS_TABLE_NAME}.fromUserId`, filters.authorId);
                } else {
                    builder
                        .andWhere(`${THOUGHTS_TABLE_NAME}.fromUserId`, filters.authorId)
                        .andWhere(`${THOUGHTS_TABLE_NAME}.isPublic`, true);
                }
            });
        }

        // This restricts the query to only return thoughts that are in the list of thoughtIds
        // when the user is not viewing their own thoughts.
        // This ensures a thought is "activated" for the user when they view it.
        if (!options?.isMe && !(options.isFriend && filters.authorId)) {
            query = query.andWhere((builder) => {
                builder
                    .whereIn(`${THOUGHTS_TABLE_NAME}.id`, thoughtIds || []);
            });
        }

        if (options?.shouldHideMatureContent) {
            query = query.where(`${THOUGHTS_TABLE_NAME}.isMatureContent`, false);
        }

        if (options.withReplies) {
            // Lateral join caps the payload to the few most recent replies per parent (enough
            // for an inline thread preview) while COUNT(*) OVER () — computed before LIMIT —
            // still reports the true total as replyCount. The brand restriction is mirrored
            // onto the reply subquery so reply previews/counts never include cross-brand replies.
            //
            // Replies deliberately carry NO isPublic filter: clients mint every reply with
            // isPublic=false (see TherrMobile ViewThought handleSubmitReply), so the flag is
            // not a privacy signal on replies — visibility follows the parent thought.
            //
            // The parents are paged in an inner query BEFORE the lateral join. Joining first
            // would count reply rows (up to 3 per parent) against LIMIT, collapsing a
            // 21-parent page to as few as 7 parents.
            const repliesBrandClause = readable === 'all'
                ? ''
                : `AND replies."brandVariation" IN (${readable.map((b) => `'${b}'`).join(',')})`;
            const repliesMatureClause = options?.shouldHideMatureContent
                ? 'AND replies."isMatureContent" = false'
                : '';
            const orderColumn = orderBy.split('.').pop();
            query = knexBuilder
                .from(query.as('parents'))
                .joinRaw(`LEFT JOIN LATERAL (
                    SELECT
                        replies.id,
                        replies."fromUserId",
                        replies.message,
                        replies.category,
                        replies."hashTags",
                        replies."isPublic",
                        replies."createdAt",
                        COUNT(*) OVER () AS "totalReplies"
                    FROM ${THOUGHTS_TABLE_NAME} AS replies
                    WHERE replies."parentId" = parents.id
                    ${repliesBrandClause}
                    ${repliesMatureClause}
                    ORDER BY replies."createdAt" DESC
                    LIMIT 3
                ) AS replies ON TRUE`)
                .orderBy(`parents.${orderColumn}`, order)
                .columns([
                    'parents.*',
                    'replies.totalReplies as replyCount',
                    'replies.id as replies[].id',
                    'replies.fromUserId as replies[].fromUserId',
                    'replies.message as replies[].message',
                    'replies.category as replies[].category',
                    'replies.hashTags as replies[].hashTags',
                    'replies.isPublic as replies[].isPublic',
                    'replies.createdAt as replies[].createdAt',
                ]);
        }

        return this.db.read.query(query.toString()).then(async ({ rows }) => {
            const thoughts = formatSQLJoinAsJSON(rows, [{ propKey: 'replies', propId: 'id' }]);
            // Page-size checks must count parents (post-join-format), not raw rows — with
            // reply previews attached, raw rows are a multiple of the parent count.
            const isLastPage = thoughts.length < restrictedLimit;

            if (options.withReplies) {
                thoughts.forEach((thought) => {
                    const modifiedThought = thought;
                    // Lateral join yields no row (NULL count) for parents with no replies
                    modifiedThought.replyCount = parseInt(modifiedThought.replyCount || 0, 10);
                });
            }

            await this.attachRepostDetails(brand, thoughts);

            if (options.withUser) {
                const userIds: string[] = [];
                const thoughtDetailsPromises: Promise<any>[] = [];
                const matchingUsers: any = {};

                thoughts.forEach((thought) => {
                    userIds.push(thought.fromUserId);

                    if (options.withReplies) {
                        (thought.replies || []).forEach((reply) => {
                            userIds.push(reply.fromUserId);
                        });
                    }
                });
                // TODO: Try fetching from redis/cache first, before fetching remaining media from DB
                thoughtDetailsPromises.push(this.usersStore.findUsers({ ids: userIds }));

                const [users] = await Promise.all(thoughtDetailsPromises);
                const usersMap = (users || []).reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});

                const mappedThoughts = thoughts.map((thought) => {
                    const modifiedThought = thought;
                    modifiedThought.user = {};

                    // USER
                    const matchingUser = usersMap[modifiedThought.fromUserId];
                    if (matchingUser) {
                        matchingUsers[matchingUser.id] = matchingUser;
                        modifiedThought.fromUserName = matchingUser.userName;
                        modifiedThought.fromUserFirstName = matchingUser.firstName;
                        modifiedThought.fromUserLastName = matchingUser.lastName;
                        modifiedThought.fromUserMedia = matchingUser.media;
                        modifiedThought.fromUserIsSuperUser = matchingUser.isSuperUser;
                    }

                    // Reply preview authors (for inline thread display in list views)
                    if (options.withReplies) {
                        modifiedThought.replies = (modifiedThought.replies || []).map((reply) => {
                            const modifiedReply = reply;
                            const matchingReplyUser = usersMap[modifiedReply.fromUserId];
                            if (matchingReplyUser) {
                                modifiedReply.fromUserName = matchingReplyUser.userName;
                                modifiedReply.fromUserMedia = matchingReplyUser.media;
                                modifiedReply.fromUserIsSuperUser = matchingReplyUser.isSuperUser;
                            }

                            return modifiedReply;
                        });
                    }

                    return modifiedThought;
                });

                return {
                    thoughts: mappedThoughts,
                    users: matchingUsers,
                    isLastPage,
                };
            }

            return {
                thoughts,
                media: {},
                users: {},
                isLastPage,
            };
        });
    }

    async create(brand: BrandValue, params: ICreateThoughtParams) {
        // TODO: Support creating multiple
        const isTextMature = isTextUnsafe([params.message, params.hashTags || '']);

        const sanitizedParams: Partial<ICreateThoughtParams> = {
            category: params.category || 'uncategorized',
            expiresAt: params.expiresAt,
            fromUserId: params.fromUserId,
            locale: params.locale,
            isPublic: isTextMature ? false : !!params.isPublic, // NOTE: For now make this content private to reduce public, mature content
            isMatureContent: isTextMature || !!params.isMatureContent,
            // `isRepost` is derived rather than trusted: it existed as an unwired flag long
            // before reposts did, so a client could set it on an ordinary post. Keeping the two
            // columns in lockstep here means no read path has to handle the contradictory
            // "isRepost with nothing reposted" state.
            isRepost: !!params.repostThoughtId,
            repostThoughtId: params.repostThoughtId || undefined,
            message: params.message.substring(0, 255),
            mentionsIds: params.mentionsIds || '',
            parentId: params.parentId,
            hashTags: params.hashTags || '',
            maxViews: params.maxViews || 0,
        };

        /**
         * Coordinates for a post that names a city.
         *
         * Derived from the message text and nothing else. In particular it is NOT taken from
         * the request body — `createThought` spreads `req.body` straight into this method, so
         * honoring caller-supplied coordinates would let any client drop a post into any
         * city's local feed, which is a spam vector with no legitimate caller today. A
         * deliberate "tag a place" UI can add a validated path later.
         *
         * Nor is it inferred from where the author lives. The column means the same thing for
         * a person as it does for a bot — this post is *about* this place, not written from
         * it — and inferring it would put someone's every post in front of their neighbors
         * while publishing a guess about where they live.
         *
         * Naming a city is not enough on its own. `detectLocality` also requires the author to
         * be near it — post text is typed by the person being ranked, so without that check,
         * writing "Chicago" into every post is all it takes to farm the Chicago feed from
         * anywhere in the world.
         *
         * The condition mirrors the local candidate filter in `getRecentThoughts` exactly —
         * public, not mature, top-level. A post failing any of those can never be selected as
         * a candidate, so coordinates on it could never be read, and writing a location onto
         * a post the author kept private is data they did not ask for. Keep the two in sync:
         * if the read side ever widens, this is the write side that has to widen with it.
         *
         * The location read is skipped entirely for a post that could not be tagged anyway,
         * so replies and private posts add no query to the write path.
         */
        if (sanitizedParams.isPublic && !sanitizedParams.isMatureContent && !params.parentId) {
            const authorLocation = await this.getAuthorLocation(params.fromUserId as any);
            const detected = detectLocality(sanitizedParams.message, authorLocation);

            if (detected) {
                sanitizedParams.latitude = detected.latitude;
                sanitizedParams.longitude = detected.longitude;
                sanitizedParams.locality = detected.locality;
            }
        }

        if (params.interestsKeys) {
            sanitizedParams.interestsKeys = JSON.stringify(params.interestsKeys) as any;
        } else if (params.category && Categories.ThoughtCategories.includes(params.category) && Categories.CategoryToInterestsMap[params.category]) {
            const interests = Categories.CategoryToInterestsMap[params.category];
            sanitizedParams.interestsKeys = JSON.stringify(interests) as any;
        } else if (Content.interestsMap[`forms.editThought.categories.${params.category}`]) {
            // Set a default interests where ever valid
            const interests = [Content.interestsMap[`forms.editThought.categories.${params.category}`]];
            sanitizedParams.interestsKeys = JSON.stringify(interests) as any;
        }

        const queryString = knexBuilder.insert(withBrandOnInsert(sanitizedParams as Record<string, unknown>, brand))
            .into(THOUGHTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, isMatureContent: boolean) {
        const queryString = knexBuilder.update({
            isMatureContent,
            isPublic: !isMatureContent, // NOTE: For now make this content private to reduce public, mature content
        })
            .into(THOUGHTS_TABLE_NAME)
            .where({ id })
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    delete(fromUserId: string) {
        const queryString = knexBuilder.delete()
            .from(THOUGHTS_TABLE_NAME)
            .where('fromUserId', fromUserId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteThoughts(params: IDeleteThoughtsParams) {
        // TODO: RSERV-52 | Consider archiving only, and delete associated reactions from reactions-service
        const queryString = knexBuilder.delete()
            .from(THOUGHTS_TABLE_NAME)
            .where('fromUserId', params.fromUserId)
            .whereIn('id', params.ids)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
