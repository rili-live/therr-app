import { expect } from 'chai';
import { Content } from 'therr-js-utilities/constants';
import { buildSharedCheckinPublicPath, PROOF_SOURCE_MEDIA_TYPE } from '../../src/utilities/shareCheckinMedia';

/**
 * Sharing a check-in copies its private proof image into the public bucket so a public post can
 * carry it. The GCS copy itself needs a live client, but the destination path is pure and
 * load-bearing, so it is pinned here.
 *
 * The path is deterministic per check-in on purpose: a repeat share overwrites the same object
 * rather than accumulating orphans, and it stays inside the sharing user's own namespace so it
 * lands where every other of that user's content lives.
 */
describe('shareCheckinMedia', () => {
    describe('buildSharedCheckinPublicPath', () => {
        it('is deterministic per (user, check-in) and preserves the extension', () => {
            const path = buildSharedCheckinPublicPath('user-1', 'checkin-9', 'user-1/content/habits_proof_abc.jpg');
            expect(path).to.equal('user-1/content/shared_checkin_checkin-9.jpg');

            // Same inputs → same object, so a retry overwrites rather than duplicating.
            expect(buildSharedCheckinPublicPath('user-1', 'checkin-9', 'user-1/content/habits_proof_abc.jpg'))
                .to.equal(path);
        });

        it('carries a non-jpg extension through', () => {
            expect(buildSharedCheckinPublicPath('u', 'c', 'u/content/proof_x.png'))
                .to.equal('u/content/shared_checkin_c.png');
        });

        it('falls back to .jpg when the source path has no extension', () => {
            // A private proof path with no extension must still produce a valid public object key
            // rather than one ending in a bare dot.
            expect(buildSharedCheckinPublicPath('u', 'c', 'u/content/proof_no_ext'))
                .to.equal('u/content/shared_checkin_c.jpg');
        });

        it('nests the copy under the sharing user, not the source path owner', () => {
            // The first segment is always the passed userId, so the public object lands in the
            // sharer's namespace even if the proof path were ever shaped differently.
            expect(buildSharedCheckinPublicPath('owner-7', 'ck', 'someone/else/thing.jpg'))
                .to.equal('owner-7/content/shared_checkin_ck.jpg');
        });
    });

    describe('PROOF_SOURCE_MEDIA_TYPE', () => {
        it('is the private media type — proofs are always copied FROM the private bucket', () => {
            expect(PROOF_SOURCE_MEDIA_TYPE).to.equal(Content.mediaTypes.USER_IMAGE_PRIVATE);
        });
    });
});
