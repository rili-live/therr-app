import { getBrandAppStore as getSharedBrandAppStore, getPlayStoreUrl, getAppStoreUrl } from 'therr-js-utilities/constants';

/**
 * App-store destinations per brand variation.
 *
 * An invite is minted inside one app and can be opened from any web surface, so the
 * install link this site offers has to follow the *invite's* brand rather than the
 * page's. Sending a Friends with Habits invitee to the Therr listing installs an app
 * that cannot see the invite at all — the user completes the install and lands
 * nowhere, which reads to them as a broken invite rather than a wrong link.
 *
 * The identifiers themselves live in `therr-js-utilities/constants/brandAppStores` because
 * the mobile app links the same listings for its review prompt, and the two must not drift.
 * This module is the web-shaped view of them: ready-to-render listing URLs.
 */
export interface IBrandAppStore {
    /** Display name of the app the invite was minted in. */
    appName: string;
    playStoreUrl: string;
    /** Absent where no iOS build of that brand exists yet. */
    appStoreUrl?: string;
}

/**
 * Resolve the install destination for a brand. Unknown, missing, and shelved brands
 * (TEEM, OTAKU, PARALLELS, APPY_SOCIAL — none of which have a store listing) fall back
 * to Therr, which is the app those invites were in practice minted from.
 */
const getBrandAppStore = (brandVariation?: string): IBrandAppStore => ({
    appName: getSharedBrandAppStore(brandVariation).appName,
    playStoreUrl: getPlayStoreUrl(brandVariation),
    appStoreUrl: getAppStoreUrl(brandVariation),
});

export default getBrandAppStore;
