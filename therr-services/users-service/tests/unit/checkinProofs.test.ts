import { expect } from 'chai';
import { Content } from 'therr-js-utilities/constants';
import {
    PROOF_MEDIA_TYPE,
    canReadProofs,
    serializeProofs,
} from '../../src/utilities/checkinProofs';

/**
 * `GET /habits/checkins/:id/proofs` — ownership gate and row serialization.
 *
 * The handler around these is Express plumbing (parse headers, 404/403, send);
 * the two things worth pinning are the access rule, because a proof path IS the
 * access control for the image behind it, and the emitted media `type`, because
 * getting it wrong resolves the URL against the wrong bucket and fails silently
 * as a broken image.
 */
describe('checkinProofs', () => {
    describe('canReadProofs', () => {
        it('allows the check-in owner', () => {
            expect(canReadProofs({ userId: 'user-1' }, 'user-1')).to.deep.equal({ allowed: true });
        });

        it('reports notFound for a missing check-in', () => {
            expect(canReadProofs(null, 'user-1')).to.deep.equal({ allowed: false, error: 'notFound' });
            expect(canReadProofs(undefined, 'user-1')).to.deep.equal({ allowed: false, error: 'notFound' });
        });

        it('refuses another user, including a pact partner', () => {
            // A partner sees *that* a check-in happened — that is the
            // accountability signal — but the photo is not part of it.
            expect(canReadProofs({ userId: 'user-1' }, 'partner-2')).to.deep.equal({
                allowed: false,
                error: 'forbidden',
            });
        });

        it('compares ids as strings so a numeric header does not bypass the gate', () => {
            expect(canReadProofs({ userId: '42' } as any, 42 as any)).to.deep.equal({ allowed: true });
            expect(canReadProofs({ userId: '42' } as any, 43 as any)).to.deep.equal({
                allowed: false,
                error: 'forbidden',
            });
        });
    });

    describe('serializeProofs', () => {
        const baseRow = {
            id: 'proof-1',
            checkinId: 'checkin-1',
            mediaType: 'image',
            mediaPath: 'user-1/content/habits_proof_goal-1_123.jpeg',
            createdAt: new Date('2026-08-20T10:00:00.000Z'),
        };

        it('emits the private-bucket media type, not the image/video kind', () => {
            // `getBucket` keys on Content.mediaTypes.*; handing it 'image' falls
            // through to the public bucket, where the object does not exist.
            const [proof] = serializeProofs([baseRow]);

            expect(proof.type).to.equal(Content.mediaTypes.USER_IMAGE_PRIVATE);
            expect(PROOF_MEDIA_TYPE).to.equal(Content.mediaTypes.USER_IMAGE_PRIVATE);
            expect(proof.mediaType).to.equal('image');
            expect(proof.path).to.equal(baseRow.mediaPath);
        });

        it('serializes timestamps as ISO strings and absent ones as null', () => {
            const [proof] = serializeProofs([baseRow]);

            expect(proof.createdAt).to.equal('2026-08-20T10:00:00.000Z');
            expect(proof.capturedAt).to.equal(null);
            expect(proof.thumbnailPath).to.equal(null);
            expect(proof.verificationStatus).to.equal(null);
        });

        it('passes through a video row and its thumbnail', () => {
            const [proof] = serializeProofs([{
                ...baseRow,
                mediaType: 'video',
                thumbnailPath: 'user-1/content/thumb.jpeg',
                capturedAt: '2026-08-20T09:30:00.000Z',
                verificationStatus: 'pending',
            }]);

            expect(proof.mediaType).to.equal('video');
            expect(proof.thumbnailPath).to.equal('user-1/content/thumb.jpeg');
            expect(proof.capturedAt).to.equal('2026-08-20T09:30:00.000Z');
            expect(proof.verificationStatus).to.equal('pending');
        });

        it('treats an unrecognized media kind as an image rather than passing it on', () => {
            const [proof] = serializeProofs([{ ...baseRow, mediaType: 'audio' }]);

            expect(proof.mediaType).to.equal('image');
        });

        it('drops rows with no path instead of returning an unrenderable tile', () => {
            const proofs = serializeProofs([
                baseRow,
                { ...baseRow, id: 'proof-2', mediaPath: '' },
                null as any,
            ]);

            expect(proofs.map((p) => p.id)).to.deep.equal(['proof-1']);
        });

        it('tolerates an empty or absent row set', () => {
            expect(serializeProofs([])).to.deep.equal([]);
            expect(serializeProofs(undefined as any)).to.deep.equal([]);
        });
    });
});
