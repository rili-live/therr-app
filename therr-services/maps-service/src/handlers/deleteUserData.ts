import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// DELETE
/**
 * When a user is deleted, this endpoint is requested to delete all user related data
 */
const deleteUserData = (req, res) => {
    const userId = req.headers['x-userid'];
    // TODO: RSERV-52 | Consider archiving only, and delete/archive associated reactions from reactions-service
    // We must delete moments first since they may be associated to a space and have NO cascade on delete (this is intentional)
    const deletePosts = Store.moments.delete(userId)
        .then(([moments]) => {
            // TODO: update spaces and assign to super admin
            console.log('TODO');
            return [moments, []];
        }).then(([moments, spaces]) => ([moments, spaces]));

    deletePosts
        .then(([moments, spaces]) => res.status(202).send({ moments, spaces }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:MOMENTS_ROUTES:ERROR' }));
};

export default deleteUserData;
