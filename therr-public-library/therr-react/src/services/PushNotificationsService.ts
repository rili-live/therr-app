/* eslint-disable class-methods-use-this */
import axios from 'axios';

interface ILocationChangeDetails {
    latitude: number;
    longitude: number;
    lastLocationSendForProcessing: number;
    radiusOfAwareness: number;
    radiusOfInfluence: number;
}
class PushNotificationsService {
    postLocationChange = (data: ILocationChangeDetails) => axios({
        method: 'post',
        url: '/push-notifications-service/location/process-user-location',
        data,
    });
}

export default new PushNotificationsService();
