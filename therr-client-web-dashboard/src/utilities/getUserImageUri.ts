import * as globalConfig from '../../../global-config';

const envVars = globalConfig[process.env.NODE_ENV];

const getUserImageUri = (user, size = 200) => {
    if (user.details?.media?.profilePicture) {
        return `${envVars.baseApiGatewayRoute}/user-files/${user.details.media.profilePicture.path}`;
    }

    return `https://robohash.org/${user.details?.id}?set=set1&size=${size}x${size}`;
};

export default getUserImageUri;
