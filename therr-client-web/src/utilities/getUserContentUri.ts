import * as globalConfig from '../../../global-config';

const BASE_ENDPOINT = globalConfig[process.env.NODE_ENV].baseImageKitEndpoint
    ? globalConfig[process.env.NODE_ENV].baseImageKitEndpoint
    : `${globalConfig[process.env.NODE_ENV].baseApiGatewayRoute}/user-files/`;

const getUserContentUri = (media, height = 1048, width = 1048, autocrop = false) => {
    let url = `${BASE_ENDPOINT}${media.path}`;
    url = `${url}?tr=h-${height},w-${width}`;
    if (!autocrop) {
        // Preserve original image dimensions
        url = `${url},c-at_least`;
    }
    return url;
};

export default getUserContentUri;
