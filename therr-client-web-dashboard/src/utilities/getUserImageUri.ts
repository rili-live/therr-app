import * as globalConfig from '../../../global-config';

const BASE_ENDPOINT = globalConfig.baseImageKitEndpoint ? globalConfig.baseImageKitEndpoint : `${globalConfig.baseApiGatewayRoute}/user-files/`;

const getUserImageUri = (user, size = 200) => {
    if (user.details?.media?.profilePicture) {
        /**
         * In the max-size crop strategy, whole image content is preserved (no cropping),
         * the aspect ratio is preserved, but one of the dimensions (height or width) is adjusted.
         */
        return `${BASE_ENDPOINT}${user.details.media.profilePicture.path}?tr=${size},${size}`;
    }

    return `https://robohash.org/${user.details?.id}?set=set1&size=${size}x${size}`;
};

export default getUserImageUri;
