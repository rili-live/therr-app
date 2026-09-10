import { BrandVariations } from 'therr-js-utilities/constants';
import translator from '../../main/utilities/translator';
import { formatCrossBrandMessage, getCrossBrandLabelKey } from '../../main/utilities/crossBrandPostLabel';

/**
 * Cross-brand post labelling.
 *
 * `BRAND_THOUGHTS_VISIBILITY` lets the Therr app read every brand's posts, so a Friends
 * with Habits goal lands in the Therr feed as a bare sentence with nothing saying what it
 * is. These lock in that such a post is labelled for the reader, in the READER's locale,
 * and that a post from the reader's own app is left alone.
 */
describe('crossBrandPostLabel', () => {
    const translate = (locale: string) => (key: string, params?: any) => translator(locale, key, params);

    describe('getCrossBrandLabelKey', () => {
        it('labels a habits post when the reader is on another brand', () => {
            expect(getCrossBrandLabelKey(BrandVariations.HABITS, BrandVariations.THERR))
                .toBe('components.thoughtDisplay.crossBrandLabels.habits');
        });

        it('does not label a post authored in the reader\'s own app', () => {
            expect(getCrossBrandLabelKey(BrandVariations.HABITS, BrandVariations.HABITS)).toBeUndefined();
            expect(getCrossBrandLabelKey(BrandVariations.THERR, BrandVariations.THERR)).toBeUndefined();
        });

        it('does not label a brand with no label defined, or a post with no brand', () => {
            expect(getCrossBrandLabelKey(BrandVariations.TEEM, BrandVariations.THERR)).toBeUndefined();
            expect(getCrossBrandLabelKey(undefined, BrandVariations.THERR)).toBeUndefined();
            expect(getCrossBrandLabelKey(null, BrandVariations.THERR)).toBeUndefined();
        });
    });

    describe('formatCrossBrandMessage', () => {
        it('prefixes a habits goal read from the Therr app', () => {
            expect(formatCrossBrandMessage({
                message: 'Run 3x this week',
                brandVariation: BrandVariations.HABITS,
                translate: translate('en-us'),
                currentBrand: BrandVariations.THERR,
            })).toBe('Goals update: Run 3x this week');
        });

        it('uses the reader\'s locale, not the author\'s', () => {
            const args = {
                message: 'Run 3x this week',
                brandVariation: BrandVariations.HABITS,
                currentBrand: BrandVariations.THERR,
            };

            expect(formatCrossBrandMessage({ ...args, translate: translate('es') }))
                .toBe('Actualización de objetivos: Run 3x this week');
            expect(formatCrossBrandMessage({ ...args, translate: translate('fr-ca') }))
                .toBe('Mise à jour des objectifs : Run 3x this week');
        });

        it('leaves a post from the reader\'s own app untouched', () => {
            expect(formatCrossBrandMessage({
                message: 'Run 3x this week',
                brandVariation: BrandVariations.HABITS,
                translate: translate('en-us'),
                currentBrand: BrandVariations.HABITS,
            })).toBe('Run 3x this week');
        });

        it('leaves replies untouched — they inherit their parent\'s context', () => {
            expect(formatCrossBrandMessage({
                message: 'Nice work!',
                brandVariation: BrandVariations.HABITS,
                parentId: 'parent-1',
                translate: translate('en-us'),
                currentBrand: BrandVariations.THERR,
            })).toBe('Nice work!');
        });

        it('never returns undefined for an empty message', () => {
            expect(formatCrossBrandMessage({
                message: null,
                brandVariation: BrandVariations.THERR,
                translate: translate('en-us'),
                currentBrand: BrandVariations.THERR,
            })).toBe('');
        });

        // The translator interpolates with `String.replace(string, string)`, where `$&`,
        // `` $` `` and `$1` are substitution patterns in the REPLACEMENT argument. Passing
        // the post body through as a param would mangle any post containing them.
        it('preserves `$` sequences in the post body verbatim', () => {
            expect(formatCrossBrandMessage({
                message: 'Save $5/day — no more $& excuses',
                brandVariation: BrandVariations.HABITS,
                translate: translate('en-us'),
                currentBrand: BrandVariations.THERR,
            })).toBe('Goals update: Save $5/day — no more $& excuses');
        });
    });
});
