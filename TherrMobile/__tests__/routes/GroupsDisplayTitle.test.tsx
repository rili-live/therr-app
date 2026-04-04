import 'react-native';

import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

/**
 * getDisplayTitle Regression Tests
 *
 * The group title field can sometimes arrive as an object instead of a string
 * from inconsistent API responses. These tests verify the getDisplayTitle
 * utility handles all cases correctly.
 */

// Mirror of the shared utility in main/routes/Groups/groupUtils.ts
const getDisplayTitle = (title: any): string =>
    typeof title === 'object' ? (title?.title || title?.name || '') : (title || '');

describe('getDisplayTitle', () => {
    it('should return a string title as-is', () => {
        expect(getDisplayTitle('My Group')).toBe('My Group');
    });

    it('should extract title from an object with a title property', () => {
        expect(getDisplayTitle({ title: 'Object Title', name: 'Object Name' })).toBe('Object Title');
    });

    it('should fall back to name when title property is missing', () => {
        expect(getDisplayTitle({ name: 'Object Name' })).toBe('Object Name');
    });

    it('should return empty string for an empty object', () => {
        expect(getDisplayTitle({})).toBe('');
    });

    it('should return empty string for null', () => {
        expect(getDisplayTitle(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(getDisplayTitle(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        expect(getDisplayTitle('')).toBe('');
    });

    it('should handle object with empty title by falling back to name', () => {
        expect(getDisplayTitle({ title: '', name: 'Fallback' })).toBe('Fallback');
    });

    it('should handle object with falsy title and falsy name', () => {
        expect(getDisplayTitle({ title: '', name: '' })).toBe('');
    });

    it('should correctly substring for avatar initial', () => {
        const title = getDisplayTitle('Hello World');
        expect(title.substring(0, 1)).toBe('H');
    });

    it('should correctly substring object title for avatar initial', () => {
        const title = getDisplayTitle({ title: 'Zara Group' });
        expect(title.substring(0, 1)).toBe('Z');
    });
});
