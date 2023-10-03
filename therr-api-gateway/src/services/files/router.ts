import express from 'express';
import handleHttpError from '../../utilities/handleHttpError';
import { storage } from '../../api/aws';
import { validate } from '../../validation';
import CacheStore from '../../store';

const filesRouter = express.Router();

filesRouter.get('/*', validate, async (req, res) => {
    try {
        const shouldCacheImages = (process.env.SHOULD_CACHE_IMAGES || '').toLowerCase() === 'true';
        const cachedFileData = shouldCacheImages && await CacheStore.filesService.getFile(req.path);
        if (cachedFileData) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
            return res.status(200).send(cachedFileData);
        }
        const sanitizedPath = req.path.substring(1);
        const file = storage
            .bucket(process.env.BUCKET_PUBLIC_USER_DATA || '')
            .file(sanitizedPath);
        const [meta] = await file.getMetadata();
        const pathSplit = req.path.split('.');
        const backupFileType = `image/${pathSplit[pathSplit.length - 1]}`;
        res.setHeader('Content-Type', meta.contentType || backupFileType);
        res.setHeader('Content-Length', meta.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        // res.setHeader('Content-Encoding', meta.contentEncoding);
        // use streams if >~ 2MB/s to lower memory usage.
        // if (meta.size > 2000000) {
        //     probably requires the fronend to readout the stream before loading the image
        //     return res.status(200).send(file.createReadStream());
        // }

        // downloading seems like a faster method (but uses more memory on container and could clog nodejs).
        return file.download()
            .then(([fileData]) => {
                if (shouldCacheImages) {
                    CacheStore.filesService.setFile(req.path, fileData);
                }
                return res.status(200).send(fileData);
            })
            .catch(() => res.status(404).send());
    } catch (err: any) {
        if (err.message?.includes('No such object')) {
            return res.status(404).send();
        }
        return handleHttpError({ err, res, message: 'SQL:FILES_ROUTES:ERROR' });
    }
});

export default filesRouter;
