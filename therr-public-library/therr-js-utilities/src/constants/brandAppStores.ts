import { BrandVariations } from './enums/Branding';
import { getBrandName } from './brandNames';

/**
 * Store-listing identity for each brand variation.
 *
 * Two surfaces need this and need it to agree. The web app links installs from an invite,
 * which has to follow the *invite's* brand rather than the page's — sending a Friends with
 * Habits invitee to the Therr listing installs an app that cannot see the invite at all.
 * The mobile app links the same listings for its "leave a review" prompt. Keeping the raw
 * identifiers here, isomorphic and dependency-free, is what stops those two from drifting;
 * each surface derives the URL shape it needs from them.
 *
 * `GET /users-service/users/invites/:token` returns the originating `brandVariation` for
 * exactly this reason (migration 20260720000001_main.invites.brandVariation).
 */
export interface IBrandAppStore {
    /** Display name of the app being linked to. */
    appName: string;
    /** Google Play `applicationId` — matches `android/app/build.gradle` for that variant. */
    playPackageId: string;
    /**
     * Apple App Store numeric id, absent where no iOS build of that brand exists yet.
     *
     * No HABITS iOS target exists today — a Habits build IS the Therr iOS app
     * (see push-notifications-service brandRouting). Add an id here when one ships.
     */
    appStoreId?: string;
    /** Slug in the App Store listing URL. Apple resolves by id alone, so this is cosmetic. */
    appStoreSlug?: string;
}

const THERR_APP_STORE: IBrandAppStore = {
    appName: getBrandName(BrandVariations.THERR),
    playPackageId: 'app.therrmobile',
    appStoreId: '1569988763',
    appStoreSlug: 'therr',
};

const HABITS_APP_STORE: IBrandAppStore = {
    appName: getBrandName(BrandVariations.HABITS),
    playPackageId: 'com.therr.habits',
};

const APP_STORES_BY_BRAND: { [brand: string]: IBrandAppStore } = {
    [BrandVariations.THERR]: THERR_APP_STORE,
    [BrandVariations.DASHBOARD_THERR]: THERR_APP_STORE,
    [BrandVariations.HABITS]: HABITS_APP_STORE,
};

/**
 * Resolve the store listing for a brand. Unknown, missing, and shelved brands (TEEM, OTAKU,
 * PARALLELS, APPY_SOCIAL — none of which have a store listing) fall back to Therr, which is
 * the app those links were in practice minted from.
 */
export const getBrandAppStore = (brandVariation?: string): IBrandAppStore => (
    (brandVariation && APP_STORES_BY_BRAND[brandVariation]) || THERR_APP_STORE
);

/** Public Play Store listing URL for a brand. */
export const getPlayStoreUrl = (brandVariation?: string): string => (
    `https://play.google.com/store/apps/details?id=${getBrandAppStore(brandVariation).playPackageId}`
);

/** Public App Store listing URL for a brand, or undefined where that brand has no iOS build. */
export const getAppStoreUrl = (brandVariation?: string): string | undefined => {
    const { appStoreId, appStoreSlug } = getBrandAppStore(brandVariation);

    return appStoreId
        ? `https://apps.apple.com/us/app/${appStoreSlug || 'therr'}/id${appStoreId}?platform=iphone`
        : undefined;
};

export {
    APP_STORES_BY_BRAND,
};
