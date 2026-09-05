import { Content } from 'therr-js-utilities/constants';
import getBucket from './getBucket';

export interface IRequestedMedia {
    path: string;
    type: string;
}

/**
 * Does this path live in the private bucket?
 *
 * Keyed off `getBucket` rather than off the type string directly, because
 * `getBucket` falls through to the **public** bucket for anything it does not
 * recognize. Asking it the question keeps this in step with that fall-through:
 * an unrecognized type resolves publicly, so it is not private media and does
 * not need the ownership/reference check below.
 */
export const isPrivateMedia = (media: IRequestedMedia): boolean => {
    const bucket = getBucket(media.type);

    return !!bucket && bucket === getBucket(Content.mediaTypes.USER_IMAGE_PRIVATE);
};

/**
 * Every upload path is written under the uploader's own id — see the
 * `signImageUrl` handler, which prefixes `<userId>/` before the caller's
 * requested filename. So the first segment identifies the owner without a
 * lookup, which is what keeps the common case (a user resolving their own
 * drafts) free of a database round trip.
 *
 * Compared as whole segments: a plain `startsWith` would let user `abc` claim
 * `abcdef/content/...`.
 */
export const isOwnedBy = (path: string, userId: string | undefined): boolean => {
    if (!path || !userId) {
        return false;
    }

    const [owner, ...rest] = path.split('/');

    return rest.length > 0 && owner === String(userId);
};

/**
 * Split a requested batch into what may be resolved without asking the database,
 * and what still has to be justified by a piece of maps-service content.
 *
 * Public-bucket media is unconditional — the bucket is public, so withholding a
 * URL protects nothing and would only break rendering.
 */
export const partitionByOwnership = (
    medias: IRequestedMedia[],
    userId: string | undefined,
): { allowed: IRequestedMedia[]; needsReferenceCheck: IRequestedMedia[] } => {
    const allowed: IRequestedMedia[] = [];
    const needsReferenceCheck: IRequestedMedia[] = [];

    medias.forEach((media) => {
        if (!media?.path) {
            return;
        }

        if (!isPrivateMedia(media) || isOwnedBy(media.path, userId)) {
            allowed.push(media);
        } else {
            needsReferenceCheck.push(media);
        }
    });

    return { allowed, needsReferenceCheck };
};
