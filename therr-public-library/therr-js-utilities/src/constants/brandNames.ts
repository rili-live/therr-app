import { BrandVariations } from './enums/Branding';

/**
 * The human-readable app name for each brand variation.
 *
 * This exists because user-facing copy that names the app has to be assembled somewhere the
 * *gateway* can reach. `hostContext.ts` in users-service already carries a much richer
 * per-brand config (email palettes, social handles, parent URLs), but it lives behind a
 * service boundary and is keyed by host rather than by brand — no use to a gateway route that
 * only has the `x-brand-variation` header. Keeping just the display name here, isomorphic and
 * dependency-free, avoids a service hop for a single string.
 *
 * Any brand without an entry falls back to Therr, matching `getBrandContext`'s treatment of an
 * absent or unrecognized header.
 */
export const BRAND_NAMES: { [brand: string]: string } = {
    [BrandVariations.THERR]: 'Therr',
    [BrandVariations.DASHBOARD_THERR]: 'Therr',
    [BrandVariations.HABITS]: 'Friends with Habits',
    [BrandVariations.TEEM]: 'Teem',
    [BrandVariations.APPY_SOCIAL]: 'Appy Social',
    [BrandVariations.PARALLELS]: 'Parallels',
    [BrandVariations.OTAKU]: 'Otaku',
};

export const DEFAULT_BRAND_NAME = BRAND_NAMES[BrandVariations.THERR];

/**
 * Display name for a brand variation, safe to interpolate into user-facing copy.
 */
export const getBrandName = (brandVariation?: string): string => (
    (brandVariation && BRAND_NAMES[brandVariation]) || DEFAULT_BRAND_NAME
);
