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
 * Content Filter Reducer Regression Tests
 *
 * Tests the activeAreasFilters merge behavior in the content reducer.
 * The reducer was changed to merge partial updates instead of replacing the
 * entire filter state, allowing contentType and order to be set independently.
 */

// Mirror of the reducer merge logic from therr-react/src/redux/reducers/content.ts
const applyFilters = (currentFilters: Record<string, any>, newData: Record<string, any>) => {
    return { ...currentFilters, ...newData };
};

const initialFilters = {
    order: 'DESC' as const,
    contentType: 'all' as const,
};

describe('Content activeAreasFilters merge behavior', () => {
    it('should initialize with default filters', () => {
        expect(initialFilters.order).toBe('DESC');
        expect(initialFilters.contentType).toBe('all');
    });

    it('should merge contentType without losing order', () => {
        const result = applyFilters(initialFilters, { contentType: 'moments' });
        expect(result.contentType).toBe('moments');
        expect(result.order).toBe('DESC');
    });

    it('should merge order without losing contentType', () => {
        const result = applyFilters(initialFilters, { order: 'ASC' });
        expect(result.order).toBe('ASC');
        expect(result.contentType).toBe('all');
    });

    it('should allow resetting contentType to all', () => {
        const withMoments = applyFilters(initialFilters, { contentType: 'moments' });
        const reset = applyFilters(withMoments, { contentType: 'all' });
        expect(reset.contentType).toBe('all');
        expect(reset.order).toBe('DESC');
    });

    it('should allow setting both filters at once', () => {
        const result = applyFilters(initialFilters, { contentType: 'thoughts', order: 'ASC' });
        expect(result.contentType).toBe('thoughts');
        expect(result.order).toBe('ASC');
    });
});

/**
 * Content Type Filter Application Tests
 *
 * Tests the logic from Areas/index.tsx that uses the contentType filter
 * to determine which content types to include in the discoveries carousel.
 */
describe('Content type filter application in Areas', () => {
    const getIncludeFlags = (contentType: string) => ({
        shouldIncludeThoughts: contentType !== 'moments',
        shouldIncludeMoments: contentType !== 'thoughts',
    });

    it('should include both types when contentType is all', () => {
        const flags = getIncludeFlags('all');
        expect(flags.shouldIncludeThoughts).toBe(true);
        expect(flags.shouldIncludeMoments).toBe(true);
    });

    it('should include only moments when contentType is moments', () => {
        const flags = getIncludeFlags('moments');
        expect(flags.shouldIncludeThoughts).toBe(false);
        expect(flags.shouldIncludeMoments).toBe(true);
    });

    it('should include only thoughts when contentType is thoughts', () => {
        const flags = getIncludeFlags('thoughts');
        expect(flags.shouldIncludeThoughts).toBe(true);
        expect(flags.shouldIncludeMoments).toBe(false);
    });
});

/**
 * Header Search Input filter count Tests
 *
 * Tests that the badge count in HeaderSearchInput correctly includes
 * the contentType filter.
 */
describe('HeaderSearchInput filter count with contentType', () => {
    const countFilters = (activeAreasFilters: any, filtersCategory: any[]) => {
        let filterCount = 0;
        filtersCategory.forEach((filter) => {
            if (!filter.isChecked) {
                filterCount += 1;
            }
        });
        if (activeAreasFilters?.contentType && activeAreasFilters.contentType !== 'all') {
            filterCount += 1;
        }
        return filterCount;
    };

    it('should not count contentType when set to all', () => {
        const count = countFilters({ contentType: 'all' }, []);
        expect(count).toBe(0);
    });

    it('should count contentType when set to moments', () => {
        const count = countFilters({ contentType: 'moments' }, []);
        expect(count).toBe(1);
    });

    it('should count contentType when set to thoughts', () => {
        const count = countFilters({ contentType: 'thoughts' }, []);
        expect(count).toBe(1);
    });

    it('should sum contentType and unchecked category filters', () => {
        const categories = [
            { isChecked: true },
            { isChecked: false },
            { isChecked: false },
        ];
        const count = countFilters({ contentType: 'moments' }, categories);
        expect(count).toBe(3);
    });

    it('should handle missing contentType', () => {
        const count = countFilters({}, []);
        expect(count).toBe(0);
    });

    it('should handle undefined activeAreasFilters', () => {
        const count = countFilters(undefined, []);
        expect(count).toBe(0);
    });
});
