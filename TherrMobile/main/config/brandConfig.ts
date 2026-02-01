import { BrandVariations } from 'therr-js-utilities/constants';

// NICHE: Update this value for each niche app variant
export const CURRENT_BRAND_VARIATION = BrandVariations.HABITS;

// Feature flags per brand - controls what features are visible
export const BRAND_FEATURES = {
    [BrandVariations.THERR]: {
        showLocation: true,
        showMap: true,
        showBusinessAccount: true,
        showTherrCoin: true,
        showHabits: false,
        showPacts: false,
        showMoments: true,
        showSpaces: true,
        showEvents: true,
        showGroups: true,
        showConnect: true,
        requirePactOnboarding: false,
    },
    [BrandVariations.HABITS]: {
        showLocation: false,
        showMap: false,
        showBusinessAccount: false,
        showTherrCoin: false,
        showHabits: true,
        showPacts: true,
        showMoments: false,
        showSpaces: false,
        showEvents: false,
        showGroups: false,
        showConnect: true, // For finding accountability partners
        requirePactOnboarding: true, // Must create/join a pact to continue
    },
    [BrandVariations.TEEM]: {
        showLocation: true,
        showMap: true,
        showBusinessAccount: false,
        showTherrCoin: false,
        showHabits: false,
        showPacts: false,
        showMoments: true,
        showSpaces: true,
        showEvents: true,
        showGroups: true,
        showConnect: true,
        requirePactOnboarding: false,
    },
};

// Get features for current brand
export const getCurrentBrandFeatures = () => BRAND_FEATURES[CURRENT_BRAND_VARIATION];

export default {
    brandVariation: CURRENT_BRAND_VARIATION,
    features: BRAND_FEATURES[CURRENT_BRAND_VARIATION],
};
