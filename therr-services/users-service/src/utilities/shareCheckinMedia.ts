import path from 'path';
import { Content } from 'therr-js-utilities/constants';
import { storage } from '../api/aws';
import { PROOF_MEDIA_TYPE } from './checkinProofs';

/**
 * Copy a check-in proof image from the private bucket into the public bucket so it can back a
 * public post, and hand back the new public path.
 *
 * WHY COPY RATHER THAN REFERENCE (see docs/WORK_IN_PROGRESS.md 2.6.8)
 *
 * Three independent reasons, any one of which is sufficient:
 *  - Proofs live in the private bucket (`PROOF_MEDIA_TYPE === USER_IMAGE_PRIVATE`); a public
 *    thought needs a public-bucket object, because the client resolves `USER_IMAGE_PUBLIC`
 *    media against the public ImageKit endpoint with no signed round-trip.
 *  - Nothing has necessarily moderated the proof for a public audience yet, and the copy is
 *    the natural object to run the content check against before the post is created.
 *  - The two objects have independent lifecycles: deleting the check-in must not retract a
 *    post that has replies, and deleting the post must not destroy the user's own record.
 *
 * The destination path is deterministic per check-in (`{userId}/content/shared_checkin_{checkinId}`),
 * so a repeat share overwrites the same object rather than accumulating orphans — the handler's
 * `sharedThoughtId` short-circuit means that normally never happens, but a share that failed
 * after the copy but before the thought was written leaves one recoverable object, not many.
 */
export const buildSharedCheckinPublicPath = (userId: string, checkinId: string, sourcePath: string): string => {
    const ext = path.extname(sourcePath) || '.jpg';
    return `${userId}/content/shared_checkin_${checkinId}${ext}`;
};

export const copyProofToPublicBucket = async (
    userId: string,
    checkinId: string,
    proofPath: string,
): Promise<{ path: string; type: string }> => {
    const privateBucketName = process.env.BUCKET_PRIVATE_USER_DATA || '';
    const publicBucketName = process.env.BUCKET_PUBLIC_USER_DATA || '';

    const destinationPath = buildSharedCheckinPublicPath(userId, checkinId, proofPath);

    const sourceFile = storage.bucket(privateBucketName).file(proofPath);
    const destinationFile = storage.bucket(publicBucketName).file(destinationPath);

    await sourceFile.copy(destinationFile);

    return {
        path: destinationPath,
        type: Content.mediaTypes.USER_IMAGE_PUBLIC,
    };
};

/**
 * Best-effort cleanup of a public copy when the share is abandoned (e.g. moderation rejected it).
 * Never throws: an orphaned public object is a lifecycle-rule problem, not a request failure.
 */
export const deleteSharedCheckinPublicObject = (publicPath: string): Promise<void> => {
    const publicBucketName = process.env.BUCKET_PUBLIC_USER_DATA || '';
    return storage
        .bucket(publicBucketName)
        .file(publicPath)
        .delete({ ignoreNotFound: true })
        .then(() => undefined)
        .catch(() => undefined);
};

// Re-exported for symmetry / discoverability alongside the copy: the source bucket is derived
// from the proof media type, which is always private today.
export const PROOF_SOURCE_MEDIA_TYPE = PROOF_MEDIA_TYPE;
