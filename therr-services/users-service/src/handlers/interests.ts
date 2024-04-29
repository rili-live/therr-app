// import { RequestHandler } from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getInterests = (req, res) => Store.interests.getByCategoryGroups()
    .then((results) => res.status(200).send(results))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:INTERESTS_ROUTES:ERROR' }));

export {
    getInterests,
};
