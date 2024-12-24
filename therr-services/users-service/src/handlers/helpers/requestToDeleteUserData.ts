import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import globalConfig from '../../../../../global-config';

const requestToDeleteUserData = (headers: InternalConfigHeaders) => {
    // TODO: Delete messages in messages service
    // TODO: Delete notifications in notifications service
    // TODO: Delete forums in messages service
    const mapServicePromise = internalRestRequest({
        headers,
    }, {
        method: 'delete',
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/delete-user-data`,
        data: {},
    });
    const reactionsServicePromise = internalRestRequest({
        headers,
    }, {
        method: 'delete',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/delete-user-data`,
        data: {},
    });

    const promises = [mapServicePromise, reactionsServicePromise];

    return Promise.all(promises).catch((err) => {
        // TODO: Log error to Honeycomb with deleted user's ID
        console.log('Failed to delete user data', err);
    });
};

export default requestToDeleteUserData;
