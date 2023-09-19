// import { RequestHandler } from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getUserOrganizations = (req, res) => Store.userOrganizations.get({
    userId: req.headers['x-userid'],
})
    .then((results) => res.status(200).send({
        userOrganizations: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));

export {
    getUserOrganizations,
};
