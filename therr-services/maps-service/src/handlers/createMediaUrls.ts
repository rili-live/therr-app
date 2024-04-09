import { Content } from 'therr-js-utilities/constants';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import getBucket from '../utilities/getBucket';
import { storage } from '../api/aws';

// POST
// TODO: This needs more security logic to ensure the requesting user has permissions to view
// non-public images
const createMediaUrls = (req, res) => {
    // TODO: Check that the user has access to this media
    const userId = req.headers['x-userid'];
    const { mediaIds, ttl, medias } = req.body;
    const imageExpireTime = ttl || (Date.now() + 60 * 60 * 1000); // 60 minutes
    const sanitizedIds = (mediaIds || []).filter((id) => id.length > 0);

    // TODO: This provides temporary backwards compatibility
    // We can remove mediaIds after full refactor of frontend
    const fetchPrivateMediaPromise = medias?.length
        ? Promise.resolve(medias)
        : Store.media.get(sanitizedIds);

    return fetchPrivateMediaPromise.then((media) => {
        const urlPromises: Promise<any>[] = [];
        media.forEach((m) => {
            const bucket = getBucket(m.type);
            if (bucket) {
                let promise;
                if (bucket === getBucket(Content.mediaTypes.USER_IMAGE_PUBLIC)) {
                    promise = Promise.resolve({
                        [m.path]: `${process.env.IMAGE_KIT_URL}${m.path}`,
                    });
                } else if (bucket === getBucket(Content.mediaTypes.USER_IMAGE_PRIVATE)) {
                    // NOTE: Private media should require authorization
                    promise = Promise.resolve({
                        [m.path]: `${process.env.IMAGE_KIT_URL_PRIVATE}${m.path}`,
                    });
                } else {
                    promise = storage
                        .bucket(bucket)
                        .file(m.path)
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
                            [m.path]: urls[0],
                        }))
                        .catch((err) => {
                            console.log(err);
                            return {};
                        });
                }
                // TODO: Consider alternatives to cache these urls (per user) and their expire time

                urlPromises.push(promise);
            } else {
                console.log('MomentsStore.ts: bucket is undefined');
            }
        });

        return Promise.all(urlPromises).then((mediaUrls) => res.status(201).send({
            media: mediaUrls.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:MEDIA_ROUTES:ERROR' }));
};

export default createMediaUrls;
