import logSpan from 'therr-js-utilities/log-or-update-span';
import { checkIsMediaSafeForWork } from '../handlers/helpers';
import Store from '../store';
import { PROOF_MEDIA_TYPE } from './checkinProofs';

/**
 * Run the same content check the moments upload path runs, over check-in proofs.
 *
 * Deliberately **not** awaited by the check-in handler, and deliberately not able
 * to fail it. Two reasons, and they point the same way:
 *
 * - The check-in is the product's core loop and its whole design commits on the
 *   first tap (§ 2.6.1); making it wait on a third-party HTTP call, or fail when
 *   Sightengine is down, would undo that for a check no user is waiting on.
 * - Proofs are owner-only today (`canReadProofs`), so an unmoderated proof is
 *   visible to exactly one person: the user who uploaded it. The moderation
 *   result matters at the moment a proof is *shared* — which is what makes this
 *   a prerequisite for sharing a check-in publicly rather than a gate on
 *   check-in itself.
 *
 * `checkIsMediaSafeForWork` fails **closed**, returning false when signing or the
 * Sightengine call throws. That asymmetry is right for a share gate and wrong for
 * a permanent record, so a thrown error is recorded as `pending` — still
 * unverified, still not shareable — rather than as `rejected`, which would
 * accuse a user of posting something unsafe because a vendor had an outage.
 */
const moderateProofs = (proofs: { id: string; mediaPath: string }[]): Promise<void> => {
    if (!proofs?.length) {
        return Promise.resolve();
    }

    return Promise.all(proofs.map((proof) => checkIsMediaSafeForWork([{
        type: PROOF_MEDIA_TYPE,
        path: proof.mediaPath,
    }])
        .then((isSafeForWork) => Store.proofs.setModerationResult(proof.id, {
            isSafeForWork,
            verificationStatus: isSafeForWork ? 'auto_verified' : 'flagged',
            moderationFlags: { provider: 'sightengine', isSafeForWork, checkedAt: new Date().toISOString() },
        }))
        .catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['proof moderation failed'],
                traceArgs: {
                    'error.message': err?.message,
                    'proof.id': proof.id,
                },
            });
        }))).then(() => undefined);
};

export default moderateProofs;
