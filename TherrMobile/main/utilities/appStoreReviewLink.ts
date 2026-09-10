import { Linking, Platform } from 'react-native';
import { getBrandAppStore } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

/**
 * Deep links that land the user on the "write a review" surface of the right store listing.
 *
 * Brand matters here: a Friends with Habits user reviewing the Therr listing leaves feedback
 * on an app they have never opened. The package ids come from
 * `therr-js-utilities/constants/brandAppStores`, shared with the web app's install links so
 * the two cannot drift apart.
 */

/** iOS has no per-niche build yet: a HABITS install IS the Therr iOS binary. */
const getIosAppStoreId = (): string | undefined => (
    getBrandAppStore(CURRENT_BRAND_VARIATION).appStoreId || getBrandAppStore().appStoreId
);

export interface IStoreReviewLinks {
    /** Preferred link — opens the native store app directly on the review sheet. */
    primary: string;
    /** Browser-safe equivalent, used when the store app is not installed or refuses the scheme. */
    fallback: string;
}

/**
 * Resolve the review links for a platform. Exported with an explicit `platformOS` so both
 * branches are testable off-device; callers should use the `Platform.OS` default.
 */
export const getStoreReviewLinks = (platformOS: string = Platform.OS): IStoreReviewLinks => {
    if (platformOS === 'ios') {
        const appStoreId = getIosAppStoreId();

        return {
            // `action=write-review` opens the review composer rather than the listing.
            primary: `itms-apps://itunes.apple.com/app/id${appStoreId}?action=write-review`,
            fallback: `https://apps.apple.com/app/id${appStoreId}?action=write-review`,
        };
    }

    const { playPackageId } = getBrandAppStore(CURRENT_BRAND_VARIATION);

    return {
        // The `market://` scheme hands off to the Play Store app, which is where the review
        // control lives; the web listing only offers it once the user is signed in there.
        primary: `market://details?id=${playPackageId}`,
        fallback: `https://play.google.com/store/apps/details?id=${playPackageId}`,
    };
};

/**
 * Send the user to the store listing to leave a review.
 *
 * Resolves to whether a link actually opened, so the caller can avoid recording a review as
 * requested when nothing happened (an emulator with no store app, a locked-down device).
 */
export const openStoreReviewPage = async (platformOS: string = Platform.OS): Promise<boolean> => {
    const { primary, fallback } = getStoreReviewLinks(platformOS);

    try {
        await Linking.openURL(primary);

        return true;
    } catch {
        // `market://` / `itms-apps://` throw when no app claims the scheme.
    }

    try {
        await Linking.openURL(fallback);

        return true;
    } catch (err) {
        console.log('APP_REVIEW_LINK_ERROR', err);

        return false;
    }
};
