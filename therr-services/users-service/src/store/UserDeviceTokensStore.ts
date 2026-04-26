import KnexBuilder, { Knex } from 'knex';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_DEVICE_TOKENS_TABLE_NAME = 'main.userDeviceTokens';

export interface IUserDeviceTokenRow {
    id: string;
    userId: string;
    brandVariation: string;
    platform: string;
    token: string;
    createdAt: Date;
    updatedAt: Date;
}

export default class UserDeviceTokensStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // Brand-scoped per docs/NICHE_APP_DATABASE_GUIDELINES.md.
        // Stays in 'shadow' for one release cycle alongside NotificationsStore.
        super(dbConnection, USER_DEVICE_TOKENS_TABLE_NAME, 'shadow');
    }

    // Upsert keyed on the unique (userId, brandVariation, platform) constraint.
    // A re-registration from the same device under the same brand bumps the token
    // and updatedAt; first registration inserts a new row. Returns the upserted row.
    upsertToken(brand: BrandValue, userId: string, platform: string, token: string) {
        this.assertBrand(brand);
        // Use raw SQL because Knex's onConflict().merge() doesn't include updatedAt
        // recomputation in the way we want — explicit raw is clearer.
        const queryString = knexBuilder
            .raw(
                `INSERT INTO ?? ("userId", "brandVariation", "platform", "token")
                 VALUES (?::uuid, ?, ?, ?)
                 ON CONFLICT ("userId", "brandVariation", "platform")
                 DO UPDATE SET "token" = EXCLUDED."token", "updatedAt" = now()
                 RETURNING *`,
                [USER_DEVICE_TOKENS_TABLE_NAME, userId, brand, platform, token],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows);
    }

    // Used by push routing: get the device tokens this user has registered for the given brand.
    // Returns at most one row per platform.
    getTokensForUser(brand: BrandValue, userId: string) {
        const queryString = this.scopedQuery(brand)
            .select('*')
            .where('userId', '=', userId)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows as IUserDeviceTokenRow[]);
    }

    // Removes any (any-brand) token row matching this exact token string. Used during invalid-token
    // cleanup when FCM tells us a token has been invalidated. The token value is globally unique to
    // a device install regardless of brand, so we wipe all matching rows defensively. Brand is not
    // required here because the input token alone identifies the row(s).
    deleteByToken(token: string) {
        const queryString = knexBuilder
            .from(USER_DEVICE_TOKENS_TABLE_NAME)
            .where('token', '=', token)
            .delete()
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }
}
