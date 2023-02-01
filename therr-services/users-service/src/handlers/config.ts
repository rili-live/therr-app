import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';

const parseConfigValue = (value, type) => {
    if (type === 'BOOLEAN') {
        if (value === 'false' || value === 'FALSE' || value === '0') {
            return false;
        }
        return !!value;
    }
    if (type === 'STRING') {
        return value;
    }
    if (type === 'NUMBER') {
        return Number(value);
    }
    if (type === 'DATE') {
        return new Date(value);
    }

    return value;
};

// READ
const getConfigByKey = (req, res) => Store.config.get(req.params.key)
    .then((results) => {
        if (!results?.length) {
            return handleHttpError({
                res,
                message: 'Config key not found',
                statusCode: 404,
            });
        }

        const configValue = parseConfigValue(results[0].value, results[0].type);

        return res.status(200).send({ [results[0].key]: configValue });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));

export {
    getConfigByKey,
    parseConfigValue,
};
