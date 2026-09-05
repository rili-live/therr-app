import { IConnection } from './connection';
import { MOMENTS_TABLE_NAME } from './MomentsStore';
import { SPACES_TABLE_NAME } from './SpacesStore';
import { EVENTS_TABLE_NAME } from './EventsStore';

/**
 * Bounded so a caller cannot turn one request into an unbounded OR chain.
 * Well past any real batch — the nearby feed resolves a screenful at a time.
 */
export const MAX_REFERENCE_CHECK_PATHS = 100;

const REFERENCING_TABLES = [MOMENTS_TABLE_NAME, SPACES_TABLE_NAME, EVENTS_TABLE_NAME];

/**
 * Answers one question: is this media path carried by a piece of maps-service content?
 *
 * Separate from `MediaStore` on purpose — moments, spaces and events all import
 * `MediaStore`, so reaching back to their table names from inside it would make a
 * require cycle out of what is only a read.
 */
export default class ContentMediaStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    /**
     * Which of these paths does a moment, space or event actually reference?
     *
     * This is the authorization fallback in `createMediaUrls` for private media the
     * requester does not own. The nearby feed and the map legitimately hand a client
     * another user's `USER_IMAGE_PRIVATE` paths — they arrive inside the area rows
     * themselves — so an owner-only rule would stop those images rendering. A path
     * that no content row references was never published by this service to anybody,
     * which is the case worth refusing: `habits.proofs` paths live in users-service
     * and appear in none of these three tables.
     *
     * Written as an OR of `@>` containment predicates rather than as a lateral
     * extraction in the WHERE clause, because containment is the form the GIN indexes
     * in `20260905000000_main.medias_gin_indexes` can answer. The lateral join is
     * only there to report *which* candidates matched.
     */
    getReferencedPaths(paths: string[]): Promise<string[]> {
        const candidates = [...new Set(paths.filter((p) => !!p))].slice(0, MAX_REFERENCE_CHECK_PATHS);

        if (!candidates.length) {
            return Promise.resolve([]);
        }

        const params = candidates.map((p) => JSON.stringify([{ path: p }]));
        const containment = candidates.map((_, index) => `c.medias @> $${index + 1}::jsonb`).join(' OR ');
        const extraction = candidates.map((_, index) => `$${index + 1}::jsonb->0->>'path'`).join(', ');

        const queries = REFERENCING_TABLES.map((tableName) => this.db.read.query(
            `SELECT DISTINCT elem->>'path' AS path
               FROM ${tableName} c, LATERAL jsonb_array_elements(c.medias) elem
              WHERE (${containment})
                AND elem->>'path' IN (${extraction})`,
            params,
        ).then((response) => response.rows.map((row) => row.path)));

        return Promise.all(queries).then((results) => [...new Set(results.flat())]);
    }
}
