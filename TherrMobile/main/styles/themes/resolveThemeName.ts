import { IMobileThemeName } from 'therr-react/types';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';

// Friends with Habits has not received the design pass needed to make the
// retro palette legible (light text on light surfaces and vice versa). Until
// that work lands, HABITS users who picked 'retro' — either historically or
// via an out-of-band DB update — silently render the dark theme. The picker
// in Settings hides the retro option entirely on HABITS, so this fallback
// only matters for legacy persisted values.
export const resolveMobileThemeName = (
    name?: IMobileThemeName,
    brand?: BrandVariations,
): IMobileThemeName | undefined => {
    const resolvedBrand = brand ?? CURRENT_BRAND_VARIATION;
    if (resolvedBrand === BrandVariations.HABITS && name === 'retro') {
        return 'dark';
    }
    return name;
};
