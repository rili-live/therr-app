import { BrandVariations } from 'therr-js-utilities/constants';

/**
 * App-store destinations per brand variation.
 *
 * An invite is minted inside one app and can be opened from any web surface, so the
 * install link this site offers has to follow the *invite's* brand rather than the
 * page's. Sending a Friends with Habits invitee to the Therr listing installs an app
 * that cannot see the invite at all — the user completes the install and lands
 * nowhere, which reads to them as a broken invite rather than a wrong link.
 *
 * `GET /users-service/users/invites/:token` returns the originating `brandVariation`
 * for exactly this reason (migration 20260720000001_main.invites.brandVariation).
 */
export interface IBrandAppStore {
    /** Display name of the app the invite was minted in. */
    appName: string;
    playStoreUrl: string;
    /** Absent where no iOS build of that brand exists yet. */
    appStoreUrl?: string;
}

const THERR_APP_STORE: IBrandAppStore = {
    appName: 'Therr',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=app.therrmobile',
    appStoreUrl: 'https://apps.apple.com/us/app/therr/id1569988763?platform=iphone',
};

const HABITS_APP_STORE: IBrandAppStore = {
    appName: 'Friends with Habits',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.therr.habits',
    // No HABITS iOS target exists yet — a Habits build IS the Therr iOS app today
    // (see push-notifications-service brandRouting). Add the badge when one ships.
};

const APP_STORES_BY_BRAND: { [key: string]: IBrandAppStore } = {
    [BrandVariations.THERR]: THERR_APP_STORE,
    [BrandVariations.DASHBOARD_THERR]: THERR_APP_STORE,
    [BrandVariations.HABITS]: HABITS_APP_STORE,
};

/**
 * Resolve the install destination for a brand. Unknown, missing, and shelved brands
 * (TEEM, OTAKU, PARALLELS, APPY_SOCIAL — none of which have a store listing) fall back
 * to Therr, which is the app those invites were in practice minted from.
 */
const getBrandAppStore = (brandVariation?: string): IBrandAppStore => (
    (brandVariation && APP_STORES_BY_BRAND[brandVariation]) || THERR_APP_STORE
);

export default getBrandAppStore;
