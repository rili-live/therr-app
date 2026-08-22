import KnexBuilder, { Knex } from 'knex';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { Location } from 'therr-js-utilities/constants';
// import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { USER_LOCATIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateUserLocationParams {
    userId: string;
    isDeclaredHome?: boolean;
    latitude: number;
    longitude: number;
    latitudeRounded?: number;
    longitudeRounded?: number;
    visitCount?: number;
}

export default class UserLocationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string }, limit = 10) {
        const queryString = knexBuilder
            .select([
                `${USER_LOCATIONS_TABLE_NAME}.*`,
            ])
            .from(USER_LOCATIONS_TABLE_NAME)
            .where(conditions)
            .orderBy('visitCount', 'desc')
            .limit(limit)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows);
    }

    /**
     * Returns the locations where the user appears to live or be staying — their home,
     * plus any temporary living space (hotel, rental, extended stay) they have occupied
     * across multiple distinct days recently.
     *
     * A location qualifies when the user explicitly declared it home, or when it has
     * been observed on at least DWELL_MIN_DISTINCT_DAYS separate calendar days and was
     * visited within DWELL_LOCATION_MAX_AGE_MS (so last year's hotel decays out).
     */
    getDwellings(userId: string, limit = 20) {
        // ISO-8601 so the literal carries its UTC offset — a naive timestamp would be
        // interpreted in the database session's timezone rather than the app server's.
        const activeSince = new Date(Date.now() - Location.DWELL_LOCATION_MAX_AGE_MS).toISOString();

        const queryString = knexBuilder
            .select([
                `${USER_LOCATIONS_TABLE_NAME}.*`,
            ])
            .from(USER_LOCATIONS_TABLE_NAME)
            .where({ userId })
            .andWhere((builder) => builder
                .where({ isDeclaredHome: true })
                .orWhere((dwellBuilder) => dwellBuilder
                    .where('distinctDayCount', '>=', Location.DWELL_MIN_DISTINCT_DAYS)
                    .andWhere('lastVisitedAt', '>=', activeSince)))
            .orderBy('isDeclaredHome', 'desc')
            .orderBy('distinctDayCount', 'desc')
            .limit(limit)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows);
    }

    /**
     * The single location that best answers "where does this user live?", or undefined.
     *
     * Deliberately more permissive than `getDwellings`, which is the right question for
     * notification muting but the wrong one here: a dwelling requires either an explicit
     * declaration or DWELL_MIN_DISTINCT_DAYS of history, so a user who signed up an hour ago
     * and shared their location has none — and they are exactly the audience for a feed
     * seeded with posts about their own city. This accepts their first ping, while ordering
     * a declared home and an established dwelling ahead of it.
     *
     * The recency guard is what keeps that safe: a location the user has not been near in
     * DWELL_LOCATION_MAX_AGE_MS is ignored unless they declared it home, so a stale ping
     * from a city they have since left cannot keep shaping their feed forever.
     */
    getPrimary(userId: string) {
        const activeSince = new Date(Date.now() - Location.DWELL_LOCATION_MAX_AGE_MS).toISOString();

        const queryString = knexBuilder
            .select([
                `${USER_LOCATIONS_TABLE_NAME}.*`,
            ])
            .from(USER_LOCATIONS_TABLE_NAME)
            .where({ userId })
            .whereNotNull('latitude')
            .whereNotNull('longitude')
            .andWhere((builder) => builder
                .where({ isDeclaredHome: true })
                .orWhere('lastVisitedAt', '>=', activeSince))
            .orderBy('isDeclaredHome', 'desc')
            .orderBy('distinctDayCount', 'desc')
            .orderBy('visitCount', 'desc')
            .orderBy('lastVisitedAt', 'desc')
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows[0]);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(USER_LOCATIONS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateUserLocationParams[]) {
        const modifiedParamsList = paramsList.map((params) => {
            const modified: ICreateUserLocationParams = {
                ...params,
                isDeclaredHome: params?.isDeclaredHome || false,
                latitudeRounded: params?.latitudeRounded || Math.round(params.latitude * 1000) / 1000,
                longitudeRounded: params?.longitudeRounded || Math.round(params.longitude * 1000) / 1000,
                visitCount: params?.visitCount || 1,
            };

            return modified;
        });
        const queryString = knexBuilder.insert(modifiedParamsList)
            .into(USER_LOCATIONS_TABLE_NAME)
            .onConflict(['userId', 'latitudeRounded', 'longitudeRounded'])
            .merge({
                visitCount: knexBuilder.raw('?? + ?', [`${USER_LOCATIONS_TABLE_NAME}.visitCount`, 1]),
                // Only counts as a new day when the previous visit landed on an earlier
                // calendar day. Repeated background pings within one day do not inflate it.
                //
                // Both sides are pinned to UTC rather than left to `date_trunc('day', now())`,
                // which resolves against the database session's TimeZone. That made the
                // day boundary depend on how the connection happened to be configured —
                // differing between the app pool, a psql session, and a read replica, and
                // silently shifting if the server timezone were ever changed. UTC is
                // arbitrary but fixed, which is what the threshold needs to mean anything.
                distinctDayCount: knexBuilder.raw(
                    '?? + (CASE WHEN (?? AT TIME ZONE \'UTC\')::date < (now() AT TIME ZONE \'UTC\')::date THEN 1 ELSE 0 END)',
                    [`${USER_LOCATIONS_TABLE_NAME}.distinctDayCount`, `${USER_LOCATIONS_TABLE_NAME}.lastVisitedAt`],
                ),
                lastVisitedAt: knexBuilder.raw('now()'),
                updatedAt: knexBuilder.raw('now()'),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(USER_LOCATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
