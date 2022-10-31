import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// DELETE
/**
 * When a user is deleted, this endpoint is requested to delete all user related data
 */
const deleteUserData = (req, res) => {
    const userId = req.headers['x-userid'];
    // TODO: RSERV-52 | Consider archiving only, and delete/archive associated reactions from reactions-service

    const momentsPromise = Store.momentReactions.delete(userId);

    const spacesPromise = Store.spaceReactions.delete(userId);

    const promises = [momentsPromise, spacesPromise];

    Promise.all(promises)
        .then(([momentReactions, spaceReactions]) => res.status(202).send({ momentReactions, spaceReactions }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

export default deleteUserData;
