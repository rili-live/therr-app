import { distanceTo } from 'geolocation-utils';
import { IAreaType } from 'therr-js-utilities/types';
import { isMyContent } from './content';

const isAreaActivated = (type: IAreaType, area, user, reactions) => {
    if (isMyContent(area, user)) {
        return true;
    }

    if (type === 'moments') {
        return !!reactions.myMomentReactions[area.id];
    }

    return !!reactions.mySpaceReactions[area.id];
};

const getNearbySpaces = (center, user, reactions, spaces) => Object.values(spaces).filter((space: any) => {
    if (!isAreaActivated('spaces', space, user, reactions)) {
        return false;
    }
    // TODO: Use the incentiveRequirements if provided to determine if the user is within distance
    let distanceToNearbySpace = distanceTo({
        lon: center.longitude,
        lat: center.latitude,
    }, {
        // TODO: Use search polygon rather than rough estimate radius
        lon: space.longitude,
        lat: space.latitude,
    });

    console.log(distanceToNearbySpace);

    // Distance in meters (roughly 400 feet)
    return distanceToNearbySpace < 900000;
}).map((space: any) => ({ id: space.id, title: space.notificationMsg }));

export default getNearbySpaces;
