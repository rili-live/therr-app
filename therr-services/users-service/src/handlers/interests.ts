// import { RequestHandler } from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getInterests = (req, res) => Store.interests.get({}, ['id', 'tag', 'emoji', 'displayNameKey', 'categoryKey'])
    .then((results) => {
        const interestsByCategory = results?.reduce((acc, cur) => {
            if (!acc[cur.categoryKey]) {
                acc[cur.categoryKey] = [cur];
            } else {
                acc[cur.categoryKey].push(cur);
            }

            return acc;
        }, {});
        return res.status(200).send(interestsByCategory);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:INTERESTS_ROUTES:ERROR' }));

export {
    getInterests,
};
