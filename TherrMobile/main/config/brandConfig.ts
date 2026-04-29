import { BrandVariations } from 'therr-js-utilities/constants';

// NICHE: Update this value for each niche app variant.
// Affects HTTP `x-brand-variation` header, socket payload, feature flags,
// and (as of Phase 6 of the styling audit) the active per-brand theme
// overrides.
//
// To customize the visual look for a niche app, do NOT change components or
// screens — instead add an entry to:
//   - `main/styles/themes/index.ts → brandColorOverrides`
//   - `main/styles/themes/index.ts → brandColorVariationOverrides`
//   - `main/styles/themes/paper.ts → brandPaperColorOverrides`
// Edits there are picked up automatically by every `getTheme()` /
// `getPaperTheme()` consumer.
export const CURRENT_BRAND_VARIATION = BrandVariations.THERR;

export default {
    brandVariation: CURRENT_BRAND_VARIATION,
};
