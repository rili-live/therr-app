import { getBrandContext } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import {
    getAppVersionConfigKeys,
    normalizeAppOs,
    resolveAppVersionPolicy,
} from '../utilities/appVersionPolicy';

// READ
// Tells a mobile build whether it is behind. See utilities/appVersionPolicy.ts for the
// `main.config` rows that drive it.
const getAppVersionPolicy = (req, res) => {
    const { brandVariation } = getBrandContext(req.headers);
    const os = normalizeAppOs(req.headers['x-app-os']);
    const currentVersion = req.headers['x-app-version'];

    // Web clients and pre-header installs have nothing to compare, so there is no policy to read.
    if (!os || !currentVersion) {
        return res.status(200).send(resolveAppVersionPolicy({ currentVersion }));
    }

    const keys = getAppVersionConfigKeys(brandVariation, os);

    return Store.config.getMany([keys.minimum, keys.recommended])
        .then((rows: { key: string; value: string }[]) => {
            const valueByKey = (rows || []).reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

            return res.status(200).send(resolveAppVersionPolicy({
                currentVersion,
                minimumVersion: valueByKey[keys.minimum],
                recommendedVersion: valueByKey[keys.recommended],
            }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:APP_VERSION_ROUTES:ERROR' }));
};

export {
    getAppVersionPolicy,
};
