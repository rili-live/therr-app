import KnexBuilder, { Knex } from 'knex';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_DEVICE_TOKENS_TABLE_NAME = 'main.userDeviceTokens';

// Mobile clients shipped before `TherrMobile/main/constants/requestPlatform.ts` send the
// literal 'mobile' as `x-platform` for both iOS and Android, so a user's two devices collide
// on the UNIQUE (userId, brandVariation, platform) key and the second overwrites the first.
// Rows under this value are still honoured — an install that never updates must keep receiving
// pushes — but a client reporting a real platform supersedes them.
//
// Lives here rather than in syncDeviceTokenForBrand so that utility can import it without the
// store importing back out of `src/store` into `src/utilities`.
export const LEGACY_TOKEN_PLATFORM = 'mobile';

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
    //
    // Ordered newest-first because both callers take `rows[0]` as *the* token to push to. A
    // user can legitimately hold several rows for one brand (an iPhone and an Android phone,
    // or a legacy 'mobile' row alongside a real 'android' one during the platform-value
    // rollout), and without an ORDER BY which of them wins is whatever order Postgres happens
    // to return — so the same user could flip between devices run to run. Freshest
    // registration is the one the user most recently opened the app on.
    getTokensForUser(brand: BrandValue, userId: string) {
        const queryString = this.scopedQuery(brand)
            .select('*')
            .where('userId', '=', userId)
            .orderBy('updatedAt', 'desc')
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows as IUserDeviceTokenRow[]);
    }

    // Batch variant for fan-out push (e.g. group-message notify). Single round-trip avoids the
    // N+1 we'd get from calling getTokensForUser per recipient.
    //
    // Same newest-first ordering as getTokensForUser: `resolveDeviceTokensForBrand` keeps the
    // first row it sees per userId, so the ordering is what makes that the freshest device.
    getTokensForUsers(brand: BrandValue, userIds: string[]) {
        if (!userIds.length) return Promise.resolve([] as IUserDeviceTokenRow[]);
        const queryString = this.scopedQuery(brand)
            .select('*')
            .whereIn('userId', userIds)
            .orderBy('updatedAt', 'desc')
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows as IUserDeviceTokenRow[]);
    }

    // Drops the pre-`requestPlatform` row for this (user, brand), where both iOS and Android
    // registered under the single literal platform 'mobile'. Called only after a client has
    // successfully registered under a real platform value, so the device that wrote the legacy
    // row is either the one that just superseded it or gone.
    deleteLegacyPlatformRow(brand: BrandValue, userId: string) {
        const queryString = this.scopedQuery(brand)
            .where('userId', '=', userId)
            .where('platform', '=', LEGACY_TOKEN_PLATFORM)
            .delete()
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }

    // Diagnostics only: every row for this user across *all* brands.
    //
    // Deliberately not brand-scoped. The failure this is built to expose is a
    // token filed under the wrong brand — a device that registered as 'therr'
    // while the app sends `x-brand-variation: habits` gets no pushes, and a
    // brand-scoped read returns an empty set for both brands, which looks
    // identical to "never registered at all". Reading across brands is what
    // makes those two cases distinguishable.
    //
    // Callers must not use this for delivery routing; getTokensForUser is the
    // routing path and stays scoped.
    getAllTokensForUserAcrossBrands(userId: string) {
        const queryString = knexBuilder
            .from(USER_DEVICE_TOKENS_TABLE_NAME)
            .select('*')
            .where('userId', '=', userId)
            .orderBy('updatedAt', 'desc')
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
