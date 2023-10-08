import * as globalConfig from '../../../global-config';

const envVars = globalConfig[process.env.NODE_ENV];

const IMAGE_KIT_URL = 'https://ik.imagekit.io/qmtvldd7sl/';

const getUserImageUri = (user, size = 200) => {
    if (user.details?.media?.profilePicture) {
        // return `${envVars.baseApiGatewayRoute}/user-files/${user.details.media.profilePicture.path}`; // PRE-IMAGE_KIT
        return `${IMAGE_KIT_URL}${user.details.media.profilePicture.path}`; // POST-IMAGE_KIT
    }

    return `https://robohash.org/${user.details?.id}?set=set1&size=${size}x${size}`;
};

export default getUserImageUri;
