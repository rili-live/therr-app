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
// The `: BrandVariations` annotation is deliberate and must not be removed. Without it
// TypeScript narrows this to a single literal member, so every
// `CURRENT_BRAND_VARIATION === BrandVariations.<other>` guard elsewhere becomes a false
// TS2367 whose message names the *currently selected* brand. Those messages then differ
// between `general` and `niche/<TAG>-general`, which churns the mobile tsc baseline on
// every brand flip and hides real regressions behind the noise.
//
// NICHE(HABITS): this value is the one line of this file that differs from `general`.
export const CURRENT_BRAND_VARIATION: BrandVariations = BrandVariations.HABITS;

// User-facing app name, for copy that must name the app — most importantly a Google Play
// prominent disclosure, which has to name the app the user is actually holding.
//
// Derived from the selected brand rather than written out, so a niche branch flips
// CURRENT_BRAND_VARIATION above and this follows. Never hardcode a brand name into a
// locale dictionary: those are shared across every variant, so a hardcoded name renders
// the wrong app's name for everyone else. Pass `{appName}` instead — `utilities/translator.ts`
// resolves it with no per-call-site wiring.
const BRAND_DISPLAY_NAMES: Partial<Record<BrandVariations, string>> = {
    [BrandVariations.THERR]: 'Therr',
    [BrandVariations.TEEM]: 'Teem',
    [BrandVariations.HABITS]: 'Friends with Habits',
};

export const BRAND_DISPLAY_NAME = BRAND_DISPLAY_NAMES[CURRENT_BRAND_VARIATION] || 'Therr';

export default {
    brandVariation: CURRENT_BRAND_VARIATION,
};
