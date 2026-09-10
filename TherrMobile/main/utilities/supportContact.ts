import { Linking } from 'react-native';
import { BRAND_DISPLAY_NAME } from '../config/brandConfig';

/**
 * The published support address, matching the one the web app gives out on its
 * child-safety and account-deletion pages (`therr-client-web/src/routes/ChildSafety.tsx`).
 */
export const SUPPORT_EMAIL_ADDRESS = 'info@therr.com';

/**
 * Open the user's mail client with a message to support pre-addressed.
 *
 * Used by the "not really" branch of the review prompt: someone who is unhappy should reach
 * a human, not an app-store listing. Resolves to whether a mail client actually opened, so a
 * device with no mail app configured degrades to simply closing the modal.
 */
export const openSupportEmail = async (subject?: string): Promise<boolean> => {
    const resolvedSubject = subject || `${BRAND_DISPLAY_NAME} feedback`;
    const url = `mailto:${SUPPORT_EMAIL_ADDRESS}?subject=${encodeURIComponent(resolvedSubject)}`;

    try {
        await Linking.openURL(url);

        return true;
    } catch (err) {
        console.log('SUPPORT_EMAIL_LINK_ERROR', err);

        return false;
    }
};
