import { expect } from 'chai';
import sinon from 'sinon';
import ContentMediaStore, { MAX_REFERENCE_CHECK_PATHS, MAX_REFERENCE_CHECK_TOTAL } from '../../src/store/ContentMediaStore';

// Three tables are probed per chunk (moments, spaces, events), so query count is
// `chunks * 3` — that multiplier is what the chunking assertions below key off.
const REFERENCING_TABLE_COUNT = 3;

const createMockStore = (rowsFor: (sql: string, params: string[]) => { path: string }[] = () => []) => ({
    read: {
        query: sinon.stub().callsFake((sql: string, params: string[]) => Promise.resolve({ rows: rowsFor(sql, params) })),
    },
});

const pathsFromParams = (params: string[]) => params.map((p) => JSON.parse(p)[0].path);

describe('ContentMediaStore', () => {
    describe('getReferencedPaths', () => {
        it('does not query when there are no candidates', async () => {
            const mockStore = createMockStore();
            const store = new ContentMediaStore(mockStore);

            const result = await store.getReferencedPaths([]);

            expect(result).to.deep.equal([]);
            expect(mockStore.read.query.called).to.equal(false);
        });

        it('ignores empty paths', async () => {
            const mockStore = createMockStore();
            const store = new ContentMediaStore(mockStore);

            await store.getReferencedPaths(['', undefined as any, null as any]);

            expect(mockStore.read.query.called).to.equal(false);
        });

        it('dedupes candidates before querying', async () => {
            const mockStore = createMockStore();
            const store = new ContentMediaStore(mockStore);

            await store.getReferencedPaths(['a/b.jpeg', 'a/b.jpeg', 'a/c.jpeg']);

            expect(mockStore.read.query.callCount).to.equal(REFERENCING_TABLE_COUNT);
            expect(pathsFromParams(mockStore.read.query.args[0][1])).to.deep.equal(['a/b.jpeg', 'a/c.jpeg']);
        });

        it('returns only the paths a content row references, deduped across tables', async () => {
            // The same path can be carried by a moment and a space; the caller wants one entry.
            const mockStore = createMockStore((_sql, params) => {
                const paths = pathsFromParams(params);
                return paths.includes('a/referenced.jpeg') ? [{ path: 'a/referenced.jpeg' }] : [];
            });
            const store = new ContentMediaStore(mockStore);

            const result = await store.getReferencedPaths(['a/referenced.jpeg', 'a/orphan.jpeg']);

            expect(result).to.deep.equal(['a/referenced.jpeg']);
        });

        // Regression: candidates past MAX_REFERENCE_CHECK_PATHS used to be sliced off and
        // never checked. A dropped candidate is indistinguishable from an unreferenced one
        // — both come back absent and render as a missing image with no error on either
        // side — so the cap silently denied media the caller was entitled to.
        it('chunks past the per-query cap instead of dropping the tail', async () => {
            const total = MAX_REFERENCE_CHECK_PATHS + 1;
            const paths = Array.from({ length: total }, (_, i) => `user-1/content/photo_${i}.jpeg`);
            const mockStore = createMockStore();
            const store = new ContentMediaStore(mockStore);

            await store.getReferencedPaths(paths);

            expect(mockStore.read.query.callCount).to.equal(2 * REFERENCING_TABLE_COUNT);

            const queried = new Set(
                mockStore.read.query.args.flatMap(([, params]) => pathsFromParams(params)),
            );
            expect(queried.size).to.equal(total);
            // The one that used to fall off the end.
            expect(queried.has(paths[total - 1])).to.equal(true);
        });

        it('resolves a path that only appears in the second chunk', async () => {
            const total = MAX_REFERENCE_CHECK_PATHS + 1;
            const paths = Array.from({ length: total }, (_, i) => `user-1/content/photo_${i}.jpeg`);
            const target = paths[total - 1];
            const mockStore = createMockStore((_sql, params) => (
                pathsFromParams(params).includes(target) ? [{ path: target }] : []
            ));
            const store = new ContentMediaStore(mockStore);

            const result = await store.getReferencedPaths(paths);

            expect(result).to.deep.equal([target]);
        });

        // The ceiling still exists so one request cannot buy unbounded work; it just sits
        // far past any real batch rather than at a screenful.
        it('still truncates at the overall ceiling', async () => {
            const paths = Array.from({ length: MAX_REFERENCE_CHECK_TOTAL + 50 }, (_, i) => `user-1/content/photo_${i}.jpeg`);
            const mockStore = createMockStore();
            const store = new ContentMediaStore(mockStore);

            await store.getReferencedPaths(paths);

            const queried = new Set(
                mockStore.read.query.args.flatMap(([, params]) => pathsFromParams(params)),
            );
            expect(queried.size).to.equal(MAX_REFERENCE_CHECK_TOTAL);
            expect(mockStore.read.query.callCount).to.equal(
                (MAX_REFERENCE_CHECK_TOTAL / MAX_REFERENCE_CHECK_PATHS) * REFERENCING_TABLE_COUNT,
            );
        });
    });
});
