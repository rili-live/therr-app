// import { RequestHandler } from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getInterests = (req, res) => Store.interests.get({}, ['id', 'tag', 'emoji', 'displayName', 'category'])
    .then((results) => {
        const interestsByCategory = results?.reduce((acc, cur) => {
            if (!acc[cur.category]) {
                acc[cur.category] = [cur];
            } else {
                acc[cur.category].push(cur);
            }

            return acc;
        }, {});
        return res.status(200).send(interestsByCategory);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:INTERESTS_ROUTES:ERROR' }));

export {
    getInterests,
};
