import { distanceTo } from 'geolocation-utils';
import { IAreaType } from 'therr-js-utilities/types';
import { isMyContent } from './content';
import { MAX_DISTANCE_TO_NEARBY_SPACE } from '../constants';

interface ILatLon {
    latitude: number;
    longitude: number;
}

const isAreaActivated = (type: IAreaType, area, user, reactions) => {
    if (isMyContent(area, user)) {
        return true;
    }

    if (type === 'events') {
        return !!reactions?.myEventReactions[area.id];
    }

    if (type === 'moments') {
        return !!reactions?.myMomentReactions[area.id];
    }

    return !!reactions?.mySpaceReactions[area.id];
};

const isValidCoord = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const getNearbySpaces = (center: ILatLon, user, reactions, spaces) => {
    if (!center || !isValidCoord(center.latitude) || !isValidCoord(center.longitude)) {
        return [];
    }

    return Object.values(spaces || {}).filter((space: any) => {
        if (!isAreaActivated('spaces', space, user, reactions)) {
            return false;
        }
        if (!isValidCoord(space?.latitude) || !isValidCoord(space?.longitude)) {
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

        return distanceToNearbySpace < MAX_DISTANCE_TO_NEARBY_SPACE;
    }).map((space: any) => ({ id: space.id, title: space.notificationMsg, featuredIncentiveRewardValue: space.featuredIncentiveRewardValue }));
};

export default getNearbySpaces;
