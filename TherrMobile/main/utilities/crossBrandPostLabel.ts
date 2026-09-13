import { BrandVariations, HABIT_CHECKIN_THOUGHT_CATEGORY } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

/**
 * Posts are minted with the brand the author was using (`main.thoughts.brandVariation`),
 * and `BRAND_THOUGHTS_VISIBILITY` lets Therr read every brand's posts. So a
 * Friends with Habits goal — written as a bare sentence like "Run 3x this week" —
 * lands in the Therr feed with nothing saying what it is, next to ordinary thoughts.
 *
 * This prefixes such a post with a short label naming what it is ("Goals update: ..."),
 * and only when the reader's app is NOT the app it was written in: inside Friends
 * with Habits every post is a goal, so labelling them all there is pure noise.
 *
 * ONE HABITS post type is deliberately NOT labelled: a shared check-in. It is a bare
 * photo post ("I did the thing"), not a goal, so the "Goals update:" pre-text misreads
 * it. Only composed goal updates carry the label. A check-in share is stamped
 * `category === HABIT_CHECKIN_THOUGHT_CATEGORY` by the server (see users-service
 * habitCheckins shareCheckin), which is the one signal that separates the two here.
 *
 * The label is resolved through the READER's dictionary, not the author's, so a
 * French reader sees French copy on an English author's goal. That is also why the
 * prefix is applied at render time rather than baked into the stored message.
 */
const CROSS_BRAND_LABEL_KEYS: { [brand: string]: string } = {
    [BrandVariations.HABITS]: 'components.thoughtDisplay.crossBrandLabels.habits',
};

export const getCrossBrandLabelKey = (
    brandVariation?: string | null,
    currentBrand: string = CURRENT_BRAND_VARIATION,
): string | undefined => {
    if (!brandVariation || brandVariation === currentBrand) {
        return undefined;
    }

    return CROSS_BRAND_LABEL_KEYS[brandVariation];
};

interface IFormatCrossBrandMessageArgs {
    message?: string | null;
    brandVariation?: string | null;
    /** Replies inherit their parent's context, so only top-level posts are labelled. */
    parentId?: string | null;
    /**
     * The post's `main.thoughts.category`. A shared check-in carries
     * `HABIT_CHECKIN_THOUGHT_CATEGORY` and is never labelled — see the file header.
     */
    category?: string | null;
    translate: (key: string, params?: any) => string;
    currentBrand?: string;
}

export const formatCrossBrandMessage = ({
    message,
    brandVariation,
    parentId,
    category,
    translate,
    currentBrand = CURRENT_BRAND_VARIATION,
}: IFormatCrossBrandMessageArgs): string => {
    const text = message || '';

    if (parentId) {
        return text;
    }

    // A shared check-in is a photo post, not a goal, so it gets no "Goals update:"
    // pre-text even when read cross-brand.
    if (category === HABIT_CHECKIN_THOUGHT_CATEGORY) {
        return text;
    }

    const labelKey = getCrossBrandLabelKey(brandVariation, currentBrand);

    if (!labelKey) {
        return text;
    }

    // The post body is spliced in with split/join rather than handed to the translator as a
    // param. The translator substitutes with `String.replace(string, string)`, whose
    // replacement argument gives `$&`, `` $` `` and `$1` special meaning — a post containing
    // any of those would come out mangled. `{message}` stays in the dictionary value so a
    // locale can still choose where the body sits relative to the label.
    return translate('components.thoughtDisplay.crossBrandLabels.format', {
        label: translate(labelKey),
    }).split('{message}').join(text);
};

export default formatCrossBrandMessage;
