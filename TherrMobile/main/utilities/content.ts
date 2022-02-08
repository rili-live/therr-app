import { MapsService } from 'therr-react/services';
import getConfig from './getConfig';

const globalConfig = getConfig();

const isMyArea = (selectedMoment, user) => {
    return String(selectedMoment.fromUserId) === String(user.details.id);
};

const getUserImageUri = (user, size = 200) => {
    if (user.details?.media?.profilePicture) {
        return `${globalConfig.baseApiGatewayRoute}/user-files/${user.details.media.profilePicture.path}`;
    }

    return `https://robohash.org/${user.details?.id}?size=${size}x${size}`;
};

const signImageUrl = (isPublic: boolean, {
    action,
    filename,
}) => {
    const signUrl = isPublic ? MapsService.getSignedUrlPublicBucket : MapsService.getSignedUrlPrivateBucket;

    // TODO: This is too slow
    // Use public method for public moments
    return signUrl({
        action,
        filename: filename,
    });
};

export {
    getUserImageUri,
    isMyArea,
    signImageUrl,
};
