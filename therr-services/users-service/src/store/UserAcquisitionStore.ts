import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_ACQUISITION_TABLE_NAME = 'main.userAcquisition';

/**
 * Column widths mirror the migration, and the client-side caps in
 * therr-react/utilities/attribution. Enforced again here because the client
 * cap is a convenience, not a constraint — this payload arrives from a public
 * registration endpoint and is entirely attacker-controlled.
 */
const MAX_UTM_LENGTH = 255;
const MAX_REFERRER_LENGTH = 1024;
const MAX_PATH_LENGTH = 512;
const MAX_SURFACE_LENGTH = 50;

export interface IUserAcquisitionParams {
    userId: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referrer?: string;
    landingPath?: string;
    surface?: string;
    brandVariation?: string;
}

const truncate = (value: any, max: number): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
};

/**
 * Reduce an untrusted `userAcquisition` payload to the columns this table has,
 * each truncated to its column width. Unknown keys are dropped rather than
 * passed through — Knex would happily build an INSERT naming a column that
 * does not exist, and that error would surface as a failed registration.
 *
 * `landingPath` is stripped of its query string and fragment: the query string
 * is where password-reset and email-verification tokens live, and an analytics
 * table is the last place those should be durably stored.
 */
export const sanitizeUserAcquisition = (
    raw: any,
    context: { userId: string; brandVariation?: string },
): IUserAcquisitionParams => {
    const source = (raw && typeof raw === 'object') ? raw : {};

    const landingPath = truncate(source.landingPath, MAX_PATH_LENGTH);

    return {
        userId: context.userId,
        utmSource: truncate(source.utmSource, MAX_UTM_LENGTH),
        utmMedium: truncate(source.utmMedium, MAX_UTM_LENGTH),
        utmCampaign: truncate(source.utmCampaign, MAX_UTM_LENGTH),
        utmContent: truncate(source.utmContent, MAX_UTM_LENGTH),
        utmTerm: truncate(source.utmTerm, MAX_UTM_LENGTH),
        referrer: truncate(source.referrer, MAX_REFERRER_LENGTH),
        landingPath: landingPath ? landingPath.split(/[?#]/)[0] : undefined,
        surface: truncate(source.surface, MAX_SURFACE_LENGTH),
        brandVariation: truncate(context.brandVariation, MAX_SURFACE_LENGTH),
    };
};

export default class UserAcquisitionStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    createAcquisition(params: IUserAcquisitionParams) {
        const queryString = knexBuilder.insert(params)
            .into(USER_ACQUISITION_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /**
     * Signups per campaign in a window — the read the weekly marketing loop
     * makes. `utmCampaign IS NOT NULL` matches the partial index.
     */
    countByCampaign(fromDate: string, toDate: string) {
        const queryString = knexBuilder
            .select('utmSource', 'utmMedium', 'utmCampaign', 'utmContent')
            .count('id as count')
            .from(USER_ACQUISITION_TABLE_NAME)
            .whereNotNull('utmCampaign')
            .andWhere('createdAt', '>=', fromDate)
            .andWhere('createdAt', '<', toDate)
            .groupBy('utmSource', 'utmMedium', 'utmCampaign', 'utmContent')
            .orderBy('count', 'desc')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }
}
