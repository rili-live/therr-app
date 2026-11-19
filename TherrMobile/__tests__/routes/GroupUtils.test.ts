import { describe, it, expect } from '@jest/globals';
import {
    getCategoryLabel,
    getFallbackAvatarColor,
    getTitleInitial,
} from '../../main/routes/Groups/groupUtils';

// Mirrors the shared translator's contract: a missing key comes back as the key itself.
const dictionary: Record<string, string> = {
    'pages.groups.categories.names.food': 'Comida',
};
const translate = (key: string) => dictionary[key] || key;

describe('getCategoryLabel', () => {
    it('uses the dictionary label for a known tag', () => {
        expect(getCategoryLabel(translate, { tag: 'food', name: 'food' })).toBe('Comida');
    });

    it('falls back to the capitalized stored name for a tag with no dictionary entry', () => {
        expect(getCategoryLabel(translate, { tag: 'gardening', name: 'gardening' })).toBe('Gardening');
    });

    it('never returns the raw translation key', () => {
        expect(getCategoryLabel(translate, { tag: 'unknown', name: '' })).toBe('Unknown');
    });

    it('tolerates a missing category', () => {
        expect(getCategoryLabel(translate, undefined)).toBe('');
    });
});

describe('getFallbackAvatarColor', () => {
    const palette = ['#111111', '#222222', '#333333'];

    it('returns the same color for the same group id every time', () => {
        const first = getFallbackAvatarColor('3f2c9a1e-group', palette);
        expect(getFallbackAvatarColor('3f2c9a1e-group', palette)).toBe(first);
        expect(palette).toContain(first);
    });

    it('spreads different ids across the palette', () => {
        const ids = Array.from({ length: 30 }, (_, i) => `group-${i}`);
        const used = new Set(ids.map((id) => getFallbackAvatarColor(id, palette)));
        expect(used.size).toBe(palette.length);
    });

    it('returns an empty string for an empty palette rather than throwing', () => {
        expect(getFallbackAvatarColor('group-1', [])).toBe('');
    });
});

describe('getTitleInitial', () => {
    it('uppercases the first letter', () => {
        expect(getTitleInitial('foodies international')).toBe('F');
    });

    it('keeps a leading emoji whole instead of splitting a surrogate pair', () => {
        expect(getTitleInitial('🍕 Pizza Club')).toBe('🍕');
    });

    it('ignores leading whitespace', () => {
        expect(getTitleInitial('  Islam')).toBe('I');
    });

    it('handles an object-shaped title from inconsistent API responses', () => {
        expect(getTitleInitial({ title: 'Global Tech' })).toBe('G');
    });

    it('falls back to "?" for an empty title', () => {
        expect(getTitleInitial('')).toBe('?');
    });
});
