import client from 'https';
import path from 'path';
import handleHttpError from '../../utilities/handleHttpError';
import { storage } from '../../api/aws';

const guessCategoryFromText = (text?: string) => {
    if (text?.includes('food')) {
        return 'food';
    }
    if (text?.includes('music')) {
        return 'music';
    }
    if (text?.includes('art')) {
        return 'art';
    }
    if (text?.includes('nature')) {
        return 'nature';
    }
    return 'uncategorized';
};

// TODO: Improve
const getStorageFilepath = (filename, {
    requestId,
    userId,
}) => {
    const parsedFileName = path.parse(filename);
    const directory = parsedFileName.dir ? `${parsedFileName.dir}/` : '';

    return `${userId}/${directory}${parsedFileName.name}_${requestId}${parsedFileName.ext}`;
};

const fetchSignedUrl = ({
    userId,
    requestId,
}, {
    action,
    filename,
    bucket,
}) => {
    const options: any = {
        version: 'v4',
        action,
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    const filePath = getStorageFilepath(filename, {
        requestId,
        userId,
    });

    return storage
        .bucket(bucket)
        .file(filePath)
        .getSignedUrl(options)
        .then((url) => [url, filePath]);
};

const getSupportedIntegrations = (platform, {
    accessToken,
    mediaId,
}) => {
    if (platform === 'instagram') {
        // eslint-disable-next-line max-len
        return `https://graph.instagram.com/${mediaId}?fields=id,media_type,media_url,thumbnail_url,caption,permalink,username,timestamp&access_token=${accessToken}`;
    }

    return '';
};

const getSignedUrlResponse = (req, res, bucket) => {
    const requestId = req.headers['x-requestid'];
    const userId = req.headers['x-userid'];

    const {
        action,
        filename,
    } = req.query;

    fetchSignedUrl({
        userId,
        requestId,
    }, {
        action,
        filename,
        bucket,
    })
        .then(([url, filePath]) => res.status(201).send({
            url,
            path: `${filePath}`,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

const streamUploadFile = (fileUrl, filename, {
    requestId,
    userId,
}): Promise<string> => {
    const storageBucket = storage.bucket(process.env.BUCKET_PUBLIC_USER_DATA || '');
    const storageFilePath = getStorageFilepath(filename, {
        requestId,
        userId,
    });
    const storageFile = storageBucket.file(storageFilePath);

    return new Promise((resolve, reject) => {
        const request = client.get(fileUrl, (res) => {
            if (res.statusCode === 200) {
                res.pipe(storageFile.createWriteStream())
                    .on('error', (err) => {
                        reject(err);
                    })
                    .on('finish', () => resolve(storageFilePath));
            } else {
                // Consume response data to free up memory
                res.resume();
                return reject(new Error(`Request to get image failed with a status code: ${res.statusCode}`));
            }
        });

        request.on('error', (err) => reject(new Error(`Error while trying to get image: ${err}`)));
    });
};

export {
    guessCategoryFromText,
    fetchSignedUrl,
    getSupportedIntegrations,
    getSignedUrlResponse,
    streamUploadFile,
};
