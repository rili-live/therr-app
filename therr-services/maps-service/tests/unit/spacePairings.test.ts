/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import SpacesStore from '../../src/store/SpacesStore';

describe('SpacesStore - searchPairedSpaces', () => {
    const createMockStores = () => {
        const mockStore = {
            read: {
                query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
            },
        };
        const mockMediaStore = {
            write: {
                query: sinon.stub().callsFake(() => Promise.resolve({})),
            },
        };
        return { mockStore, mockMediaStore };
    };

    it('generates a query that excludes the source space by id', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include("'space-123'");
        expect(query).to.include('"isPublic" = true');
        expect(query).to.include('"isMatureContent" = false');
        expect(query).to.include('"isClaimPending" = false');
    });

    it('includes ST_DWithin with default 8000m radius', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('ST_DWithin');
        expect(query).to.include('8000');
    });

    it('uses custom radius when provided', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food', { radiusMeters: 5000 });

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('5000');
    });

    it('includes catScore CASE expression for complementary categories', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('AS "catScore"');
        expect(query).to.include('THEN 2'); // complementary match
        expect(query).to.include('THEN 1'); // non-same category
        expect(query).to.include('ELSE 0'); // same category
    });

    it('joins spacePairingFeedback to incorporate feedback into catScore', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('LEFT JOIN');
        expect(query).to.include('"spacePairingFeedback"');
        expect(query).to.include('"sourceSpaceId"');
        expect(query).to.include('"feedbackScore"');
        expect(query).to.include('COALESCE');
    });

    it('orders by catScore DESC then distInMeters ASC', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('"catScore" DESC');
        expect(query).to.include('"distInMeters" ASC');
    });

    it('limits results to 6 candidates', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('LIMIT 6');
    });

    it('selects the expected columns', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.restaurant/food');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('"notificationMsg"');
        expect(query).to.include('"addressReadable"');
        expect(query).to.include('"priceRange"');
        expect(query).to.include('medias');
        expect(query).to.include('category');
    });

    it('handles unknown category gracefully (empty complementary list)', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, 'categories.unknown');

        const query = mockStore.read.query.args[0][0];
        // Should still generate a valid query with an empty ARRAY for complementary categories
        expect(query).to.include('AS "catScore"');
        expect(query).to.include('LIMIT 6');
    });

    it('handles empty string category', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        store.searchPairedSpaces('space-123', 40.7128, -74.0060, '');

        const query = mockStore.read.query.args[0][0];
        expect(query).to.include('AS "catScore"');
        expect(query).to.include('LIMIT 6');
    });

    it('uses parameterized values (not raw interpolation)', () => {
        const { mockStore, mockMediaStore } = createMockStores();
        const store = new SpacesStore(mockStore, mockMediaStore);

        // Use values that would break raw interpolation if not parameterized
        store.searchPairedSpaces("space'; DROP TABLE spaces;--", 40.7128, -74.0060, "cat'; DROP TABLE spaces;--");

        const query = mockStore.read.query.args[0][0];
        // Knex parameterized queries escape single quotes by doubling them
        // The doubled quote ('') prevents SQL injection by keeping the value as a string literal
        expect(query).to.include("space''");
        expect(query).to.include("cat''");
        // Verify the injected SQL is trapped inside a string literal (preceded by escaped quote)
        expect(query).to.not.match(/[^']'; DROP TABLE/);
    });
});
