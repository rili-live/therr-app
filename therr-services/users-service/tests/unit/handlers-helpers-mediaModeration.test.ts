import { expect } from 'chai';
import { Content } from 'therr-js-utilities/constants';
import { checkIsMediaSafeForWork } from '../../src/handlers/helpers';

/**
 * `checkIsMediaSafeForWork` is the content gate in front of two things that publish a user's
 * image: `utilities/moderateProofs` and the public check-in share in `handlers/habitCheckins`.
 * Both document it as failing closed, so the cases where it can answer "safe" without having
 * looked at anything are the ones worth pinning.
 *
 * These cases never reach GCS or Sightengine — the function decides before signing a URL — so
 * no network stubbing is needed.
 */
describe('checkIsMediaSafeForWork — decisions made without inspecting content', () => {
    const publicBucket = process.env.BUCKET_PUBLIC_USER_DATA;
    const privateBucket = process.env.BUCKET_PRIVATE_USER_DATA;

    afterEach(() => {
        process.env.BUCKET_PUBLIC_USER_DATA = publicBucket || '';
        process.env.BUCKET_PRIVATE_USER_DATA = privateBucket || '';
    });

    it('rejects public media when no bucket is configured, rather than auto-approving it', async () => {
        // An unset BUCKET_PUBLIC_USER_DATA used to return true here: no signed URL, no
        // Sightengine call, no log line — every image silently approved for a public post.
        delete process.env.BUCKET_PUBLIC_USER_DATA;

        const isSafe = await checkIsMediaSafeForWork([
            { type: Content.mediaTypes.USER_IMAGE_PUBLIC, path: 'user-1/content/shared_checkin_c1.jpg' },
        ]);

        expect(isSafe).to.equal(false);
    });

    it('rejects private proof media when no bucket is configured', async () => {
        // Same gate, the other bucket — this is the path moderateProofs takes.
        delete process.env.BUCKET_PRIVATE_USER_DATA;

        const isSafe = await checkIsMediaSafeForWork([
            { type: Content.mediaTypes.USER_IMAGE_PRIVATE, path: 'user-1/content/habits_proof_c1.jpg' },
        ]);

        expect(isSafe).to.equal(false);
    });

    it('allows an empty media list — there is nothing to moderate', async () => {
        // Callers pass [] for a post with no image; that must stay a pass, or every
        // text-only thought would be rejected.
        expect(await checkIsMediaSafeForWork([])).to.equal(true);
    });
});
