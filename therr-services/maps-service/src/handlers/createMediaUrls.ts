import { Content } from 'therr-js-utilities/constants';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import getBucket from '../utilities/getBucket';
import { storage } from '../api/aws';
import { IRequestedMedia, partitionByOwnership } from '../utilities/mediaAccess';

/**
 * Resolve display URLs for media the caller names.
 *
 * Authorization matters more here than the signing does. Private-bucket media
 * resolves to a **deterministic** `IMAGE_KIT_URL_PRIVATE` URL rather than a signed
 * one, so handing back a URL for a path is equivalent to handing back the image
 * itself, permanently. Until now the handler resolved any path any caller named.
 *
 * Three tiers, in cost order:
 *
 * 1. Public-bucket media resolves unconditionally — the bucket is public, so
 *    withholding a URL protects nothing and only breaks rendering.
 * 2. Private media under the caller's own `<userId>/` prefix resolves with no
 *    database round trip. This is the common case (drafts, a user's own proofs).
 * 3. Anything else must be justified by a moment, space or event that references
 *    the path — which is how the nearby feed and map legitimately render another
 *    user's private area image.
 *
 * Unresolvable paths are **omitted from the response rather than rejected**, the
 * same choice the reactions write allow-list makes. Clients batch a screenful of
 * paths into one call and already handle a path coming back absent
 * (`!content?.media[media.path]` in `NearbyWrapper`); a 403 for the batch would
 * blank every image in it, including the ones the caller is entitled to.
 */
const resolveUrl = (media: IRequestedMedia, imageExpireTime: number): Promise<Record<string, string>> | null => {
    const bucket = getBucket(media.type);

    if (!bucket) {
        console.log('createMediaUrls.ts: bucket is undefined');
        return null;
    }

    if (bucket === getBucket(Content.mediaTypes.USER_IMAGE_PUBLIC)) {
        return Promise.resolve({
            [media.path]: `${process.env.IMAGE_KIT_URL}${media.path}`,
        });
    }

    if (bucket === getBucket(Content.mediaTypes.USER_IMAGE_PRIVATE)) {
        return Promise.resolve({
            [media.path]: `${process.env.IMAGE_KIT_URL_PRIVATE}${media.path}`,
        });
    }

    return storage
        .bucket(bucket)
        .file(media.path)
        .getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: imageExpireTime,
            // TODO: Test is cache-control headers work here
            extensionHeaders: {
                'Cache-Control': 'public, max-age=43200', // 1 day
            },
        })
        .then((urls) => ({
            [media.path]: urls[0],
        }))
        .catch((err) => {
            console.log(err);
            return {};
        });
};

// POST
const createMediaUrls = (req, res) => {
    const userId = req.headers['x-userid'];
    const { mediaIds, ttl, medias } = req.body;
    const imageExpireTime = ttl || (Date.now() + 60 * 60 * 1000); // 60 minutes
    const sanitizedIds = (mediaIds || []).filter((id) => id.length > 0);

    // TODO: This provides temporary backwards compatibility
    // We can remove mediaIds after full refactor of frontend
    const fetchPrivateMediaPromise: Promise<IRequestedMedia[]> = medias?.length
        ? Promise.resolve(medias)
        : Store.media.get(sanitizedIds);

    return fetchPrivateMediaPromise.then((media) => {
        const { allowed, needsReferenceCheck } = partitionByOwnership(media, userId);

        const authorizedPromise: Promise<IRequestedMedia[]> = needsReferenceCheck.length
            ? Store.contentMedia
                .getReferencedPaths(needsReferenceCheck.map((m) => m.path))
                .then((referenced) => {
                    const referencedSet = new Set(referenced);

                    return allowed.concat(needsReferenceCheck.filter((m) => referencedSet.has(m.path)));
                })
            : Promise.resolve(allowed);

        return authorizedPromise.then((authorized) => {
            const urlPromises = authorized
                .map((m) => resolveUrl(m, imageExpireTime))
                .filter((promise): promise is Promise<Record<string, string>> => !!promise);

            // TODO: Consider alternatives to cache these urls (per user) and their expire time
            return Promise.all(urlPromises).then((mediaUrls) => res.status(201).send({
                media: mediaUrls.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
            }));
        });
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:MEDIA_ROUTES:ERROR' }));
};

export default createMediaUrls;
