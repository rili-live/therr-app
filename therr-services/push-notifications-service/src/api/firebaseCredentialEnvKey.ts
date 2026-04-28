import { BrandVariations } from 'therr-js-utilities/constants';

// Maps a brand to the env var that holds its base64-encoded Firebase service account JSON.
//
// THERR keeps the historical, unsuffixed env var so existing single-app deployments stay
// working unchanged. Every other brand maps to PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_<UPPER>.
//
// Extracted to its own module so it's testable without loading firebaseAdmin.ts (which
// validates THERR credentials at module load and is therefore not import-safe in unit tests).
export const getCredentialEnvKey = (brandVariation: BrandVariations): string => {
    if (brandVariation === BrandVariations.THERR) {
        return 'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64';
    }
    return `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_${String(brandVariation).toUpperCase()}`;
};
