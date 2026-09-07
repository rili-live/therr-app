import { expect } from 'chai';
import { Content } from 'therr-js-utilities/constants';
import { isOwnedBy, isPrivateMedia, partitionByOwnership } from '../../src/utilities/mediaAccess';

// `getBucket` reads these at call time, and the private/public distinction is the
// whole point of the partition — with both unset they collapse to `undefined` and
// every media would read as public.
const PUBLIC_BUCKET = 'test-public-user-data';
const PRIVATE_BUCKET = 'test-private-user-data';

describe('mediaAccess', () => {
    let originalPublic: string | undefined;
    let originalPrivate: string | undefined;

    before(() => {
        originalPublic = process.env.BUCKET_PUBLIC_USER_DATA;
        originalPrivate = process.env.BUCKET_PRIVATE_USER_DATA;
        process.env.BUCKET_PUBLIC_USER_DATA = PUBLIC_BUCKET;
        process.env.BUCKET_PRIVATE_USER_DATA = PRIVATE_BUCKET;
    });

    after(() => {
        process.env.BUCKET_PUBLIC_USER_DATA = originalPublic;
        process.env.BUCKET_PRIVATE_USER_DATA = originalPrivate;
    });

    describe('isOwnedBy', () => {
        it('accepts a path under the user\'s own prefix', () => {
            expect(isOwnedBy('user-1/content/photo_abc.jpeg', 'user-1')).to.equal(true);
        });

        it('rejects another user\'s path', () => {
            expect(isOwnedBy('user-2/content/photo_abc.jpeg', 'user-1')).to.equal(false);
        });

        // A plain startsWith would let `user-1` claim every path belonging to `user-10`.
        it('compares whole segments, not a string prefix', () => {
            expect(isOwnedBy('user-10/content/photo_abc.jpeg', 'user-1')).to.equal(false);
        });

        it('rejects a bare prefix with no file after it', () => {
            expect(isOwnedBy('user-1', 'user-1')).to.equal(false);
        });

        it('rejects an unauthenticated caller', () => {
            expect(isOwnedBy('user-1/content/photo_abc.jpeg', undefined)).to.equal(false);
        });
    });

    describe('isPrivateMedia', () => {
        it('recognizes private media', () => {
            expect(isPrivateMedia({ path: 'p', type: Content.mediaTypes.USER_IMAGE_PRIVATE })).to.equal(true);
        });

        it('recognizes public media', () => {
            expect(isPrivateMedia({ path: 'p', type: Content.mediaTypes.USER_IMAGE_PUBLIC })).to.equal(false);
        });

        // getBucket falls through to the public bucket for anything it does not know,
        // so an unrecognized type is not private and must not be gated as though it were.
        it('treats an unrecognized type as public, matching getBucket\'s fall-through', () => {
            expect(isPrivateMedia({ path: 'p', type: 'not-a-real-type' })).to.equal(false);
        });
    });

    describe('partitionByOwnership', () => {
        const publicMedia = { path: 'user-2/content/pub.jpeg', type: Content.mediaTypes.USER_IMAGE_PUBLIC };
        const ownPrivate = { path: 'user-1/content/mine.jpeg', type: Content.mediaTypes.USER_IMAGE_PRIVATE };
        const othersPrivate = { path: 'user-2/content/theirs.jpeg', type: Content.mediaTypes.USER_IMAGE_PRIVATE };

        it('allows public media regardless of owner, with no reference check', () => {
            const { allowed, needsReferenceCheck } = partitionByOwnership([publicMedia], 'user-1');

            expect(allowed).to.deep.equal([publicMedia]);
            expect(needsReferenceCheck).to.have.lengthOf(0);
        });

        it('allows the caller\'s own private media with no reference check', () => {
            const { allowed, needsReferenceCheck } = partitionByOwnership([ownPrivate], 'user-1');

            expect(allowed).to.deep.equal([ownPrivate]);
            expect(needsReferenceCheck).to.have.lengthOf(0);
        });

        // This is the habit-proof case: a proof path is private, belongs to someone
        // else, and is referenced by no maps-service content, so the reference check
        // is what ends up refusing it.
        it('defers another user\'s private media to the reference check', () => {
            const { allowed, needsReferenceCheck } = partitionByOwnership([othersPrivate], 'user-1');

            expect(allowed).to.have.lengthOf(0);
            expect(needsReferenceCheck).to.deep.equal([othersPrivate]);
        });

        it('defers everything private for an unauthenticated caller', () => {
            const { allowed, needsReferenceCheck } = partitionByOwnership([ownPrivate, publicMedia], undefined);

            expect(allowed).to.deep.equal([publicMedia]);
            expect(needsReferenceCheck).to.deep.equal([ownPrivate]);
        });

        it('drops entries with no path', () => {
            const { allowed, needsReferenceCheck } = partitionByOwnership([{ path: '', type: 'x' } as any], 'user-1');

            expect(allowed).to.have.lengthOf(0);
            expect(needsReferenceCheck).to.have.lengthOf(0);
        });
    });
});
