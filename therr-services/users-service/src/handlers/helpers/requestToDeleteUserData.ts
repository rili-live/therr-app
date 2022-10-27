import axios from 'axios';
import globalConfig from '../../../../../global-config';

const requestToDeleteUserData = (headers) => {
    const mapServicePromise = axios({
        method: 'delete',
        url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/delete-user-data`,
        headers,
        data: {},
    });
    const reactionsServicePromise = axios({
        method: 'delete',
        url: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}/delete-user-data`,
        headers,
        data: {},
    });

    const promises = [mapServicePromise, reactionsServicePromise];

    return Promise.all(promises).catch((err) => {
        // TODO: Log error to Honeycomb with deleted user's ID
        console.log('Failed to delete user data', err);
    });
};

export default requestToDeleteUserData;
