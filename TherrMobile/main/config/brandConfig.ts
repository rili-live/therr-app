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
//
// Annotated as the enum rather than inferred as a literal on purpose. Without
// it, TypeScript narrows this to the one selected member and every
// `CURRENT_BRAND_VARIATION === BrandVariations.HABITS` guard elsewhere becomes
// a provably-false comparison (TS2367) — 23 of them on `general`. Those guards
// are all correct at runtime, so the errors were pure noise, and worse, the set
// of them changed with the selected brand: flipping this value churned the tsc
// baseline and made a brand leak between `general` and `niche/*` hard to see.
export const CURRENT_BRAND_VARIATION: BrandVariations = BrandVariations.THERR;

export default {
    brandVariation: CURRENT_BRAND_VARIATION,
};
