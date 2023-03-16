import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import getBucket from '../utilities/getBucket';
import { storage } from '../api/aws';

// POST
// TODO: This needs more security logic to ensure the requesting user has permissions to view
// non-public images
const createMediaUrls = (req, res) => {
    const userId = req.headers['x-userid'];
    const { mediaIds, ttl } = req.body;
    const imageExpireTime = ttl || (Date.now() + 60 * 60 * 1000); // 60 minutes

    return Store.media.get(mediaIds).then((media) => {
        const urlPromises: Promise<any>[] = [];
        media.forEach((m) => {
            const bucket = getBucket(m.type);
            if (bucket) {
                // TODO: Consider alternatives to cache these urls (per user) and their expire time
                const promise = storage
                    .bucket(bucket)
                    .file(m.path)
                    .getSignedUrl({
                        version: 'v4',
                        action: 'read',
                        expires: imageExpireTime,
                    })
                    .then((urls) => ({
                        [m.id]: urls[0],
                    }))
                    .catch((err) => {
                        console.log(err);
                        return {};
                    });
                urlPromises.push(promise);
            }
            console.log('MometsStore.ts: bucket is undefined');
        });

        return Promise.all(urlPromises).then((mediaUrls) => res.status(201).send({
            media: mediaUrls.reduce((prev: any, curr: any) => ({ ...curr, ...prev }), {}),
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:MEDIA_ROUTES:ERROR' }));
};

export default createMediaUrls;
