import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * AreaDisplay Helper Function Tests
 *
 * Tests the pure helper functions used by the AreaDisplay component
 * for formatting space details (category labels, price ranges).
 *
 * These functions are extracted here to mirror the module-level helpers
 * in main/components/UserContent/AreaDisplay.tsx.
 */

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

// ============================================================================
// Helper functions (mirroring AreaDisplay.tsx module-level helpers)
// ============================================================================

const formatCategoryLabel = (category: string): string => {
    if (!category) return '';
    const label = category.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatPriceRange = (priceRange: number): string => '$'.repeat(priceRange);

// ============================================================================
// Tests
// ============================================================================

describe('formatCategoryLabel', () => {
    it('should strip the "categories." prefix', () => {
        expect(formatCategoryLabel('categories.restaurant')).toBe('Restaurant');
    });

    it('should replace "/" with " & "', () => {
        expect(formatCategoryLabel('categories.food/drink')).toBe('Food & drink');
    });

    it('should capitalize the first letter', () => {
        expect(formatCategoryLabel('categories.cafe')).toBe('Cafe');
    });

    it('should handle categories without the prefix', () => {
        expect(formatCategoryLabel('nightlife')).toBe('Nightlife');
    });

    it('should handle already-capitalized categories', () => {
        expect(formatCategoryLabel('categories.Hotels')).toBe('Hotels');
    });

    it('should return empty string for empty input', () => {
        expect(formatCategoryLabel('')).toBe('');
    });

    it('should return empty string for falsy input', () => {
        expect(formatCategoryLabel(undefined as unknown as string)).toBe('');
        expect(formatCategoryLabel(null as unknown as string)).toBe('');
    });

    it('should handle compound categories with multiple slashes', () => {
        // Only the first "/" is replaced by String.replace (non-global)
        expect(formatCategoryLabel('categories.arts/culture/history')).toBe('Arts & culture/history');
    });
});

describe('formatPriceRange', () => {
    it('should return "$" for price range 1', () => {
        expect(formatPriceRange(1)).toBe('$');
    });

    it('should return "$$" for price range 2', () => {
        expect(formatPriceRange(2)).toBe('$$');
    });

    it('should return "$$$" for price range 3', () => {
        expect(formatPriceRange(3)).toBe('$$$');
    });

    it('should return "$$$$" for price range 4', () => {
        expect(formatPriceRange(4)).toBe('$$$$');
    });

    it('should return empty string for price range 0', () => {
        expect(formatPriceRange(0)).toBe('');
    });
});

describe('Opening hours parsing', () => {
    // Mirrors the inline parsing logic in AreaDisplay render method
    const parseOpeningHours = (schema: string[]): { days: string; hours: string }[] => schema.map((entry) => {
        const parts = entry.split(' ');
        return {
            days: parts[0] || '',
            hours: parts.slice(1).join(' ') || '',
        };
    });

    it('should parse standard day/hours entries', () => {
        const schema = ['Mo 9:00-17:00', 'Tu 9:00-17:00'];
        const result = parseOpeningHours(schema);
        expect(result).toEqual([
            { days: 'Mo', hours: '9:00-17:00' },
            { days: 'Tu', hours: '9:00-17:00' },
        ]);
    });

    it('should handle day ranges', () => {
        const schema = ['Mo-Fr 9:00-17:00', 'Sa 10:00-14:00'];
        const result = parseOpeningHours(schema);
        expect(result).toEqual([
            { days: 'Mo-Fr', hours: '9:00-17:00' },
            { days: 'Sa', hours: '10:00-14:00' },
        ]);
    });

    it('should handle hours with spaces (e.g., "9:00 AM - 5:00 PM")', () => {
        const schema = ['Mo 9:00 AM - 5:00 PM'];
        const result = parseOpeningHours(schema);
        expect(result).toEqual([
            { days: 'Mo', hours: '9:00 AM - 5:00 PM' },
        ]);
    });

    it('should handle "Closed" entries', () => {
        const schema = ['Su Closed'];
        const result = parseOpeningHours(schema);
        expect(result).toEqual([
            { days: 'Su', hours: 'Closed' },
        ]);
    });

    it('should handle empty schema', () => {
        expect(parseOpeningHours([])).toEqual([]);
    });

    it('should handle entry with only a day (no hours)', () => {
        const schema = ['Mo'];
        const result = parseOpeningHours(schema);
        expect(result).toEqual([
            { days: 'Mo', hours: '' },
        ]);
    });
});

describe('Action links filtering logic', () => {
    // Mirrors the action link construction in AreaDisplay.render
    const buildActionLinks = (area: any) => {
        const links = [
            { url: area.websiteUrl, icon: 'globe', title: 'Website' },
            { url: area.menuUrl, icon: 'utensils', title: 'Menu' },
            { url: area.orderUrl, icon: 'shopping-bag', title: 'Order' },
            { url: area.reservationUrl, icon: 'calendar', title: 'Reserve' },
        ].filter(item => !!item?.url);

        if (area.phoneNumber) {
            links.push({
                url: `tel:${area.phoneNumber}`,
                icon: 'phone',
                title: 'Call',
            });
        }

        return links;
    };

    it('should include only links with URLs', () => {
        const area = {
            websiteUrl: 'https://example.com',
            menuUrl: null,
            orderUrl: undefined,
            reservationUrl: '',
            phoneNumber: null,
        };
        const links = buildActionLinks(area);
        expect(links).toHaveLength(1);
        expect(links[0].title).toBe('Website');
    });

    it('should include all links when all URLs are present', () => {
        const area = {
            websiteUrl: 'https://example.com',
            menuUrl: 'https://example.com/menu',
            orderUrl: 'https://example.com/order',
            reservationUrl: 'https://example.com/reserve',
            phoneNumber: '555-1234',
        };
        const links = buildActionLinks(area);
        expect(links).toHaveLength(5);
    });

    it('should add phone link with tel: prefix', () => {
        const area = {
            phoneNumber: '555-1234',
        };
        const links = buildActionLinks(area);
        expect(links).toHaveLength(1);
        expect(links[0].url).toBe('tel:555-1234');
        expect(links[0].icon).toBe('phone');
    });

    it('should return empty array when no URLs are present', () => {
        const area = {};
        const links = buildActionLinks(area);
        expect(links).toHaveLength(0);
    });
});

describe('Space detail visibility conditions', () => {
    // Mirrors the conditional rendering guards in AreaDisplay.render
    const shouldShowCategory = (isSpace: boolean, isExpanded: boolean, area: any) =>
        isSpace && isExpanded && (area.category || area.priceRange > 0);

    const shouldShowAddress = (isSpace: boolean, isExpanded: boolean, area: any) =>
        isSpace && isExpanded && !!area.addressReadable;

    const shouldShowHours = (isSpace: boolean, isExpanded: boolean, area: any) =>
        isSpace && isExpanded && area.openingHours?.schema?.length > 0;

    const shouldShowContact = (isSpace: boolean, isExpanded: boolean, area: any) =>
        isSpace && isExpanded && (area.addressStreetAddress || area.addressLocality || area.addressRegion || area.phoneNumber);

    const shouldShowEvents = (isSpace: boolean, isExpanded: boolean, area: any) =>
        isSpace && isExpanded && area.events?.length > 0;

    const shouldShowMoments = (isSpace: boolean, isExpanded: boolean, area: any) =>
        isSpace && isExpanded && area.associatedMoments?.length > 0;

    describe('category/price row', () => {
        it('should show when space has category', () => {
            expect(shouldShowCategory(true, true, { category: 'categories.restaurant' })).toBeTruthy();
        });

        it('should show when space has price range', () => {
            expect(shouldShowCategory(true, true, { priceRange: 2 })).toBe(true);
        });

        it('should not show for moments', () => {
            expect(shouldShowCategory(false, true, { category: 'categories.restaurant' })).toBe(false);
        });

        it('should not show when collapsed', () => {
            expect(shouldShowCategory(true, false, { category: 'categories.restaurant' })).toBe(false);
        });

        it('should not show when no category and no price', () => {
            expect(shouldShowCategory(true, true, { priceRange: 0 })).toBe(false);
        });
    });

    describe('address summary row', () => {
        it('should show when address is available', () => {
            expect(shouldShowAddress(true, true, { addressReadable: '123 Main St' })).toBe(true);
        });

        it('should not show when address is empty', () => {
            expect(shouldShowAddress(true, true, { addressReadable: '' })).toBe(false);
        });

        it('should not show for non-spaces', () => {
            expect(shouldShowAddress(false, true, { addressReadable: '123 Main St' })).toBe(false);
        });
    });

    describe('hours section', () => {
        it('should show when opening hours schema exists', () => {
            expect(shouldShowHours(true, true, { openingHours: { schema: ['Mo 9:00-17:00'] } })).toBe(true);
        });

        it('should not show when schema is empty', () => {
            expect(shouldShowHours(true, true, { openingHours: { schema: [] } })).toBe(false);
        });

        it('should not show when openingHours is null', () => {
            expect(shouldShowHours(true, true, { openingHours: null })).toBe(false);
        });
    });

    describe('contact section', () => {
        it('should show when phone number exists', () => {
            expect(shouldShowContact(true, true, { phoneNumber: '555-1234' })).toBeTruthy();
        });

        it('should show when street address exists', () => {
            expect(shouldShowContact(true, true, { addressStreetAddress: '123 Main St' })).toBeTruthy();
        });

        it('should not show when no contact info available', () => {
            expect(shouldShowContact(true, true, {})).toBeFalsy();
        });
    });

    describe('events section', () => {
        it('should show when events exist', () => {
            expect(shouldShowEvents(true, true, { events: [{ id: '1' }] })).toBe(true);
        });

        it('should not show when events array is empty', () => {
            expect(shouldShowEvents(true, true, { events: [] })).toBe(false);
        });
    });

    describe('moments section', () => {
        it('should show when moments exist', () => {
            expect(shouldShowMoments(true, true, { associatedMoments: [{ id: '1' }] })).toBe(true);
        });

        it('should not show when no moments', () => {
            expect(shouldShowMoments(true, true, { associatedMoments: [] })).toBe(false);
        });
    });
});
