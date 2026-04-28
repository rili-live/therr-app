import { BrandVariations } from './enums/Branding';

// Per-brand allowlist of brand values whose thoughts this brand may READ.
// 'all' means no filter (caller sees thoughts from every brand).
// To flip a brand to strict isolation, replace 'all' with a list containing only itself.
export const BRAND_THOUGHTS_VISIBILITY: Record<string, BrandVariations[] | 'all'> = {
    [BrandVariations.THERR]: 'all',
    [BrandVariations.HABITS]: [BrandVariations.HABITS],
    [BrandVariations.TEEM]: [BrandVariations.TEEM],
};

export const getReadableBrands = (brand: BrandVariations | string): BrandVariations[] | 'all' => BRAND_THOUGHTS_VISIBILITY[brand]
    ?? [brand as BrandVariations];
